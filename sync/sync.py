"""
sync.py — HubSpot → Supabase deals_current sync
Runs every 15 min via GitHub Actions.

Required env vars:
  HUBSPOT_API_KEY       HubSpot Private App token
  SUPABASE_URL          Supabase project URL
  SUPABASE_SERVICE_KEY  Supabase service role key (bypasses RLS)

Optional env vars:
  CLOSED_STAGE_IDS      Comma-separated stage IDs to exclude (e.g. "closedwon,closedlost")
                        Defaults to "closedwon,closedlost"
"""

import os
import sys
import httpx
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

HUBSPOT_API_KEY    = os.environ["HUBSPOT_API_KEY"]
SUPABASE_URL       = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
CLOSED_STAGE_IDS   = set(
    os.environ.get("CLOSED_STAGE_IDS", "closedwon,closedlost").split(",")
)

HUBSPOT_BASE = "https://api.hubapi.com"
HEADERS      = {"Authorization": f"Bearer {HUBSPOT_API_KEY}"}

BASE_PROPERTIES = [
    "dealname",
    "hubspot_owner_id",
    "dealstage",
    "createdate",
    "notes_last_updated",
    "notes_next_activity_date",
]

# ── HubSpot helpers ───────────────────────────────────────────────────────────

def get_pipeline_stage_ids(pipeline_id: str = "default") -> list[str]:
    """Fetch all stage IDs for a pipeline so we can request hs_date_entered_* props."""
    url = f"{HUBSPOT_BASE}/crm/v3/pipelines/deals/{pipeline_id}/stages"
    r = httpx.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return [s["id"] for s in r.json().get("results", [])]


def fetch_all_deals(properties: list[str]) -> list[dict]:
    """Page through HubSpot CRM search API and return all active deals."""
    url    = f"{HUBSPOT_BASE}/crm/v3/objects/deals/search"
    deals  = []
    after  = None

    while True:
        payload: dict = {
            "properties": properties,
            "limit": 100,
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": "dealstage",
                            "operator":     "NOT_IN",
                            "values":       list(CLOSED_STAGE_IDS),
                        }
                    ]
                }
            ],
        }
        if after:
            payload["after"] = after

        r = httpx.post(url, headers=HEADERS, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()

        deals.extend(data.get("results", []))

        paging = data.get("paging", {})
        after  = paging.get("next", {}).get("after")
        if not after:
            break

    return deals


def last_stage_change(props: dict, stage_ids: list[str]) -> str | None:
    """Return the ISO timestamp for when the deal entered its current stage."""
    current_stage = props.get("dealstage")
    if not current_stage:
        return None
    key = f"hs_date_entered_{current_stage}"
    return props.get(key)


# ── Transform ─────────────────────────────────────────────────────────────────

def to_row(deal: dict, stage_name_map: dict, stage_ids: list[str]) -> dict:
    p = deal.get("properties", {})
    stage_id = p.get("dealstage")
    return {
        "deal_id":              deal["id"],
        "deal_name":            p.get("dealname"),
        "owner_id":             p.get("hubspot_owner_id"),
        "stage_id":             stage_id,
        "stage_name":           stage_name_map.get(stage_id),
        "create_date":          p.get("createdate", "")[:10] or None,
        "last_activity_at":     p.get("notes_last_updated"),
        "last_stage_change_at": last_stage_change(p, stage_ids),
        "next_activity_date":   p.get("notes_next_activity_date", "")[:10] or None,
    }


# ── Stage name lookup ─────────────────────────────────────────────────────────

def get_stage_name_map(pipeline_id: str = "default") -> dict[str, str]:
    url = f"{HUBSPOT_BASE}/crm/v3/pipelines/deals/{pipeline_id}/stages"
    r = httpx.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return {s["id"]: s["label"] for s in r.json().get("results", [])}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Fetching pipeline stages…")
    stage_ids     = get_pipeline_stage_ids()
    stage_name_map = get_stage_name_map()
    print(f"  {len(stage_ids)} stages found")

    # Build full property list including hs_date_entered_* per stage
    properties = BASE_PROPERTIES + [f"hs_date_entered_{sid}" for sid in stage_ids]

    print("Fetching active deals from HubSpot…")
    deals = fetch_all_deals(properties)
    print(f"  {len(deals)} active deals fetched")

    rows = [to_row(d, stage_name_map, stage_ids) for d in deals]

    print("Upserting to Supabase deals_current…")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Upsert in batches of 500
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        res = (
            supabase.table("deals_current")
            .upsert(batch, on_conflict="deal_id")
            .execute()
        )
        print(f"  Upserted batch {i // batch_size + 1} ({len(batch)} rows)")

    # Delete deals that are no longer active (not returned by HubSpot)
    active_ids = [r["deal_id"] for r in rows]
    if active_ids:
        supabase.table("deals_current").delete().not_.in_(
            "deal_id", active_ids
        ).execute()
        print(f"  Cleaned up stale deals")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
