// POST /api/auth/admin-view — body: { kode: string }. Requires admin session; sets viewed rep.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from '@/lib/auth'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  if (cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value !== '1') {
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

  try {
    const rep = await getRepByKode(kode)
    if (!rep) {
      return Response.json({ error: 'Unknown rep' }, { status: 404 })
    }

    cookieStore.set(ADMIN_VIEW_KODE_COOKIE_NAME, kode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC,
    })

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
