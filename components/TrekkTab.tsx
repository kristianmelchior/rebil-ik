'use client'

// Trekk-fane — kombinert visning av avvik og ettersalg for innlogget IK.
// Avvik: kr 100 trekk per rad. Ettersalg: kr 500 trekk per rad der endelig_avgjort = true.

import React, { useState } from 'react'
import type { AvvikRow, EttersalgRow } from '@/lib/types'

const ANKE_BASE    = 'https://docs.google.com/forms/d/e/1FAIpQLSex1E3NJRR2ql-DppcP0Jkv_rMCuEnlkg5lFuInCiEeS-gdqg/viewform'
const HS_PORTAL_ID = '25445101'

function hubspotUrl(recordId: string): string {
  return `https://app-eu1.hubspot.com/contacts/${HS_PORTAL_ID}/record/0-3/${recordId}`
}
const ENTRY_NAVN    = 'entry.165698814'
const ENTRY_REGNR   = 'entry.2103852737'
const ENTRY_HS_LINK = 'entry.1206656143'

function ankeUrl(repName: string, regnr: string | null | undefined, recordId: string): string {
  const params = new URLSearchParams({
    usp: 'pp_url',
    [ENTRY_NAVN]:    repName,
    [ENTRY_REGNR]:   regnr ?? '',
    [ENTRY_HS_LINK]: hubspotUrl(recordId),
  })
  return `${ANKE_BASE}?${params.toString()}`
}

// Trekk-ordningen startet april 2026 — skjul alt før dette
const TREKK_START = '2026-04'

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

