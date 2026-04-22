-- Run in Supabase SQL Editor.
-- Creates get_kontakttid_range: lead counts per rep/kategori for an arbitrary date range.
-- Used by /api/stats for the teamleder/admin stats table.

DROP FUNCTION IF EXISTS get_kontakttid_range(date, date);

CREATE OR REPLACE FUNCTION get_kontakttid_range(p_from date, p_to date)
RETURNS TABLE(kode text, teamleder text, kontakttid_kategori text, lead_count bigint)
LANGUAGE sql STABLE AS $kontakttid_range$
  SELECT
    kode::text,
    teamleder::text,
    COALESCE(kontakttid_kategori::text, 'Ukjent') AS kontakttid_kategori,
    COUNT(*) AS lead_count
  FROM public.leads
  WHERE dato_kontaktet_kunde_main_eller_avslag IS NOT NULL
    AND dato_kontaktet_kunde_main_eller_avslag::date BETWEEN p_from AND p_to
  GROUP BY
    kode,
    teamleder,
    COALESCE(kontakttid_kategori::text, 'Ukjent')
$kontakttid_range$;

-- Verify:
-- SELECT * FROM get_kontakttid_range('2026-04-01', '2026-04-21') LIMIT 20;
