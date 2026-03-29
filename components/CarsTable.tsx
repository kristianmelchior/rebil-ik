// Part 4 — cars table for the selected month.
// Sorted by dato_kjopt descending. HubSpot link when hs_deal_id present.
// Rabatt badge driven by prisgrense column. Footer shows totals.

import type { SaleRow } from '@/lib/types'
import { fmtKr } from '@/lib/formatDisplay'
import { prisgrenseChipClass, HUBSPOT_SALES_DEAL_BASE } from '@/lib/rabattBadge'

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
              {['Bil', 'Type', 'Innkjøpspris', 'Pris', 'Prisgrense', 'Bonusbidrag'].map((h, i) => (
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
              const chipCls = prisgrenseChipClass(row.prisgrense)
              return (
                <tr key={row.id} className="border-b border-[#F0F0F0] hover:bg-bg">
                  {/* Bil — sales.navn; link to HubSpot deal when hs_deal_id present */}
                  <td className="px-4 py-3 text-text-primary">
                    {row.hs_deal_id ? (
                      <a
                        href={`${HUBSPOT_SALES_DEAL_BASE}/${row.hs_deal_id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-text-hint underline-offset-[3px] hover:decoration-text-primary"
                      >
                        {row.navn?.trim() || `#${row.id}`}
                        {row.prisgrense === 'Pris' ? ' 🏆' : ''}
                      </a>
                    ) : (
                      <span>
                        {row.navn?.trim() || `#${row.id}`}
                        {row.prisgrense === 'Pris' ? ' 🏆' : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.salgstype}</td>
                  <td className="px-4 py-3 text-text-primary text-right">
                    {row.innkjopspris != null ? fmtKr(row.innkjopspris) : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-primary text-right">{fmtKr(row.brutto)}</td>
                  <td className="px-4 py-3">
                    {row.prisgrense ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-pill ${chipCls}`}>
                        {row.prisgrense}
                      </span>
                    ) : null}
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
