"""
bq_sync.py — HubSpot → BigQuery raw data sync.

Fetches deals, contacts, and calls from HubSpot and writes raw,
untransformed data to BigQuery. No flattening — dbt handles that.

Processes one day at a time and writes to BQ after each day, so a crash
mid-run only loses that day's data. Re-running appends — do not re-run
without checking for duplicates first.

Required env vars:
  HUBSPOT_API_KEY                HubSpot Private App token
  GOOGLE_APPLICATION_CREDENTIALS Path to GCP service account JSON
  BQ_PROJECT_ID                  BigQuery project ID (e.g. rebil-335813)

Run (PowerShell):
  $env:HUBSPOT_API_KEY="..."
  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\key.json"
  $env:BQ_PROJECT_ID="rebil-335813"
  python sync/bq_sync.py
"""

import os
import sys
import time
from datetime import datetime, timezone, timedelta

import httpx
from google.cloud import bigquery
from google.cloud.bigquery import SchemaField, TimePartitioning

# ── Flags ─────────────────────────────────────────────────────────────────────

SAMPLE_MODE  = False  # Set to True for sample testing (stops after SAMPLE_LIMIT deals)
SAMPLE_LIMIT = 200

# Only fetch deals with hs_lastmodifieddate >= this date.
DATE_FILTER = "2026-03-01"

# ── Credentials ───────────────────────────────────────────────────────────────

HUBSPOT_API_KEY = os.environ["HUBSPOT_API_KEY"]
BQ_PROJECT_ID   = os.environ["BQ_PROJECT_ID"]

HUBSPOT_BASE = "https://api.hubapi.com"
HS_HEADERS   = {
    "Authorization": f"Bearer {HUBSPOT_API_KEY}",
    "Content-Type":  "application/json",
}

DATASET_RAW   = "dwh_km_raw"
DATASET_CLEAN = "dwh_km_clean"

# ── API call tracking ──────────────────────────────────────────────────────────

_api_call_count = 0
_op_call_counts: dict[str, int] = {}
_current_op     = "unknown"


def _hs_request(method: str, url: str, **kwargs) -> httpx.Response:
    global _api_call_count
    _api_call_count += 1
    _op_call_counts[_current_op] = _op_call_counts.get(_current_op, 0) + 1
    return httpx.request(method, url, headers=HS_HEADERS, **kwargs)


def hs_get(url: str, **kwargs) -> httpx.Response:
    return _hs_request("GET", url, **kwargs)


def hs_post(url: str, **kwargs) -> httpx.Response:
    return _hs_request("POST", url, **kwargs)


def set_op(name: str) -> None:
    global _current_op
    _current_op = name


def print_api_summary() -> None:
    print("\nAPI call summary:")
    for op, n in _op_call_counts.items():
        print(f"  {op:<45} {n} call(s)")
    print(f"  {'TOTAL':<45} {_api_call_count}")


# ── BigQuery schemas ───────────────────────────────────────────────────────────

_F = SchemaField

SCHEMA_DEALS = [
    _F("deal_id",               "STRING",    mode="REQUIRED"),
    _F("owner_id",              "STRING",    mode="NULLABLE"),
    _F("stage_id",              "STRING",    mode="NULLABLE"),
    _F("pipeline_id",           "STRING",    mode="NULLABLE"),
    _F("created_at",            "TIMESTAMP", mode="NULLABLE"),
    _F("updated_at",            "TIMESTAMP", mode="NULLABLE"),
    _F("rebil_db_car_id",       "STRING",    mode="NULLABLE"),
    _F("reg_nr",                "STRING",    mode="NULLABLE"),
    _F("object_source_detail_1","STRING",    mode="NULLABLE"),
    _F("properties",            "JSON",      mode="NULLABLE"),
    _F("fetched_at",            "TIMESTAMP", mode="REQUIRED"),
]

