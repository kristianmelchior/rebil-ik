'use client'

// Entry — dashboard + Boooom! feed tab; session cookie or admin.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { RepDashboard, SaleRow, NpsRow } from '@/lib/types'
import AuthGate from '@/components/AuthGate'
import KpiTiles from '@/components/KpiTiles'
import TrendCharts from '@/components/TrendCharts'
import InsightTiles from '@/components/InsightTiles'
import { buildPrisSlices } from '@/components/BreakdownTile'
import BonusPanel from '@/components/BonusPanel'
import FeedTab from '@/components/FeedTab'
import NpsTab from '@/components/NpsTab'
import TrekkTab from '@/components/TrekkTab'
import ToplistTab from '@/components/ToplistTab'
import StatsTab from '@/components/StatsTab'
import RatingPreviewPopup from '@/components/RatingPreviewPopup'
import RepPipelineWidget from '@/components/RepPipelineWidget'

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
  const [error,         setError]         = useState<string | boolean>(false)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [activeTab,     setActiveTab]     = useState<'dashboard' | 'toplist' | 'feed' | 'nps' | 'trekk' | 'stats'>('dashboard')
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
          try { const j = await dataRes.json(); setError(j?.error ?? true) } catch { setError(true) }
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
            <svg width="200" height="88" viewBox="0 0 200 88" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* === REAR SPOILER === */}
              {/* Wing blade */}
              <rect x="12" y="14" width="38" height="6" rx="2" fill="#1a1a1a" />
              {/* Wing end plates */}
              <rect x="12" y="14" width="4" height="11" rx="1" fill="#2a2a2a" />
              <rect x="46" y="14" width="4" height="11" rx="1" fill="#2a2a2a" />
              {/* Wing pillars */}
              <rect x="22" y="20" width="4" height="16" fill="#1a1a1a" />
              <rect x="38" y="20" width="4" height="16" fill="#1a1a1a" />

              {/* === MAIN BODY — low & wide === */}
              <path d="M18,36 L160,36 Q178,36 188,44 Q194,50 188,56 L18,56 Q10,56 10,46 Q10,36 18,36 Z" fill="#f40000" />

              {/* === COCKPIT === */}
              <path d="M70,36 Q74,16 88,14 L114,14 Q130,16 132,36 Z" fill="#f40000" />
              {/* Windshield glass */}
              <path d="M77,35 Q80,20 90,18 L110,18 Q122,20 125,35 Z" fill="#b0d8ef" opacity="0.88" />

              {/* === DETAILS === */}
              {/* Front headlight strip */}
              <rect x="181" y="39" width="9" height="4" rx="2" fill="#ffe566" />
              {/* Taillight strip */}
              <rect x="10" y="40" width="6" height="6" rx="2" fill="#ff4444" />
              {/* Front splitter */}
              <rect x="180" y="56" width="20" height="3" rx="1.5" fill="#1a1a1a" />
              {/* Rear diffuser */}
              <path d="M10,54 L18,56 L18,60 L6,58 Z" fill="#1a1a1a" />
              {/* Side vent */}
              <rect x="142" y="41" width="16" height="8" rx="2" fill="#cc0000" />
              <rect x="143" y="42" width="14" height="6" rx="1" fill="#aa0000" />
              {/* Racing stripe */}
              <rect x="18" y="44" width="160" height="3" rx="1" fill="#cc0000" opacity="0.5" />

              {/* === REAR WHEEL === */}
              <g transform="translate(44,68)">
                <circle cx="0" cy="0" r="17" fill="#1a1a1a" />
                <circle cx="0" cy="0" r="12" fill="#3a3a3a" />
                <g className="wheel-spin">
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#777" strokeWidth="2.5" />
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#777" strokeWidth="2.5" />
                  <line x1="-8.5" y1="-8.5" x2="8.5" y2="8.5" stroke="#777" strokeWidth="2.5" />
                  <line x1="8.5" y1="-8.5" x2="-8.5" y2="8.5" stroke="#777" strokeWidth="2.5" />
                </g>
                <circle cx="0" cy="0" r="4" fill="#999" />
              </g>

              {/* === FRONT WHEEL === */}
              <g transform="translate(156,68)">
                <circle cx="0" cy="0" r="17" fill="#1a1a1a" />
                <circle cx="0" cy="0" r="12" fill="#3a3a3a" />
                <g className="wheel-spin">
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#777" strokeWidth="2.5" />
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#777" strokeWidth="2.5" />
                  <line x1="-8.5" y1="-8.5" x2="8.5" y2="8.5" stroke="#777" strokeWidth="2.5" />
                  <line x1="8.5" y1="-8.5" x2="-8.5" y2="8.5" stroke="#777" strokeWidth="2.5" />
                </g>
                <circle cx="0" cy="0" r="4" fill="#999" />
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
          {typeof error === 'string' && <p className="text-xs text-red-500 mb-2 font-mono">{error}</p>}
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
          <button
            type="button"
            onClick={() => setActiveTab('trekk')}
            className={
              activeTab === 'trekk'
                ? 'text-text-primary border-b-2 border-[var(--rebil-red)] py-3.5 mr-7 text-sm font-medium'
                : tabBtn
            }
          >
            Trekk
          </button>

          {/* Se stats — admin/teamleder only, pushed to the right */}
          {(data.admin || data.teamView) && (
            <Link
              href="/tl/tabell"
              className="ml-auto my-2 text-sm font-medium px-4 py-1.5 rounded-lg bg-text-primary text-white hover:opacity-80 transition-opacity"
            >
              Se stats
            </Link>
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
            leadsTotal={metrics.leadsTotal}
            currentMonthKonvPlattform={data.currentMonthKonvPlattform}
            last30KonvPlattform={data.last30KonvPlattform}
            currentMonthSameDagPct={data.currentMonthSameDagPct}
            last30SameDagPct={data.last30SameDagPct}
          />
          <RepPipelineWidget />
          <TrendCharts
            trend={data.trend}
            medianTrend={data.medianTrend}
            prisDistTrend={data.prisDistTrend}
            fordDistTrend={data.fordDistTrend}
            konvPlattformTrend={data.konvPlattformTrend}
            kontakttidTrend={data.kontakttidTrend}
            leadsHandledKategoriTrend={data.leadsHandledKategoriTrend ?? []}
            currentMonthMetrics={data.currentMonth}
            last30Metrics={data.last30Days}
            repKode={data.rep.kode}
          />
          <BonusPanel
            bonus={data.bonus}
            bonusByMonth={data.bonusByMonth}
            rep={data.rep}
            salesByMonth={data.salesByMonth}
            lastUpdated={data.lastUpdated}
            conversionFactors={data.conversionFactors ?? []}
            npsBonus={data.npsBonus ?? []}
            onMonthChange={setSelectedMonth}
          />
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
      {activeTab === 'trekk' && (
        <main className={`${shell} py-8`}>
          <TrekkTab avvik={data.avvik ?? []} ettersalg={data.ettersalg ?? []} repName={data.rep.full_name} />
        </main>
      )}
      {activeTab === 'stats' && (data.admin || data.teamView) && (
        <main className={`${shell} py-8`}>
          <StatsTab defaultTlFilter={data.teamView ? data.rep.full_name : undefined} />
        </main>
      )}

      {/* Weekly TL rating popup — test phase: Benjamin Parr only (admins can preview any rep) */}
      <RatingPreviewPopup
        repName={data.rep.full_name}
        repKode={data.rep.kode}
        isAdmin={!!data.admin}
      />
    </div>
  )
}
