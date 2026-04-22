'use client'

// Tildelte leads — two side-by-side tables showing lead reassignments per rep.
// Table 1: leads received (rep_name ≠ dealowner_assigned_to, person is rep_name)
// Table 2: leads lost (dealowner_assigned_to = person, person ≠ rep_name)

import { useState, useEffect, useMemo } from 'react'
import type { TildelingData, TildelingEntry } from '@/app/api/tildeling/route'

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

// ─── Table component ─────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-text-muted opacity-30">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

interface SimpleTableProps {
  title:    string
  subtitle: string
  rows:     TildelingEntry[]
  countKey: 'tildelt' | 'mistet'
  loading:  boolean
}

function SimpleTable({ title, subtitle, rows, countKey, loading }: SimpleTableProps) {
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [sortCol, setSortCol] = useState<'name' | 'count'>('count')

  const sorted = useMemo(() => {
    const filtered = rows.filter(r => r[countKey] > 0)
    return [...filtered].sort((a, b) => {
      if (sortCol === 'name') {
        return sortDir === 'asc'
          ? a.name.localeCompare(b.name, 'nb')
          : b.name.localeCompare(a.name, 'nb')
      }
      return sortDir === 'asc' ? a[countKey] - b[countKey] : b[countKey] - a[countKey]
    })
  }, [rows, countKey, sortCol, sortDir])

  function toggle(col: 'name' | 'count') {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div className="flex-1 min-w-0 bg-surface border border-border rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              onClick={() => toggle('name')}
              className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text-primary"
            >
              Selger <SortIcon active={sortCol === 'name'} dir={sortDir} />
            </th>
            <th
              onClick={() => toggle('count')}
              className="px-4 py-2.5 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text-primary"
            >
              Antall <SortIcon active={sortCol === 'count'} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-bg' : ''}`}>
                <td className="px-4 py-3"><div className="h-4 w-36 bg-border rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-4 w-8 bg-border rounded animate-pulse ml-auto" /></td>
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr><td colSpan={2} className="px-4 py-10 text-center text-text-muted text-sm">Ingen data</td></tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border last:border-0 hover:bg-bg transition-colors ${i % 2 !== 0 ? 'bg-bg' : ''}`}
              >
                <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{row.name}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-primary">
                  {row[countKey].toLocaleString('nb-NO')}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {!loading && sorted.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border bg-bg">
              <td className="px-4 py-3 text-sm font-semibold text-text-primary">Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-primary">
                {sorted.reduce((s, r) => s + r[countKey], 0).toLocaleString('nb-NO')}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = 'month' | '30d' | 'custom'

export default function TildelingTab({ defaultTlFilter }: { defaultTlFilter?: string }) {
  const [mode,     setMode]     = useState<Mode>('month')
  const [period,   setPeriod]   = useState(MONTH_OPTIONS[0]?.value ?? '')
  const [data,     setData]     = useState<TildelingData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tlFilter, setTlFilter] = useState<string>(defaultTlFilter ?? '__all__')

  useEffect(() => {
    setLoading(true)
    const params = mode === 'custom' ? `period=${period}` : `mode=${mode}`
    void fetch(`/api/tildeling?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: TildelingData | null) => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mode, period])

  const teamleaders = useMemo(() => {
    const names = Array.from(new Set((data?.rows ?? []).map(r => r.teamleder).filter(Boolean)))
    return names.sort((a, b) => a.localeCompare(b, 'nb'))
  }, [data])

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? []
    return tlFilter === '__all__' ? rows : rows.filter(r => r.teamleder === tlFilter)
  }, [data, tlFilter])

  return (
    <div className="space-y-5">

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
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

      {/* Two tables side by side */}
      <div className="flex gap-4">
        <SimpleTable
          title="Fått tildelt"
          subtitle="rep_name = person, men ikke dealowner_assigned_to"
          rows={filteredRows}
          countKey="tildelt"
          loading={loading}
        />
        <SimpleTable
          title="Mistet"
          subtitle="dealowner_assigned_to = person, men ikke rep_name"
          rows={filteredRows}
          countKey="mistet"
          loading={loading}
        />
      </div>
    </div>
  )
}
