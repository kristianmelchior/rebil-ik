-- Run in Supabase SQL Editor.
-- Creates get_kontakttid_monthly: lead counts per rep/month/kategori
-- based on dato_kontaktet_kunde_main_eller_avslag.

DROP FUNCTION IF EXISTS get_kontakttid_monthly(integer);
DROP FUNCTION IF EXISTS get_kontakttid_monthly(int);

CREATE OR REPLACE FUNCTION get_kontakttid_monthly(p_year int)
RETURNS TABLE(kode text, teamleder text, month text, kontakttid_kategori text, lead_count bigint)
LANGUAGE sql STABLE AS $kontakttid$
  SELECT
    kode::text,
    teamleder::text,
    to_char(dato_kontaktet_kunde_main_eller_avslag, 'YYYY-MM') AS month,
    COALESCE(kontakttid_kategori::text, 'Ukjent') AS kontakttid_kategori,
    COUNT(*) AS lead_count
  FROM public.leads
  WHERE dato_kontaktet_kunde_main_eller_avslag IS NOT NULL
    AND EXTRACT(YEAR FROM dato_kontaktet_kunde_main_eller_avslag::date) = p_year
  GROUP BY
    kode,
    teamleder,
    to_char(dato_kontaktet_kunde_main_eller_avslag, 'YYYY-MM'),
    COALESCE(kontakttid_kategori::text, 'Ukjent')
$kontakttid$;

DROP FUNCTION IF EXISTS get_kontakttid_avg_monthly(integer);
DROP FUNCTION IF EXISTS get_kontakttid_avg_monthly(int);

CREATE OR REPLACE FUNCTION get_kontakttid_avg_monthly(p_year int)
RETURNS TABLE(kode text, teamleder text, month text, avg_days numeric)
LANGUAGE sql STABLE AS $kontakttid_avg$
  SELECT
    kode::text,
    teamleder::text,
    to_char(dato_kontaktet_kunde_main_eller_avslag, 'YYYY-MM') AS month,
    ROUND(AVG(dato_kontaktet_kunde_main_eller_avslag::date - createdate::date), 1) AS avg_days
  FROM public.leads
  WHERE dato_kontaktet_kunde_main_eller_avslag IS NOT NULL
    AND createdate IS NOT NULL
    AND EXTRACT(YEAR FROM dato_kontaktet_kunde_main_eller_avslag::date) = p_year
  GROUP BY kode, teamleder, to_char(dato_kontaktet_kunde_main_eller_avslag, 'YYYY-MM')
$kontakttid_avg$;

-- Verify:
-- SELECT * FROM get_kontakttid_monthly(2026) LIMIT 20;
-- SELECT DISTINCT kontakttid_kategori FROM get_kontakttid_monthly(2026);
-- SELECT * FROM get_kontakttid_avg_monthly(2026) LIMIT 10;
