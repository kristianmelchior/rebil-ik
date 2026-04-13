'use client'

// Secondary insight tiles shown below the main KPI tiles.
// Period toggle is shared with KpiTiles via page.tsx state.

import type { SaleRow } from '@/lib/types'
import { fmtKjoptLeads } from '@/lib/formatDisplay'
import { BreakdownTile, buildFordSlices } from './BreakdownTile'

// ─── Main component ───────────────────────────────────────────────────────────

interface InsightTilesProps {
  period:          'month' | '30d'
  salesThisMonth:  SaleRow[]
  salesLast30Days: SaleRow[]
  leads:           number
}

export default function InsightTiles({
  period, salesThisMonth, salesLast30Days, leads,
}: InsightTilesProps) {
  const sales      = period === 'month' ? salesThisMonth : salesLast30Days
  const fordSlices = buildFordSlices(sales)

  return (
    <section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {/* 1. Leads */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Leads</p>
          <p className="text-kpi font-medium text-text-muted leading-tight">{fmtKjoptLeads(leads)}</p>
        </div>

        {/* 2. Andel Fastpris */}
        <BreakdownTile
          title="Andel Fastpris"
          mainLabel="Fastpris"
          slices={fordSlices}
          muted
        />

        {/* 3. Konv til plattform */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konv til plattform</p>
          <p className="text-kpi font-medium text-text-muted leading-tight">—</p>
        </div>

        {/* 4. Kontakttid */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Kontakttid</p>
          <p className="text-kpi font-medium text-text-muted leading-tight">—</p>
        </div>

      </div>
    </section>
  )
}
