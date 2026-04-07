'use client'

// NPS tab — table of NPS submissions for the current rep, sorted by submitted_at desc.

import type { NpsRow } from '@/lib/types'

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

const COLS = ['Dato', 'Survey', 'Selger', 'NPS', 'Adj. score'] as const

export default function NpsTab({ rows }: NpsTabProps) {
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
            {COLS.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider ${
                  i >= 3 ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.record_id}
              className={`border-b border-border last:border-0 ${
                i % 2 === 0 ? '' : 'bg-bg'
              }`}
            >
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                {formatDate(row.submitted_at)}
              </td>
              <td className="px-4 py-3 text-text-primary">
                {row.survey || '—'}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {row.rep_name || '—'}
              </td>
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${npsScoreColor(row.nps)}`}>
                {row.nps ?? '—'}
              </td>
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${npsScoreColor(row.nps_adj_score)}`}>
                {row.nps_adj_score ?? '—'}
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
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
