// GET /auth/callback
// Server-side OAuth callback. createServerClient reads the PKCE code
// verifier from the request cookies (set by createBrowserClient in AuthGate),
// exchanges the code, looks up the rep by email, and sets the session cookie.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getRepByEmail } from '@/lib/db'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from '@/lib/auth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(errorParam)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=no_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session?.user?.email) {
    console.error('[callback] exchangeCodeForSession failed:', error?.message ?? 'no email')
    const msg = error?.message ?? 'Exchange failed'
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(msg)}`)
  }

  const rep = await getRepByEmail(data.session.user.email)

  if (!rep) {
    console.error('[callback] No rep for email:', data.session.user.email)
    return NextResponse.redirect(`${origin}/?auth_error=not_employee`)
  }

  cookieStore.set(SESSION_COOKIE_NAME, rep.kode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  })

  return NextResponse.redirect(origin)
}
