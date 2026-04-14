"""
sync.py — HubSpot → Supabase deals_current sync
Runs every 15 min via GitHub Actions.

Required env vars (GitHub Secrets):
  HUBSPOT_API_KEY       HubSpot Private App token
  SUPABASE_URL          Supabase project URL
  SUPABASE_SERVICE_KEY  Supabase service role key (bypasses RLS)

Pipeline config lives in config.py — not in secrets.
"""

import json
import os
import sys
import httpx
from supabase import create_client
from config import PIPELINE_ID, ACTIVE_STAGE_IDS, EXCLUDED_STAGE_IDS, STAGE_CATEGORY

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

# ── HubSpot helpers ───────────────────────────────────────────────────────────

def get_pipeline_stages(pipeline_id: str) -> list[dict]:
    """Fetch all stages for a pipeline."""
    url = f"{HUBSPOT_BASE}/crm/v3/pipelines/deals/{pipeline_id}/stages"
    r = httpx.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json().get("results", [])


def fetch_all_deals(properties: list[str]) -> list[dict]:
    """Page through HubSpot CRM search API and return all active deals."""
    url   = f"{HUBSPOT_BASE}/crm/v3/objects/deals/search"
    deals = []
    after = None

    while True:
        payload: dict = {
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": "dealstage",
                            "operator":     "IN",
                            "values":       ACTIVE_STAGE_IDS,
                        }
                    ]
                }
            ],
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

        paging = data.get("paging", {})
        after  = paging.get("next", {}).get("after")
        if not after:
            break

    return deals


# ── Transform ─────────────────────────────────────────────────────────────────

def to_row(deal: dict, stage_name_map: dict) -> dict:
    p        = deal.get("properties", {})
    stage_id = p.get("dealstage")
    return {
        "deal_id":            deal["id"],
        "deal_name":          p.get("dealname"),
        "owner_id":           p.get("referent___owner"),
        "stage_id":           stage_id,
        "stage_name":         stage_name_map.get(stage_id),
        "create_date":        (p.get("createdate") or "")[:10] or None,
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

    stages         = get_pipeline_stages(PIPELINE_ID)
    stage_name_map = {s["id"]: s["label"] for s in stages}

    properties = BASE_PROPERTIES
    print(f"  Requesting {len(properties)} properties")

    print("Fetching all deals from HubSpot…")
    all_deals = fetch_all_deals(properties)
    print(f"  {len(all_deals)} active deals fetched")

    rows = [to_row(d, stage_name_map) for d in all_deals]

    print("Upserting to Supabase deals_current…")
    supabase   = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    batch_size = 500
    for b, i in enumerate(range(0, len(rows), batch_size)):
        batch = rows[i : i + batch_size]
        try:
            supabase.table("deals_current").upsert(batch, on_conflict="deal_id").execute()
            print(f"  Batch {b + 1}: {len(batch)} rows upserted")
        except Exception as e:
            print(f"  Batch {b + 1} failed — trying row by row to find culprit…")
            for j, row in enumerate(batch):
                try:
                    supabase.table("deals_current").upsert(row).execute()
                except Exception as row_e:
                    print(f"  Failed on row {j}: {row_e}")
                    print(f"  Row data: {json.dumps(row, indent=2, default=str)}")
                    raise

    # Remove stale deals: fetch current IDs from Supabase, delete those not in active set
    active_ids = set(r["deal_id"] for r in rows)
    existing   = supabase.table("deals_current").select("deal_id").execute()
    stale_ids  = [r["deal_id"] for r in existing.data if r["deal_id"] not in active_ids]
    if stale_ids:
        stale_rows = [r for r in existing.data if r["deal_id"] in set(stale_ids)]
        for r in stale_rows:
            print(f"    Removing stale: {r['deal_id']} — {r.get('deal_name')} (stage: {r.get('stage_name')})")
        for i in range(0, len(stale_ids), 100):
            supabase.table("deals_current").delete().in_("deal_id", stale_ids[i:i+100]).execute()
        print(f"  {len(stale_ids)} stale deals removed")
    else:
        print("  No stale deals")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
