// GET /api/tildeling?mode=month|30d  OR  ?period=YYYY-MM
// Admin and teamleder only — returns per-person lead tildeling counts.

import { cookies } from 'next/headers'
import { getRepByKode, getLeadTildeling } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  isTeamleder,
} from '@/lib/auth'

export interface TildelingEntry {
  name:      string
  teamleder: string
  tildelt:   number
  mistet:    number
}

export interface TildelingData {
  rows: TildelingEntry[]
  from: string
  to:   string
}

function dateRange(mode: string | null, period: string | null): { from: string; to: string } {
  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [py, pm] = period.split('-').map(Number)
    const lastDay  = new Date(py, pm, 0).getDate()
    return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` }
  }
  if (mode === '30d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 30)
    return { from: d.toISOString().slice(0, 10), to: todayStr }
  }
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: todayStr }
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const isAdmin     = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const repKode     = cookieStore.get(SESSION_COOKIE_NAME)?.value

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
    const rows = await getLeadTildeling(from, to)
    return Response.json({ rows, from, to } satisfies TildelingData, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=60' },
    })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
