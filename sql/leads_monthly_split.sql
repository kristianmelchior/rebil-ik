-- Run in Supabase SQL Editor.
-- Updates get_leads_monthly and get_leads_range to return teller_true and teller_false separately.
-- Must DROP first because the return type changes (Postgres requires this).

-- ── Diagnostic: run this first to see current function signatures ─────────────
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE proname IN ('get_leads_monthly', 'get_leads_range');

-- ── Drop all known variants ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_leads_monthly(integer);
DROP FUNCTION IF EXISTS get_leads_monthly(int);
DROP FUNCTION IF EXISTS get_leads_range(date, date);
DROP FUNCTION IF EXISTS get_leads_range(text, text);
DROP FUNCTION IF EXISTS get_leads_range(varchar, varchar);

-- ── Recreate get_leads_monthly ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_leads_monthly(p_year int)
RETURNS TABLE(kode text, teamleder text, month text, teller_true bigint, teller_false bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    kode::text,
    teamleder::text,
    to_char(createdate, 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE teller_lead = true)  AS teller_true,
    COUNT(*) FILTER (WHERE teller_lead = false) AS teller_false
  FROM public.leads
  WHERE EXTRACT(YEAR FROM createdate::date) = p_year
  GROUP BY kode, teamleder, to_char(createdate, 'YYYY-MM')
$$;

-- ── Recreate get_leads_range (text params to match JS client) ─────────────────
CREATE OR REPLACE FUNCTION get_leads_range(p_from text, p_to text)
RETURNS TABLE(kode text, teamleder text, teller_true bigint, teller_false bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    kode::text,
    teamleder::text,
    COUNT(*) FILTER (WHERE teller_lead = true)  AS teller_true,
    COUNT(*) FILTER (WHERE teller_lead = false) AS teller_false
  FROM public.leads
  WHERE createdate::date BETWEEN p_from::date AND p_to::date
  GROUP BY kode, teamleder
$$;

-- ── Verify (run after the above) ──────────────────────────────────────────────
-- SELECT * FROM get_leads_monthly(2026) LIMIT 5;
-- SELECT * FROM get_leads_range('2026-03-22', '2026-04-21') LIMIT 5;
