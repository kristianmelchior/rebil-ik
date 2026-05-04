-- Run in Supabase SQL Editor.
-- Step 1: settings table (key/value store for app config)
CREATE TABLE IF NOT EXISTS public.settings (
  key   text PRIMARY KEY,
  value text
);

-- Step 2: update get_flagged_deals to support ansvarlig_tl
-- (adding a param changes the signature, so we drop both possible old signatures first)
DROP FUNCTION IF EXISTS get_flagged_deals(text);
DROP FUNCTION IF EXISTS get_flagged_deals(text, text);

CREATE OR REPLACE FUNCTION get_flagged_deals(p_tl text DEFAULT NULL, p_ansvarlig_tl text DEFAULT NULL)
RETURNS TABLE(
  deal_id          text,
  deal_name        text,
  stage_name       text,
  owner_name       text,
  hubspot_owner_id text,
  ik_name          text,
  ik_kode          text,
  create_date      timestamptz,
  reason           text
)
LANGUAGE sql STABLE AS $flagged$
  SELECT
    d.deal_id,
    d.deal_name,
    d.stage_name,
    r_owner.full_name    AS owner_name,
    d.hubspot_owner_id,
    r_ik.full_name       AS ik_name,
    r_ik.kode            AS ik_kode,
    d.create_date,
    CASE
      WHEN d.hubspot_owner_id IS NULL                               THEN 'no_owner'
      WHEN r_owner.kode IS NULL                                     THEN 'owner_not_rep'
      WHEN d.hubspot_owner_id IS DISTINCT FROM d.owner_id          THEN 'owner_mismatch'
    END AS reason
  FROM public.deals_current d
  LEFT JOIN public.reps r_owner ON r_owner.hubspot_id = d.hubspot_owner_id
  LEFT JOIN public.reps r_ik    ON r_ik.hubspot_id    = d.owner_id
  WHERE d.create_date < now() - interval '30 minutes'
  AND (
    d.hubspot_owner_id IS NULL
    OR r_owner.kode IS NULL
    OR (d.hubspot_owner_id IS DISTINCT FROM d.owner_id
        AND d.hubspot_owner_id IS NOT NULL
        AND d.owner_id IS NOT NULL)
  )
  AND (
    p_tl IS NULL                                                       -- superadmin: show all
    OR r_ik.teamleder = p_tl                                           -- normal TL filter
    OR (p_tl = p_ansvarlig_tl AND d.owner_id IS NULL)                 -- ansvarlig TL sees no-IK deals
  )
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
-- SELECT * FROM get_flagged_deals('Benjamin Parr', 'Benjamin Parr') LIMIT 20;
