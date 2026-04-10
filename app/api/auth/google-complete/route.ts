// POST /api/auth/google-complete
// Verifies a Supabase access token server-side, looks up the rep by email,
// and sets the rep session cookie. Called from /auth/callback after OAuth exchange.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByEmail } from '@/lib/db'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from '@/lib/auth'

function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
}

function resolveKey(): string {
  // Prefer service role key for server-side token verification
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SB_SERVICE_ROLE_KEY'] as const) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  // Fall back to anon key
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  )
}

export async function POST(req: Request) {
  const body = await req.json() as { access_token?: string }
  const { access_token } = body

  if (!access_token) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  // Verify the token with Supabase — get the actual user, don't trust client-supplied email
  const supabase = createClient(supabaseUrl(), resolveKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(access_token)

  if (error || !user?.email) {
    console.error('[google-complete] getUser failed:', error?.message ?? 'no email')
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const rep = await getRepByEmail(user.email)

  if (!rep) {
    console.error('[google-complete] No rep found for email:', user.email)
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
