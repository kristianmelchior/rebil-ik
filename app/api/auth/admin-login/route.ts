// POST /api/auth/admin-login — body: { password: string }.
// Sets admin cookies and first rep as view target. Clears normal rep session.

import { cookies } from 'next/headers'
import { getAllRepsForPicker } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  adminPasswordMatches,
} from '@/lib/auth'

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SEC,
}

export async function POST(request: Request) {
  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!adminPasswordMatches(password)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const reps = await getAllRepsForPicker()
    if (reps.length === 0) {
      return Response.json({ error: 'Ingen selgere i databasen' }, { status: 500 })
    }

    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
    cookieStore.set(ADMIN_SESSION_COOKIE_NAME, '1', cookieOpts)
    cookieStore.set(ADMIN_VIEW_KODE_COOKIE_NAME, reps[0].kode, cookieOpts)

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
