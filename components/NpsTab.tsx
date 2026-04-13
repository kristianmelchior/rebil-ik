'use client'

// NPS tab — table of NPS submissions for the current rep, sorted by submitted_at desc.

import { useState } from 'react'
import type { NpsRow } from '@/lib/types'

const HS_BASE = 'https://app-eu1.hubspot.com/contacts/25445101/record/0-3'

interface NpsTabProps {
  rows: NpsRow[]
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function npsScoreColor(score: number | null): string {
  if (score === null) return 'text-text-muted'
  if (score >= 9) return 'text-green-600'
  if (score >= 7) return 'text-yellow-600'
  return 'text-red-500'
}

interface Tooltip { text: string; x: number; y: number }

export default function NpsTab({ rows }: NpsTabProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-muted text-sm">
        Ingen NPS-data for inneværende år.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Dato</th>
            <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Survey</th>
            <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Selger</th>
            <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">NPS</th>
            <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">Adj. score</th>
            <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-left">Svar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.record_id}
              className={`border-b border-border last:border-0 hover:bg-bg transition-colors ${
                i % 2 === 0 ? '' : 'bg-bg'
              }`}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <a
                  href={`${HS_BASE}/${row.record_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-text-secondary underline underline-offset-2 decoration-text-muted hover:text-text-primary"
                >
                  {formatDate(row.submitted_at)}
                </a>
              </td>
              <td className="px-4 py-3 text-text-primary">
                {row.survey || '—'}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {row.rep_name || '—'}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-text-primary">
                {row.nps ?? '—'}
              </td>
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${npsScoreColor(row.nps_adj_score)}`}>
                {row.nps_adj_score ?? '—'}
              </td>
              <td
                className="px-4 py-3 text-text-secondary max-w-[320px] truncate"
                onMouseEnter={row.svar ? e => setTooltip({ text: row.svar!, x: e.clientX, y: e.clientY }) : undefined}
                onMouseMove={row.svar ? e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null) : undefined}
                onMouseLeave={row.svar ? () => setTooltip(null) : undefined}
              >
                {row.svar || '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-bg">
            <td colSpan={3} className="px-4 py-3 text-xs text-text-muted">
              {rows.length} svar
            </td>
            <td className="px-4 py-3 text-right text-xs text-text-muted tabular-nums">
              Snitt: {rows.length > 0
                ? (rows.reduce((s, r) => s + (r.nps ?? 0), 0) / rows.length).toFixed(1)
                : '—'}
            </td>
            <td className="px-4 py-3 text-right text-xs text-text-muted tabular-nums">
              Snitt: {rows.length > 0
                ? (rows.reduce((s, r) => s + (r.nps_adj_score ?? 0), 0) / rows.length).toFixed(1)
                : '—'}
            </td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
      {tooltip && (
        <div
          className="fixed z-50 bg-surface border border-border rounded-card shadow-lg p-3 text-xs text-text-primary w-72 leading-relaxed pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
