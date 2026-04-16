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

def fetch_all_pipeline_deals(properties: list[str]) -> list[dict]:
    """
    Fetch ALL non-archived deals using the list endpoint (no filter needed).
    Filters to active pipeline stages client-side.
    Uses GET /crm/v3/objects/deals — avoids 400 errors from unsupported
    search filters (pipeline EQ and dealstage IN both fail on this account).
    """
    props_param = ",".join(properties)
    url   = f"{HUBSPOT_BASE}/crm/v3/objects/deals"
    deals = []
    after = None

    while True:
        params: dict = {
            "properties": props_param,
            "limit":      100,
            "archived":   "false",
        }
        if after:
            params["after"] = after

        r = httpx.get(url, headers=HEADERS, params=params, timeout=30)
        if not r.is_success:
            print(f"  HubSpot error {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()
        data = r.json()
        deals.extend(data.get("results", []))

        after = data.get("paging", {}).get("next", {}).get("after")
        if not after:
            break

    print(f"  {len(deals)} total non-archived deals fetched")
    return deals


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
    active_ids = [r["deal_id"] for r in rows]

    # Upsert in batches of 500
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        supabase.table("deals_current").upsert(
            rows[i : i + batch_size], on_conflict="deal_id"
        ).execute()
    print(f"  Upserted {len(rows)} active deal(s)")

    # Delete stale rows not in the current active set
    result  = supabase.table("deals_current").delete().not_.in_("deal_id", active_ids).execute()
    deleted = len(result.data) if result.data else 0
    print(f"  Deleted {deleted} stale deal(s)")

    # Mark sync time — only reached if all upserts and deletes succeeded
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("deals_current").update({"fetched_at": now_iso}).not_.is_("deal_id", None).execute()
    print(f"  Sync timestamp set: {now_iso}")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
