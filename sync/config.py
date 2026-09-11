# sync/config.py — HubSpot pipeline configuration.
# Edit this file when stage IDs change, then commit.
# Run discover_pipelines.py to find stage IDs and labels.

PIPELINE_ID = "22294509"

# Maps stage ID → human-readable stage name.
# Hardcoded to avoid a live API call on every sync run.
# Update when stages change (run discover_pipelines.py to get current labels).
STAGE_NAME_MAP: dict[str, str] = {
    "5095786727": "Pool winback leads",
    "1446317287": "Lead qualification",
    "188841923":  "Nye leads",
    "74384847":   "Kontaktforsøk 1 + SMS",
    "5952292069": "Kontaktforsøk 2 + SMS",
    "71217910":   "Kontaktforsøk 3 📨",
    "1795037396": "Videre fra samtale",
    "434020796":  "Publisert B2B",
    "5786943711": "Uten bud etter 24t",
    "519657156":  "Tilbud klart",
    "519657157":  "KF tilbud klart",
    "431588053":  "Send tilbud",
    "189321201":  "Lead, tilbud sendt",
    "122403776":  "Kontaktforsøk 1 + SMS, lead",
    "141045495":  "I dialog med kunde 📨",
    "185258735":  "Hot lead",
    "188827596":  "Aksept/Få slettebekreftelse/lage kontrakt",
    "188827597":  "Kontrakt signert",
}

# Maps stage ID → category label shown in the dashboard.
STAGE_CATEGORY: dict[str, str] = {
    # NYE LEADS
    "5095786727": "NYE LEADS",                   # Pool winback leads
    "1446317287": "NYE LEADS",                   # Lead qualification
    "188841923":  "NYE LEADS",                   # Nye leads
    # KF1
    "74384847":   "KF1",                         # Kontaktforsøk 1 + SMS
    # KF2
    "5952292069": "KF2",                         # Kontaktforsøk 2 + SMS
    # KF3
    "71217910":   "KF3",                         # Kontaktforsøk 3 📨
    # TIL PLATTFORM
    "1795037396": "TIL PLATTFORM",               # Videre fra samtale
    "434020796":  "TIL PLATTFORM",               # Publisert B2B
    "5786943711": "TIL PLATTFORM",               # Uten bud etter 24t
    "519657156":  "TIL PLATTFORM",               # Tilbud klart
    "519657157":  "TIL PLATTFORM",               # KF tilbud klart
    # CLOSING
    "431588053":  "CLOSING",                     # Send tilbud
    "189321201":  "CLOSING",                     # Lead, tilbud sendt
    "122403776":  "CLOSING",                     # Kontaktforsøk 1 + SMS, lead
    "141045495":  "CLOSING",                     # I dialog med kunde 📨
    "185258735":  "CLOSING",                     # Hot lead
    # VERIFIKASJON/SLUTTFØRING
    "188827596":  "VERIFIKASJON/SLUTTFØRING",    # Aksept/Få slettebekreftelse/lage kontrakt
    "188827597":  "VERIFIKASJON/SLUTTFØRING",    # Kontrakt signert
}

# Active stage IDs — used as the search filter. Equals all pipeline stages
# minus the excluded ones below. Update both lists when stages change.
ACTIVE_STAGE_IDS: list[str] = [
    "5095786727", # Pool winback leads
    "1446317287", # Lead qualification
    "188841923",  # Nye leads
    "74384847",   # Kontaktforsøk 1 + SMS
    "5952292069", # Kontaktforsøk 2 + SMS
    "71217910",   # Kontaktforsøk 3 📨
    "1795037396", # Videre fra samtale
    "434020796",  # Publisert B2B
    "5786943711", # Uten bud etter 24t
    "519657156",  # Tilbud klart
    "519657157",  # KF tilbud klart
    "431588053",  # Send tilbud
    "189321201",  # Lead, tilbud sendt
    "122403776",  # Kontaktforsøk 1 + SMS, lead
    "141045495",  # I dialog med kunde 📨
    "185258735",  # Hot lead
    "188827596",  # Aksept/Få slettebekreftelse/lage kontrakt
    "188827597",  # Kontrakt signert
]

# Stage IDs to exclude from deals_current.
# These are avslag, winback, bobil/lastebil and inter-pipeline transfer stages.
EXCLUDED_STAGE_IDS: list[str] = [
    "71217913",    # Avslag
    "122403775",   # Bobil & lastebil
    "2571667699",  # Winback leads
    "2572487916",  # WB 1 - Epost løp WB
    "2572488897",  # WB 2 - Fjernkommisjon WB
    "2572488898",  # WB 3 - Vanlig WB
    "2572488899",  # Hente inn bud - WB
    "2572488900",  # Følg opp spesifikk tid
    "2572488901",  # Avslag etter WB
    "2571667704",  # Solgt før WB
    "433091290",   # Prising etter kontakt
    "872498152",   # Tilbud klart - prising
    "5174318309",  # Lead til Retail Kommisjon
]
