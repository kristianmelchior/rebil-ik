'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import CollapsibleSection from './CollapsibleSection'
import type { ReviewRow } from '@/app/tl/api/pipeline/review/route'

export interface CategoryData {
  name:        string
  count:       number
  rottenCount: number
  color:       string
}

export interface RepDeepDive {
  name:       string
  categories: {
    count:       number
    rottenCount: number
    stages: { stageName: string; count: number; rottenCount: number }[]
  }[]
}

interface RottenDeal {
  deal_id:            string
  deal_name:          string | null
  stage_name:         string | null
  ref_date:           string
  days_since:         number
  create_date:        string | null
  last_activity_at:   string | null
  next_activity_date: string | null
}

interface TooltipState {
  x:      number
  y:      number
  stages: { stageName: string; count: number; rottenCount: number }[]
}

const HS_URL = (dealId: string) =>
  `https://app-eu1.hubspot.com/contacts/25445101/record/0-3/${dealId}/`

const SNOOZE_PRESETS = [
  { days: 2,  label: '2 dager',    hint: 'Standard' },
  { days: 5,  label: '5 dager',    hint: null },
  { days: 7,  label: '1 uke',      hint: null },
  { days: 14, label: '2 uker',     hint: null },
  { days: 30, label: '1 måned',    hint: null },
]

function rottenBadgeClass(rottenCount: number, total: number): string {
  const pct = total > 0 ? rottenCount / total : 0
  if (pct > 0.5)  return 'bg-[#FCEBEB] text-[#A32D2D]'
  if (pct > 0.25) return 'bg-[#FDE8D0] text-[#C2580A]'
  return 'text-text-muted'
}

function snoozeUntil(r: ReviewRow): Date {
  const d = new Date(r.reviewed_at)
  d.setDate(d.getDate() + r.snooze_days)
  return d
}

function reviewStatus(r: ReviewRow | undefined): 'active' | 'expired' | 'none' {
  if (!r) return 'none'
  return new Date() < snoozeUntil(r) ? 'active' : 'expired'
}

function daysAgo(r: ReviewRow): number {
  return Math.floor((Date.now() - new Date(r.reviewed_at).getTime()) / 86_400_000)
}

interface Props {
  total:         number
  categories:    CategoryData[]
  reps:          RepDeepDive[]
  lastSyncedAt:  Date | null
}

