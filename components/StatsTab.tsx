'use client'

// Stats — admin/teamleder-only team overview table with 6 metrics per rep.

import { useState, useEffect, useMemo } from 'react'
import type { StatsData, RepStatsEntry } from '@/app/api/stats/route'

// ─── Period helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

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
  for (let m = 11; m >= 0; m--) {
    options.push({
      label: `${MONTH_NAMES[m]} ${prev}`,
      value: `${prev}-${String(m + 1).padStart(2, '0')}`,
    })
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt     = (n: number)          => Math.round(n).toLocaleString('nb-NO')
const fmtPct  = (v: number | null)   => v === null ? '—' : `${Math.round(v * 100)}%`
const fmtKonv = (v: number | null)   => v === null ? '—' : `${v.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const fmtNps  = (v: number | null)   => v === null ? '—' : Math.round(v).toLocaleString('nb-NO')

// ─── Column definitions ───────────────────────────────────────────────────────

type SortKey = keyof RepStatsEntry

interface ColDef {
  key: SortKey
  label: string
  fmt: (r: RepStatsEntry) => string
  primary: boolean
}

const COLS: ColDef[] = [
  { key: 'bilerKjopt',   label: 'Biler kjøpt',   fmt: r => fmt(r.bilerKjopt),            primary: true  },
  { key: 'fullprisPct',  label: 'Andel fullpris', fmt: r => fmtPct(r.fullprisPct),        primary: true  },
  { key: 'konvertering', label: 'Konvertering',   fmt: r => fmtKonv(r.konvertering),      primary: true  },
  { key: 'npsScore',     label: 'NPS',            fmt: r => fmtNps(r.npsScore),           primary: true  },
  { key: 'leads',        label: 'Leads',          fmt: r => fmt(r.leads),                 primary: false },
  { key: 'fastprisPct',  label: 'Andel Fastpris', fmt: r => fmtPct(r.fastprisPct),        primary: false },
]

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
  const totalBiler  = rows.reduce((s, r) => s + r.bilerKjopt, 0)
  const totalLeads  = rows.reduce((s, r) => s + r.leads, 0)

  const konvRows    = rows.filter(r => r.konvertering !== null)
  const npsRows     = rows.filter(r => r.npsScore     !== null)
  const prisRows    = rows.filter(r => r.fullprisPct  !== null)
  const fastRows    = rows.filter(r => r.fastprisPct  !== null)

  return {
    kode: '__total__',
    rep_name: 'Total',
    teamleder: '',
    teamlederInitials: '',
    bilerKjopt:   totalBiler,
    leads:        totalLeads,
    konvertering: konvRows.length === 0  ? null : konvRows.reduce((s, r)  => s + r.konvertering!, 0)  / konvRows.length,
    npsScore:     npsRows.length  === 0  ? null : npsRows.reduce((s, r)   => s + r.npsScore!,     0)  / npsRows.length,
    fullprisPct:  prisRows.length === 0  ? null : prisRows.reduce((s, r)  => s + r.fullprisPct!,  0)  / prisRows.length,
    fastprisPct:  fastRows.length === 0  ? null : fastRows.reduce((s, r)  => s + r.fastprisPct!,  0)  / fastRows.length,
  }
}

// ─── Sort indicator ───────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-text-muted opacity-30">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = 'month' | '30d' | 'custom'

export default function StatsTab() {
  const [mode,      setMode]      = useState<Mode>('month')
  const [period,    setPeriod]    = useState(MONTH_OPTIONS[0]?.value ?? '')
  const [data,      setData]      = useState<StatsData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [sortKey,   setSortKey]   = useState<SortKey>('bilerKjopt')
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc')
  const [tlFilter,  setTlFilter]  = useState<string>('__all__')

  useEffect(() => {
    setLoading(true)
    const params = mode === 'custom' ? `period=${period}` : `mode=${mode}`
    void fetch(`/api/stats?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: StatsData | null) => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mode, period])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
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
    return sortRows(base, sortKey, sortDir)
  }, [data, tlFilter, sortKey, sortDir])

  const totals = useMemo(() => computeTotals(filteredRows), [filteredRows])

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
      <div className="bg-surface border border-border rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {/* Name — sortable */}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-text-primary"
                onClick={() => handleSort('rep_name')}
              >
                Selger <SortIcon active={sortKey === 'rep_name'} dir={sortDir} />
              </th>
              {COLS.map(col => (
                <th
                  key={col.key as string}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-right text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-text-primary ${
                    col.primary ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'
                  }`}
                >
                  {col.label} <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-bg' : ''}`}>
                  <td className="px-4 py-3"><div className="h-4 w-36 bg-border rounded animate-pulse" /></td>
                  {COLS.map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-10 bg-border rounded animate-pulse ml-auto" /></td>
                  ))}
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted text-sm">Ingen data</td></tr>
            ) : (
              filteredRows.map((row, i) => (
                <tr
                  key={row.kode}
                  className={`border-b border-border last:border-0 hover:bg-bg transition-colors ${i % 2 !== 0 ? 'bg-bg' : ''}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-text-primary">{row.rep_name}</span>
                    {row.teamlederInitials && (
                      <span className="ml-2 text-[11px] font-medium text-text-muted bg-bg border border-border rounded px-1.5 py-0.5">
                        {row.teamlederInitials}
                      </span>
                    )}
                  </td>
                  {COLS.map(col => (
                    <td
                      key={col.key as string}
                      className={`px-4 py-3 text-right tabular-nums ${
                        col.primary ? 'font-semibold text-text-primary' : 'font-normal text-text-muted'
                      }`}
                    >
                      {col.fmt(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {/* Totals row */}
          {!loading && filteredRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-bg">
                <td className="px-4 py-3 text-sm font-semibold text-text-primary">Total</td>
                {COLS.map(col => (
                  <td
                    key={col.key as string}
                    className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      col.primary ? 'text-text-primary' : 'text-text-muted'
                    }`}
                  >
                    {col.fmt(totals)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
