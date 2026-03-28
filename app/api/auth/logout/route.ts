// POST /api/auth/logout — clears session cookie.

import { cookies } from 'next/headers'
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
} from '@/lib/auth'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME)
  cookieStore.delete(ADMIN_VIEW_KODE_COOKIE_NAME)
  return Response.json({ ok: true })
}
