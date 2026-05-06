-- Run in Supabase SQL Editor.
-- Creates get_leads_handled_range: counts leads per dealeier_ik for a date range.
-- Used by the Tabell view to show "Leads håndtert" per rep.
-- Uses GROUP BY in the database to avoid Supabase's 1000-row client-side limit.

DROP FUNCTION IF EXISTS get_leads_handled_range(date, date);

CREATE OR REPLACE FUNCTION get_leads_handled_range(p_from date, p_to date)
RETURNS TABLE(dealeier_ik text, count bigint)
LANGUAGE sql STABLE AS $$
  SELECT dealeier_ik, COUNT(*) AS count
  FROM public.leads
  WHERE createdate BETWEEN p_from AND p_to
    AND dealeier_ik IS NOT NULL
    AND dealeier_ik != ''
  GROUP BY dealeier_ik
$$;

-- Verify:
-- SELECT * FROM get_leads_handled_range('2026-04-01', '2026-04-30') ORDER BY count DESC;
