// POST /api/auth/team-view — body: { kode: string }
// Requires a teamleder session; sets which team member to view.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  TEAM_VIEW_KODE_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  isTeamleder,
} from '@/lib/auth'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const sessionKode = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionKode) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionRep = await getRepByKode(sessionKode)
  if (!sessionRep || !isTeamleder(sessionRep.rolle)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { kode?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const kode = typeof body.kode === 'string' ? body.kode.trim() : ''
  if (!kode) {
    return Response.json({ error: 'Missing kode' }, { status: 400 })
  }

  // Validate target rep is on the teamleder's team
  const targetRep = await getRepByKode(kode)
  if (!targetRep || targetRep.teamleder !== sessionRep.full_name) {
    return Response.json({ error: 'Not on your team' }, { status: 403 })
  }

  cookieStore.set(TEAM_VIEW_KODE_COOKIE_NAME, kode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })

  return Response.json({ ok: true })
}
