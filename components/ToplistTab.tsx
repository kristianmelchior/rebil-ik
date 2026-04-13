'use client'

// Toppliste — team leaderboard. Period selector + top-3 in 4 categories.

import { useState, useEffect } from 'react'
import type { ToplistData } from '@/app/api/toplist/route'

// ─── Period helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

function buildPeriodOptions(): { label: string; value: string }[] {
  const now = new Date()
  const options: { label: string; value: string }[] = []
  for (let m = now.getMonth(); m >= 0; m--) {
    options.push({
      label: `${MONTH_NAMES[m]} ${now.getFullYear()}`,
      value: `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`,
    })
  }
  const prevYear = now.getFullYear() - 1
  for (let m = 11; m >= 0; m--) {
    options.push({
      label: `${MONTH_NAMES[m]} ${prevYear}`,
      value: `${prevYear}-${String(m + 1).padStart(2, '0')}`,
    })
  }
  return options
}

const PERIOD_OPTIONS = buildPeriodOptions()

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? 'bg-yellow-400 text-white' :
    rank === 2 ? 'bg-[#C0C0C0] text-white'  :
                 'bg-[#CD7F32] text-white'
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cls}`}>
      {rank}
    </span>
  )
}

// ─── Leaderboard section ──────────────────────────────────────────────────────

interface Entry { kode: string; rep_name: string; value: number }

function LeaderboardSection({
  title,
  entries,
  formatValue,
  loading,
  note,
}: {
  title: string
  entries: Entry[]
  formatValue: (v: number) => string
  loading: boolean
  note: string
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-6">
      <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">{title}</h3>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
              <div className="w-7 h-7 rounded-full bg-border animate-pulse shrink-0" />
              <div className="flex-1 h-4 bg-border rounded animate-pulse" />
              <div className="w-10 h-4 bg-border rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">Ingen data for perioden</p>
      ) : (
        <div className="space-y-0">
          {entries.map((e, i) => (
            <div
              key={e.kode}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0"
            >
              <RankBadge rank={i + 1} />
              <span className={`flex-1 text-base text-text-primary truncate ${i === 0 ? 'font-bold' : 'font-normal'}`}>{e.rep_name}</span>
              <span className={`text-base text-text-primary tabular-nums ${i === 0 ? 'font-bold' : 'font-normal'}`}>{formatValue(e.value)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-text-muted mt-3">{note}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ToplistTab() {
  const [period,  setPeriod]  = useState(PERIOD_OPTIONS[0]?.value ?? '')
  const [data,    setData]    = useState<ToplistData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!period) return
    setLoading(true)
    void fetch(`/api/toplist?period=${period}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: ToplistData | null) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [period])

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-text-secondary whitespace-nowrap">Periode</label>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="text-sm font-medium text-text-primary border border-border rounded-lg px-3 py-2 bg-surface focus:border-[var(--rebil-red)] outline-none cursor-pointer"
        >
          {PERIOD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Four leaderboard sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <LeaderboardSection
          title="Flest kjøpte biler"
          entries={data?.bilerKjopt ?? []}
          formatValue={v => Math.round(v).toLocaleString('nb-NO')}
          loading={loading}
          note="Minimum 5 biler for å komme på toppliste"
        />
        <LeaderboardSection
          title="Høyest andel fullpris"
          entries={data?.fullpris ?? []}
          formatValue={v => `${Math.round(v * 100)}%`}
          loading={loading}
          note="Minimum 5 Fastpris-biler for å komme på toppliste"
        />
        <LeaderboardSection
          title="Beste konvertering"
          entries={data?.konvertering ?? []}
          formatValue={v => `${v.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          loading={loading}
          note="Minimum 5 biler for å komme på toppliste"
        />
        <LeaderboardSection
          title="Beste NPS"
          entries={data?.nps ?? []}
          formatValue={v => Math.round(v).toLocaleString('nb-NO')}
          loading={loading}
          note="Minimum 5 biler for å komme på toppliste"
        />
      </div>
    </div>
  )
}
