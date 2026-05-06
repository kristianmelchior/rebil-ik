-- Run in Supabase SQL Editor.
-- Returns leads håndtert (dealeier_ik = p_name) per month + leads_kategori for one rep.
-- Used by the IK-dash Leads trend chart (breakdown by kategori).

DROP FUNCTION IF EXISTS get_leads_handled_monthly_by_kategori(text, int);

CREATE OR REPLACE FUNCTION get_leads_handled_monthly_by_kategori(p_name text, p_year int)
RETURNS TABLE(month text, leads_kategori text, count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    to_char(createdate, 'YYYY-MM')               AS month,
    COALESCE(leads_kategori, 'Ukjent')           AS leads_kategori,
    COUNT(*)                                      AS count
  FROM public.leads
  WHERE dealeier_ik = p_name
    AND EXTRACT(YEAR FROM createdate::date) = p_year
  GROUP BY to_char(createdate, 'YYYY-MM'), COALESCE(leads_kategori, 'Ukjent')
  ORDER BY month, leads_kategori
$$;

-- Verify:
-- SELECT * FROM get_leads_handled_monthly_by_kategori('Karl Magnus Slorafoss', 2026);
