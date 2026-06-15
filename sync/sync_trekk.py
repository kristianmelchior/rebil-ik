#!/usr/bin/env python3
"""
sync/sync_trekk.py — Synkroniserer avvik og ettersalg fra Google Sheets til Supabase.

Kjøres manuelt:  python sync/sync_trekk.py

Konfigurer SPREADSHEET_ID og kolonnenavn i AVVIK_CONFIG / ETTERSALG_CONFIG nedenfor.
Legg Supabase-nøkler i sync/.env.trekk (se .env.trekk.example).

Avhengigheter (se sync/requirements_trekk.txt):
  pip install -r sync/requirements_trekk.txt
"""

import os
import sys
import json
import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Last inn .env.trekk fra samme mappe som dette skriptet
# ---------------------------------------------------------------------------
env_file = Path(__file__).parent / ".env.trekk"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

# ---------------------------------------------------------------------------
# Supabase og Google credentials
# ---------------------------------------------------------------------------
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")  # service role, omgår RLS
GOOGLE_SA_JSON       = os.environ.get("GOOGLE_SA_JSON", "")        # sti til service account JSON-fil
#   Alternativt kan du sette innholdet direkte: GOOGLE_SA_JSON_CONTENT='{...}'
GOOGLE_SA_JSON_CONTENT = os.environ.get("GOOGLE_SA_JSON_CONTENT", "")

# ---------------------------------------------------------------------------
# Konfigurer arket ditt her
# ---------------------------------------------------------------------------

# Avvik-ark ----------------------------------------------------------------
AVVIK_SPREADSHEET_ID = os.environ.get("AVVIK_SPREADSHEET_ID", "1LKz8rvfnhjKmNmLAK-bJ7-Ii96rz67C5wAqExZkMUgQ")
AVVIK_SHEET_NAME     = os.environ.get("AVVIK_SHEET_NAME", "Data_avvik")  # fane-navn i arket

# Kolonnenavn i avvik-arket (eksakt tekst i rad 1):
AVVIK_COL = {
    "record_id":        "Record ID",                      # kolonne A — brukes direkte som PK
    "hubspot_owner_id": "Dealeier innkjøpskonsulent",     # numerisk HubSpot owner-ID
    "dato":             "Dato kontrakt innkjøp",           # Unix timestamp ms eller DD.MM.YYYY
    "avvik_type":       "Avvik type",
    "avvik_komment":    "Avvik kommentar",
    "merke":            "Merke",
    "modell":           "Modell",
    "regnr":            "Regnr",
}

# Ettersalg-ark -----------------------------------------------------------
ETTERSALG_SPREADSHEET_ID = os.environ.get("ETTERSALG_SPREADSHEET_ID", "14UxI0k8Qa8VE9fqFGn5VgHbpB53G5tXO_vEkTzbq3IA")
ETTERSALG_SHEET_NAME     = os.environ.get("ETTERSALG_SHEET_NAME", "Data formatted 2.0")

# Kolonnenavn i ettersalg-arket (eksakt tekst i rad 1):
ETTERSALG_COL = {
    "record_id":        "Record ID",                      # kolonne H — brukes direkte som PK
    "hubspot_owner_id": "Dealeier iK",                    # kolonne K — numerisk HubSpot owner-ID
    "dato":             "Dato henvendelse mottatt",        # kolonne I — "21 May 26"-format
    "kostnad":          "Ettersalg kostnad",               # kolonne B — heltall NOK
    "fakturert_selger": "Ettersalg skal fakturere selger", # kolonne C — heltall NOK
    "regnr":            "Regnr",                           # kolonne A
    "endelig_avgjort":  "Endelig avgjørelse",              # kolonne O — "Ja" → true
}

# ---------------------------------------------------------------------------
# Hjelpe-funksjoner
# ---------------------------------------------------------------------------

def parse_date(raw: str) -> str | None:
    """Konverterer dato-streng til YYYY-MM-DD.
    Støtter: Unix timestamp ms (fra HubSpot), DD.MM.YYYY, YYYY-MM-DD."""
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    # Unix timestamp i millisekunder (HubSpot-format, f.eks. "1753315200000")
    if raw.isdigit() and len(raw) >= 10:
        ts_sec = int(raw) / 1000 if len(raw) >= 13 else int(raw)
        try:
            return datetime.datetime.utcfromtimestamp(ts_sec).strftime("%Y-%m-%d")
        except (ValueError, OSError):
            pass
    # Vanlige dato-formater inkl. "21 May 26" (DD Mon YY fra Google Sheets)
    for fmt in ("%d %b %y", "%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
                "%d %b %Y", "%b %d, %Y"):
        try:
            return datetime.datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    print(f"  [WARN] Ukjent datoformat: {raw!r} — rad hoppes over")
    return None


