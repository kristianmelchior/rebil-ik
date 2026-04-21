// GET /api/stats?mode=month|30d  OR  ?period=YYYY-MM
// Admin and teamleder only — returns per-rep metrics for all reps with a defined kode.

import { cookies } from 'next/headers'
import { getAllSales, getLeadsRange, getAllNps, getAllRepsWithDetails, getRepByKode } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  isTeamleder,
} from '@/lib/auth'
import type { SaleRow, NpsRow, LeadRangeAgg } from '@/lib/types'

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
  konvertering: number | null
  npsScore: number | null
  fullprisPct: number | null
  fastprisPct: number | null
}

export interface StatsData {
  rows: RepStatsEntry[]
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

const PRIS_SET = new Set(['Pris', 'Rabattnivå 1', 'Rabattnivå 2', 'Minstepris'])

function buildMetrics(
  sales: SaleRow[], leadsAgg: LeadRangeAgg[], nps: NpsRow[], from: string, to: string,
  reps: { kode: string; full_name: string; teamleder: string }[]
): RepStatsEntry[] {
  const periodSales = sales.filter(s => s.dato_kjopt >= from && s.dato_kjopt <= to)
  const periodNps   = nps.filter(n   => n.submitted_at >= from && n.submitted_at <= to)

  // Pre-build lead count map for O(1) lookups (RPC returns one row per kode)
  const leadCountMap = new Map<string, number>()
  for (const l of leadsAgg) {
    leadCountMap.set(l.kode, (leadCountMap.get(l.kode) ?? 0) + Number(l.teller_true))
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

    // NPS
    const repNps = periodNps.filter(n => n.kode === k)
    const npsScore = repNps.length === 0
      ? null
      : repNps.reduce((sum, n) => sum + n.nps_adj_score, 0) / repNps.length

    // fullprisPct
    let prisBiler = 0, totalPrisBiler = 0
    for (const s of repSales) {
      if (!s.prisgrense || !PRIS_SET.has(s.prisgrense)) continue
      const b = s.biler ?? 0
      totalPrisBiler += b
      if (s.prisgrense === 'Pris') prisBiler += b
    }
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

    return {
      kode: k,
      rep_name: rep.full_name,
      teamleder: rep.teamleder,
      teamlederInitials: initials(rep.teamleder),
      bilerKjopt,
      leads: leadsCount,
      konvertering,
      npsScore,
      fullprisPct,
      fastprisPct,
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
    const [reps, { sales, nps }, leadsAgg] = await Promise.all([
      getAllRepsWithDetails(),
      fetchYears(from, to),
      getLeadsRange(from, to),
    ])

    // Only include reps with a non-empty kode (skip zz_unknown etc.)
    const activeReps = reps.filter(r => !skipKode(r.kode))
    const rows = buildMetrics(sales, leadsAgg, nps, from, to, activeReps)

    return Response.json({ rows, from, to } satisfies StatsData, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' },
    })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
