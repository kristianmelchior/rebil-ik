-- Run in Supabase SQL Editor.
-- Lead counts per rep/kategori, filtered by createdate (not contact date).
-- Used for the konvertering-per-kategori bar chart in the stats table.
-- NULL kontakttid_kategori → "Mangler kontakttid" (4th bar).

DROP FUNCTION IF EXISTS get_kontakttid_by_createdate(date, date);

CREATE OR REPLACE FUNCTION get_kontakttid_by_createdate(p_from date, p_to date)
RETURNS TABLE(kode text, teamleder text, kontakttid_kategori text, lead_count bigint)
LANGUAGE sql STABLE AS $kt_create$
  SELECT
    kode::text,
    teamleder::text,
    COALESCE(kontakttid_kategori::text, 'Mangler kontakttid') AS kontakttid_kategori,
    COUNT(*) AS lead_count
  FROM public.leads
  WHERE createdate::date BETWEEN p_from AND p_to
    AND teller_lead = true
  GROUP BY kode, teamleder, COALESCE(kontakttid_kategori::text, 'Mangler kontakttid')
$kt_create$;

-- Verify:
-- SELECT * FROM get_kontakttid_by_createdate('2026-04-01', '2026-04-21') ORDER BY kode, kontakttid_kategori;
