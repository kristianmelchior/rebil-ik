// GET /api/data — RepDashboard for rep session or admin viewing a selected rep.

import { cookies } from 'next/headers'
import {
  getRepByKode,
  getAllSales,
  getLeadsMonthly,
  getLeadsRange,
  getAllNps,
  getKonvPlattformMonthly,
  getKonvPlattformRange,
  getKontakttidMonthly,
  getKontakttidAvgMonthly,
  getKontakttidRange,
  getAllRepsForPicker,
  getTeamMembers,
  getLeadsHandledMonthlyByKategori,
} from '@/lib/db'
import type { LeadsHandledKategoriPoint } from '@/lib/types'
import { buildDashboard } from '@/lib/transforms'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
  TEAM_VIEW_KODE_COOKIE_NAME,
  isTeamleder,
} from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const adminViewKode = cookieStore.get(ADMIN_VIEW_KODE_COOKIE_NAME)?.value
  const repSessionKode = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const teamViewKode = cookieStore.get(TEAM_VIEW_KODE_COOKIE_NAME)?.value

  const kode = isAdmin ? adminViewKode : repSessionKode

  if (!kode) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Determine which rep's data to show
    const sessionRep = await getRepByKode(kode)
    if (!sessionRep) {
      if (isAdmin) {
        cookieStore.delete(ADMIN_VIEW_KODE_COOKIE_NAME)
      } else {
        cookieStore.delete(SESSION_COOKIE_NAME)
      }
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const repIsTeamleder = isTeamleder(sessionRep.rolle)

    // Teamleder viewing a team member — validate the target is on their team
    let rep = sessionRep
    if (!isAdmin && repIsTeamleder && teamViewKode) {
      const targetRep = await getRepByKode(teamViewKode)
      if (targetRep && targetRep.teamleder === sessionRep.full_name) {
        rep = targetRep
      } else {
        // Invalid target — clear the cookie and show teamleder's own data
        cookieStore.delete(TEAM_VIEW_KODE_COOKIE_NAME)
      }
    }

    const today = new Date()
    const year = today.getFullYear()
    const todayStr = today.toISOString().slice(0, 10)
    const last30Date = new Date(today)
    last30Date.setDate(last30Date.getDate() - 30)
    const last30Start = last30Date.toISOString().slice(0, 10)

    const [allSales, leadMonthly, leadRange30, allNps] = await Promise.all([
      getAllSales(year),
      getLeadsMonthly(year).catch(() => [] as Awaited<ReturnType<typeof getLeadsMonthly>>),
      getLeadsRange(last30Start, todayStr).catch(() => [] as Awaited<ReturnType<typeof getLeadsRange>>),
      getAllNps(year),
    ])

    // Graceful fallback — returns empty arrays until SQL functions are deployed
    const [konvPlattformMonthly, konvPlattformRange30, kontakttidMonthly, kontakttidAvgMonthly, kontakttidRange30, leadsHandledKategoriRaw] = await Promise.all([
      getKonvPlattformMonthly(year).catch(() => []),
      getKonvPlattformRange(last30Start, todayStr).catch(() => []),
      getKontakttidMonthly(year).catch(() => []),
      getKontakttidAvgMonthly(year).catch(() => []),
      getKontakttidRange(last30Start, todayStr).catch(() => []),
      getLeadsHandledMonthlyByKategori(rep.full_name, year).catch(() => []),
    ])

    // Process leads-handled-by-kategori into per-month points
    const leadsHandledKategoriMap = new Map<string, Record<string, number>>()
    for (const row of leadsHandledKategoriRaw) {
      if (!leadsHandledKategoriMap.has(row.month)) leadsHandledKategoriMap.set(row.month, {})
      leadsHandledKategoriMap.get(row.month)![row.leads_kategori] = Number(row.count)
    }
    const leadsHandledKategoriTrend: LeadsHandledKategoriPoint[] = Array.from(leadsHandledKategoriMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, categories]) => ({
        month,
        categories,
        total: Object.values(categories).reduce((s, v) => s + v, 0),
      }))

    const dashboard = buildDashboard(rep, allSales, leadMonthly, leadRange30, allNps, konvPlattformMonthly, konvPlattformRange30, kontakttidMonthly, kontakttidAvgMonthly, kontakttidRange30)

    const dashboardWithKategori = { ...dashboard, leadsHandledKategoriTrend }

    if (isAdmin) {
      const reps = await getAllRepsForPicker()
      return Response.json(
        { ...dashboardWithKategori, admin: { reps } },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (repIsTeamleder) {
      const teamReps = await getTeamMembers(sessionRep.full_name)
      return Response.json(
        { ...dashboardWithKategori, teamView: { reps: teamReps } },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return Response.json(dashboardWithKategori, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/data] error:', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
