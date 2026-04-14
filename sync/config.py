# sync/config.py — HubSpot pipeline configuration.
# Edit this file when stage IDs change, then commit.
# Run sync.py once without filters first to discover all stage IDs.

PIPELINE_ID = "22294509"

# Maps stage ID → category label shown in the dashboard.
STAGE_CATEGORY: dict[str, str] = {
    # NYE LEADS
    "5095786727": "NYE LEADS",   # Pool winback leads
    "1446317287": "NYE LEADS",   # Lead qualification
    "188841923":  "NYE LEADS",   # Nye leads
    "1992087774": "NYE LEADS",   # Ferdig estimert
    # INNBYTTE
    "4610331873": "INNBYTTE",    # Innbytte - send til Retail
    # KF1
    "74384847":   "KF1",         # Kontaktforsøk 1 + SMS
    # KF2
    "71217910":   "KF2",         # Kontaktforsøk 2
    # TIL PLATTFORM
    "1795037396": "TIL PLATTFORM",  # Henter inn bud - plattform & prising
    "434020796":  "TIL PLATTFORM",  # Venter på bud
    "519657156":  "TIL PLATTFORM",  # Tilbud klart
    "519657157":  "TIL PLATTFORM",  # KF1
    "519657158":  "TIL PLATTFORM",  # KF2
    # CLOSING
    "431588053":  "CLOSING",     # Send tilbud
    "189321201":  "CLOSING",     # Lead, tilbud sendt
    "122403776":  "CLOSING",     # Kontaktforsøk 1 + SMS, lead
    "122403777":  "CLOSING",     # Kontaktforsøk 2, lead
    "141045495":  "CLOSING",     # I dialog med kunde
    "185258735":  "CLOSING",     # Hot lead
    # VERIFIKASJON/SLUTTFØRING
    "188827594":  "VERIFIKASJON/SLUTTFØRING",  # Videovisning avtalt
    "188827595":  "VERIFIKASJON/SLUTTFØRING",  # Videovisning under arbeid
    "188827596":  "VERIFIKASJON/SLUTTFØRING",  # Aksept/Få slettebekreftelse/lage kontrakt
    "188827597":  "VERIFIKASJON/SLUTTFØRING",  # Kontrakt signert
    "3677025490": "VERIFIKASJON/SLUTTFØRING",  # Rebil salgshjeeeelp
}

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
