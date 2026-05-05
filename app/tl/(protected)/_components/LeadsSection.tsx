'use client'

// Leads detail view — filter by rep + period, two sortable tables.
// Table 1 (top):    rep_name = filter AND dealeier_ik ≠ filter
// Table 2 (bottom): dealeier_ik = filter

import { useState, useEffect, useCallback } from 'react'
import type { LeadDetailRow, LeadsResponse } from '@/app/tl/api/leads/route'

const HS_URL = (id: string) =>
  `https://app-eu1.hubspot.com/contacts/25445101/record/0-3/${id}/`

// ─── Date formatter ───────────────────────────────────────────────────────────

const DAY_SHORT   = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

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

function monthRange(ym: string): { from: string; to: string } {
  const [year, mon] = ym.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${String(lastDay).padStart(2, '0')}` }
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortCol = 'hs_object_id' | 'dealeier_ik' | 'rep_name' | 'createdate' | 'teller_lead' | 'lost_reason'
type SortDir = 'asc' | 'desc'

function sortValue(row: LeadDetailRow, col: SortCol): string | number {
  switch (col) {
    case 'hs_object_id':          return row.hs_object_id ?? ''
    case 'dealeier_ik': return row.dealeier_ik ?? ''
    case 'rep_name':              return row.rep_name ?? ''
    case 'createdate':            return row.createdate ?? ''
    case 'teller_lead':           return row.teller_lead ? 1 : 0
    case 'lost_reason':           return row.lost_reason ?? ''
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortTh({
  col, label, sortCol, sortDir, onSort,
}: {
  col:     SortCol
  label:   string
  sortCol: SortCol
  sortDir: SortDir
  onSort:  (col: SortCol) => void
}) {
  const active = sortCol === col
  return (
    <th
      className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-2 pr-4 cursor-pointer select-none whitespace-nowrap hover:text-text-primary"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-25'}`}>
          {active && sortDir === 'desc' ? '▲' : '▼'}
        </span>
      </span>
    </th>
  )
}

interface LeadsTableProps {
  title:            string
  subtitle:         string
  rows:             LeadDetailRow[]
  defaultCollapsed?: boolean
}

function LeadsTable({ title, subtitle, rows, defaultCollapsed = false }: LeadsTableProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [sortCol, setSortCol] = useState<SortCol>('createdate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = sortValue(a, sortCol)
    const bv = sortValue(b, sortCol)
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'nb')
    return sortDir === 'asc' ? cmp : -cmp
  })

  const thProps = { sortCol, sortDir, onSort: handleSort }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 group"
          aria-expanded={!collapsed}
        >
          <span className={`text-[11px] text-text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
          <h2 className="text-base font-semibold text-text-primary group-hover:underline">{title}</h2>
        </button>
        <span className="text-xs text-text-muted">{subtitle}</span>
        <span className="ml-auto text-xs text-text-muted">{rows.length} {rows.length === 1 ? 'lead' : 'leads'}</span>
      </div>

      {!collapsed && rows.length === 0 ? (
        <p className="text-sm text-text-muted">Ingen leads.</p>
      ) : !collapsed ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-[#FAFAFA]">
                <SortTh {...thProps} col="hs_object_id"          label="HS Object ID" />
                <SortTh {...thProps} col="dealeier_ik" label="Dealeier IK" />
                <SortTh {...thProps} col="rep_name"              label="Rep name" />
                <SortTh {...thProps} col="createdate"            label="Dato" />
                <SortTh {...thProps} col="teller_lead"           label="Teller lead" />
                <SortTh {...thProps} col="lost_reason"           label="Lost reason" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={`${row.hs_object_id}-${i}`}
                  className="border-t border-border/60 hover:bg-[#FAFAFA] transition-colors"
                >
                  <td className="py-2.5 pr-4">
                    {row.hs_object_id ? (
                      <a
                        href={HS_URL(row.hs_object_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#185FA5] hover:underline font-mono text-xs"
                      >
                        {row.hs_object_id}
                      </a>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {row.dealeier_ik ?? <span className="text-text-muted italic">Ikke satt</span>}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {row.rep_name ?? <span className="text-text-muted italic">—</span>}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-text-muted">
                    {fmtDate(row.createdate)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {row.teller_lead === null ? (
                      <span className="text-text-muted">—</span>
                    ) : row.teller_lead ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Ja</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F5] text-text-muted">Nei</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {row.lost_reason ?? <span className="text-text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  reps: { full_name: string; teamleder: string }[]
}

export default function LeadsSection({ reps }: Props) {
  const [selectedRep,   setSelectedRep]   = useState('')
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0]?.value ?? '')
  const [data,          setData]          = useState<LeadsResponse | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  const fetchLeads = useCallback(async (rep: string, month: string) => {
    if (!rep || !month) return
    setLoading(true)
    setError(null)
    try {
      const { from, to } = monthRange(month)
      const params = new URLSearchParams({ dealowner: rep, from, to })
      const res  = await fetch(`/tl/api/leads?${params}`, { credentials: 'include' })
      const json = await res.json() as LeadsResponse | { error: string }
      if ('error' in json) setError(json.error)
      else setData(json)
    } catch {
      setError('Nettverksfeil')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedRep) fetchLeads(selectedRep, selectedMonth)
    else setData(null)
  }, [selectedRep, selectedMonth, fetchLeads])

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-6">Leads</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-8">
        <select
          value={selectedRep}
          onChange={e => setSelectedRep(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary min-w-[200px]"
        >
          <option value="">Velg rep…</option>
          {reps.map(r => (
            <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
          ))}
        </select>

        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary"
        >
          {MONTH_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* States */}
      {!selectedRep && <p className="text-sm text-text-muted">Velg en rep for å se leads.</p>}
      {loading       && <p className="text-sm text-text-muted">Laster…</p>}
      {error         && <p className="text-sm text-[#A32D2D]">{error}</p>}

      {/* Summary + Tables */}
      {!loading && data && (() => {
        const håndtert   = data.asDealowner.length
        const helgevakt  = data.asDealowner.filter(r => r.teller_lead === false).length
        const ikketeller = data.asDealowner.filter(r => r.dealeier_ik !== selectedRep).length
        const flyttet    = data.asRepName.length

        const stats: { label: string; value: number; hint: string }[] = [
          { label: 'Leads håndtert',       value: håndtert,   hint: 'dealeier_ik = valgt rep' },
          { label: 'Leads helgevakt',       value: helgevakt,  hint: 'teller_lead = false' },
          { label: 'Leads som ikke teller', value: ikketeller, hint: 'dealeier_ik ≠ valgt rep (fra andres pipeline)' },
          { label: 'Leads flyttet',         value: flyttet,    hint: 'rep_name = valgt rep, dealeier_ik endret' },
        ]

        return (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {stats.map(s => (
                <div key={s.label} className="bg-white border border-border rounded-lg p-4">
                  <p className="text-xs text-text-muted mb-1 leading-tight">{s.label}</p>
                  <p className="text-2xl font-semibold text-text-primary">{s.value}</p>
                  <p className="text-[11px] text-text-hint mt-1 leading-tight">{s.hint}</p>
                </div>
              ))}
            </div>

            <LeadsTable
              title="Leads flyttet"
              subtitle="rep_name = valgt rep, dealeier_ik ≠ valgt rep"
              rows={data.asRepName}
              defaultCollapsed
            />
            <LeadsTable
              title="Leads håndtert"
              subtitle="dealeier_ik = valgt rep"
              rows={data.asDealowner}
            />
          </>
        )
      })()}
    </div>
  )
}
