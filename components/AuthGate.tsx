'use client'

// Login — rep kode or admin password (see lib/auth.ts ADMIN_PASSWORD).

import Image from 'next/image'
import { useState, type FormEvent } from 'react'

const fetchOpts: RequestInit = { credentials: 'include' }

export default function AuthGate() {
  const [kode, setKode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)

  const [showAdmin,    setShowAdmin]    = useState(false)
  const [adminPass,    setAdminPass]    = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode }),
        ...fetchOpts,
      })
      if (res.ok) {
        window.location.reload()
      } else if (res.status === 401) {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
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
      } catch {
        /* ignore */
      }
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
        <h1 className="text-lg font-medium text-text-primary mt-6 mb-2">Logg inn</h1>
        <p className="text-sm text-text-secondary mb-6">
          Skriv inn din personlige kode for å se ditt dashboard.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-text-secondary mb-1.5">Din kode</label>
          <input
            type="text"
            value={kode}
            onChange={e => setKode(e.target.value)}
            placeholder="Skriv inn koden din"
            className="rounded-pill h-11 border border-border px-4 text-base w-full focus:border-[var(--rebil-red)] outline-none placeholder:text-text-hint"
          />
          {error && (
            <p className="text-sm text-[var(--rebil-red)] mt-2">Ugyldig kode. Prøv igjen.</p>
          )}
          <button
            type="submit"
            disabled={loading || !kode}
            className="w-full h-12 rounded-pill bg-brand-green hover:bg-brand-green-hover text-white text-base font-medium mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Laster…' : 'Gå til mitt dashboard →'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => {
              setShowAdmin(s => !s)
              setAdminErrorMsg(null)
            }}
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