export default function PipelineOverview({ total, categories, reps, lastSyncedAt }: Props) {
  const [tooltip,     setTooltip]     = useState<TooltipState | null>(null)
  const [expandedRep, setExpandedRep] = useState<string | null>(null)
  const [repDeals,    setRepDeals]    = useState<Record<string, RottenDeal[] | 'loading' | 'error'>>({})
  const [repLimits,   setRepLimits]   = useState<Record<string, number>>({})
  const [repLoading,  setRepLoading]  = useState<Record<string, boolean>>({})
  const [copied,      setCopied]      = useState<string | null>(null)

  // Review state
  const [reviews,      setReviews]      = useState<Record<string, ReviewRow>>({})
  const [snoozeOpen,    setSnoozeOpen]    = useState<string | null>(null)
  const [customDays,    setCustomDays]    = useState<string>('')
  const [reviewPending, setReviewPending] = useState<Set<string>>(new Set())
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetch('/tl/api/pipeline/review', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((rows: ReviewRow[]) => {
        const map: Record<string, ReviewRow> = {}
        for (const r of rows) map[r.deal_id] = r
        setReviews(map)
      })
      .catch(() => {})
  }, [])

  async function markReviewed(dealId: string, snoozeDays: number) {
    setSnoozeOpen(null)
    setReviewPending(s => new Set(s).add(dealId))
    try {
      const res = await fetch('/tl/api/pipeline/review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, snooze_days: snoozeDays }),
      })
      if (res.ok) {
        // Re-fetch to get reviewed_by from server
        const all = await fetch('/tl/api/pipeline/review', { credentials: 'include' }).then(r => r.json()) as ReviewRow[]
        const map: Record<string, ReviewRow> = {}
        for (const r of all) map[r.deal_id] = r
        setReviews(map)
      }
    } finally {
      setReviewPending(s => { const n = new Set(s); n.delete(dealId); return n })
    }
  }

  async function unmarkReviewed(dealId: string) {
    setReviewPending(s => new Set(s).add(dealId))
    try {
      const res = await fetch('/tl/api/pipeline/review', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId }),
      })
      if (res.ok) {
        setReviews(prev => { const n = { ...prev }; delete n[dealId]; return n })
      }
    } finally {
      setReviewPending(s => { const n = new Set(s); n.delete(dealId); return n })
    }
  }

  const max = Math.max(...categories.map(c => c.count), 1)

  const activeCatIndices = categories
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.count > 0)
    .map(({ i }) => i)

  function showTooltip(e: React.MouseEvent, stages: RepDeepDive['categories'][number]['stages']) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, stages: stages.filter(s => s.count > 0) })
  }

  async function fetchDeals(name: string, limit: number) {
    setRepLoading(prev => ({ ...prev, [name]: true }))
    try {
      const res  = await fetch(`/tl/api/pipeline/rotten-sample?owner=${encodeURIComponent(name)}&limit=${limit}`, { credentials: 'include' })
      const data = await res.json() as RottenDeal[] | { error: string }
      setRepDeals(prev => ({ ...prev, [name]: Array.isArray(data) ? data : 'error' }))
      setRepLimits(prev => ({ ...prev, [name]: limit }))
    } catch {
      setRepDeals(prev => ({ ...prev, [name]: 'error' }))
    } finally {
      setRepLoading(prev => ({ ...prev, [name]: false }))
    }
  }

  async function toggleRep(name: string) {
    if (expandedRep === name) { setExpandedRep(null); return }
    setExpandedRep(name)
    if (repDeals[name] && repDeals[name] !== 'error') return

    setRepDeals(prev => ({ ...prev, [name]: 'loading' }))
    await fetchDeals(name, 10)
  }

  async function loadMore(name: string) {
    const next = (repLimits[name] ?? 10) + 10
    await fetchDeals(name, next)
  }

  function copyForSlack(name: string, deals: RottenDeal[]) {
    const lines = [
      `*Over grense — ${name.trim()}* (${deals.length} vist)`,
      '',
      ...deals.map(d => {
        const neste = d.next_activity_date
          ? new Date(d.next_activity_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
          : 'Ingen neste aktivitet'
        const name = (d.deal_name ?? d.deal_id).trim()
        return `*${name}*  ·  ${d.stage_name ?? '?'}  ·  ${d.days_since}d  ·  ${neste}\n${HS_URL(d.deal_id)}`
      }),
    ]
    void navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
      setCopied(name)
      setTimeout(() => setCopied(c => c === name ? null : c), 2000)
    })
  }

  return (
    <>
      <CollapsibleSection
        title={
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#639922] animate-pulse" />
            Pipeline nå
            <span className="normal-case tracking-normal font-normal text-text-muted ml-1">
              — {total} aktive deals
            </span>
          </>
        }
        defaultOpen
      >
        {/* ── Pipeline chart ─────────────────────────────────────────────── */}
        <div className="p-4 bg-[#EBF4FD]">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-medium text-[#185FA5]">{total} deals</span>
            {(() => {
              if (!lastSyncedAt) return <span className="text-xs text-[#185FA5] opacity-75">i pipeline</span>
              const ageMin = Math.floor((Date.now() - lastSyncedAt.getTime()) / 60_000)
              const timeStr = `${String(lastSyncedAt.getHours()).padStart(2,'0')}:${String(lastSyncedAt.getMinutes()).padStart(2,'0')}`
              const color = ageMin > 60 ? '#E24B4A' : ageMin > 30 ? '#C2580A' : undefined
              return (
                <span className="text-xs opacity-90" style={{ color: color ?? '#185FA5', opacity: color ? 1 : undefined }}>
                  i pipeline · synket {timeStr}
                  {ageMin > 30 && ` (${ageMin} min siden)`}
                </span>
              )
            })()}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {categories.filter(c => c.count > 0).map(cat => {
              const trackPct  = Math.round((cat.count / max) * 100)
              const rottenPct = cat.count > 0 ? Math.round((cat.rottenCount / cat.count) * 100) : 0
              return (
                <div key={cat.name} className="flex-1 min-w-[72px]">
                  <div className="text-[11px] text-[#185FA5] mb-1.5 whitespace-nowrap opacity-80">{cat.name}</div>
                  <div className="h-2 rounded-full bg-[#185FA5]/15 overflow-hidden mb-1.5" style={{ width: `${trackPct}%` }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${rottenPct}%`, background: cat.rottenCount > 0 ? '#E24B4A' : cat.color }} />
                  </div>
                  {cat.rottenCount > 0 ? (
                    <>
                      <div className="text-sm font-semibold text-[#A32D2D]">{cat.rottenCount} over grense</div>
                      <div className="text-[11px] text-[#185FA5] opacity-60">av {cat.count}</div>
                    </>
                  ) : (
                    <div className="text-sm font-medium text-[#185FA5]">{cat.count}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Flags placeholder ──────────────────────────────────────────── */}
        <div className="border-t border-border px-4 py-3">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Flags</div>
          <p className="text-sm text-text-muted text-center py-4">Kommer snart — over grense og varsler vises her</p>
        </div>

        {/* ── Deepdive table ─────────────────────────────────────────────── */}
        <div className="border-t border-border px-4 py-3">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Deepdive — personer</div>

          {reps.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Ingen data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium text-text-muted whitespace-nowrap w-6" />
                    <th className="py-2 pr-3 text-left font-medium text-text-muted whitespace-nowrap">Konsulent</th>
                    {activeCatIndices.map(i => (
                      <th key={categories[i].name} className="py-2 px-3 text-center font-medium text-text-muted whitespace-nowrap uppercase tracking-wide">
                        {categories[i].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reps.map((rep, repIdx) => {
                    const isExpanded = expandedRep === rep.name
                    const deals      = repDeals[rep.name]
                    const totalRotten = rep.categories.reduce((s, c) => s + c.rottenCount, 0)
                    return (
                      <Fragment key={rep.name}>
                        <tr
                          className={`border-b border-border ${isExpanded ? 'bg-[#F5F5F5]' : repIdx % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}
                        >
                          <td className="py-2 pl-1">
                            {totalRotten > 0 && (
                              <button
                                onClick={() => void toggleRep(rep.name)}
                                className="text-text-muted hover:text-text-primary transition-colors"
                                title="Se over grense"
                              >
                                <svg
                                  className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                                  viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                >
                                  <path d="M4 2l4 4-4 4" />
                                </svg>
                              </button>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-medium text-text-primary whitespace-nowrap">{rep.name}</td>
                          {activeCatIndices.map(i => {
                            const cat       = rep.categories[i]
                            const hasRotten = cat.rottenCount > 0
                            return (
                              <td
                                key={i}
                                className="py-2 px-3 text-center"
                                onMouseEnter={e => hasRotten && showTooltip(e, cat.stages)}
                                onMouseLeave={() => setTooltip(null)}
                              >
                                {hasRotten ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium cursor-default ${rottenBadgeClass(cat.rottenCount, cat.count)}`}>
                                    {cat.rottenCount}
                                  </span>
                                ) : (
                                  <span className="text-text-muted">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>

                        {/* Expanded deal list */}
                        {isExpanded && (
                          <tr className="border-b border-border bg-[#FAFAFA]">
                            <td colSpan={2 + activeCatIndices.length} className="px-4 py-3">
                              {deals === 'loading' && (
                                <p className="text-xs text-text-muted py-1">Laster…</p>
                              )}
                              {deals === 'error' && (
                                <p className="text-xs text-[#A32D2D] py-1">Feil ved lasting</p>
                              )}
                              {Array.isArray(deals) && deals.length === 0 && (
                                <p className="text-xs text-text-muted py-1">Ingen over grense funnet</p>
                              )}
                              {Array.isArray(deals) && deals.length > 0 && (
                                <>
                                <div className="flex justify-end mb-2">
                                  <button
                                    onClick={() => copyForSlack(rep.name, deals)}
                                    className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary border border-border rounded px-2 py-1 transition-colors"
                                  >
                                    {copied === rep.name ? (
                                      <><svg className="w-3 h-3 text-[#639922]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg> Kopiert!</>
                                    ) : (
                                      <><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="1" width="7" height="8" rx="1"/><path d="M1 4v7"/></svg> Kopier til Slack</>
                                    )}
                                  </button>
                                </div>
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="text-text-muted">
                                      <th className="text-left font-medium pb-1.5 pr-4">Deal</th>
                                      <th className="text-left font-medium pb-1.5 pr-4">Steg</th>
                                      <th className="text-left font-medium pb-1.5 pr-4">Opprettet</th>
                                      <th className="text-left font-medium pb-1.5 pr-4">Siste aktivitet</th>
                                      <th className="text-left font-medium pb-1.5 pr-4">Dager</th>
                                      <th className="text-left font-medium pb-1.5">Neste aktivitet</th>
                                      <th className="text-left font-medium pb-1.5 pl-4 w-6" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {deals.map(deal => {
                                      const review = reviews[deal.deal_id]
                                      const status = reviewStatus(review)
                                      const pending = reviewPending.has(deal.deal_id)

                                      const rowBg =
                                        status === 'active'  ? 'bg-[#F0FBF0]' :
                                        status === 'expired' ? 'bg-[#FFFBEB]' : ''

                                      return (
                                        <tr key={deal.deal_id} className={`border-t border-border/50 ${rowBg}`}>
                                          <td className="py-1.5 pr-4">
                                            <a
                                              href={HS_URL(deal.deal_id)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[#185FA5] hover:underline"
                                            >
                                              {deal.deal_name ?? deal.deal_id}
                                            </a>
                                            {status === 'expired' && review && (
                                              <span className="ml-2 text-[10px] text-[#C2580A]">
                                                Gjennomgått for {daysAgo(review)}d siden — inaktiv igjen
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-1.5 pr-4 text-text-muted whitespace-nowrap">{deal.stage_name ?? '—'}</td>
                                          <td className="py-1.5 pr-4 text-text-muted whitespace-nowrap">{deal.create_date ?? '—'}</td>
                                          <td className="py-1.5 pr-4 text-text-muted whitespace-nowrap">{deal.last_activity_at ?? '—'}</td>
                                          <td className="py-1.5 pr-4 font-medium text-[#A32D2D] whitespace-nowrap">{deal.days_since}d</td>
                                          <td className="py-1.5 text-text-muted whitespace-nowrap">
                                            {deal.next_activity_date
                                              ? new Date(deal.next_activity_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
                                              : <span className="text-[#C2580A]">Ikke satt</span>
                                            }
                                          </td>
                                          <td className="py-1.5 pl-4 whitespace-nowrap relative">
                                            {status === 'active' ? (
                                              <button
                                                onClick={() => void unmarkReviewed(deal.deal_id)}
                                                disabled={pending}
                                                title={`Gjennomgått av ${review!.reviewed_by} — klikk for å fjerne`}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#D1FAD1] text-[#276527] hover:bg-[#BBF0BB] transition-colors disabled:opacity-50"
                                              >
                                                <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
                                                OK
                                              </button>
                                            ) : (
                                              <div className="relative">
                                                <button
                                                  onClick={() => { setSnoozeOpen(o => o === deal.deal_id ? null : deal.deal_id); setCustomDays('') }}
                                                  disabled={pending}
                                                  title="Merk som gjennomgått"
                                                  className="p-0.5 rounded text-text-muted hover:text-[#276527] hover:bg-[#D1FAD1] transition-colors disabled:opacity-50"
                                                >
                                                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
                                                </button>
                                                {snoozeOpen === deal.deal_id && (
                                                  <div className="absolute right-0 top-6 z-50 bg-white border border-border rounded-lg shadow-lg py-2 min-w-[180px]">
                                                    <p className="px-3 pb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wide">Snooze i</p>
                                                    {SNOOZE_PRESETS.map(({ days, label, hint }) => (
                                                      <button
                                                        key={days}
                                                        onClick={() => void markReviewed(deal.deal_id, days)}
                                                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-primary hover:bg-[#F0FBF0] hover:text-[#276527] transition-colors group"
                                                      >
                                                        <span className={hint ? 'font-semibold' : 'font-normal'}>{label}</span>
                                                        {hint && <span className="text-[10px] text-text-muted group-hover:text-[#276527]/70">{hint}</span>}
                                                      </button>
                                                    ))}
                                                    <div className="border-t border-border mx-2 mt-1.5 pt-2 flex items-center gap-1.5 px-1">
                                                      <input
                                                        ref={customInputRef}
                                                        type="number"
                                                        min={1}
                                                        max={365}
                                                        value={customDays}
                                                        onChange={e => setCustomDays(e.target.value)}
                                                        onKeyDown={e => {
                                                          if (e.key === 'Enter') {
                                                            const n = parseInt(customDays, 10)
                                                            if (n > 0) void markReviewed(deal.deal_id, n)
                                                          }
                                                        }}
                                                        placeholder="Antall"
                                                        className="w-16 text-xs border border-border rounded px-2 py-1 outline-none focus:border-[#276527] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                      />
                                                      <span className="text-xs text-text-muted">dager</span>
                                                      <button
                                                        onClick={() => {
                                                          const n = parseInt(customDays, 10)
                                                          if (n > 0) void markReviewed(deal.deal_id, n)
                                                        }}
                                                        disabled={!customDays || parseInt(customDays, 10) < 1}
                                                        className="ml-auto text-[11px] font-medium px-2 py-1 rounded bg-[#276527] text-white hover:bg-[#1e4d1e] disabled:opacity-40 transition-colors"
                                                      >
                                                        Snooze
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                                {deals.length === (repLimits[rep.name] ?? 10) && (
                                  <div className="mt-2 text-center">
                                    <button
                                      onClick={() => void loadMore(rep.name)}
                                      disabled={repLoading[rep.name]}
                                      className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
                                    >
                                      {repLoading[rep.name] ? 'Laster…' : 'Hent flere deals'}
                                    </button>
                                  </div>
                                )}
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Tooltip ──────────────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-border shadow-lg rounded-card px-3 py-2 text-xs pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 4 }}
        >
          {tooltip.stages.map(s => (
            <div key={s.stageName} className="flex items-center justify-between gap-4 py-0.5">
              <span className="text-text-muted">{s.stageName}</span>
              <span className="font-medium text-text-primary">
                {s.rottenCount > 0
                  ? <span className="text-[#A32D2D]">{s.rottenCount}/{s.count} over grense</span>
                  : s.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Close snooze popover on outside click */}
      {snoozeOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSnoozeOpen(null)} />
      )}
    </>
  )
}
