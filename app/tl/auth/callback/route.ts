// GET /tl/auth/callback
// TL-specific OAuth callback — always redirects to /tl after setting session.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getRepByEmail } from '@/lib/db'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const errorParam = searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${origin}/tl/login?auth_error=${encodeURIComponent(errorParam)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/tl/login?auth_error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase    = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
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
    const msg = error?.message ?? 'Exchange failed'
    return NextResponse.redirect(`${origin}/tl/login?auth_error=${encodeURIComponent(msg)}`)
  }

  const email = data.session.user.email
  const rep   = await getRepByEmail(email)

  if (!rep && !isTlSuperadmin(email)) {
    return NextResponse.redirect(`${origin}/tl/login?auth_error=not_employee`)
  }

  const sessionValue = rep ? rep.kode : `__tl_super__${email}`

  cookieStore.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   SESSION_MAX_AGE_SEC,
    path:     '/',
  })

  return NextResponse.redirect(`${origin}/tl`)
}
