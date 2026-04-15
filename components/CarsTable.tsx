// Part 4 — cars table for the selected month.
// Sorted by dato_kjopt descending. HubSpot link when hs_deal_id present.
// Rabatt badge driven by prisgrense column. Footer shows totals.

import type { SaleRow } from '@/lib/types'
import { fmtKr, fmtDatoKjoptShort } from '@/lib/formatDisplay'
import { prisgrenseChipClass, HUBSPOT_SALES_DEAL_BASE } from '@/lib/rabattBadge'

interface CarsTableProps {
  sales:      SaleRow[]
  convFactor?: number
}

export default function CarsTable({ sales, convFactor = 1 }: CarsTableProps) {
  // Sort descending by date
  const sorted = [...sales].sort((a, b) => b.dato_kjopt.localeCompare(a.dato_kjopt))

  const totalBiler  = sorted.reduce((sum, r) => sum + r.biler,     0)
  const totalBrutto = sorted.reduce((sum, r) => sum + r.brutto,    0)
  const totalBonus  = sorted.reduce((sum, r) => sum + (r.bonus ?? 0), 0)
  const totalEstMKonv = Math.round(totalBonus * convFactor)

  const HEADERS = ['Bil', 'Type', 'Dato', 'Innkjøpspris', 'Pris', 'Prisgrense', 'Bonusbidrag', 'Est m konv']
  const RIGHT_ALIGN = new Set([3, 4, 6, 7])

  return (
    <>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mt-7 mb-1.5">
        Bilsliste
      </p>
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {HEADERS.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider ${RIGHT_ALIGN.has(i) ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const chipCls   = prisgrenseChipClass(row.prisgrense)
              const estMKonv  = row.bonus != null ? Math.round(row.bonus * convFactor) : null
              return (
                <tr key={row.id} className="border-b border-[#F0F0F0] hover:bg-bg">
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
                  <td className="px-4 py-3 text-text-secondary">{fmtDatoKjoptShort(row.dato_kjopt)}</td>
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
                  <td className="px-4 py-3 text-text-primary text-right font-medium">
                    {estMKonv != null ? fmtKr(estMKonv) : '—'}
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
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3 text-right">{fmtKr(totalBrutto)}</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3 text-right">{fmtKr(totalBonus)}</td>
              <td className="px-4 py-3 text-right">{fmtKr(totalEstMKonv)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