interface TrekkTabProps {
  avvik: AvvikRow[]
  ettersalg: EttersalgRow[]
  repName: string
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatKr(n: number): string {
  return `kr ${n.toLocaleString('nb-NO')}`
}

// Ankefristen er 5 dager etter at måneden raden tilhører er over.
// F.eks. mai 2026 → frist 5. juni 2026.
function ankeDeadlinePassed(dato: string): boolean {
  if (!dato) return true
  const [year, month] = dato.slice(0, 7).split('-').map(Number)
  // Siste dag i måneden = dag 0 i neste måned
  const lastDayOfMonth = new Date(year, month, 0)
  const deadline = new Date(lastDayOfMonth)
  deadline.setDate(deadline.getDate() + 5)
  deadline.setHours(23, 59, 59, 999)
  return new Date() > deadline
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string): string {
  const [year, mon] = ym.split('-')
  return `${MONTH_NAMES[parseInt(mon, 10) - 1]} ${year}`
}

// Collect all unique YYYY-MM keys from both datasets, sorted newest first
function buildMonthOptions(avvik: AvvikRow[], ettersalg: EttersalgRow[]): string[] {
  const set = new Set<string>()
  for (const r of avvik)     set.add(r.dato.slice(0, 7))
  for (const r of ettersalg) set.add(r.dato.slice(0, 7))
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

export default function TrekkTab({ avvik, ettersalg, repName }: TrekkTabProps) {
  const ym = currentMonthKey()

  // Filtrer bort data fra før trekk-ordningen startet
  const avvikFiltered     = avvik.filter(r => r.dato.slice(0, 7) >= TREKK_START)
  const ettersalgFiltered = ettersalg.filter(r => r.dato.slice(0, 7) >= TREKK_START)

  const monthOptions = buildMonthOptions(avvikFiltered, ettersalgFiltered)

  const [selectedMonth, setSelectedMonth] = useState<string>(ym)
  const [expandedAvvik, setExpandedAvvik] = useState<string | null>(null)

  const isAll = selectedMonth === 'all'

  // Filter data by selected month
  const filteredAvvik     = isAll ? avvikFiltered     : avvikFiltered.filter(r => r.dato.startsWith(selectedMonth))
  const filteredEttersalg = isAll ? ettersalgFiltered : ettersalgFiltered.filter(r => r.dato.startsWith(selectedMonth))

  // Summary band
  const avvikCount     = filteredAvvik.length
  const ettersalgCount = filteredEttersalg.filter(r => r.endelig_avgjort).length
  const avvikTrekk     = avvikCount * 100
  const ettersalgTrekk = ettersalgCount * 500
  const totalTrekk     = avvikTrekk + ettersalgTrekk

  // Tables — sorted newest first
  const sortedAvvik     = [...filteredAvvik].sort((a, b) => b.dato.localeCompare(a.dato))
  const sortedEttersalg = [...filteredEttersalg].sort((a, b) => b.dato.localeCompare(a.dato))

  const periodLabel = isAll ? 'apr 2026–' : 'denne måneden'

  return (
    <div className="space-y-6">

      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-foreground">Trekk</h2>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            background: 'white', border: '1px solid #E0E0E0', borderRadius: '8px',
            padding: '5px 12px', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', outline: 'none', width: '180px',
          }}
        >
          <option value={ym}>Inneværende måned</option>
          <option value="all">Totalt (apr 2026–)</option>
          {monthOptions.filter(m => m !== ym).map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Summary band */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-card p-4 text-center">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
            Avvik {periodLabel}
          </div>
          <div className="text-2xl font-bold text-foreground">{avvikCount}</div>
          {avvikTrekk > 0 && (
            <div className="text-sm text-red-500 mt-1">−{formatKr(avvikTrekk)}</div>
          )}
        </div>
        <div className="bg-surface border border-border rounded-card p-4 text-center">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
            Ettersalg {periodLabel}
          </div>
          <div className="text-2xl font-bold text-foreground">{ettersalgCount}</div>
          {ettersalgTrekk > 0 && (
            <div className="text-sm text-red-500 mt-1">−{formatKr(ettersalgTrekk)}</div>
          )}
        </div>
        <div className="bg-surface border border-border rounded-card p-4 text-center">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
            Totalt trekk {periodLabel}
          </div>
          <div className={`text-2xl font-bold ${totalTrekk > 0 ? 'text-red-500' : 'text-foreground'}`}>
            {totalTrekk > 0 ? `−${formatKr(totalTrekk)}` : formatKr(0)}
          </div>
        </div>
      </div>

      {/* Avvik table */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Avvik</h3>
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          {sortedAvvik.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-muted">
              Ingen avvik {isAll ? 'registrert for inneværende år' : 'denne måneden'}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Dato</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Bil</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">Trekk</th>
                </tr>
              </thead>
              <tbody>
                {sortedAvvik.map((row, i) => {
                  const bil = [row.merke, row.modell, row.regnr].filter(Boolean).join(' ')
                  const isExpanded = expandedAvvik === row.record_id
                  return (
                    <React.Fragment key={row.record_id}>
                      <tr
                        onClick={() => setExpandedAvvik(isExpanded ? null : row.record_id)}
                        className={`border-b border-border hover:bg-bg transition-colors cursor-pointer select-none${i % 2 !== 0 || isExpanded ? ' bg-bg' : ''}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <a
                            href={hubspotUrl(row.record_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-text-secondary underline underline-offset-2 decoration-text-muted hover:text-text-primary"
                          >
                            {formatDate(row.dato)}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-foreground">{row.avvik_type ?? '—'}</td>
                        <td className="px-4 py-3 text-foreground">{bil || '—'}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-2 justify-end">
                            −kr 100
                            <svg
                              className={`w-3.5 h-3.5 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            >
                              <path d="M2 4l4 4 4-4"/>
                            </svg>
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border bg-bg">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                              <div>
                                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Dato</span>
                                <p className="text-foreground mt-0.5">{formatDate(row.dato)}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Type</span>
                                <p className="text-foreground mt-0.5">{row.avvik_type ?? '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Merke / Modell</span>
                                <p className="text-foreground mt-0.5">{[row.merke, row.modell].filter(Boolean).join(' ') || '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Regnr</span>
                                <p className="text-foreground font-mono mt-0.5">{row.regnr ?? '—'}</p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Kommentar</span>
                                <p className="text-foreground mt-0.5 whitespace-pre-wrap">{row.avvik_komment ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-bg">
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Totalt ({sortedAvvik.length} avvik)
                  </td>
                  <td className="px-4 py-3 text-right text-red-500 font-semibold whitespace-nowrap">
                    −{formatKr(sortedAvvik.length * 100)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Ettersalg table */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Ettersalg</h3>
          <p className="text-xs italic text-text-muted">Anking er kun mulig for inneværende måned — frist 5 dager etter månedslutt.</p>
        </div>
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          {sortedEttersalg.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-muted">
              Ingen ettersalg {isAll ? 'registrert for inneværende år' : 'denne måneden'}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Dato</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Regnr</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">Kostnad</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">Fakturert selger</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">Trekk</th>
                </tr>
              </thead>
              <tbody>
                {sortedEttersalg.map((row, i) => (
                  <tr
                    key={row.record_id}
                    className={`border-b border-border last:border-0 hover:bg-bg transition-colors ${i % 2 === 0 ? '' : 'bg-bg'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a
                        href={hubspotUrl(row.record_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-text-secondary underline underline-offset-2 decoration-text-muted hover:text-text-primary"
                      >
                        {formatDate(row.dato)}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.regnr ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">{formatKr(row.kostnad)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(row.fakturert_selger ?? 0) > 0
                        ? <span className="text-foreground">{formatKr(row.fakturert_selger)}</span>
                        : <span className="text-text-muted">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const fristPassert = ankeDeadlinePassed(row.dato)
                        if (row.endelig_avgjort) {
                          return fristPassert ? (
                            <span className="text-red-500 font-medium">Trukket</span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <span className="text-red-500 font-medium">Trekkes</span>
                              <a
                                href={ankeUrl(repName, row.regnr, row.record_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
                              >
                                Anke
                              </a>
                            </span>
                          )
                        } else {
                          return (
                            <span className="text-green-600 font-medium">
                              {fristPassert ? 'Ikke trukket' : 'Trekkes ikke'}
                            </span>
                          )
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {row.endelig_avgjort ? (
                        <span className="text-red-500">−kr 500</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-bg">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Totalt ({sortedEttersalg.filter(r => r.endelig_avgjort).length} trekkes)
                  </td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                    {ettersalgTrekk > 0 ? (
                      <span className="text-red-500">−{formatKr(ettersalgTrekk)}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}
