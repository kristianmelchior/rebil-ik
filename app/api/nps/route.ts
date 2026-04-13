// GET /api/nps — NPS rows for the current rep (auth: rep session or admin viewing a rep).

import { cookies } from 'next/headers'
import { getNpsByKode } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
  TEAM_VIEW_KODE_COOKIE_NAME,
} from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const adminViewKode = cookieStore.get(ADMIN_VIEW_KODE_COOKIE_NAME)?.value
  const repSessionKode = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const teamViewKode = cookieStore.get(TEAM_VIEW_KODE_COOKIE_NAME)?.value

  const kode = isAdmin
    ? adminViewKode
    : (teamViewKode ?? repSessionKode)

  if (!kode) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const year = new Date().getFullYear()
    const rows = await getNpsByKode(kode, year)
    return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
