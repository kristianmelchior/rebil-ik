# sync/config.py — HubSpot pipeline configuration.
# Edit this file when stage IDs change, then commit.
# Run sync.py once without filters first to discover all stage IDs.

PIPELINE_ID = "22294509"

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
