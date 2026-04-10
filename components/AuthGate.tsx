'use client'

// Login — Google SSO or admin password.

import Image from 'next/image'
import { useState, type FormEvent } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const fetchOpts: RequestInit = { credentials: 'include' }

export default function AuthGate() {
  const [googleLoading, setGoogleLoading] = useState(false)

  const [showAdmin,     setShowAdmin]     = useState(false)
  const [adminPass,     setAdminPass]     = useState('')
  const [adminLoading,  setAdminLoading]  = useState(false)
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null)

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setGoogleLoading(false)
  }

  async function handleAdminSubmit(e: FormEvent) {
    e.preventDefault()
    setAdminLoading(true)
    setAdminErrorMsg(null)

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPass }),
        credentials: 'include',
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      let detail = ''
      try {
        const j = (await res.json()) as { error?: string }
        if (j.error) detail = j.error
      } catch { /* ignore */ }
      if (res.status === 401) {
        setAdminErrorMsg('Feil passord.')
      } else if (res.status === 500) {
        setAdminErrorMsg(detail || 'Kunne ikke hente selgere fra databasen.')
      } else {
        setAdminErrorMsg(detail || `Noe gikk galt (${res.status}).`)
      }
    } finally {
      setAdminLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="max-w-[380px] w-full rounded-card bg-surface border border-border p-10">
        <Image src="/logo.svg" alt="Rebil" height={24} width={80} />
        <h1 className="text-lg font-medium text-text-primary mt-6 mb-6">Logg inn</h1>

        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={googleLoading}
          className="w-full h-11 rounded-pill border border-border bg-surface hover:bg-bg text-sm font-medium text-text-primary flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {googleLoading ? 'Videresender…' : 'Logg inn med Google'}
        </button>

        <div className="mt-8 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => { setShowAdmin(s => !s); setAdminErrorMsg(null) }}
            className="text-xs text-text-muted hover:text-text-secondary underline underline-offset-2"
          >
            {showAdmin ? 'Skjul administrator' : 'Administrator?'}
          </button>
          {showAdmin && (
            <form onSubmit={handleAdminSubmit} className="mt-4">
              <label className="block text-sm text-text-secondary mb-1.5">Admin-passord</label>
              <input
                type="password"
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                autoComplete="current-password"
                className="rounded-pill h-11 border border-border px-4 text-base w-full focus:border-[var(--rebil-red)] outline-none"
              />
              {adminErrorMsg && (
                <p className="text-sm text-[var(--rebil-red)] mt-2">{adminErrorMsg}</p>
              )}
              <button
                type="submit"
                disabled={adminLoading || !adminPass}
                className="w-full h-11 rounded-pill border border-border text-text-primary text-sm font-medium mt-2 hover:bg-bg disabled:opacity-50"
              >
                {adminLoading ? 'Laster…' : 'Logg inn som administrator'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