SCHEMA_CONTACTS = [
    _F("id",         "STRING",    mode="REQUIRED"),
    _F("owner_id",   "STRING",    mode="NULLABLE"),
    _F("created_at", "TIMESTAMP", mode="NULLABLE"),
    _F("updated_at", "TIMESTAMP", mode="NULLABLE"),
    _F("phone",      "STRING",    mode="NULLABLE"),
    _F("email",      "STRING",    mode="NULLABLE"),
    _F("properties", "JSON",      mode="NULLABLE"),
    _F("fetched_at", "TIMESTAMP", mode="REQUIRED"),
]

SCHEMA_CALLS = [
    _F("id",                         "STRING",    mode="REQUIRED"),
    _F("created_at",                 "TIMESTAMP", mode="NULLABLE"),
    _F("updated_at",                 "TIMESTAMP", mode="NULLABLE"),
    _F("owner_id",                   "STRING",    mode="NULLABLE"),
    _F("call_timestamp",             "TIMESTAMP", mode="NULLABLE"),
    _F("call_deal_stage_during_call","STRING",    mode="NULLABLE"),
    _F("properties",                 "JSON",      mode="NULLABLE"),
    _F("fetched_at",                 "TIMESTAMP", mode="REQUIRED"),
]

SCHEMA_DEAL_CONTACT_ASSOC = [
    _F("deal_id",            "STRING",    mode="REQUIRED"),
    _F("contact_id",         "STRING",    mode="REQUIRED"),
    _F("association_type_id","STRING",    mode="NULLABLE"),
    _F("first_seen_at",      "TIMESTAMP", mode="NULLABLE"),
    _F("last_seen_at",       "TIMESTAMP", mode="NULLABLE"),
]

SCHEMA_DEAL_CALL_ASSOC = [
    _F("deal_id",            "STRING",    mode="REQUIRED"),
    _F("call_id",            "STRING",    mode="REQUIRED"),
    _F("association_type_id","STRING",    mode="NULLABLE"),
    _F("first_seen_at",      "TIMESTAMP", mode="NULLABLE"),
    _F("last_seen_at",       "TIMESTAMP", mode="NULLABLE"),
]

SCHEMA_DEAL_STAGE_HISTORY = [
    _F("deal_id",    "STRING",    mode="REQUIRED"),
    _F("stage_id",   "STRING",    mode="REQUIRED"),
    _F("entered_at", "TIMESTAMP", mode="NULLABLE"),
    _F("fetched_at", "TIMESTAMP", mode="REQUIRED"),
]

# ── BigQuery helpers ───────────────────────────────────────────────────────────

def ensure_datasets(client: bigquery.Client) -> None:
    for ds_id in [DATASET_RAW, DATASET_CLEAN]:
        ref = f"{BQ_PROJECT_ID}.{ds_id}"
        try:
            client.get_dataset(ref)
        except Exception:
            client.create_dataset(bigquery.Dataset(ref))
            print(f"  Created dataset {ds_id}")


def ensure_table(
    client: bigquery.Client,
    dataset_id: str,
    table_id: str,
    schema: list,
    partition_field: str,
    clustering_fields: list[str] | None = None,
) -> None:
    full_id = f"{BQ_PROJECT_ID}.{dataset_id}.{table_id}"
    if SAMPLE_MODE:
        client.delete_table(full_id, not_found_ok=True)
    table = bigquery.Table(full_id, schema=schema)
    table.time_partitioning = TimePartitioning(field=partition_field)
    if clustering_fields:
        table.clustering_fields = clustering_fields
    client.create_table(table, exists_ok=True)


def write_table(
    client: bigquery.Client,
    full_table_id: str,
    rows: list[dict],
    schema: list,
) -> None:
    name = full_table_id.split(".")[-1]
    if not rows:
        return
    job = client.load_table_from_json(
        rows, full_table_id,
        job_config=bigquery.LoadJobConfig(schema=schema, write_disposition="WRITE_APPEND"),
    )
    job.result()
    print(f"    {name:<43} +{len(rows)} rows")


