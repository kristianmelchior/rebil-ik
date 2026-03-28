// GET /api/data — RepDashboard for rep session or admin viewing a selected rep.

import { cookies } from 'next/headers'
import {
  getRepByKode,
  getAllSales,
  getAllLeads,
  getAllNps,
  getAllRepsForPicker,
} from '@/lib/db'
import { buildDashboard } from '@/lib/transforms'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
} from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const adminViewKode = cookieStore.get(ADMIN_VIEW_KODE_COOKIE_NAME)?.value
  const repSessionKode = cookieStore.get(SESSION_COOKIE_NAME)?.value

  const kode = isAdmin ? adminViewKode : repSessionKode

  if (!kode) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rep = await getRepByKode(kode)
    if (!rep) {
      if (isAdmin) {
        cookieStore.delete(ADMIN_VIEW_KODE_COOKIE_NAME)
      } else {
        cookieStore.delete(SESSION_COOKIE_NAME)
      }
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = new Date().getFullYear()
    const [allSales, allLeads, allNps] = await Promise.all([
      getAllSales(year),
      getAllLeads(year),
      getAllNps(year),
    ])

    const dashboard = buildDashboard(rep, allSales, allLeads, allNps)

    if (isAdmin) {
      const reps = await getAllRepsForPicker()
      return Response.json(
        { ...dashboard, admin: { reps } },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return Response.json(dashboard, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
