'use client'

// Entry — dashboard + Boooom! feed tab; session cookie or admin.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { RepDashboard, SaleRow } from '@/lib/types'
import AuthGate from '@/components/AuthGate'
import KpiTiles from '@/components/KpiTiles'
import TrendCharts from '@/components/TrendCharts'
import BonusPanel from '@/components/BonusPanel'
import CarsTable from '@/components/CarsTable'
import FeedTab from '@/components/FeedTab'

const fetchOpts: RequestInit = { credentials: 'include' }

const FEED_LAST_SEEN_KEY = 'feed_last_seen'

async function clearSession() {
  await fetch('/api/auth/logout', { method: 'POST', ...fetchOpts })
}

async function logOut() {
  await clearSession()
  window.location.reload()
}

function maxDatoKjopt(sales: SaleRow[]): string {
  return sales.reduce((m, s) => (s.dato_kjopt > m ? s.dato_kjopt : m), '')
}

function computeHasUnread(sales: SaleRow[]): boolean {
  if (sales.length === 0) return false
  const lastSeen = localStorage.getItem(FEED_LAST_SEEN_KEY)
  if (!lastSeen) return true
  const maxD = maxDatoKjopt(sales)
  return maxD > lastSeen.slice(0, 10)
}

export default function Page() {
  const [data,          setData]          = useState<RepDashboard | null>(null)
  const [authed,        setAuthed]        = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [activeTab,     setActiveTab]     = useState<'dashboard' | 'feed'>('dashboard')
  const [feedSales,     setFeedSales]     = useState<SaleRow[]>([])
  const [hasUnread,     setHasUnread]     = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const dataRes = await fetch('/api/data', fetchOpts)
      if (dataRes.status === 401) {
        await clearSession()
        if (!cancelled) setLoading(false)
        return
      }
      if (!dataRes.ok) {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
        return
      }

      const json = (await dataRes.json()) as RepDashboard

      const feedRes = await fetch('/api/feed', fetchOpts)
      let sales: SaleRow[] = []
      if (feedRes.ok) {
        try {
          sales = (await feedRes.json()) as SaleRow[]
        } catch {
          sales = []
        }
      }

      if (cancelled) return

      setData(json)
      setAuthed(true)
      setSelectedMonth(new Date().toISOString().slice(0, 7))
      setFeedSales(Array.isArray(sales) ? sales : [])
      setHasUnread(computeHasUnread(Array.isArray(sales) ? sales : []))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function selectFeedTab() {
    setActiveTab('feed')
    localStorage.setItem(FEED_LAST_SEEN_KEY, new Date().toISOString())
    setHasUnread(false)
  }

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

  const tabBtn =
    'relative py-3.5 mr-7 text-sm font-medium border-b-2 border-transparent text-text-muted hover:text-text-primary'

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
        <div className={`${shell} flex items-center`}>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={
              activeTab === 'dashboard'
                ? 'text-text-primary border-b-2 border-[var(--rebil-red)] py-3.5 mr-7 text-sm font-medium'
                : tabBtn
            }
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={selectFeedTab}
            className={
              activeTab === 'feed'
                ? 'text-text-primary border-b-2 border-[var(--rebil-red)] py-3.5 mr-7 text-sm font-medium inline-flex items-center gap-2'
                : `${tabBtn} inline-flex items-center gap-2`
            }
          >
            Boooom!
            {hasUnread && (
              <span
                className="w-2 h-2 rounded-full bg-[var(--rebil-red)] shrink-0"
                aria-hidden
              />
            )}
          </button>
        </div>
      </nav>

      {activeTab === 'dashboard' ? (
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
      ) : (
        <main className={`${shell} py-8`}>
          <FeedTab sales={feedSales} viewerName={data.rep.full_name} />
        </main>
      )}
    </div>
  )
}
