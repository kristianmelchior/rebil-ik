// Pure transform functions — no Supabase imports, no side effects.
// Converts raw DB rows into typed metrics and assembles the RepDashboard payload.

import type { SaleRow, LeadRow, NpsRow, Rep, PeriodMetrics, RepDashboard } from './types'
import { computeBonus } from './bonus'

// Filter rows to those matching a specific rep kode.
// Input: rows (array with kode field), kode (rep UUID)  Output: filtered rows
function filterByKode<T extends { kode: string | null }>(rows: T[], kode: string): T[] {
  return rows.filter(r => r.kode === kode)
}

/** Exclude unknown placeholder rep from team median (same idea as NPS pipeline). */
function skipKodeForTeamMedian(kode: string | null | undefined): boolean {
  if (kode == null || kode === '') return true
  return kode === 'zz_unknown'
}

// Filter rows by date range (inclusive) using string comparison.
// YYYY-MM-DD strings sort lexicographically — no Date parsing needed.
// Input: rows, dateField (key containing YYYY-MM-DD string), from/to strings
// Output: rows where dateField is within [from, to]
function filterByDateRange<T>(rows: T[], dateField: keyof T, from: string, to: string): T[] {
  return rows.filter(r => {
    const d = r[dateField] as string
    return d >= from && d <= to
  })
}

// Compute PeriodMetrics from a set of rows already filtered to one rep and period.
// bilerKjopt = SUM(biler) not COUNT(*). konverteringsrate null if leads === 0.
// Input: saleRows, leadRows, npsRows  Output: PeriodMetrics
function computeMetrics(
  saleRows: SaleRow[],
  leadRows: LeadRow[],
  npsRows: NpsRow[]
): PeriodMetrics {
  const bilerKjopt = saleRows.reduce((sum, r) => sum + r.biler, 0)
  const leads = leadRows.filter(r => r.teller_lead).length
  const konverteringsrate = leads === 0 ? null : (bilerKjopt / leads) * 100

  const npsValues = npsRows.map(r => r.nps_adj_score)
  const npsScore = npsValues.length === 0
    ? null
    : npsValues.reduce((sum, v) => sum + v, 0) / npsValues.length

  return { bilerKjopt, leads, konverteringsrate, npsScore, npsCount: npsValues.length }
}

// Compute the statistical median of a numeric array.
// Input: values (number[])  Output: median or null if empty
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// Compute team-wide PeriodMetrics median for a date range.
// Collects all unique rep kodes from all three tables, computes per-rep metrics,
// then takes the median of each field (nulls excluded from median calculation).
// Input: all year rows for all reps, from/to date strings  Output: PeriodMetrics
function computeTeamMedian(
  allSaleRows: SaleRow[],
  allLeadRows: LeadRow[],
  allNpsRows: NpsRow[],
  from: string,
  to: string
): PeriodMetrics {
  const salesInRange = filterByDateRange(allSaleRows, 'dato_kjopt', from, to)
  const leadsInRange = filterByDateRange(allLeadRows, 'createdate', from, to)
  const npsInRange   = filterByDateRange(allNpsRows,  'month',       from, to)

  const kodeSet = new Set<string>()
  for (const r of salesInRange) {
    if (!skipKodeForTeamMedian(r.kode)) kodeSet.add(r.kode)
  }
  for (const r of leadsInRange) {
    if (!skipKodeForTeamMedian(r.kode)) kodeSet.add(r.kode)
  }
  for (const r of npsInRange) {
    const k = r.kode
    if (k != null && !skipKodeForTeamMedian(k)) kodeSet.add(k)
  }

  const kodes = Array.from(kodeSet)
  if (kodes.length === 0) {
    return { bilerKjopt: 0, leads: 0, konverteringsrate: null, npsScore: null, npsCount: 0 }
  }

  const perRep = kodes.map(kode => computeMetrics(
    filterByKode(salesInRange, kode),
    filterByKode(leadsInRange, kode),
    filterByKode(npsInRange,   kode),
  ))

  return {
    bilerKjopt:        median(perRep.map(m => m.bilerKjopt)) ?? 0,
    leads:             median(perRep.map(m => m.leads)) ?? 0,
    konverteringsrate: median(perRep.map(m => m.konverteringsrate).filter((v): v is number => v !== null)),
    npsScore:          median(perRep.map(m => m.npsScore).filter((v): v is number => v !== null)),
    npsCount:          0,
  }
}

