'use client'

// Stats — admin/teamleder-only team overview table with 6 metrics per rep.

import React, { useState, useEffect, useMemo } from 'react'
import type { StatsData, RepStatsEntry } from '@/app/api/stats/route'

// ─── Period helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

const DATA_START_YEAR = 2026

function buildMonthOptions(): { label: string; value: string }[] {
  const now = new Date()
  const options: { label: string; value: string }[] = []
  for (let m = now.getMonth(); m >= 0; m--) {
    options.push({
      label: `${MONTH_NAMES[m]} ${now.getFullYear()}`,
      value: `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`,
    })
  }
  const prev = now.getFullYear() - 1
  if (prev >= DATA_START_YEAR) {
    for (let m = 11; m >= 0; m--) {
      options.push({
        label: `${MONTH_NAMES[m]} ${prev}`,
        value: `${prev}-${String(m + 1).padStart(2, '0')}`,
      })
    }
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt     = (n: number)          => Math.round(n).toLocaleString('nb-NO')
const fmtPct  = (v: number | null)   => v === null ? '—' : `${Math.round(v * 100)}%`
const fmtKonv = (v: number | null)   => v === null ? '—' : `${v.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const fmtNps     = (v: number | null)   => v === null ? '—' : Math.round(v).toLocaleString('nb-NO')
const fmtAvgDays = (v: number | null | undefined) => v == null ? '—' : `${v.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}d`

// ─── Column definitions ───────────────────────────────────────────────────────

type SortKey = keyof RepStatsEntry

interface ColDef {
  key: SortKey
  label: string
  fmt: (r: RepStatsEntry) => string
  primary: boolean
  neutral?: boolean
  styleOverride?: (value: number | null | undefined) => React.CSSProperties
}

// Detail columns shown when "Netto videre" is expanded
const VIDERE_DETAIL_KEYS = new Set(['kommisjon', 'fjernkommisjon', 'salgshjelp', 'vrakbiler', 'plattformCount'])


const ALL_COLS: ColDef[] = [
  { key: 'bilerKjopt',          label: 'Biler kjøpt',      fmt: r => fmt(r.bilerKjopt),               primary: true  },
  { key: 'nettoAntallVidere',   label: 'Netto videre',     fmt: r => fmt(r.nettoAntallVidere),        primary: true  },
  { key: 'kommisjon',           label: 'Kommisjon',        fmt: r => fmt(r.kommisjon),                primary: false },
  { key: 'fjernkommisjon',      label: 'Fjernkom.',        fmt: r => fmt(r.fjernkommisjon),           primary: false },
  { key: 'salgshjelp',          label: 'Salgshjelp',       fmt: r => fmt(r.salgshjelp),               primary: false },
  { key: 'vrakbiler',           label: 'Vrakbiler',        fmt: r => fmt(r.vrakbiler),                primary: false },
  { key: 'plattformCount',      label: 'Til plattform',    fmt: r => fmt(r.plattformCount),           primary: false },
  { key: 'fullprisPct',         label: 'Andel fullpris',   fmt: r => fmtPct(r.fullprisPct),           primary: true  },
  { key: 'konvertering',        label: 'Konv. (teller)',   fmt: r => fmtKonv(r.konvertering),         primary: true  },
  { key: 'konverteringHandtert',label: 'Konv. (håndtert)', fmt: r => fmtKonv(r.konverteringHandtert), primary: true  },
  { key: 'npsScore',            label: 'NPS',              fmt: r => fmtNps(r.npsScore),              primary: true  },
  { key: 'konvPlattformRate',   label: 'Konv. til plt.',   fmt: r => fmtPct(r.konvPlattformRate),     primary: false },
  { key: 'konvFraPlattform',    label: 'Konv. fra plt.',   fmt: r => fmtPct(r.konvFraPlattform),      primary: false },
  { key: 'avgKontakttidDays',   label: 'Avg. kontakttid',  fmt: r => fmtAvgDays(r.avgKontakttidDays), primary: false,
    styleOverride: (v) => v == null ? {} : v < 1.8 ? { color: '#16a34a' } : v > 2.3 ? { color: '#dc2626' } : {} },
  { key: 'sameDagPct',          label: 'Kontakttid',       fmt: r => fmtPct(r.sameDagPct),            primary: false },
  { key: 'leads',               label: 'Leads teller',     fmt: r => fmt(r.leads),                    primary: false },
  { key: 'leadsHandtert',       label: 'Leads håndtert',   fmt: r => fmt(r.leadsHandtert),            primary: false },
  { key: 'fastprisPct',         label: 'Andel Fastpris',   fmt: r => fmtPct(r.fastprisPct),           primary: false, neutral: true },
  { key: 'antallAvvik',        label: 'Avvik',            fmt: r => fmt(r.antallAvvik),              primary: false, neutral: true },
  { key: 'antallEttersalg',    label: 'Ettersalg',        fmt: r => fmt(r.antallEttersalg),          primary: false, neutral: true },
  { key: 'andelViderefakturert', label: 'Viderefakt.',    fmt: r => fmtPct(r.andelViderefakturert),  primary: false, neutral: true },
]

// ─── Conditional formatting ───────────────────────────────────────────────────

function condStyle(
  value: number | null,
  rows: RepStatsEntry[],
  key: SortKey,
): React.CSSProperties {
  if (value === null) return {}
  const activeRows = rows.filter(r => r.bilerKjopt > 0)
  const vals = activeRows.map(r => r[key] as number | null).filter((v): v is number => v !== null)
  if (vals.length < 3) return {}
  const sorted = [...vals].sort((a, b) => a - b)
  const n = sorted.length
  const cutLow  = sorted[Math.floor((n - 1) * 0.20)]
  const cutHigh = sorted[Math.floor((n - 1) * 0.80)]
  if (cutLow === cutHigh) return {}
  if (value >= cutHigh) return { color: '#16a34a' }
  if (value <= cutLow)  return { color: '#dc2626' }
  return {}
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortRows(rows: RepStatsEntry[], key: SortKey, dir: 'asc' | 'desc'): RepStatsEntry[] {
  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    // nulls always last
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv, 'nb') : bv.localeCompare(av, 'nb')
    }
    const an = Number(av), bn = Number(bv)
    return dir === 'asc' ? an - bn : bn - an
  })
}

// ─── Totals row ───────────────────────────────────────────────────────────────

function computeTotals(rows: RepStatsEntry[]): RepStatsEntry {
  const totalBiler        = rows.reduce((s, r) => s + r.bilerKjopt, 0)
  const totalLeads        = rows.reduce((s, r) => s + r.leads, 0)
  const totalLeadsHandtert = rows.reduce((s, r) => s + r.leadsHandtert, 0)

  const konvRows    = rows.filter(r => r.konvertering      !== null)
  const npsRows     = rows.filter(r => r.npsScore          !== null)
  const prisRows    = rows.filter(r => r.fullprisPct       !== null)
  const fastRows    = rows.filter(r => r.fastprisPct       !== null)
  const pltRows     = rows.filter(r => r.konvPlattformRate !== null)
  const ktRows      = rows.filter(r => r.sameDagPct        !== null)

  return {
    kode: '__total__',
    rep_name: 'Total',
    teamleder: '',
    teamlederInitials: '',
    bilerKjopt:        totalBiler,
    leads:             totalLeads,
    leadsHandtert:     totalLeadsHandtert,
    konvertering:         konvRows.length === 0 ? null : konvRows.reduce((s, r) => s + r.konvertering!,         0) / konvRows.length,
    konverteringHandtert: (() => { const r = rows.filter(r => r.konverteringHandtert != null); return r.length === 0 ? null : r.reduce((s, r) => s + r.konverteringHandtert!, 0) / r.length })(),
    npsScore:          npsRows.length  === 0 ? null : npsRows.reduce((s, r)  => s + r.npsScore!,          0) / npsRows.length,
    fullprisPct:       (() => {
      const pb = rows.reduce((acc, r) => { for (const [k, v] of Object.entries(r.prisBreakdown)) acc[k] = (acc[k] ?? 0) + v; return acc }, {} as Record<string, number>)
      const tot = Object.values(pb).reduce((s, v) => s + v, 0)
      return tot === 0 ? null : (pb['Pris'] ?? 0) / tot
    })(),
    fastprisPct:       fastRows.length === 0 ? null : fastRows.reduce((s, r) => s + r.fastprisPct!,       0) / fastRows.length,
    konvPlattformRate:    pltRows.length  === 0 ? null : pltRows.reduce((s, r)  => s + r.konvPlattformRate!, 0) / pltRows.length,
    sameDagPct:           ktRows.length   === 0 ? null : ktRows.reduce((s, r)   => s + r.sameDagPct!,        0) / ktRows.length,
    avgKontakttidDays:    (() => { const r = rows.filter(r => r.avgKontakttidDays != null); return r.length === 0 ? null : r.reduce((s, r) => s + r.avgKontakttidDays!, 0) / r.length })(),
    kontakttidBreakdown:  {},
    prisBreakdown: rows.reduce((acc, r) => {
      for (const [k, v] of Object.entries(r.prisBreakdown)) {
        acc[k] = (acc[k] ?? 0) + v
      }
      return acc
    }, {} as Record<string, number>),
    tjenesteBreakdown: rows.reduce((acc, r) => {
      for (const [k, v] of Object.entries(r.tjenesteBreakdown)) {
        acc[k] = (acc[k] ?? 0) + v
      }
      return acc
    }, {} as Record<string, number>),
    kommisjon:         rows.reduce((s, r) => s + r.kommisjon,      0),
    fjernkommisjon:    rows.reduce((s, r) => s + r.fjernkommisjon, 0),
    salgshjelp:        rows.reduce((s, r) => s + r.salgshjelp,     0),
    vrakbiler:         rows.reduce((s, r) => s + r.vrakbiler,      0),
    plattformCount:    rows.reduce((s, r) => s + r.plattformCount, 0),
    nettoAntallVidere: rows.reduce((s, r) => s + r.nettoAntallVidere, 0),
    konvFraPlattform:  (() => {
      const totalPlt   = rows.reduce((s, r) => s + r.plattformCount, 0)
      const totalBiler = rows.reduce((s, r) => s + r.bilerKjopt, 0)
      return totalPlt === 0 ? null : totalBiler / totalPlt
    })(),
    antallAvvik:          rows.reduce((s, r) => s + r.antallAvvik, 0),
    antallEttersalg:      rows.reduce((s, r) => s + r.antallEttersalg, 0),
    ettersalgKostnad:     rows.reduce((s, r) => s + r.ettersalgKostnad, 0),
    ettersalgFakturert:   rows.reduce((s, r) => s + r.ettersalgFakturert, 0),
    andelViderefakturert: (() => {
      const k = rows.reduce((s, r) => s + r.ettersalgKostnad, 0)
      const f = rows.reduce((s, r) => s + r.ettersalgFakturert, 0)
      return k === 0 ? null : f / k
    })(),
  }
}

// ─── Sort indicator ───────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-text-muted opacity-30">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = 'month' | '30d' | 'custom'

export default function StatsTab({ defaultTlFilter }: { defaultTlFilter?: string }) {
  const [mode,              setMode]              = useState<Mode>('month')
  const [period,            setPeriod]            = useState(MONTH_OPTIONS[0]?.value ?? '')
  const [data,              setData]              = useState<StatsData | null>(null)
  const [loading,           setLoading]           = useState(true)
  const [sortKey,           setSortKey]           = useState<SortKey>('bilerKjopt')
  const [sortDir,           setSortDir]           = useState<'asc' | 'desc'>('desc')
  const [tlFilter,          setTlFilter]          = useState<string>(defaultTlFilter ?? '__all__')
  const [showVidereDetails, setShowVidereDetails] = useState(false)
  const [showKjoptDetails,  setShowKjoptDetails]  = useState(false)
  const [showPrisDetails,   setShowPrisDetails]   = useState(false)
  const [tjenesteSortCat,   setTjenesteSortCat]   = useState<string | null>(null)

  const visibleCols = ALL_COLS.filter(c => showVidereDetails || !VIDERE_DETAIL_KEYS.has(c.key as string))

  useEffect(() => {
    setLoading(true)
    const params = mode === 'custom' ? `period=${period}` : `mode=${mode}`
    void fetch(`/api/stats?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: StatsData | null) => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mode, period])

  function handleSort(key: SortKey) {
    setTjenesteSortCat(null)
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function handleTjenesteSort(cat: string) {
    if (tjenesteSortCat === cat) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setTjenesteSortCat(cat)
      setSortDir('desc')
    }
  }

  // Unique teamleaders for filter dropdown
  const teamleaders = useMemo(() => {
    const names = Array.from(new Set((data?.rows ?? []).map(r => r.teamleder).filter(Boolean)))
    return names.sort((a, b) => a.localeCompare(b, 'nb'))
  }, [data])

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? []
    const base = tlFilter === '__all__' ? rows : rows.filter(r => r.teamleder === tlFilter)
    if (tjenesteSortCat) {
      return [...base].sort((a, b) => {
        const av = a.tjenesteBreakdown[tjenesteSortCat] ?? 0
        const bv = b.tjenesteBreakdown[tjenesteSortCat] ?? 0
        return sortDir === 'asc' ? av - bv : bv - av
      })
    }
    return sortRows(base, sortKey, sortDir)
  }, [data, tlFilter, sortKey, sortDir, tjenesteSortCat])

  const totals = useMemo(() => computeTotals(filteredRows), [filteredRows])

  const PRIS_ORDER = ['Rabattnivå 1', 'Rabattnivå 2', 'Minstepris']

  // Derive pris detail categories from filtered rows (excl. 'Pris'), fixed order + unknown last
  const prisCategories = useMemo(() => {
    if (!showPrisDetails) return []
    const seen = new Set<string>()
    for (const row of filteredRows) {
      for (const k of Object.keys(row.prisBreakdown)) {
        if (k !== 'Pris') seen.add(k)
      }
    }
    const known   = PRIS_ORDER.filter(k => seen.has(k))
    const unknown = [...seen].filter(k => !PRIS_ORDER.includes(k)).sort()
    return [...known, ...unknown]
  }, [showPrisDetails, filteredRows])

  // Derive tjeneste categories from filtered rows, sorted by total desc
  const tjenestenCategories = useMemo(() => {
    if (!showKjoptDetails) return []
    const sums: Record<string, number> = {}
    for (const row of filteredRows) {
      for (const [k, v] of Object.entries(row.tjenesteBreakdown)) {
        sums[k] = (sums[k] ?? 0) + v
      }
    }
    return Object.entries(sums)
      .filter(([, v]) => v > 0)
      .sort((a, b) => {
        const aLast = a[0].toLowerCase().includes('publisert')
        const bLast = b[0].toLowerCase().includes('publisert')
        if (aLast && !bLast) return 1
        if (!aLast && bLast) return -1
        return b[1] - a[1]
      })
      .map(([k]) => k)
  }, [showKjoptDetails, filteredRows])

  return (
    <div className="space-y-5">

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Mode pills */}
        <div className="inline-flex bg-[#EBEBEB] rounded-pill p-[3px] gap-0.5">
          {([['month', 'Inneværende måned'], ['30d', 'Siste 30 dager']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-pill text-xs font-medium px-3.5 py-1 transition-colors ${
                mode === m
                  ? 'bg-[var(--rebil-red)] text-white'
                  : 'bg-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Historical month */}
        <select
          value={mode === 'custom' ? period : ''}
          onChange={e => { setPeriod(e.target.value); setMode('custom') }}
          className={`text-sm font-medium border border-border rounded-lg px-3 py-1.5 bg-surface outline-none cursor-pointer transition-colors ${
            mode === 'custom' ? 'text-text-primary border-[var(--rebil-red)]' : 'text-text-muted focus:border-[var(--rebil-red)]'
          }`}
        >
          <option value="" disabled>Tidligere måneder…</option>
          {MONTH_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Teamleder filter */}
        {teamleaders.length > 0 && (
          <select
            value={tlFilter}
            onChange={e => setTlFilter(e.target.value)}
            className="text-sm font-medium border border-border rounded-lg px-3 py-1.5 bg-surface outline-none cursor-pointer focus:border-[var(--rebil-red)] text-text-primary"
          >
            <option value="__all__">Alle teamledere</option>
            {teamleaders.map(tl => (
              <option key={tl} value={tl}>{tl}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-card overflow-x-auto max-h-[calc(100vh-180px)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-surface">
            <tr className="border-b border-border">
              {/* Name — sortable, sticky */}
              <th
                className="sticky left-0 z-10 bg-surface px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-text-primary after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border"
                onClick={() => handleSort('rep_name')}
              >
                Selger <SortIcon active={sortKey === 'rep_name'} dir={sortDir} />
              </th>
              {visibleCols.map(col => (
                col.key === 'bilerKjopt' ? (
                  <React.Fragment key="bilerKjopt-group">
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap select-none font-semibold text-text-primary">
                      <span
                        onClick={() => setShowKjoptDetails(v => !v)}
                        className="inline-flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
                        title={showKjoptDetails ? 'Skjul detaljer' : 'Vis detaljer'}
                      >
                        {col.label}
                        <span className={`inline-block transition-transform duration-200 ${showKjoptDetails ? 'rotate-180' : ''}`}>▾</span>
                      </span>
                      {' '}
                      <span onClick={() => handleSort(col.key)} className="cursor-pointer hover:opacity-70 transition-opacity">
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </span>
                    </th>
                    {showKjoptDetails && tjenestenCategories.map(cat => (
                      <th
                        key={`tj_${cat}`}
                        title={cat}
                        onClick={() => handleTjenesteSort(cat)}
                        className="min-w-[100px] px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap font-medium text-text-muted cursor-pointer select-none hover:text-text-primary"
                      >
                        {cat.length > 14 ? cat.slice(0, 13) + '…' : cat} <SortIcon active={tjenesteSortCat === cat} dir={sortDir} />
                      </th>
                    ))}
                  </React.Fragment>
                ) : col.key === 'fullprisPct' ? (
                  <React.Fragment key="fullpris-group">
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap select-none font-semibold text-text-primary">
                      <span
                        onClick={() => setShowPrisDetails(v => !v)}
                        className="inline-flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
                        title={showPrisDetails ? 'Skjul detaljer' : 'Vis detaljer'}
                      >
                        {col.label}
                        <span className={`inline-block transition-transform duration-200 ${showPrisDetails ? 'rotate-180' : ''}`}>▾</span>
                      </span>
                      {' '}
                      <span onClick={() => handleSort(col.key)} className="cursor-pointer hover:opacity-70 transition-opacity">
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </span>
                    </th>
                    {showPrisDetails && prisCategories.map(cat => (
                      <th
                        key={`pris_${cat}`}
                        onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap font-medium text-text-muted cursor-pointer select-none hover:text-text-primary"
                      >
                        {cat} <SortIcon active={false} dir={sortDir} />
                      </th>
                    ))}
                  </React.Fragment>
                ) : col.key === 'nettoAntallVidere' ? (
                  <th
                    key={col.key as string}
                    className="px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap select-none font-semibold text-text-primary"
                  >
                    <span
                      onClick={() => setShowVidereDetails(v => !v)}
                      className="inline-flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
                      title={showVidereDetails ? 'Skjul detaljer' : 'Vis detaljer'}
                    >
                      {col.label}
                      <span className={`inline-block transition-transform duration-200 ${showVidereDetails ? 'rotate-180' : ''}`}>▾</span>
                    </span>
                    {' '}
                    <span onClick={() => handleSort(col.key)} className="cursor-pointer hover:opacity-70 transition-opacity">
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </span>
                  </th>
                ) : (
                  <th
                    key={col.key as string}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-text-primary ${
                      col.primary ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'
                    }`}
                  >
                    {col.label} <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-bg' : ''}`}>
                  <td className={`sticky left-0 z-10 px-4 py-3 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border ${i % 2 !== 0 ? 'bg-bg' : 'bg-surface'}`}><div className="h-4 w-36 bg-border rounded animate-pulse" /></td>
                  {visibleCols.map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-10 bg-border rounded animate-pulse ml-auto" /></td>
                  ))}
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-text-muted text-sm">Ingen data</td></tr>
            ) : (
              filteredRows.map((row, i) => (
                <tr
                  key={row.kode}
                  className={`border-b border-border last:border-0 hover:bg-bg transition-colors ${i % 2 !== 0 ? 'bg-bg' : ''}`}
                >
                  <td className={`sticky left-0 z-10 px-4 py-3 whitespace-nowrap after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border ${i % 2 !== 0 ? 'bg-bg' : 'bg-surface'}`}>
                    <span className="font-medium text-text-primary">{row.rep_name}</span>
                    {row.teamlederInitials && (
                      <span className="ml-2 text-[11px] font-medium text-text-muted bg-bg border border-border rounded px-1.5 py-0.5">
                        {row.teamlederInitials}
                      </span>
                    )}
                  </td>
                  {visibleCols.map(col => (
                    col.key === 'fullprisPct' ? (
                      <React.Fragment key="fullpris-group">
                        <td
                          style={condStyle(row.fullprisPct, filteredRows, 'fullprisPct')}
                          className="px-4 py-3 text-right tabular-nums font-semibold"
                        >
                          {col.fmt(row)}
                        </td>
                        {showPrisDetails && prisCategories.map(cat => {
                          const total = Object.values(row.prisBreakdown).reduce((s, v) => s + v, 0)
                          const pct = total === 0 ? null : (row.prisBreakdown[cat] ?? 0) / total
                          return (
                            <td key={`pris_${cat}`} className="px-4 py-3 text-right tabular-nums font-normal text-text-muted">
                              {pct === null ? '—' : fmtPct(pct)}
                            </td>
                          )
                        })}
                      </React.Fragment>
                    ) : col.key === 'bilerKjopt' ? (
                      <React.Fragment key="bilerKjopt-group">
                        <td
                          style={condStyle(row.bilerKjopt, filteredRows, 'bilerKjopt')}
                          className="px-4 py-3 text-right tabular-nums font-semibold"
                        >
                          {col.fmt(row)}
                        </td>
                        {showKjoptDetails && tjenestenCategories.map(cat => (
                          <td key={`tj_${cat}`} className="px-4 py-3 text-right tabular-nums font-normal text-text-muted">
                            {row.tjenesteBreakdown[cat] ? fmt(row.tjenesteBreakdown[cat]) : '—'}
                          </td>
                        ))}
                      </React.Fragment>
                    ) : (
                      <td
                        key={col.key as string}
                        style={col.styleOverride ? col.styleOverride(row[col.key] as number | null) : col.neutral ? undefined : condStyle(row[col.key] as number | null, filteredRows, col.key)}
                        className={`px-4 py-3 text-right tabular-nums ${
                          col.primary ? 'font-semibold' : 'font-normal'
                        }`}
                      >
                        {col.fmt(row)}
                      </td>
                    )
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {/* Totals row */}
          {!loading && filteredRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-bg">
                <td className="sticky left-0 z-10 bg-bg px-4 py-3 text-sm font-semibold text-text-primary after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">Total</td>
                {visibleCols.map(col => (
                  col.key === 'fullprisPct' ? (
                    <React.Fragment key="fullpris-group">
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-muted">
                        {col.fmt(totals)}
                      </td>
                      {showPrisDetails && prisCategories.map(cat => {
                        const total = Object.values(totals.prisBreakdown).reduce((s, v) => s + v, 0)
                        const pct = total === 0 ? null : (totals.prisBreakdown[cat] ?? 0) / total
                        return (
                          <td key={`pris_${cat}`} className="px-4 py-3 text-right tabular-nums font-semibold text-text-muted">
                            {pct === null ? '—' : fmtPct(pct)}
                          </td>
                        )
                      })}
                    </React.Fragment>
                  ) : col.key === 'bilerKjopt' ? (
                    <React.Fragment key="bilerKjopt-group">
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-primary">
                        {col.fmt(totals)}
                      </td>
                      {showKjoptDetails && tjenestenCategories.map(cat => (
                        <td key={`tj_${cat}`} className="px-4 py-3 text-right tabular-nums font-semibold text-text-muted">
                          {totals.tjenesteBreakdown[cat] ? fmt(totals.tjenesteBreakdown[cat]) : '—'}
                        </td>
                      ))}
                    </React.Fragment>
                  ) : (
                    <td
                      key={col.key as string}
                      className={`px-4 py-3 text-right tabular-nums font-semibold ${
                        col.primary ? 'text-text-primary' : 'text-text-muted'
                      }`}
                    >
                      {col.fmt(totals)}
                    </td>
                  )
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

    </div>
  )
}
