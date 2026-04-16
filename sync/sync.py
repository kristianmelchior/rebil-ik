"""
sync.py — HubSpot → Supabase deals_current incremental sync.
Runs every 15 min via GitHub Actions.

Strategy:
  1. Search for deals modified in the last SYNC_WINDOW_MINUTES (time filter,
     no stage filter) — avoids 400 from pipeline/stage IN filters.
  2. Deals still in an active stage → upsert into deals_current.
  3. Deals that moved to a non-active stage → delete from deals_current.

Stage names come from STAGE_NAME_MAP in config.py — no API call needed.

Required env vars (GitHub Secrets):
  HUBSPOT_API_KEY       HubSpot Private App token
  SUPABASE_URL          Supabase project URL
  SUPABASE_SERVICE_KEY  Supabase service role key (bypasses RLS)
"""

import os
import sys
from datetime import datetime, timezone, timedelta

import httpx
from supabase import create_client

from config import PIPELINE_ID, ACTIVE_STAGE_IDS, STAGE_CATEGORY, STAGE_NAME_MAP

# ── Config ────────────────────────────────────────────────────────────────────

HUBSPOT_API_KEY      = os.environ["HUBSPOT_API_KEY"]
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HUBSPOT_BASE = "https://api.hubapi.com"
HEADERS      = {"Authorization": f"Bearer {HUBSPOT_API_KEY}"}

# Window for incremental sync. Larger than the sync interval (15 min)
# to handle clock skew. 30 min gives comfortable overlap.
SYNC_WINDOW_MINUTES = 30

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

# ── HubSpot helpers ───────────────────────────────────────────────────────────

def fetch_recently_modified_deals(properties: list[str]) -> list[dict]:
    """
    Search for ALL deals modified in the last SYNC_WINDOW_MINUTES.
    Uses a time filter — avoids 400 errors from pipeline/stage IN filters.
    Returns both active and newly-inactive deals so we can upsert or delete.

    Expected API calls: ceil(n_modified / 100) — typically 1 per run.
    """
    since_ms = int(
        (datetime.now(timezone.utc) - timedelta(minutes=SYNC_WINDOW_MINUTES))
        .timestamp() * 1000
    )

    url   = f"{HUBSPOT_BASE}/crm/v3/objects/deals/search"
    deals = []
    after = None

    while True:
        payload: dict = {
            "filterGroups": [{
                "filters": [{
                    "propertyName": "hs_lastmodifieddate",
                    "operator":     "GTE",
                    "value":        str(since_ms),
                }]
            }],
            "properties": properties,
            "limit":      100,
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
    print(f"Sync window: last {SYNC_WINDOW_MINUTES} minutes")

    print("Fetching recently modified deals from HubSpot…")
    all_deals = fetch_recently_modified_deals(BASE_PROPERTIES)
    print(f"  {len(all_deals)} deals modified in window")

    # Deduplicate by deal_id — HubSpot can return the same deal on multiple pages
    # when deals are modified mid-search. Keep the last (most recent) occurrence.
    seen: dict[str, dict] = {}
    for d in all_deals:
        seen[d["id"]] = d
    all_deals = list(seen.values())

    active_deals = [d for d in all_deals if d.get("properties", {}).get("dealstage") in ACTIVE_STAGE_IDS]
    inactive_ids = [d["id"] for d in all_deals if d.get("properties", {}).get("dealstage") not in ACTIVE_STAGE_IDS]

    print(f"  {len(active_deals)} still active, {len(inactive_ids)} moved to non-active stage")

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    if active_deals:
        rows = [to_row(d) for d in active_deals]
        batch_size = 500
        for i in range(0, len(rows), batch_size):
            supabase.table("deals_current").upsert(rows[i : i + batch_size], on_conflict="deal_id").execute()
        print(f"  Upserted {len(rows)} active deal(s)")

    if inactive_ids:
        supabase.table("deals_current").delete().in_("deal_id", inactive_ids).execute()
        print(f"  Deleted {len(inactive_ids)} deal(s) no longer in active stages")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
