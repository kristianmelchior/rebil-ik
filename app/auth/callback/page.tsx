'use client'

// OAuth callback page — exchanges Supabase auth code for session,
// then calls /api/auth/google-complete to set the rep session cookie.

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'pkce' } }
  )
}

function CallbackHandler() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      if (!code) {
        window.location.href = '/'
        return
      }

      const supabase = createSupabaseClient()
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError || !data.session?.access_token) {
        setError('Kunne ikke fullføre innlogging. Prøv igjen.')
        return
      }

      const res = await fetch('/api/auth/google-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: data.session.access_token }),
        credentials: 'include',
      })

      if (res.ok) {
        window.location.href = '/'
      } else if (res.status === 403) {
        setError('Denne Google-kontoen er ikke registrert som Rebil-ansatt.')
      } else {
        setError('Noe gikk galt. Prøv igjen.')
      }
    }

    void handleCallback()
  }, [searchParams])

  if (error) {
    return (
      <div className="text-center max-w-sm px-4">
        <p className="text-text-secondary mb-4">{error}</p>
        <a
          href="/"
          className="inline-block px-6 h-10 leading-10 rounded-pill bg-brand-green text-white text-sm font-medium hover:bg-brand-green-hover"
        >
          Tilbake til innlogging
        </a>
      </div>
    )
  }

  return <p className="text-text-secondary text-sm">Logger inn…</p>
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Suspense fallback={<p className="text-text-secondary text-sm">Logger inn…</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