def build_rep_map(supabase_client) -> dict[str, str]:
    """Henter alle reps og returnerer {hubspot_id: kode}."""
    print("→ Henter reps fra Supabase…")
    res = supabase_client.table("reps").select("kode,hubspot_id").execute()
    mapping: dict[str, str] = {}
    for r in res.data or []:
        if r.get("hubspot_id"):
            mapping[str(r["hubspot_id"])] = r["kode"]
    print(f"  {len(mapping)} reps med hubspot_id funnet")
    return mapping


def get_header_map(rows: list[list]) -> dict[str, int]:
    """Returnerer {kolonnenavn: indeks} fra første rad i arket."""
    if not rows:
        return {}
    return {h.strip(): i for i, h in enumerate(rows[0])}


def cell(row: list, headers: dict[str, int], col_name: str) -> str:
    """Henter celleverdien for et kolonnenavn, returnerer tom streng hvis mangler."""
    idx = headers.get(col_name)
    if idx is None:
        return ""
    return row[idx].strip() if idx < len(row) else ""

# ---------------------------------------------------------------------------
# Sync-funksjoner
# ---------------------------------------------------------------------------

def sync_avvik(sheets_service, supabase_client, rep_map: dict[str, str]) -> None:
    print("\n=== Synkroniserer AVVIK ===")
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=AVVIK_SPREADSHEET_ID,
        range=AVVIK_SHEET_NAME,
    ).execute()
    all_rows = result.get("values", [])
    if not all_rows:
        print("  Arket er tomt — hopper over")
        return

    headers = get_header_map(all_rows)
    print(f"  Kolonner funnet: {list(headers.keys())}")

    # Valider at nødvendige kolonner finnes
    required = ["record_id", "hubspot_owner_id", "dato"]
    missing = [AVVIK_COL[k] for k in required if AVVIK_COL[k] not in headers]
    if missing:
        print(f"  [FEIL] Kolonner ikke funnet i avvik-arket: {missing}")
        print(f"  Sjekk AVVIK_COL-konfigurasjonen i sync_trekk.py")
        return

    upsert_rows = []
    skipped = 0

    for i, row in enumerate(all_rows[1:], start=2):  # hopper over header-rad
        record_id = cell(row, headers, AVVIK_COL["record_id"])
        if not record_id:
            skipped += 1
            continue

        hubspot_id = cell(row, headers, AVVIK_COL["hubspot_owner_id"])
        if not hubspot_id:
            skipped += 1
            continue

        kode = rep_map.get(hubspot_id)
        if not kode:
            print(f"  [WARN] Rad {i}: HubSpot-ID {hubspot_id!r} ikke funnet i reps — hoppes over")
            skipped += 1
            continue

        dato_raw = cell(row, headers, AVVIK_COL["dato"])
        dato = parse_date(dato_raw)
        if not dato:
            skipped += 1
            continue

        upsert_rows.append({
            "record_id":     record_id,
            "kode":          kode,
            "dato":          dato,
            "avvik_type":    cell(row, headers, AVVIK_COL["avvik_type"]) or None,
            "avvik_komment": cell(row, headers, AVVIK_COL["avvik_komment"]) or None,
            "merke":         cell(row, headers, AVVIK_COL["merke"]) or None,
            "modell":        cell(row, headers, AVVIK_COL["modell"]) or None,
            "regnr":         cell(row, headers, AVVIK_COL["regnr"]) or None,
        })

    print(f"  {len(upsert_rows)} rader klare for upsert, {skipped} hoppet over")

    if upsert_rows:
        res = supabase_client.table("avvik").upsert(upsert_rows, on_conflict="record_id").execute()
        print(f"  ✓ Upsert fullført ({len(res.data or [])} rader bekreftet)")


