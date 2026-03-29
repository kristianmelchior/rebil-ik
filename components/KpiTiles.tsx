'use client'

// Part 1 — four KPI tiles with period toggle (Inneværende måned / Siste 30 dager).
// Shows rep value + team median for: Biler kjøpt, Leads, Konvertering, NPS.

import { useState } from 'react'
import type { PeriodMetrics } from '@/lib/types'
import { fmtKjoptLeads, fmtKonvertering, fmtNps } from '@/lib/formatDisplay'
import ToggleGroup from './ToggleGroup'

interface KpiTilesProps {
  currentMonth:        PeriodMetrics
  last30Days:          PeriodMetrics
  medianCurrentMonth:  PeriodMetrics
  medianLast30Days:    PeriodMetrics
}

const PERIOD_OPTIONS = [
  { label: 'Inneværende måned', value: 'month' },
  { label: 'Siste 30 dager',    value: '30d'   },
]

export default function KpiTiles({
  currentMonth, last30Days, medianCurrentMonth, medianLast30Days,
}: KpiTilesProps) {
  const [period, setPeriod] = useState<'month' | '30d'>('30d')

  const metrics = period === 'month' ? currentMonth      : last30Days
  const medians = period === 'month' ? medianCurrentMonth : medianLast30Days

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-text-primary">Nøkkeltall</h2>
        <ToggleGroup
          options={PERIOD_OPTIONS}
          value={period}
          onChange={v => setPeriod(v as 'month' | '30d')}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Biler kjøpt */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Biler kjøpt</p>
          <p className="text-kpi font-medium text-text-primary leading-tight mb-1.5">{fmtKjoptLeads(metrics.bilerKjopt)}</p>
          <p className="text-xs text-text-muted">Median: {fmtKjoptLeads(medians.bilerKjopt)}</p>
        </div>

        {/* Leads */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Leads</p>
          <p className="text-kpi font-medium text-text-primary leading-tight mb-1.5">{fmtKjoptLeads(metrics.leads)}</p>
          <p className="text-xs text-text-muted">Median: {fmtKjoptLeads(medians.leads)}</p>
        </div>

        {/* Konvertering */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konvertering</p>
          <p className="text-kpi font-medium text-text-primary leading-tight mb-1.5">{fmtKonvertering(metrics.konverteringsrate)}</p>
          <p className="text-xs text-text-muted">Median: {fmtKonvertering(medians.konverteringsrate)}</p>
        </div>

        {/* NPS */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">NPS</p>
          <p className="text-kpi font-medium text-text-primary leading-tight mb-1.5">{fmtNps(metrics.npsScore)}</p>
          <p className="text-xs text-text-muted">Median: {fmtNps(medians.npsScore)}</p>
          {metrics.npsCount > 0 && (
            <p className="text-xs text-text-hint mt-1">Basert på {fmtKjoptLeads(metrics.npsCount)} svar</p>
          )}
        </div>
      </div>
    </section>
  )
}
