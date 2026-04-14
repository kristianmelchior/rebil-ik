"""
sync.py — HubSpot → Supabase deals_current sync
Runs every 15 min via GitHub Actions.

Required env vars (GitHub Secrets):
  HUBSPOT_API_KEY       HubSpot Private App token
  SUPABASE_URL          Supabase project URL
  SUPABASE_SERVICE_KEY  Supabase service role key (bypasses RLS)

Pipeline config lives in config.py — not in secrets.
"""

import os
import sys
import httpx
from supabase import create_client
from config import PIPELINE_ID, EXCLUDED_STAGE_IDS

# ── Config ────────────────────────────────────────────────────────────────────

HUBSPOT_API_KEY      = os.environ["HUBSPOT_API_KEY"]
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HUBSPOT_BASE = "https://api.hubapi.com"
HEADERS      = {"Authorization": f"Bearer {HUBSPOT_API_KEY}"}

BASE_PROPERTIES = [
    "dealname",
    "referent___owner",
    "dealstage",
    "createdate",
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


def get_valid_deal_properties() -> set[str]:
    """Return the set of all existing deal property names from HubSpot."""
    url = f"{HUBSPOT_BASE}/crm/v3/properties/deals"
    r = httpx.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return {p["name"] for p in r.json().get("results", [])}


def _search_deals(properties: list[str]) -> list[dict]:
    """Single paginated fetch with a fixed property list. Raises on HTTP errors."""
    url   = f"{HUBSPOT_BASE}/crm/v3/objects/deals/search"
    deals = []
    after = None

    while True:
        payload: dict = {
            "properties":   properties,
            "limit":        100,
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": "pipeline",
                            "operator":     "EQ",
                            "value":        PIPELINE_ID,
                        }
                    ]
                }
            ],
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


def fetch_all_deals(properties: list[str]) -> list[dict]:
    """Fetch all deals. Filters properties against HubSpot's property registry first."""
    return _search_deals(properties)


# ── Transform ─────────────────────────────────────────────────────────────────

def get_last_stage_change(props: dict) -> str | None:
    """Return when the deal entered its current stage."""
    current_stage = props.get("dealstage")
    if not current_stage:
        return None
    return props.get(f"hs_date_entered_{current_stage}")


def to_row(deal: dict, stage_name_map: dict) -> dict:
    p        = deal.get("properties", {})
    stage_id = p.get("dealstage")
    return {
        "deal_id":              deal["id"],
        "deal_name":            p.get("dealname"),
        "owner_id":             p.get("referent___owner"),
        "stage_id":             stage_id,
        "stage_name":           stage_name_map.get(stage_id),
        "create_date":          (p.get("createdate") or "")[:10] or None,
        "last_stage_change_at": get_last_stage_change(p),
        "next_activity_date":   (p.get("notes_next_activity_date") or "")[:10] or None,
        "innbytte_":            p.get("innbytte_"),
        "type_lead":            p.get("type_lead"),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Pipeline: {PIPELINE_ID}")

    stages         = get_pipeline_stages(PIPELINE_ID)
    stage_name_map = {s["id"]: s["label"] for s in stages}
    stage_ids      = [s["id"] for s in stages]
    stage_labels = [s["id"] + " (" + s["label"] + ")" for s in stages]
    print(f"  Stages: {stage_labels}")

    valid_props      = get_valid_deal_properties()
    stage_date_props = [f"hs_date_entered_{sid}" for sid in stage_ids]
    all_wanted       = BASE_PROPERTIES + stage_date_props
    properties       = [p for p in all_wanted if p in valid_props]
    dropped          = [p for p in all_wanted if p not in valid_props]
    if dropped:
        print(f"  Skipping {len(dropped)} props not in HubSpot: {dropped}")

    print("Fetching all deals from HubSpot…")
    all_deals = fetch_all_deals(properties)
    print(f"  {len(all_deals)} total deals fetched")

    # Filter in Python so we can log the split
    excluded    = set(EXCLUDED_STAGE_IDS)
    active      = [d for d in all_deals if d.get("properties", {}).get("dealstage") not in excluded]
    closed_count = len(all_deals) - len(active)
    print(f"  {len(active)} active, {closed_count} excluded by config.py")

    rows = [to_row(d, stage_name_map) for d in active]

    print("Upserting to Supabase deals_current…")
    supabase   = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table("deals_current").upsert(batch, on_conflict="deal_id").execute()
        print(f"  Batch {i // batch_size + 1}: {len(batch)} rows upserted")

    # Remove deals no longer in the active set
    active_ids = [r["deal_id"] for r in rows]
    if active_ids:
        supabase.table("deals_current").delete().not_.in_("deal_id", active_ids).execute()
        print("  Stale deals cleaned up")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