def sync_ettersalg(sheets_service, supabase_client, rep_map: dict[str, str]) -> None:
    print("\n=== Synkroniserer ETTERSALG ===")
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=ETTERSALG_SPREADSHEET_ID,
        range=ETTERSALG_SHEET_NAME,
    ).execute()
    all_rows = result.get("values", [])
    if not all_rows:
        print("  Arket er tomt — hopper over")
        return

    headers = get_header_map(all_rows)
    print(f"  Kolonner funnet: {list(headers.keys())}")

    required = ["record_id", "hubspot_owner_id", "dato"]
    missing = [ETTERSALG_COL[k] for k in required if ETTERSALG_COL[k] not in headers]
    if missing:
        print(f"  [FEIL] Kolonner ikke funnet i ettersalg-arket: {missing}")
        print(f"  Sjekk ETTERSALG_COL-konfigurasjonen i sync_trekk.py")
        return

    upsert_rows = []
    skipped = 0

    for i, row in enumerate(all_rows[1:], start=2):
        record_id = cell(row, headers, ETTERSALG_COL["record_id"])
        if not record_id:
            skipped += 1
            continue

        hubspot_id = cell(row, headers, ETTERSALG_COL["hubspot_owner_id"])
        if not hubspot_id:
            skipped += 1
            continue

        kode = rep_map.get(hubspot_id)
        if not kode:
            print(f"  [WARN] Rad {i}: HubSpot-ID {hubspot_id!r} ikke funnet i reps — hoppes over")
            skipped += 1
            continue

        dato_raw = cell(row, headers, ETTERSALG_COL["dato"])
        dato = parse_date(dato_raw)
        if not dato:
            skipped += 1
            continue

        def parse_int(raw: str) -> int:
            try:
                return int(float(raw.replace(" ", "").replace(",", "."))) if raw else 0
            except (ValueError, AttributeError):
                return 0

        kostnad          = parse_int(cell(row, headers, ETTERSALG_COL["kostnad"]))
        fakturert_selger = parse_int(cell(row, headers, ETTERSALG_COL["fakturert_selger"]))

        endelig_raw = cell(row, headers, ETTERSALG_COL["endelig_avgjort"])
        endelig_avgjort = endelig_raw.strip().lower() in ("ja", "yes", "true", "1")

        upsert_rows.append({
            "record_id":        record_id,
            "kode":             kode,
            "dato":             dato,
            "kostnad":          kostnad,
            "fakturert_selger": fakturert_selger,
            "regnr":            cell(row, headers, ETTERSALG_COL["regnr"]) or None,
            "endelig_avgjort":  endelig_avgjort,
        })

    print(f"  {len(upsert_rows)} rader klare for upsert, {skipped} hoppet over")

    if upsert_rows:
        res = supabase_client.table("ettersalg").upsert(upsert_rows, on_conflict="record_id").execute()
        print(f"  ✓ Upsert fullført ({len(res.data or [])} rader bekreftet)")

# ---------------------------------------------------------------------------
# Valider konfigurasjon
# ---------------------------------------------------------------------------

def validate_config() -> bool:
    ok = True
    if not SUPABASE_URL or not SUPABASE_URL.startswith("http"):
        print("[FEIL] SUPABASE_URL er ikke satt. Legg det i sync/.env.trekk")
        ok = False
    if not SUPABASE_SERVICE_KEY:
        print("[FEIL] SUPABASE_SERVICE_KEY er ikke satt. Legg det i sync/.env.trekk")
        ok = False
    if not GOOGLE_SA_JSON and not GOOGLE_SA_JSON_CONTENT:
        print("[FEIL] GOOGLE_SA_JSON (sti til service account JSON-fil) er ikke satt")
        ok = False
    # Spreadsheet IDer er hardkodet som defaults — ingen valideringsfeil her
    return ok

# ---------------------------------------------------------------------------
# Hovedprogram
# ---------------------------------------------------------------------------

def main() -> None:
    print("sync_trekk.py — Google Sheets → Supabase")
    print(f"Kjøretid: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    if not validate_config():
        print("\nFiks konfigurasjonsfeilene ovenfor og prøv igjen.")
        print("Se sync/.env.trekk.example for mal.")
        sys.exit(1)

    # Importer avhengigheter (feil her betyr at requirements_trekk.txt ikke er installert)
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        from supabase import create_client
    except ImportError as e:
        print(f"[FEIL] Manglende avhengighet: {e}")
        print("Kjør:  pip install -r sync/requirements_trekk.txt")
        sys.exit(1)

    # Google Sheets-autentisering
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    if GOOGLE_SA_JSON_CONTENT:
        sa_info = json.loads(GOOGLE_SA_JSON_CONTENT)
        credentials = Credentials.from_service_account_info(sa_info, scopes=scopes)
    else:
        credentials = Credentials.from_service_account_file(GOOGLE_SA_JSON, scopes=scopes)

    sheets_service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    print("✓ Google Sheets autentisert")

    # Supabase-klient (service role — omgår RLS)
    supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✓ Supabase tilkoblet")

    # Hent rep-mapping én gang
    rep_map = build_rep_map(supabase_client)

    # Sync
    sync_avvik(sheets_service, supabase_client, rep_map)
    sync_ettersalg(sheets_service, supabase_client, rep_map)

    print("\n✅ Ferdig!")


if __name__ == "__main__":
    main()