# ── HubSpot helpers ────────────────────────────────────────────────────────────

def get_all_property_names(object_type: str) -> list[str]:
    """Returns all property names for the given object type, handling pagination."""
    url   = f"{HUBSPOT_BASE}/crm/v3/properties/{object_type}"
    names = []
    after = None
    while True:
        params = {"after": after} if after else {}
        r = hs_get(url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        names.extend(p["name"] for p in data.get("results", []))
        after = data.get("paging", {}).get("next", {}).get("after")
        if not after:
            break
    return names


def search_ids_in_window(from_ms: int, to_ms: int) -> list[str]:
    """
    Return all deal IDs with hs_lastmodifieddate in [from_ms, to_ms).
    Automatically halves the window if a chunk would hit HubSpot's 10k limit.
    """
    url   = f"{HUBSPOT_BASE}/crm/v3/objects/deals/search"
    ids   = []
    after = None

    while True:
        payload: dict = {
            "filterGroups": [{"filters": [
                {"propertyName": "hs_lastmodifieddate", "operator": "GTE", "value": str(from_ms)},
                {"propertyName": "hs_lastmodifieddate", "operator": "LT",  "value": str(to_ms)},
            ]}],
            "properties": ["hs_object_id"],
            "limit":      100,
        }
        if after:
            payload["after"] = after

        r = hs_post(url, json=payload, timeout=60)
        if not r.is_success:
            print(f"  HubSpot error {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()
        data    = r.json()
        results = data.get("results", [])
        ids.extend(obj["id"] for obj in results)

        if len(ids) >= 10_000:
            # Window too wide — split in half and recurse
            mid_ms = (from_ms + to_ms) // 2
            return search_ids_in_window(from_ms, mid_ms) + search_ids_in_window(mid_ms, to_ms)

        after = data.get("paging", {}).get("next", {}).get("after")
        if not after:
            break

    return ids


def batch_read_deals(ids: list[str], properties: list[str]) -> tuple[list[dict], list[dict]]:
    """Batch read deals + dealstage history in one pass (50/batch due to propertiesWithHistory)."""
    url           = f"{HUBSPOT_BASE}/crm/v3/objects/deals/batch/read"
    deals         = []
    stage_entries = []

    for i in range(0, len(ids), 50):
        batch   = ids[i : i + 50]
        payload = {
            "inputs":                [{"id": id_} for id_ in batch],
            "properties":            properties,
            "propertiesWithHistory": ["dealstage"],
        }
        r = hs_post(url, json=payload, timeout=60)
        if not r.is_success:
            print(f"  HubSpot error {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()

        for obj in r.json().get("results", []):
            deals.append(obj)
            for entry in obj.get("propertiesWithHistory", {}).get("dealstage", []):
                stage_entries.append({
                    "deal_id":    obj["id"],
                    "stage_id":   entry.get("value"),
                    "entered_at": entry.get("timestamp"),
                })

    return deals, stage_entries


def batch_read_associations(from_type: str, to_type: str, ids: list[str]) -> dict[str, list[dict]]:
    """Returns {from_id: [{to_id, type_id}]} for all given IDs (100/batch)."""
    url    = f"{HUBSPOT_BASE}/crm/v4/associations/{from_type}/{to_type}/batch/read"
    result: dict[str, list[dict]] = {}

    for i in range(0, len(ids), 100):
        batch = ids[i : i + 100]
        r = hs_post(url, json={"inputs": [{"id": id_} for id_ in batch]}, timeout=30)
        r.raise_for_status()
        for item in r.json().get("results", []):
            from_id = str(item["from"]["id"])
            result[from_id] = [
                {
                    "to_id":   str(assoc.get("toObjectId", "")),
                    "type_id": str((assoc.get("associationTypes") or [{}])[0].get("typeId", "")),
                }
                for assoc in item.get("to", [])
            ]

    return result


def batch_read_objects(object_type: str, ids: list[str], properties: list[str]) -> list[dict]:
    """Batch read HubSpot objects by ID (100/batch)."""
    url    = f"{HUBSPOT_BASE}/crm/v3/objects/{object_type}/batch/read"
    result = []

    for i in range(0, len(ids), 100):
        batch = ids[i : i + 100]
        r = hs_post(url, json={"inputs": [{"id": id_} for id_ in batch], "properties": properties}, timeout=60)
        r.raise_for_status()
        result.extend(r.json().get("results", []))

    return result


# ── Row builders ───────────────────────────────────────────────────────────────

def deal_to_row(deal: dict, fetched_at: str) -> dict:
    p = deal.get("properties", {})
    return {
        "deal_id":               deal["id"],
        "owner_id":              p.get("hubspot_owner_id"),
        "stage_id":              p.get("dealstage"),
        "pipeline_id":           p.get("pipeline"),
        "created_at":            deal.get("createdAt"),
        "updated_at":            deal.get("updatedAt"),
        "rebil_db_car_id":       p.get("rebil_db_car_id"),
        "reg_nr":                p.get("reg_nr"),
        "object_source_detail_1":p.get("hs_object_source_detail_1"),
        "properties":            p,
        "fetched_at":            fetched_at,
    }


def contact_to_row(contact: dict, fetched_at: str) -> dict:
    p = contact.get("properties", {})
    return {
        "id":         contact["id"],
        "owner_id":   p.get("hubspot_owner_id"),
        "created_at": contact.get("createdAt"),
        "updated_at": contact.get("updatedAt"),
        "phone":      p.get("phone"),
        "email":      p.get("email"),
        "properties": p,
        "fetched_at": fetched_at,
    }


def call_to_row(call: dict, fetched_at: str) -> dict:
    p = call.get("properties", {})
    return {
        "id":                         call["id"],
        "created_at":                 call.get("createdAt"),
        "updated_at":                 call.get("updatedAt"),
        "owner_id":                   p.get("hubspot_owner_id"),
        "call_timestamp":             p.get("hs_timestamp"),
        "call_deal_stage_during_call":p.get("hs_call_deal_stage_during_call"),
        "properties":                 p,
        "fetched_at":                 fetched_at,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def process_day(
    bq: bigquery.Client,
    day_dt: datetime,
    deal_props: list[str],
    contact_props: list[str],
    call_props: list[str],
    fetched_at: str,
    pfx: str,
) -> int:
    """Fetch and write all data for one calendar day. Returns number of deals processed."""
    from_ms = int(day_dt.timestamp() * 1000)
    to_ms   = int((day_dt + timedelta(days=1)).timestamp() * 1000)
    label   = day_dt.strftime("%Y-%m-%d")

    set_op(f"search: {label}")
    deal_ids = search_ids_in_window(from_ms, to_ms)
    if not deal_ids:
        print(f"  {label}: 0 deals — skipping")
        return 0

    print(f"  {label}: {len(deal_ids)} deals")

    set_op(f"batch_read deals: {label}")
    deals, stage_entries = batch_read_deals(deal_ids, deal_props)

    set_op(f"assoc contact: {label}")
    contact_assocs = batch_read_associations("deals", "contacts", deal_ids)
    set_op(f"assoc call: {label}")
    call_assocs    = batch_read_associations("deals", "calls",    deal_ids)

    all_contact_ids = list({a["to_id"] for v in contact_assocs.values() for a in v})
    all_call_ids    = list({a["to_id"] for v in call_assocs.values()    for a in v})

    set_op(f"batch_read contacts: {label}")
    contacts = batch_read_objects("contacts", all_contact_ids, contact_props) if all_contact_ids else []
    set_op(f"batch_read calls: {label}")
    calls    = batch_read_objects("calls",    all_call_ids,    call_props)    if all_call_ids    else []

    deal_rows          = [deal_to_row(d, fetched_at) for d in deals]
    contact_rows       = [contact_to_row(c, fetched_at) for c in contacts]
    call_rows          = [call_to_row(c, fetched_at) for c in calls]
    stage_history_rows = [{**e, "fetched_at": fetched_at} for e in stage_entries]
    dc_assoc_rows      = [
        {"deal_id": did, "contact_id": a["to_id"], "association_type_id": a["type_id"],
         "first_seen_at": fetched_at, "last_seen_at": fetched_at}
        for did, assocs in contact_assocs.items() for a in assocs
    ]
    dca_rows = [
        {"deal_id": did, "call_id": a["to_id"], "association_type_id": a["type_id"],
         "first_seen_at": fetched_at, "last_seen_at": fetched_at}
        for did, assocs in call_assocs.items() for a in assocs
    ]

    write_table(bq, f"{pfx}.deals_raw",                deal_rows,          SCHEMA_DEALS)
    write_table(bq, f"{pfx}.contacts_raw",              contact_rows,       SCHEMA_CONTACTS)
    write_table(bq, f"{pfx}.calls_raw",                 call_rows,          SCHEMA_CALLS)
    write_table(bq, f"{pfx}.deal_stage_history_raw",    stage_history_rows, SCHEMA_DEAL_STAGE_HISTORY)
    write_table(bq, f"{pfx}.deal_contact_associations", dc_assoc_rows,      SCHEMA_DEAL_CONTACT_ASSOC)
    write_table(bq, f"{pfx}.deal_call_associations",    dca_rows,           SCHEMA_DEAL_CALL_ASSOC)

    return len(deal_ids)


def main() -> None:
    fetched_at = datetime.now(timezone.utc).isoformat()
    bq         = bigquery.Client(project=BQ_PROJECT_ID)
    pfx        = f"{BQ_PROJECT_ID}.{DATASET_RAW}"

    print("Setting up BigQuery datasets and tables...")
    ensure_datasets(bq)
    ensure_table(bq, DATASET_RAW, "deals_raw",                SCHEMA_DEALS,             "updated_at",     ["owner_id", "stage_id", "object_source_detail_1"])
    ensure_table(bq, DATASET_RAW, "contacts_raw",             SCHEMA_CONTACTS,          "updated_at",     ["owner_id"])
    ensure_table(bq, DATASET_RAW, "calls_raw",                SCHEMA_CALLS,             "call_timestamp", ["owner_id", "call_deal_stage_during_call"])
    ensure_table(bq, DATASET_RAW, "deal_contact_associations",SCHEMA_DEAL_CONTACT_ASSOC,"last_seen_at")
    ensure_table(bq, DATASET_RAW, "deal_call_associations",   SCHEMA_DEAL_CALL_ASSOC,   "last_seen_at")
    ensure_table(bq, DATASET_RAW, "deal_stage_history_raw",   SCHEMA_DEAL_STAGE_HISTORY,"entered_at",     ["deal_id"])

    print("Fetching property schemas from HubSpot...")
    set_op("property_names: deals")
    deal_props    = get_all_property_names("deals")
    set_op("property_names: contacts")
    contact_props = get_all_property_names("contacts")
    set_op("property_names: calls")
    call_props    = get_all_property_names("calls")
    print(f"  deals={len(deal_props)}, contacts={len(contact_props)}, calls={len(call_props)} properties")

    start_dt    = datetime.fromisoformat(DATE_FILTER).replace(tzinfo=timezone.utc)
    now_dt      = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    total_deals = 0

    print(f"Processing day by day from {DATE_FILTER}...")
    day = start_dt
    while day < now_dt:
        n = process_day(bq, day, deal_props, contact_props, call_props, fetched_at, pfx)
        total_deals += n

        if SAMPLE_MODE and total_deals >= SAMPLE_LIMIT:
            print(f"  Sample limit reached ({total_deals} deals)")
            break

        day += timedelta(days=1)

    print(f"\nTotal deals processed: {total_deals}")
    print_api_summary()
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
