'use client'

// Entry — dashboard + Boooom! feed tab; session cookie or admin.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { RepDashboard, SaleRow, NpsRow } from '@/lib/types'
import AuthGate from '@/components/AuthGate'
import KpiTiles from '@/components/KpiTiles'
import TrendCharts from '@/components/TrendCharts'
import InsightTiles from '@/components/InsightTiles'
import { buildPrisSlices } from '@/components/BreakdownTile'
import BonusPanel from '@/components/BonusPanel'
import CarsTable from '@/components/CarsTable'
import FeedTab from '@/components/FeedTab'
import NpsTab from '@/components/NpsTab'
import ToplistTab from '@/components/ToplistTab'
import StatsTab from '@/components/StatsTab'

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
  const [activeTab,     setActiveTab]     = useState<'dashboard' | 'toplist' | 'feed' | 'nps' | 'stats'>('dashboard')
  const [period,        setPeriod]        = useState<'month' | '30d'>('30d')
  const [feedSales,     setFeedSales]     = useState<SaleRow[]>([])
  const [hasUnread,     setHasUnread]     = useState(false)
  const [npsRows,       setNpsRows]       = useState<NpsRow[]>([])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [dataRes, feedRes, npsRes] = await Promise.all([
        fetch('/api/data', fetchOpts),
        fetch('/api/feed', fetchOpts),
        fetch('/api/nps', fetchOpts),
      ])

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

      let sales: SaleRow[] = []
      if (feedRes.ok) {
        try {
          sales = (await feedRes.json()) as SaleRow[]
        } catch {
          sales = []
        }
      }

      let nps: NpsRow[] = []
      if (npsRes.ok) {
        try {
          nps = (await npsRes.json()) as NpsRow[]
        } catch {
          nps = []
        }
      }

      if (cancelled) return

      setData(json)
      setAuthed(true)
      setSelectedMonth(new Date().toISOString().slice(0, 7))
      setFeedSales(Array.isArray(sales) ? sales : [])
      setHasUnread(computeHasUnread(Array.isArray(sales) ? sales : []))
      setNpsRows(Array.isArray(nps) ? nps : [])
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
      <div className="min-h-screen bg-bg flex flex-col">
        {/* Header skeleton */}
        <div className="bg-surface border-b border-border h-[60px] flex items-center px-8 animate-pulse">
          <div className="max-w-[1100px] mx-auto w-full flex items-center justify-between">
            <div className="h-5 w-16 bg-border rounded" />
            <div className="h-8 w-40 bg-border rounded-lg" />
          </div>
        </div>
        {/* Nav skeleton */}
        <div className="bg-surface border-b border-border animate-pulse">
          <div className="max-w-[1100px] mx-auto px-8 flex gap-7 py-3.5">
            <div className="h-4 w-20 bg-border rounded" />
            <div className="h-4 w-16 bg-border rounded" />
          </div>
        </div>

        {/* Car animation */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <style>{`
            @keyframes drive {
              0%   { transform: translateX(-120px); }
              100% { transform: translateX(120px); }
            }
            @keyframes spin-wheel {
              from { transform-origin: center; transform: rotate(0deg); }
              to   { transform-origin: center; transform: rotate(360deg); }
            }
            .car-drive {
              animation: drive 1.4s ease-in-out infinite alternate;
            }
            .wheel-spin {
              animation: spin-wheel 0.5s linear infinite;
            }
          `}</style>

          <div className="car-drive">
            <svg width="160" height="80" viewBox="0 0 160 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Body */}
              <rect x="10" y="34" width="140" height="28" rx="6" fill="#c0392b" />
              {/* Roof / cabin */}
              <path d="M45 34 Q52 14 75 12 L105 12 Q122 12 118 34 Z" fill="#c0392b" />
              {/* Windshield */}
              <path d="M52 33 Q57 18 75 16 L100 16 Q113 16 112 33 Z" fill="#a8d8f0" opacity="0.85" />
              {/* Side windows */}
              <rect x="54" y="16" width="22" height="17" rx="2" fill="#a8d8f0" opacity="0.85" />
              {/* Headlight */}
              <rect x="146" y="42" width="8" height="6" rx="2" fill="#f9e04b" />
              {/* Taillight */}
              <rect x="6" y="42" width="8" height="6" rx="2" fill="#e74c3c" />
              {/* Bumpers */}
              <rect x="148" y="52" width="8" height="4" rx="2" fill="#999" />
              <rect x="4" y="52" width="8" height="4" rx="2" fill="#999" />
              {/* Underside */}
              <rect x="10" y="58" width="140" height="4" rx="2" fill="#a93226" />

              {/* Rear wheel */}
              <g transform="translate(38,62)">
                <circle cx="0" cy="0" r="14" fill="#222" />
                <circle cx="0" cy="0" r="9" fill="#555" />
                <g className="wheel-spin">
                  <line x1="0" y1="-9" x2="0" y2="9" stroke="#888" strokeWidth="2" />
                  <line x1="-9" y1="0" x2="9" y2="0" stroke="#888" strokeWidth="2" />
                  <line x1="-6.4" y1="-6.4" x2="6.4" y2="6.4" stroke="#888" strokeWidth="2" />
                  <line x1="6.4" y1="-6.4" x2="-6.4" y2="6.4" stroke="#888" strokeWidth="2" />
                </g>
                <circle cx="0" cy="0" r="3" fill="#ccc" />
              </g>

              {/* Front wheel */}
              <g transform="translate(118,62)">
                <circle cx="0" cy="0" r="14" fill="#222" />
                <circle cx="0" cy="0" r="9" fill="#555" />
                <g className="wheel-spin">
                  <line x1="0" y1="-9" x2="0" y2="9" stroke="#888" strokeWidth="2" />
                  <line x1="-9" y1="0" x2="9" y2="0" stroke="#888" strokeWidth="2" />
                  <line x1="-6.4" y1="-6.4" x2="6.4" y2="6.4" stroke="#888" strokeWidth="2" />
                  <line x1="6.4" y1="-6.4" x2="-6.4" y2="6.4" stroke="#888" strokeWidth="2" />
                </g>
                <circle cx="0" cy="0" r="3" fill="#ccc" />
              </g>
            </svg>
          </div>

          <p className="text-sm text-text-muted">Laster inn…</p>
        </div>

        {/* Bottom skeleton tiles */}
        <div className="max-w-[1100px] mx-auto w-full px-8 pb-8 animate-pulse space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-surface border border-border rounded-card p-5 space-y-3">
                <div className="h-3 w-24 bg-border rounded" />
                <div className="h-8 w-16 bg-border rounded" />
                <div className="h-3 w-20 bg-border rounded" />
              </div>
            ))}
          </div>
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

  const metrics    = period === 'month' ? data.currentMonth  : data.last30Days
  const curSales   = period === 'month' ? data.salesThisMonth : data.salesLast30Days
  const prisSlices = buildPrisSlices(curSales)

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
                <span className="text-sm text-text-muted shrink-0">{data.rep.rolle}</span>
              </>
            ) : data.teamView ? (
              <>
                <select
                  value={data.rep.kode}
                  onChange={async e => {
                    const next = e.target.value
                    const res = await fetch('/api/auth/team-view', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kode: next }),
                      ...fetchOpts,
                    })
                    if (res.ok) window.location.reload()
                  }}
                  className="min-w-0 max-w-[min(100%,280px)] text-sm font-medium text-text-primary border border-border rounded-lg px-3 py-2 bg-surface focus:border-[var(--rebil-red)] outline-none cursor-pointer"
                  aria-label="Velg teammedlem"
                >
                  {data.teamView.reps.map(r => (
                    <option key={r.kode} value={r.kode}>{r.full_name}</option>
                  ))}
                </select>
                <span className="text-sm text-text-muted shrink-0">{data.rep.rolle}</span>
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
        <div className={`${shell} flex items-center justify-between`}>
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
            onClick={() => setActiveTab('toplist')}
            className={
              activeTab === 'toplist'
                ? 'text-text-primary border-b-2 border-[var(--rebil-red)] py-3.5 mr-7 text-sm font-medium'
                : tabBtn
            }
          >
            Toppliste
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
          <button
            type="button"
            onClick={() => setActiveTab('nps')}
            className={
              activeTab === 'nps'
                ? 'text-text-primary border-b-2 border-[var(--rebil-red)] py-3.5 mr-7 text-sm font-medium'
                : tabBtn
            }
          >
            NPS
          </button>

          {/* Se stats — admin/teamleder only, pushed to the right */}
          {(data.admin || data.teamView) && (
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`ml-auto my-2 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                activeTab === 'stats'
                  ? 'bg-[var(--rebil-red)] text-white'
                  : 'bg-text-primary text-white hover:opacity-80'
              }`}
            >
              Se stats
            </button>
          )}
        </div>
      </nav>

      {activeTab === 'dashboard' && (
        <main className={`${shell} py-8 space-y-10`}>
          <KpiTiles
            currentMonth={data.currentMonth}
            last30Days={data.last30Days}
            period={period}
            onPeriodChange={setPeriod}
            prisSlices={prisSlices}
          />
          <InsightTiles
            period={period}
            salesThisMonth={data.salesThisMonth}
            salesLast30Days={data.salesLast30Days}
            leads={metrics.leads}
          />
          <TrendCharts
            trend={data.trend}
            medianTrend={data.medianTrend}
            prisDistTrend={data.prisDistTrend}
            fordDistTrend={data.fordDistTrend}
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
      )}
      {activeTab === 'toplist' && (
        <main className={`${shell} py-8`}>
          <ToplistTab />
        </main>
      )}
      {activeTab === 'feed' && (
        <main className={`${shell} py-8`}>
          <FeedTab sales={feedSales} viewerName={data.rep.full_name} />
        </main>
      )}
      {activeTab === 'nps' && (
        <main className={`${shell} py-8`}>
          <NpsTab rows={npsRows} />
        </main>
      )}
      {activeTab === 'stats' && (data.admin || data.teamView) && (
        <main className={`${shell} py-8`}>
          <StatsTab />
        </main>
      )}
    </div>
  )
}
