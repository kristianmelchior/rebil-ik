'use client'

import { useEffect, useState } from 'react'
import { cleanScore, scoreStyle, rottenBadgeClass } from '@/lib/tl/pipeline-utils'

interface CategorySummary {
  name:        string
  count:       number
  rottenCount: number
}

interface RottenDeal {
  deal_id:          string
  deal_name:        string | null
  stage_name:       string | null
  days_since:       number
  create_date:      string | null
  last_activity_at: string | null
  hubspot_url:      string
}

interface PipelineData {
  categories:   CategorySummary[]
  totalDeals:   number
  totalRotten:  number
  rottenDeals:  RottenDeal[]
  repName:      string
}

export default function RepPipelineWidget() {
  const [data,      setData]      = useState<PipelineData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(false)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    fetch('/api/pipeline/my-pipeline', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: PipelineData | null) => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null
  if (data.totalDeals === 0) return null

  const score = cleanScore(data.totalRotten)

  function toggleDeal(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === data!.rottenDeals.length
        ? new Set()
        : new Set(data!.rottenDeals.map(d => d.deal_id))
    )
  }

  function copyToSlack() {
    const toCopy = selected.size > 0
      ? data!.rottenDeals.filter(d => selected.has(d.deal_id))
      : data!.rottenDeals
    const lines = [
      `*Over grense — ${data!.repName}* (${toCopy.length} deals)`,
      '',
      ...toCopy.map(d =>
        `*${(d.deal_name ?? d.deal_id).trim()}*  ·  ${d.stage_name ?? '?'}  ·  ${d.days_since}d\n${d.hubspot_url}`
      ),
    ]
    void navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-card border border-border bg-surface overflow-hidden">

      {/* ── Header: score + deals + kategori-badges ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-4">
          Pipeline — mine leads
        </div>

        {/* Én linje: Score + Aktive deals | Kategori-badges fordelt over full bredde */}
        <div className="flex items-start w-full gap-4">

          {/* Score */}
          <div className="flex flex-col items-center gap-1.5 w-[100px] shrink-0">
            <span className="text-[11px] text-text-muted uppercase tracking-wide h-4 flex items-center">Score</span>
            <span className={`text-4xl font-bold px-3 py-0.5 rounded-lg leading-none ${scoreStyle(score)}`}>
              {score}
            </span>
          </div>

          {/* Aktive deals */}
          <div className="flex flex-col items-center gap-1.5 w-[100px] shrink-0">
            <span className="text-[11px] text-text-muted uppercase tracking-wide h-4 flex items-center whitespace-nowrap">Aktive deals</span>
            <span className="text-4xl font-normal text-text-primary leading-none">{data.totalDeals}</span>
          </div>

          {/* Separator */}
          <div className="w-px bg-border self-stretch mx-1 shrink-0" />

          {/* Kategorier — fyller resten jevnt */}
          <div className="flex flex-1 items-start">
            {data.categories.filter(c => c.count > 0).map(cat => (
              <div key={cat.name} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-text-muted uppercase tracking-wide h-4 flex items-center text-center leading-tight">{cat.name}</span>
                <span className={`text-[11px] font-medium leading-none ${cat.rottenCount > 0 ? `inline-block px-2 py-0.5 rounded-full ${rottenBadgeClass(cat.rottenCount)}` : 'text-text-muted'}`}>
                  {cat.rottenCount}
                </span>
                <span className="text-[10px] text-text-muted">av {cat.count}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Expandable: deals over grense ── */}
      {data.totalRotten > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-text-primary hover:bg-[#FAFAFA] transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg
                className={`w-3 h-3 transition-transform duration-150 text-text-muted ${expanded ? 'rotate-90' : ''}`}
                viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <path d="M4 2l4 4-4 4" />
              </svg>
              <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold ${rottenBadgeClass(data.totalRotten)}`}>
                {data.totalRotten}
              </span>
              deal{data.totalRotten !== 1 ? 's' : ''} over grense
            </span>
            {expanded && (
              <button
                onClick={e => { e.stopPropagation(); copyToSlack() }}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary border border-border rounded px-2 py-1 transition-colors"
              >
                {copied ? (
                  <><svg className="w-3 h-3 text-[#639922]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg> Kopiert!</>
                ) : (
                  <><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="1" width="7" height="8" rx="1"/><path d="M1 4v7"/></svg>
                  {selected.size > 0 ? `Kopier ${selected.size} valgte` : 'Kopier til Slack'}</>
                )}
              </button>
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="pb-2 pr-2 w-5">
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-[#185FA5]"
                        checked={selected.size === data.rottenDeals.length && data.rottenDeals.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="pb-2 pr-4 text-left font-medium">Deal</th>
                    <th className="pb-2 pr-4 text-left font-medium whitespace-nowrap">Steg</th>
                    <th className="pb-2 pr-4 text-left font-medium whitespace-nowrap">Opprettet</th>
                    <th className="pb-2 pr-4 text-left font-medium whitespace-nowrap">Siste aktivitet</th>
                    <th className="pb-2 pr-4 text-left font-medium whitespace-nowrap">Dager</th>
                    <th className="pb-2 text-left font-medium whitespace-nowrap">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rottenDeals.map(deal => {
                    const isSelected = selected.has(deal.deal_id)
                    return (
                      <tr
                        key={deal.deal_id}
                        className={`border-t border-border/50 ${isSelected ? 'bg-[#EEF4FC]' : ''}`}
                      >
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            className="cursor-pointer accent-[#185FA5]"
                            checked={isSelected}
                            onChange={() => toggleDeal(deal.deal_id)}
                          />
                        </td>
                        <td className="py-2 pr-4 font-medium text-text-primary">
                          {deal.deal_name ?? deal.deal_id}
                        </td>
                        <td className="py-2 pr-4 text-text-muted whitespace-nowrap">{deal.stage_name ?? '—'}</td>
                        <td className="py-2 pr-4 text-text-muted whitespace-nowrap">{deal.create_date ?? '—'}</td>
                        <td className="py-2 pr-4 text-text-muted whitespace-nowrap">{deal.last_activity_at ? deal.last_activity_at.slice(0, 10) : '—'}</td>
                        <td className="py-2 pr-4 font-medium text-[#A32D2D] whitespace-nowrap">{deal.days_since}d</td>
                        <td className="py-2">
                          <a
                            href={deal.hubspot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-[#185FA5] text-white hover:bg-[#1050A0] transition-colors whitespace-nowrap"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M3 2l7 4-7 4V2z"/>
                            </svg>
                            Ring nå
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