// Generate YYYY-MM keys for all 12 months of a given year (Jan–Dec).
// Input: year (number)  Output: ['YYYY-01', 'YYYY-02', ..., 'YYYY-12']
function buildYearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, '0')}`
  )
}

// Build per-rep trend for all 12 months of the year (Jan–Dec), oldest first.
// Future months return real zeros — TrendCharts.tsx converts them to null for rendering.
// Input: rep's saleRows/leadRows/npsRows (already kode-filtered), year
// Output: 12 entries of (PeriodMetrics & { month: string })
function buildTrend(
  saleRows: SaleRow[],
  leadRows: LeadRow[],
  npsRows: NpsRow[],
  year: number
): (PeriodMetrics & { month: string })[] {
  return buildYearMonthKeys(year).map(ym => ({
    month: ym,
    ...computeMetrics(
      filterByDateRange(saleRows, 'dato_kjopt', `${ym}-01`, `${ym}-31`),
      filterByDateRange(leadRows, 'createdate', `${ym}-01`, `${ym}-31`),
      filterByDateRange(npsRows,  'month',      `${ym}-01`, `${ym}-31`),
    ),
  }))
}

// Build team median trend for all 12 months of the year (Jan–Dec), oldest first.
// Input: all-rep rows, year  Output: 12 entries of (PeriodMetrics & { month: string })
function buildMedianTrend(
  allSaleRows: SaleRow[],
  allLeadRows: LeadRow[],
  allNpsRows: NpsRow[],
  year: number
): (PeriodMetrics & { month: string })[] {
  return buildYearMonthKeys(year).map(ym => ({
    month: ym,
    ...computeTeamMedian(allSaleRows, allLeadRows, allNpsRows, `${ym}-01`, `${ym}-31`),
  }))
}

// Master function — assembles the full RepDashboard from raw DB rows.
// Filters by rep, computes current-month + last-30-day metrics, trend, bonus, and table data.
// Input: rep (Rep), allSales/allLeads/allNps (full-year rows for all reps)
// Output: RepDashboard
export function buildDashboard(
  rep: Rep,
  allSales: SaleRow[],
  allLeads: LeadRow[],
  allNps: NpsRow[]
): RepDashboard {
  const today = new Date()
  const year  = today.getFullYear()
  const month = today.getMonth() + 1 // 1-based
  const todayStr          = today.toISOString().slice(0, 10)
  const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const currentMonthKey   = `${year}-${String(month).padStart(2, '0')}`

  const last30Date = new Date(today)
  last30Date.setDate(last30Date.getDate() - 30)
  const last30Start = last30Date.toISOString().slice(0, 10)

  // Isolate this rep's rows
  const repSales = filterByKode(allSales, rep.kode)
  const repLeads = filterByKode(allLeads, rep.kode)
  const repNps   = filterByKode(allNps,   rep.kode)

  // Current-month slices
  const repSalesMonth = filterByDateRange(repSales, 'dato_kjopt', currentMonthStart, todayStr)
  const repLeadsMonth = filterByDateRange(repLeads, 'createdate', currentMonthStart, todayStr)
  const repNpsMonth   = filterByDateRange(repNps,   'month',      currentMonthStart, todayStr)

  // Last-30-day slices
  const repSales30 = filterByDateRange(repSales, 'dato_kjopt', last30Start, todayStr)
  const repLeads30 = filterByDateRange(repLeads, 'createdate', last30Start, todayStr)
  const repNps30   = filterByDateRange(repNps,   'month',      last30Start, todayStr)

  // Group all rep sales by 'YYYY-MM' key for the BonusPanel month selector
  const salesByMonth: Record<string, SaleRow[]> = {}
  for (const sale of repSales) {
    const ym = sale.dato_kjopt.slice(0, 7)
    if (!salesByMonth[ym]) salesByMonth[ym] = []
    salesByMonth[ym].push(sale)
  }

  return {
    rep,
    currentMonth:        computeMetrics(repSalesMonth, repLeadsMonth, repNpsMonth),
    last30Days:          computeMetrics(repSales30,    repLeads30,    repNps30),
    medianCurrentMonth:  computeTeamMedian(allSales, allLeads, allNps, currentMonthStart, todayStr),
    medianLast30Days:    computeTeamMedian(allSales, allLeads, allNps, last30Start, todayStr),
    trend:               buildTrend(repSales, repLeads, repNps, year),
    medianTrend:         buildMedianTrend(allSales, allLeads, allNps, year),
    bonus:               computeBonus(rep, repSalesMonth, repLeadsMonth, repNpsMonth),
    salesThisMonth:      salesByMonth[currentMonthKey] ?? [],
    salesByMonth,
    lastUpdated:         new Date().toISOString(),
  }
}
