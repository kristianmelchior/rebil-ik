-- Run in Supabase SQL Editor.
-- Creates get_lead_tildeling: counts per person of leads gained (tildelt) and lost (mistet).
-- Tildelt: rep_name = person AND dealowner_assigned_to IS DISTINCT FROM rep_name
-- Mistet:  dealowner_assigned_to = person AND rep_name IS DISTINCT FROM dealowner_assigned_to
-- Groups by name only (MAX teamleder) to avoid duplicates when a person spans multiple teams.

DROP FUNCTION IF EXISTS get_lead_tildeling(date, date);

CREATE OR REPLACE FUNCTION get_lead_tildeling(p_from date, p_to date)
RETURNS TABLE(
  name        text,
  teamleder   text,
  tildelt     bigint,
  mistet      bigint
)
LANGUAGE sql STABLE AS $tildeling$
  WITH base AS (
    SELECT rep_name, dealowner_assigned_to, teamleder
    FROM public.leads
    WHERE createdate::date BETWEEN p_from AND p_to
      AND rep_name IS NOT NULL
      AND rep_name IS DISTINCT FROM dealowner_assigned_to
  ),
  incoming AS (
    SELECT rep_name AS name, MAX(teamleder) AS teamleder, COUNT(*) AS cnt
    FROM base
    GROUP BY rep_name
  ),
  outgoing AS (
    SELECT dealowner_assigned_to AS name, MAX(teamleder) AS teamleder, COUNT(*) AS cnt
    FROM base
    WHERE dealowner_assigned_to IS NOT NULL
    GROUP BY dealowner_assigned_to
  )
  SELECT
    COALESCE(i.name, o.name)           AS name,
    COALESCE(i.teamleder, o.teamleder) AS teamleder,
    COALESCE(i.cnt, 0)                 AS tildelt,
    COALESCE(o.cnt, 0)                 AS mistet
  FROM incoming i
  FULL OUTER JOIN outgoing o ON i.name = o.name
$tildeling$;

-- Verify:
-- SELECT * FROM get_lead_tildeling('2026-04-01', '2026-04-30') ORDER BY tildelt DESC;
