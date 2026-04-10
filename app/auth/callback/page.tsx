'use client'

// OAuth callback page — exchanges Supabase PKCE auth code for session,
// then calls /api/auth/google-complete to set the rep session cookie.

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

function CallbackHandler() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      if (!code) {
        // No code in URL — might be an error param from the provider
        const errDesc = searchParams.get('error_description') ?? searchParams.get('error')
        setError(errDesc ?? 'Ingen innloggingskode i URL. Prøv igjen.')
        return
      }

      const supabase = getSupabaseBrowserClient()
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError || !data.session?.access_token) {
        const msg = exchangeError?.message ?? 'Ingen sesjon returnert'
        console.error('[callback] exchangeCodeForSession failed:', msg)
        setError(`Kunne ikke fullføre innlogging: ${msg}`)
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
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(`Innlogging feilet (${res.status}): ${body.error ?? 'ukjent feil'}`)
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
