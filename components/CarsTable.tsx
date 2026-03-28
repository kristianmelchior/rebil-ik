// Part 4 — cars table for the selected month.
// Sorted by dato_kjopt descending. HubSpot link when hs_deal_id present.
// Rabatt badge driven by prisgrense column. Footer shows totals.

import type { SaleRow } from '@/lib/types'

const HUBSPOT_BASE = 'https://app-eu1.hubspot.com/contacts/25445101/record/0-3'

// Badge config keyed by prisgrense value
const RABATT_BADGE: Record<string, { label: string; cls: string }> = {
  'Pris':       { label: 'Ingen rabatt', cls: 'bg-flag-ok-bg text-flag-ok-text'     },
  'Rabatt 1':   { label: 'Lav rabatt',   cls: 'bg-flag-warn-bg text-flag-warn-text' },
  'Rabatt 2':   { label: 'Høy rabatt',   cls: 'bg-flag-red-bg text-flag-red-text'   },
  'Minstepris': { label: 'Minstepris',   cls: 'bg-flag-red-bg text-flag-red-text'   },
}

// Format currency with Norwegian locale
// Input: n (number)  Output: "kr X XXX"
function fmtKr(n: number): string {
  return `kr ${Math.round(n).toLocaleString('nb-NO')}`
}

interface CarsTableProps {
  sales: SaleRow[]
}

export default function CarsTable({ sales }: CarsTableProps) {
  // Sort descending by date
  const sorted = [...sales].sort((a, b) => b.dato_kjopt.localeCompare(a.dato_kjopt))

  const totalBiler     = sorted.reduce((sum, r) => sum + r.biler,     0)
  const totalBrutto    = sorted.reduce((sum, r) => sum + r.brutto,    0)
  const totalBonus = sorted.reduce((sum, r) => sum + (r.bonus ?? 0), 0)

  return (
    <>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mt-7 mb-1.5">
        Bilsliste
      </p>
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Bil', 'Type', 'Innkjøpspris', 'Pris', 'Rabatt', 'Bonusbidrag'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider ${i >= 2 && i !== 4 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const badge = row.prisgrense ? RABATT_BADGE[row.prisgrense] : null
              return (
                <tr key={row.id} className="border-b border-[#F0F0F0] hover:bg-bg">
                  {/* Bil — sales.navn; link to HubSpot deal when hs_deal_id present */}
                  <td className="px-4 py-3 text-text-primary">
                    {row.hs_deal_id ? (
                      <a
                        href={`${HUBSPOT_BASE}/${row.hs_deal_id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-text-hint underline-offset-[3px] hover:decoration-text-primary"
                      >
                        {row.navn?.trim() || `#${row.id}`}
                      </a>
                    ) : (
                      <span>{row.navn?.trim() || `#${row.id}`}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.salgstype}</td>
                  <td className="px-4 py-3 text-text-primary text-right">
                    {row.innkjopspris != null ? fmtKr(row.innkjopspris) : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-primary text-right">{fmtKr(row.brutto)}</td>
                  <td className="px-4 py-3">
                    {badge && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-pill ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-primary text-right">
                    {row.bonus != null ? fmtKr(row.bonus) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-border">
              <td className="px-4 py-3">{totalBiler} biler</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3 text-right">{fmtKr(totalBrutto)}</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3 text-right">{fmtKr(totalBonus)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
