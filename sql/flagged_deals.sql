-- Run in Supabase SQL Editor.
-- Step 1: add hubspot_owner_id column to deals_current (populated by sync.py after deploy).
ALTER TABLE public.deals_current
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text;

-- Step 2: function that returns deals with owner mismatches.
-- Three cases:
--   no_owner      — hubspot_owner_id IS NULL
--   owner_not_rep — hubspot_owner_id is set but not found in reps (admin/ex-employee)
--   owner_mismatch — hubspot_owner_id ≠ referent___owner (owner_id), both non-null

DROP FUNCTION IF EXISTS get_flagged_deals(text);

CREATE OR REPLACE FUNCTION get_flagged_deals(p_tl text DEFAULT NULL)
RETURNS TABLE(
  deal_id    text,
  deal_name  text,
  stage_name text,
  owner_name text,
  ik_name    text,
  reason     text
)
LANGUAGE sql STABLE AS $flagged$
  SELECT
    d.deal_id,
    d.deal_name,
    d.stage_name,
    r_owner.full_name  AS owner_name,
    r_ik.full_name     AS ik_name,
    CASE
      WHEN d.hubspot_owner_id IS NULL                                                    THEN 'no_owner'
      WHEN r_owner.kode IS NULL                                                          THEN 'owner_not_rep'
      WHEN d.hubspot_owner_id IS DISTINCT FROM d.owner_id                               THEN 'owner_mismatch'
    END AS reason
  FROM public.deals_current d
  LEFT JOIN public.reps r_owner ON r_owner.hubspot_id = d.hubspot_owner_id
  LEFT JOIN public.reps r_ik    ON r_ik.hubspot_id    = d.owner_id
  WHERE (
    d.hubspot_owner_id IS NULL
    OR r_owner.kode IS NULL
    OR (d.hubspot_owner_id IS DISTINCT FROM d.owner_id
        AND d.hubspot_owner_id IS NOT NULL
        AND d.owner_id IS NOT NULL)
  )
  AND (p_tl IS NULL OR r_ik.teamleder = p_tl)
  ORDER BY
    CASE
      WHEN d.hubspot_owner_id IS NULL THEN 1
      WHEN r_owner.kode IS NULL       THEN 2
      ELSE 3
    END,
    d.deal_name
$flagged$;

-- Verify:
-- SELECT * FROM get_flagged_deals() LIMIT 20;
-- SELECT * FROM get_flagged_deals('Benjamin Parr') LIMIT 20;
