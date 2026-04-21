-- Run in Supabase SQL Editor.
-- Creates two RPCs for platform conversion:
--   get_konv_plattform_monthly  — yearly data grouped by dato_lagt_i_plattform month
--   get_konv_plattform_range    — arbitrary date range (for last-30-days tile)
-- Denominator (createdate count) comes from the existing get_leads_monthly/range RPCs.

DROP FUNCTION IF EXISTS get_konv_plattform_monthly(integer);
DROP FUNCTION IF EXISTS get_konv_plattform_monthly(int);
DROP FUNCTION IF EXISTS get_konv_plattform_range(text, text);

CREATE OR REPLACE FUNCTION get_konv_plattform_monthly(p_year int)
RETURNS TABLE(kode text, teamleder text, month text, plattform_count bigint)
LANGUAGE sql STABLE AS $konvplt$
  SELECT
    kode::text,
    teamleder::text,
    to_char(dato_lagt_i_plattform, 'YYYY-MM') AS month,
    COUNT(*) AS plattform_count
  FROM public.leads
  WHERE dato_lagt_i_plattform IS NOT NULL
    AND EXTRACT(YEAR FROM dato_lagt_i_plattform::date) = p_year
  GROUP BY kode, teamleder, to_char(dato_lagt_i_plattform, 'YYYY-MM')
$konvplt$;

CREATE OR REPLACE FUNCTION get_konv_plattform_range(p_from text, p_to text)
RETURNS TABLE(kode text, teamleder text, plattform_count bigint)
LANGUAGE sql STABLE AS $konvplt_range$
  SELECT
    kode::text,
    teamleder::text,
    COUNT(*) AS plattform_count
  FROM public.leads
  WHERE dato_lagt_i_plattform IS NOT NULL
    AND dato_lagt_i_plattform::date BETWEEN p_from::date AND p_to::date
  GROUP BY kode, teamleder
$konvplt_range$;

-- Verify:
-- SELECT * FROM get_konv_plattform_monthly(2026) LIMIT 10;
-- SELECT * FROM get_konv_plattform_range('2026-03-22', '2026-04-21') LIMIT 10;
