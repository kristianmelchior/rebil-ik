'use client'

// Entry — loads dashboard when session cookie is valid; otherwise AuthGate.
// 401 → clears session via /api/auth/logout and shows login.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { RepDashboard } from '@/lib/types'
import AuthGate from '@/components/AuthGate'
import KpiTiles from '@/components/KpiTiles'
import TrendCharts from '@/components/TrendCharts'
import BonusPanel from '@/components/BonusPanel'
import CarsTable from '@/components/CarsTable'

const fetchOpts: RequestInit = { credentials: 'include' }

async function clearSession() {
  await fetch('/api/auth/logout', { method: 'POST', ...fetchOpts })
}

async function logOut() {
  await clearSession()
  window.location.reload()
}

export default function Page() {
  const [data,          setData]          = useState<RepDashboard | null>(null)
  const [authed,        setAuthed]        = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    fetch('/api/data', fetchOpts)
      .then(async res => {
        if (res.status === 401) {
          await clearSession()
          setLoading(false)
          return null
        }
        if (!res.ok) throw new Error('fetch failed')
        return res.json() as Promise<RepDashboard>
      })
      .then(json => {
        if (json) {
          setData(json)
          setAuthed(true)
          setSelectedMonth(new Date().toISOString().slice(0, 7))
        }
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  if (!loading && !authed && !error) return <AuthGate />

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-[1100px] mx-auto px-8 py-8 space-y-6 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-border rounded-card" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Kunne ikke laste data. Prøv igjen.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 h-10 rounded-pill bg-brand-green text-white text-sm font-medium hover:bg-brand-green-hover"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    )
  }

  if (!data) return <AuthGate />

  const shell = 'max-w-[1100px] mx-auto px-8'

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b border-border">
        <div className={`${shell} h-[60px] flex items-center justify-between gap-4`}>
          <Image src="/logo.svg" alt="Rebil" height={20} width={67} />
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 justify-end">
            {data.admin ? (
              <>
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">
                  Admin
                </span>
                <select
                  value={data.rep.kode}
                  onChange={async e => {
                    const next = e.target.value
                    const res = await fetch('/api/auth/admin-view', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kode: next }),
                      ...fetchOpts,
                    })
                    if (res.ok) window.location.reload()
                  }}
                  className="min-w-0 max-w-[min(100%,280px)] text-sm font-medium text-text-primary border border-border rounded-lg px-3 py-2 bg-surface focus:border-[var(--rebil-red)] outline-none cursor-pointer"
                  aria-label="Velg selger"
                >
                  {data.admin.reps.map(r => (
                    <option key={r.kode} value={r.kode}>{r.full_name}</option>
                  ))}
                </select>
                <span className="text-sm text-text-muted shrink-0 hidden md:inline">{data.rep.tier}</span>
              </>
            ) : (
              <div className="flex items-baseline gap-1.5 min-w-0 justify-end text-right">
                <span className="text-lg font-medium text-text-primary truncate">{data.rep.full_name}</span>
                <span className="text-sm text-text-muted shrink-0">{data.rep.tier}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void logOut()}
              className="shrink-0 text-sm font-medium text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg border border-border hover:bg-bg"
            >
              Logg ut
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-surface border-b border-border">
        <div className={`${shell} flex`}>
          <span className="text-text-primary border-b-2 border-[var(--rebil-red)] py-3.5 mr-7 text-sm font-medium">
            Dashboard
          </span>
          <span className="italic text-text-hint py-3.5 text-sm cursor-default">
            [deepdive]
          </span>
        </div>
      </nav>

      <main className={`${shell} py-8 space-y-10`}>
        <KpiTiles
          currentMonth={data.currentMonth}
          last30Days={data.last30Days}
          medianCurrentMonth={data.medianCurrentMonth}
          medianLast30Days={data.medianLast30Days}
        />
        <TrendCharts
          trend={data.trend}
          medianTrend={data.medianTrend}
        />
        <BonusPanel
          bonus={data.bonus}
          rep={data.rep}
          salesByMonth={data.salesByMonth}
          lastUpdated={data.lastUpdated}
          onMonthChange={setSelectedMonth}
        />
        <CarsTable sales={data.salesByMonth[selectedMonth] ?? []} />
      </main>
    </div>
  )
}
