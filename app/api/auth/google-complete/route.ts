// POST /api/auth/google-complete
// Verifies a Supabase access token server-side, looks up the rep by email,
// and sets the rep session cookie. Called from /auth/callback after OAuth exchange.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByEmail } from '@/lib/db'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from '@/lib/auth'

export async function POST(req: Request) {
  const body = await req.json() as { access_token?: string }
  const { access_token } = body

  if (!access_token) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  // Verify the token with Supabase — get the actual user, don't trust client-supplied email
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(access_token)

  if (error || !user?.email) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const rep = await getRepByEmail(user.email)

  if (!rep) {
    return Response.json({ error: 'Not a Rebil employee' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, rep.kode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  })

  return Response.json({ ok: true })
}
