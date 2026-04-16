"""
sync.py — HubSpot → Supabase deals_current full sync.
Runs every 15 min via GitHub Actions.

Strategy:
  1. Fetch ALL deals in the pipeline from HubSpot (pipeline filter).
  2. Keep only active-stage deals.
  3. Upsert them all into deals_current.
  4. Delete any rows in deals_current NOT in the active set (stale cleanup).

This ensures deals_current always exactly mirrors the active pipeline.
If the fetch fails, we abort before touching Supabase — data stays intact.
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Local dev: load ../.env.local if present (no-op in GitHub Actions)
_env_file = Path(__file__).parent.parent / '.env.local'
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        if '=' in _line and not _line.startswith('#'):
            _k, _, _v = _line.partition('=')
            os.environ.setdefault(_k.strip(), _v.strip())
    # Map Next.js variable names → sync script names
    os.environ.setdefault('SUPABASE_URL',         os.environ.get('NEXT_PUBLIC_SUPABASE_URL', ''))
    os.environ.setdefault('SUPABASE_SERVICE_KEY',  os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''))

import httpx
from supabase import create_client

from config import PIPELINE_ID, ACTIVE_STAGE_IDS, STAGE_CATEGORY, STAGE_NAME_MAP

# ── Config ────────────────────────────────────────────────────────────────────

HUBSPOT_API_KEY      = os.environ["HUBSPOT_API_KEY"]
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HUBSPOT_BASE = "https://api.hubapi.com"
HEADERS      = {"Authorization": f"Bearer {HUBSPOT_API_KEY}"}

BASE_PROPERTIES = [
    "dealname",
    "dealstage",
    "createdate",
    "referent___owner",
    "notes_last_updated",
    "hs_lastmodifieddate",
    "notes_next_activity_date",
    "innbytte_",
    "type_lead",
]

# Safety guard: abort if HubSpot returns suspiciously few deals
# (protects against wiping Supabase on API errors / empty responses)
MIN_EXPECTED_DEALS = 100

# ── HubSpot ───────────────────────────────────────────────────────────────────

def search_stages_batch(stage_ids: list[str], properties: list[str]) -> list[dict]:
    """
    Search for deals in a batch of stages using filterGroups (OR logic).
    Max 5 filterGroups per HubSpot request — one EQ filter per stage.
    """
    url   = f"{HUBSPOT_BASE}/crm/v3/objects/deals/search"
    deals = []
    after = None

    filter_groups = [
        {"filters": [{"propertyName": "dealstage", "operator": "EQ", "value": sid}]}
        for sid in stage_ids
    ]

    while True:
        payload: dict = {
            "filterGroups": filter_groups,
            "properties":   properties,
            "limit":        100,
        }
        if after:
            payload["after"] = after

        r = httpx.post(url, headers=HEADERS, json=payload, timeout=30)
        if not r.is_success:
            print(f"  HubSpot error {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()
        data = r.json()
        deals.extend(data.get("results", []))

        after = data.get("paging", {}).get("next", {}).get("after")
        if not after:
            break

    return deals


def fetch_all_pipeline_deals(properties: list[str]) -> list[dict]:
    """
    Fetch all deals in active stages by batching stages into groups of 5
    (HubSpot max filterGroups per request). Each batch uses OR logic via
    filterGroups with dealstage EQ — avoids the 400 from dealstage IN.
    """
    BATCH = 5
    all_deals: list[dict] = []

    for i in range(0, len(ACTIVE_STAGE_IDS), BATCH):
        batch = ACTIVE_STAGE_IDS[i : i + BATCH]
        deals = search_stages_batch(batch, properties)
        all_deals.extend(deals)
        print(f"  Batch {i // BATCH + 1}: {len(deals)} deals (stages {i+1}–{min(i+BATCH, len(ACTIVE_STAGE_IDS))})")

    # Deduplicate — a deal could appear in multiple batches if stage changed mid-fetch
    seen: dict[str, dict] = {}
    for d in all_deals:
        seen[d["id"]] = d

    return list(seen.values())


# ── Transform ─────────────────────────────────────────────────────────────────

def to_row(deal: dict) -> dict:
    p        = deal.get("properties", {})
    stage_id = p.get("dealstage")
    return {
        "deal_id":            deal["id"],
        "deal_name":          p.get("dealname"),
        "owner_id":           p.get("referent___owner"),
        "stage_id":           stage_id,
        "stage_name":         STAGE_NAME_MAP.get(stage_id),
        "create_date":        p.get("createdate"),
        "last_activity_at":   p.get("notes_last_updated"),
        "last_modified_at":   p.get("hs_lastmodifieddate"),
        "next_activity_date": (p.get("notes_next_activity_date") or "")[:10] or None,
        "innbytte_":          p.get("innbytte_"),
        "type_lead":          p.get("type_lead"),
        "category":           STAGE_CATEGORY.get(stage_id),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Pipeline: {PIPELINE_ID}")

    print("Fetching all pipeline deals from HubSpot…")
    all_deals = fetch_all_pipeline_deals(BASE_PROPERTIES)
    print(f"  {len(all_deals)} total deals in pipeline")

    active_deals = [
        d for d in all_deals
        if d.get("properties", {}).get("dealstage") in ACTIVE_STAGE_IDS
    ]
    print(f"  {len(active_deals)} in active stages")

    # Safety guard — abort if result looks wrong rather than wiping Supabase
    if len(active_deals) < MIN_EXPECTED_DEALS:
        raise RuntimeError(
            f"Only {len(active_deals)} active deals returned — expected at least "
            f"{MIN_EXPECTED_DEALS}. Aborting to protect Supabase data."
        )

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    rows      = [to_row(d) for d in active_deals]
    active_ids = {r["deal_id"] for r in rows}

    # Upsert all active deals (no empty-table window)
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        supabase.table("deals_current").upsert(
            rows[i : i + batch_size], on_conflict="deal_id"
        ).execute()
    print(f"  Upserted {len(rows)} deals")

    # Delete only the stale records (current in DB but not in this sync)
    existing  = supabase.table("deals_current").select("deal_id").execute()
    stale_ids = [r["deal_id"] for r in (existing.data or []) if r["deal_id"] not in active_ids]
    if stale_ids:
        for i in range(0, len(stale_ids), batch_size):
            supabase.table("deals_current").delete().in_("deal_id", stale_ids[i : i + batch_size]).execute()
    print(f"  Deleted {len(stale_ids)} stale deal(s)")

    # Set fetched_at only after everything succeeded
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("deals_current").update({"fetched_at": now_iso}).not_.is_("deal_id", None).execute()
    print(f"  fetched_at: {now_iso}")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
