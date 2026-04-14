# sync/config.py — HubSpot pipeline configuration.
# Edit this file when stage IDs change, then commit.
# Run sync.py once without filters first to discover all stage IDs.

PIPELINE_ID = "default"

# Stage IDs to exclude from deals_current (closed/lost deals).
# Find these by running sync.py without filters and inspecting the output.
EXCLUDED_STAGE_IDS: list[str] = [
    # "closedwon",
    # "closedlost",
    # Add real stage IDs here after first sync run
]
