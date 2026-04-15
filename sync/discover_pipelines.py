"""
discover_pipelines.py — Print all HubSpot deal pipelines and their stages.
Run once to find the pipeline ID and stage IDs for config.py.

Usage:
  HUBSPOT_API_KEY=your_key python discover_pipelines.py
"""

import os
import httpx

API_KEY = os.environ["HUBSPOT_API_KEY"]
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

r = httpx.get(
    "https://api.hubapi.com/crm/v3/pipelines/deals",
    headers=HEADERS,
    timeout=30,
)
r.raise_for_status()

for pipeline in r.json().get("results", []):
    print(f"\nPipeline: {pipeline['label']}")
    print(f"  ID: {pipeline['id']}")
    print(f"  Stages:")
    for stage in sorted(pipeline.get("stages", []), key=lambda s: s.get("displayOrder", 0)):
        print(f"    {stage['id']:40}  {stage['label']}")
