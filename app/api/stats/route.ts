// GET /api/stats?mode=month|30d  OR  ?period=YYYY-MM
// Admin and teamleder only — returns per-rep metrics for all reps with a defined kode.

import { cookies } from 'next/headers'
import { getAllSales, getLeadsRange, getAllNps, getAllRepsWithDetails, getRepByKode, getKonvPlattformRange, getKontakttidRange, getKontakttidAvgMonthly, getKonvPerKontakttid, getLeadsHandledRange } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  isTeamleder,
} from '@/lib/auth'
import type { SaleRow, NpsRow, LeadRangeAgg, KonvPlattformRangeAgg, KontakttidRangeAgg, KontakttidAvgAgg, KonvPerKontakttidRow } from '@/lib/types'

function skipKode(kode: string | null | undefined): boolean {
  return kode == null || kode === '' || kode === 'zz_unknown'
}

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase()
}

export interface RepStatsEntry {
  kode: string
  rep_name: string
  teamleder: string
  teamlederInitials: string
  bilerKjopt: number
  leads: number
  leadsHandtert: number
  konvertering: number | null
  konverteringHandtert: number | null
  npsScore: number | null
  fullprisPct: number | null
  fastprisPct: number | null
  konvPlattformRate: number | null        // plattform_count / leads (0–1), null if no leads
  sameDagPct: number | null               // share of "1. Samme dag" kontakttid category (0–1)
  kontakttidBreakdown: Record<string, number>  // category → lead_count
  avgKontakttidDays: number | null        // average days from lead received to first contact
  // Antall videre breakdown
  kommisjon:           number
  fjernkommisjon:      number
  salgshjelp:          number
  vrakbiler:           number
  plattformCount:      number
  nettoAntallVidere:   number               // salesNetto (dedup by hs_deal_id) + plattformCount
  // Prisgrense breakdown (excl. b2b_scrap): biler per kategori
  prisBreakdown: Record<string, number>
  // Biler kjøpt breakdown by tjeneste (kolonne Z i Kjøpte biler-arket)
  tjenesteBreakdown: Record<string, number>
  // Konvertering fra plattform: alle kjøpte biler / antall lagt i plattform
  // B2B og Retail går alltid gjennom plattform; Kommisjon/Fjernkom/Vrak/Salgshjelp delvis.
  konvFraPlattform:    number | null        // bilerKjøpt / plattformCount (null if 0 plattform leads)
}

export interface StatsData {
  rows: RepStatsEntry[]
  konvPerKontakttid: KonvPerKontakttidRow[]
  from: string
  to: string
}

