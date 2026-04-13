'use client'

// Part 1 — four KPI tiles with period toggle (Inneværende måned / Siste 30 dager).
// Shows rep value for: Biler kjøpt, Andel fullpris, Konvertering, NPS.

import { useState } from 'react'
import type { PeriodMetrics } from '@/lib/types'
import { fmtKjoptLeads, fmtKonvertering, fmtNps } from '@/lib/formatDisplay'
import ToggleGroup from './ToggleGroup'
import { BreakdownTile, type Slice } from './BreakdownTile'

interface KpiTilesProps {
  currentMonth:    PeriodMetrics
  last30Days:      PeriodMetrics
  period:          'month' | '30d'
  onPeriodChange:  (v: 'month' | '30d') => void
  prisSlices:      Slice[]
}

const PERIOD_OPTIONS = [
  { label: 'Inneværende måned', value: 'month' },
  { label: 'Siste 30 dager',    value: '30d'   },
]

export default function KpiTiles({
  currentMonth, last30Days, period, onPeriodChange, prisSlices,
}: KpiTilesProps) {
  const metrics = period === 'month' ? currentMonth : last30Days
  const [npsHover, setNpsHover] = useState(false)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-text-primary">Nøkkeltall</h2>
        <ToggleGroup
          options={PERIOD_OPTIONS}
          value={period}
          onChange={v => onPeriodChange(v as 'month' | '30d')}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Biler kjøpt */}
        <div className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px]">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Biler kjøpt</p>
          <p className="text-kpi font-medium text-text-primary leading-tight">{fmtKjoptLeads(metrics.bilerKjopt)}</p>
        </div>

        {/* Andel fullpris */}
        <BreakdownTile
          title="Andel fullpris"
          mainLabel="Pris"
          slices={prisSlices}
        />

        {/* Konvertering */}
        <div className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px]">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konvertering</p>
          <p className="text-kpi font-medium text-text-primary leading-tight">{fmtKonvertering(metrics.konverteringsrate)}</p>
        </div>

        {/* NPS */}
        <div
          className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px] relative"
          onMouseEnter={() => setNpsHover(true)}
          onMouseLeave={() => setNpsHover(false)}
        >
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">NPS</p>
          <p className="text-kpi font-medium text-text-primary leading-tight">{fmtNps(metrics.npsScore)}</p>
          {npsHover && metrics.npsCount > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 bg-surface border border-border rounded-card shadow-lg px-3 py-2 text-xs text-text-secondary whitespace-nowrap">
              Basert på {fmtKjoptLeads(metrics.npsCount)} svar
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
