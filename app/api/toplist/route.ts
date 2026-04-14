// GET /api/toplist?period=YYYY-MM — team leaderboard for a given month.

import { cookies } from 'next/headers'
import { getAllSales, getLeadsRange, getAllNps } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  TEAM_VIEW_KODE_COOKIE_NAME,
} from '@/lib/auth'
import type { SaleRow, NpsRow } from '@/lib/types'

function skipKode(kode: string | null | undefined): boolean {
  return kode == null || kode === '' || kode === 'zz_unknown'
}

interface ToplistEntry {
  kode: string
  rep_name: string
  value: number
}

export interface ToplistData {
  bilerKjopt:   ToplistEntry[]
  fullpris:     ToplistEntry[]
  konvertering: ToplistEntry[]
  nps:          ToplistEntry[]
}

function buildRepNameMap(
  sales: SaleRow[], nps: NpsRow[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of sales) if (!skipKode(r.kode)) map.set(r.kode, r.rep_name)
  for (const r of nps)   if (!skipKode(r.kode) && r.kode) map.set(r.kode!, r.rep_name)
  return map
}

function top3(entries: { kode: string; value: number }[], nameMap: Map<string, string>): ToplistEntry[] {
  return entries
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(e => ({ kode: e.kode, rep_name: nameMap.get(e.kode) ?? e.kode, value: e.value }))
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const isAdmin    = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const repKode    = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const teamView   = cookieStore.get(TEAM_VIEW_KODE_COOKIE_NAME)?.value

  if (!isAdmin && !repKode && !teamView) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return Response.json({ error: 'Invalid period' }, { status: 400 })
  }

  const year = parseInt(period.slice(0, 4))
  const month = parseInt(period.slice(5, 7))
  const lastDay = new Date(year, month, 0).getDate()
  const from = `${period}-01`
  const to   = `${period}-${String(lastDay).padStart(2, '0')}`

  try {
    const [allSales, leadsAgg, allNps] = await Promise.all([
      getAllSales(year),
      getLeadsRange(from, to),
      getAllNps(year),
    ])

    const sales = allSales.filter(s => s.dato_kjopt >= from && s.dato_kjopt <= to)
    const nps   = allNps.filter(n   => n.submitted_at >= from && n.submitted_at <= to)

    const nameMap = buildRepNameMap(sales, nps)
    const kodes   = Array.from(nameMap.keys())

    // ── Biler kjøpt ──
    const bilerMap = new Map<string, number>()
    for (const s of sales) {
      if (skipKode(s.kode)) continue
      bilerMap.set(s.kode, (bilerMap.get(s.kode) ?? 0) + (s.biler ?? 0))
    }

    // ── Andel fullpris ──
    const prisMap = new Map<string, { pris: number; total: number }>()
    const PRIS_SET = new Set(['Pris', 'Rabattnivå 1', 'Rabattnivå 2', 'Minstepris'])
    for (const s of sales) {
      if (skipKode(s.kode) || !s.prisgrense || !PRIS_SET.has(s.prisgrense)) continue
      const biler = s.biler ?? 0
      if (biler <= 0) continue
      if (!prisMap.has(s.kode)) prisMap.set(s.kode, { pris: 0, total: 0 })
      const r = prisMap.get(s.kode)!
      r.total += biler
      if (s.prisgrense === 'Pris') r.pris += biler
    }

    // ── Konvertering ──
    const konvSales = new Map<string, number>()
    for (const s of sales) {
      if (skipKode(s.kode)) continue
      konvSales.set(s.kode, (konvSales.get(s.kode) ?? 0) + (s.biler ?? 0))
    }
    const konvLeads = new Map<string, number>()
    for (const l of leadsAgg) {
      if (skipKode(l.kode)) continue
      konvLeads.set(l.kode, Number(l.lead_count))
    }

    // ── NPS ──
    const npsMap = new Map<string, number[]>()
    for (const n of nps) {
      if (skipKode(n.kode)) continue
      if (!npsMap.has(n.kode!)) npsMap.set(n.kode!, [])
      npsMap.get(n.kode!)!.push(n.nps_adj_score)
    }

    // Fastpris biler per rep (B2B + Retail, not Salgshjelp) — used for fullpris qualification
    const fastprisMap = new Map<string, number>()
    for (const s of sales) {
      if (skipKode(s.kode)) continue
      const b = s.biler ?? 0
      if (b <= 0) continue
      if (s.bonustype !== 'Salgshjelp' && (s.salgstype === 'B2B' || s.salgstype === 'Retail')) {
        fastprisMap.set(s.kode, (fastprisMap.get(s.kode) ?? 0) + b)
      }
    }

    const MIN_BILER = 5
    const qualifiedKodes    = new Set(kodes.filter(k => (bilerMap.get(k)    ?? 0) >= MIN_BILER))
    const qualifiedFullpris = new Set(kodes.filter(k => (fastprisMap.get(k) ?? 0) >= MIN_BILER))

    const result: ToplistData = {
      bilerKjopt: top3(
        kodes
          .filter(k => qualifiedKodes.has(k))
          .map(k => ({ kode: k, value: bilerMap.get(k)! })),
        nameMap
      ),
      fullpris: top3(
        [...prisMap.entries()]
          .filter(([kode, r]) => qualifiedFullpris.has(kode) && r.total > 0)
          .map(([kode, r]) => ({ kode, value: r.pris / r.total })),
        nameMap
      ),
      konvertering: top3(
        kodes
          .filter(k => qualifiedKodes.has(k) && (konvLeads.get(k) ?? 0) > 0)
          .map(k => ({ kode: k, value: ((konvSales.get(k) ?? 0) / konvLeads.get(k)!) * 100 })),
        nameMap
      ),
      nps: top3(
        [...npsMap.entries()]
          .filter(([kode]) => qualifiedKodes.has(kode))
          .map(([kode, scores]) => ({ kode, value: scores.reduce((a, b) => a + b, 0) / scores.length })),
        nameMap
      ),
    }

    return Response.json(result, { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' } })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
