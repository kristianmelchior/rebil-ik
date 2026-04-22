-- Run in Supabase SQL Editor.
-- Conversion rate per kontakttid_kategori.
-- Leads:  COUNT by createdate in period
-- Kjøpt:  COUNT by dato_kontrakt in period
-- Both from the leads table. NULL kontakttid_kategori excluded.

DROP FUNCTION IF EXISTS get_konv_per_kontakttid(date, date);

CREATE OR REPLACE FUNCTION get_konv_per_kontakttid(p_from date, p_to date)
RETURNS TABLE(kontakttid_kategori text, leads bigint, kjopt bigint)
LANGUAGE sql STABLE AS $konv_kt$
  SELECT
    kontakttid_kategori,
    COUNT(*) FILTER (WHERE createdate::date  BETWEEN p_from AND p_to) AS leads,
    COUNT(*) FILTER (WHERE dato_kontrakt::date BETWEEN p_from AND p_to) AS kjopt
  FROM public.leads
  WHERE kontakttid_kategori IS NOT NULL
    AND kontakttid_kategori NOT LIKE '9.%'
    AND (createdate::date BETWEEN p_from AND p_to
      OR dato_kontrakt::date BETWEEN p_from AND p_to)
  GROUP BY kontakttid_kategori
  ORDER BY kontakttid_kategori
$konv_kt$;

-- Verify:
-- SELECT *, ROUND(kjopt::numeric / NULLIF(leads, 0) * 100, 1) AS konv_pct
-- FROM get_konv_per_kontakttid('2026-04-01', '2026-04-21');