function dateRange(mode: string | null, period: string | null): { from: string; to: string } {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [py, pm] = period.split('-').map(Number)
    const lastDay = new Date(py, pm, 0).getDate()
    return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` }
  }
  if (mode === '30d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 30)
    return { from: d.toISOString().slice(0, 10), to: todayStr }
  }
  // default: current month
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: todayStr }
}

async function fetchYears(from: string, to: string) {
  const fromYear = parseInt(from.slice(0, 4))
  const toYear   = parseInt(to.slice(0, 4))
  if (fromYear === toYear) {
    const [s, n] = await Promise.all([getAllSales(fromYear), getAllNps(fromYear)])
    return { sales: s, nps: n }
  }
  // spans two years (e.g. 30d in early January)
  const [s1, n1, s2, n2] = await Promise.all([
    getAllSales(fromYear), getAllNps(fromYear),
    getAllSales(toYear),   getAllNps(toYear),
  ])
  return { sales: [...s1, ...s2], nps: [...n1, ...n2] }
}

const PRIS_CATS = ['Pris', 'Rabatt 1', 'Rabatt 2', 'Minstepris'] as const
const PRIS_SET  = new Set(PRIS_CATS)

function buildMetrics(
  sales: SaleRow[], leadsAgg: LeadRangeAgg[], nps: NpsRow[], from: string, to: string,
  reps: { kode: string; full_name: string; teamleder: string }[],
  konvPlattformAgg: KonvPlattformRangeAgg[],
  kontakttidAgg: KontakttidRangeAgg[],
  kontakttidAvgAgg: KontakttidAvgAgg[],
  leadsHandledByName: Map<string, number>,
): RepStatsEntry[] {
  const periodSales = sales.filter(s => s.dato_kjopt >= from && s.dato_kjopt <= to)
  const periodNps   = nps.filter(n   => n.submitted_at >= from && n.submitted_at <= to)

  // Pre-build lead count map for O(1) lookups (RPC returns one row per kode)
  const leadCountMap = new Map<string, number>()
  for (const l of leadsAgg) {
    leadCountMap.set(l.kode, (leadCountMap.get(l.kode) ?? 0) + Number(l.teller_true))
  }

  // konvPlattform: plattform_count per kode
  const konvPlattformMap = new Map<string, number>()
  for (const k of konvPlattformAgg) {
    konvPlattformMap.set(k.kode, (konvPlattformMap.get(k.kode) ?? 0) + Number(k.plattform_count))
  }

  // kontakttid: group by kode → category → count
  const kontakttidMap = new Map<string, Map<string, number>>()
  for (const k of kontakttidAgg) {
    if (!kontakttidMap.has(k.kode)) kontakttidMap.set(k.kode, new Map())
    const catMap = kontakttidMap.get(k.kode)!
    catMap.set(k.kontakttid_kategori, (catMap.get(k.kontakttid_kategori) ?? 0) + Number(k.lead_count))
  }

  // avg kontakttid: filter monthly data to months within range, then average per rep
  const fromYM = from.slice(0, 7)  // YYYY-MM
  const toYM   = to.slice(0, 7)
  const avgKontakttidMap = new Map<string, number>()
  const avgAccum = new Map<string, { sum: number; count: number }>()
  for (const k of kontakttidAvgAgg) {
    if (k.month < fromYM || k.month > toYM) continue
    const acc = avgAccum.get(k.kode) ?? { sum: 0, count: 0 }
    acc.sum += Number(k.avg_days)
    acc.count += 1
    avgAccum.set(k.kode, acc)
  }
  for (const [kode, { sum, count }] of avgAccum) {
    avgKontakttidMap.set(kode, sum / count)
  }

  return reps.map(rep => {
    const k = rep.kode

    // bilerKjopt
    const repSales = periodSales.filter(s => s.kode === k)
    const bilerKjopt = repSales.reduce((sum, s) => sum + (s.biler ?? 0), 0)

    // leads
    const leadsCount = leadCountMap.get(k) ?? 0

    // konvertering
    const konvertering = leadsCount === 0 ? null : (bilerKjopt / leadsCount) * 100
    const leadsHandtert = leadsHandledByName.get(rep.full_name) ?? 0
    const konverteringHandtert = leadsHandtert === 0 ? null : (bilerKjopt / leadsHandtert) * 100

    // NPS
    const repNps = periodNps.filter(n => n.kode === k)
    const npsScore = repNps.length === 0
      ? null
      : repNps.reduce((sum, n) => sum + n.nps_adj_score, 0) / repNps.length

    // fullprisPct + prisBreakdown (excl. b2b_scrap; all non-null prisgrense values included)
    const prisBreakdown: Record<string, number> = {}
    let prisBiler = 0
    for (const s of repSales) {
      if (s.innkjopstype === 'b2b_scrap') continue
      if (!s.prisgrense) continue
      const b = s.biler ?? 0
      prisBreakdown[s.prisgrense] = (prisBreakdown[s.prisgrense] ?? 0) + b
      if (s.prisgrense === 'Pris') prisBiler += b
    }
    const totalPrisBiler = Object.values(prisBreakdown).reduce((s, v) => s + v, 0)
    const fullprisPct = totalPrisBiler === 0 ? null : prisBiler / totalPrisBiler

    // fastprisPct
    let fastprisBiler = 0
    for (const s of repSales) {
      const b = s.biler ?? 0
      if (b <= 0) continue
      if (s.bonustype !== 'Salgshjelp' && (s.salgstype === 'B2B' || s.salgstype === 'Retail')) {
        fastprisBiler += b
      }
    }
    const fastprisPct = bilerKjopt === 0 ? null : fastprisBiler / bilerKjopt

    const plattformCount    = konvPlattformMap.get(k) ?? 0
    const konvPlattformRate = leadsCount === 0 ? null : plattformCount / leadsCount

    // Antall videre breakdown
    const kommisjon      = repSales.filter(s => s.salgstype === 'Kommisjon').reduce((n, s) => n + (s.biler ?? 0), 0)
    const fjernkommisjon = repSales.filter(s => s.salgstype === 'Fjernkommisjon').reduce((n, s) => n + (s.biler ?? 0), 0)
    const salgshjelp     = repSales.filter(s => s.bonustype === 'Salgshjelp').reduce((n, s) => n + (s.biler ?? 0), 0)
    const vrakbiler      = repSales.filter(s => s.innkjopstype === 'b2b_scrap').reduce((n, s) => n + (s.biler ?? 0), 0)
    const qualifyingSales = repSales.filter(s =>
      s.salgstype === 'Kommisjon' || s.salgstype === 'Fjernkommisjon' ||
      s.bonustype === 'Salgshjelp' || s.innkjopstype === 'b2b_scrap'
    )
    const salesNettoMap = new Map<string, number>()
    for (const s of qualifyingSales) {
      const key = s.hs_deal_id ?? `_id_${s.id}`
      salesNettoMap.set(key, (salesNettoMap.get(key) ?? 0) + (s.biler ?? 0))
    }
    const salesNetto      = [...salesNettoMap.values()].reduce((sum, b) => sum + b, 0)
    const nettoAntallVidere = salesNetto + plattformCount

    // tjeneste breakdown
    const tjenesteBreakdown: Record<string, number> = {}
    for (const s of repSales) {
      const t = s.tjeneste ?? 'Ukjent'
      tjenesteBreakdown[t] = (tjenesteBreakdown[t] ?? 0) + (s.biler ?? 0)
    }

    // Konvertering fra plattform: bilerKjøpt / plattformCount
    const konvFraPlattform = plattformCount === 0 ? null : bilerKjopt / plattformCount

    const catMap = kontakttidMap.get(k)
    const sameDagCount = catMap?.get('1. Samme dag') ?? 0
    const sameDagPct = leadsCount === 0 ? null : sameDagCount / leadsCount
    const kontakttidBreakdown: Record<string, number> = catMap ? Object.fromEntries(catMap.entries()) : {}
    const avgKontakttidDays = avgKontakttidMap.get(k) ?? null

    return {
      kode: k,
      rep_name: rep.full_name,
      teamleder: rep.teamleder,
      teamlederInitials: initials(rep.teamleder),
      bilerKjopt,
      leads: leadsCount,
      leadsHandtert,
      konvertering,
      konverteringHandtert,
      npsScore,
      fullprisPct,
      fastprisPct,
      konvPlattformRate,
      sameDagPct,
      kontakttidBreakdown,
      avgKontakttidDays,
      kommisjon,
      fjernkommisjon,
      salgshjelp,
      vrakbiler,
      plattformCount,
      nettoAntallVidere,
      prisBreakdown,
      tjenesteBreakdown,
      konvFraPlattform,
    }
  })
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const repKode = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!isAdmin) {
    if (!repKode) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const rep = await getRepByKode(repKode)
    if (!rep || !isTeamleder(rep.rolle)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { searchParams } = new URL(request.url)
  const mode   = searchParams.get('mode')
  const period = searchParams.get('period')

  const { from, to } = dateRange(mode, period)

  try {
    const fromYear = parseInt(from.slice(0, 4))
    const toYear   = parseInt(to.slice(0, 4))

    const [reps, { sales, nps }, leadsAgg, konvPlattformAgg, kontakttidAgg, konvPerKontakttid, leadsHandledAgg, avgCur, avgPrev] = await Promise.all([
      getAllRepsWithDetails(),
      fetchYears(from, to),
      getLeadsRange(from, to),
      getKonvPlattformRange(from, to).catch((e) => { console.error('[stats] konvPlattformRange:', e); return [] as KonvPlattformRangeAgg[] }),
      getKontakttidRange(from, to).catch((e) => { console.error('[stats] kontakttidRange:', e); return [] as KontakttidRangeAgg[] }),
      getKonvPerKontakttid(from, to).catch((e) => { console.error('[stats] konvPerKontakttid:', e); return [] as KonvPerKontakttidRow[] }),
      getLeadsHandledRange(from, to).catch(() => [] as { dealeier_ik: string; count: number }[]),
      getKontakttidAvgMonthly(fromYear).catch(() => [] as KontakttidAvgAgg[]),
      fromYear !== toYear ? getKontakttidAvgMonthly(toYear).catch(() => [] as KontakttidAvgAgg[]) : Promise.resolve([] as KontakttidAvgAgg[]),
    ])
    const kontakttidAvgAgg = [...avgCur, ...avgPrev]

    const leadsHandledByName = new Map<string, number>()
    for (const r of leadsHandledAgg) leadsHandledByName.set(r.dealeier_ik, r.count)

    // Only include reps with a non-empty kode (skip zz_unknown etc.)
    const activeReps = reps.filter(r => !skipKode(r.kode))
    const rows = buildMetrics(sales, leadsAgg, nps, from, to, activeReps, konvPlattformAgg, kontakttidAgg, kontakttidAvgAgg, leadsHandledByName)

    return Response.json({ rows, konvPerKontakttid, from, to } satisfies StatsData, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' },
    })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
