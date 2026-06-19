'use client'

// Nøkkeltall section — 8 tiles in a 5-col grid + expandable innkjøpskanaler chart.
// Col 5 is a row-span-2 card (Antall videre). Click it to show monthly bar chart.

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, LabelList,
} from 'recharts'
import type { PeriodMetrics, SaleRow, KonvPlattformPoint } from '@/lib/types'
import { fmtKjoptLeads, fmtKonvertering, fmtNps } from '@/lib/formatDisplay'
import ToggleGroup from './ToggleGroup'
import { BreakdownTile, buildFordSlices, type Slice } from './BreakdownTile'

const BRAND_RED  = 'var(--rebil-red)'
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

interface KpiTilesProps {
  currentMonth:    PeriodMetrics
  last30Days:      PeriodMetrics
  period:          'month' | '30d'
  onPeriodChange:  (v: 'month' | '30d') => void
  prisSlices:      Slice[]
  salesThisMonth:  SaleRow[]
  salesLast30Days: SaleRow[]
  currentMonthKonvPlattform?: { rate: number | null; count: number }
  last30KonvPlattform?:       { rate: number | null; count: number }
  currentMonthSameDagPct?:    number | null
  last30SameDagPct?:          number | null
  // For innkjøpskanaler chart
  salesByMonth?:        Record<string, SaleRow[]>
  konvPlattformTrend?:  KonvPlattformPoint[]
  // For cross-source dedup in card (current period) and chart (historical months)
  plattformLeadIdsMonth?:   string[]
  plattformLeadIds30d?:     string[]
  plattformLeadIdsByMonth?: Record<string, string[]>
}

const PERIOD_OPTIONS = [
  { label: 'Inneværende måned', value: 'month' },
  { label: 'Siste 30 dager',    value: '30d'   },
]

type KanalKey = 'kommisjon' | 'fjernkommisjon' | 'salgshjelp' | 'vrakbiler' | 'plattform' | 'netto'

const KANAL_OPTIONS: { key: KanalKey; label: string }[] = [
  { key: 'kommisjon',      label: 'Kommisjon'           },
  { key: 'fjernkommisjon', label: 'Fjernkommisjon'      },
  { key: 'salgshjelp',     label: 'Salgshjelp'          },
  { key: 'vrakbiler',      label: 'Vrakbiler'           },
  { key: 'plattform',      label: 'Til plattform'       },
  { key: 'netto',          label: 'Netto antall videre' },
]

function buildKanalerChartData(
  salesByMonth: Record<string, SaleRow[]>,
  konvPlattformTrend: KonvPlattformPoint[],
  year: number,
  plattformLeadIdsByMonth: Record<string, string[]>,
) {
  const plattformMap = new Map(konvPlattformTrend.map(p => [p.month, p.count]))
  return Array.from({ length: 12 }, (_, i) => {
    const ym  = `${year}-${String(i + 1).padStart(2, '0')}`
    const rows = salesByMonth[ym] ?? []
    const kommisjon      = rows.filter(r => r.salgstype === 'Kommisjon').reduce((n, r) => n + (r.biler ?? 0), 0)
    const fjernkommisjon = rows.filter(r => r.salgstype === 'Fjernkommisjon').reduce((n, r) => n + (r.biler ?? 0), 0)
    const salgshjelp     = rows.filter(r => r.bonustype === 'Salgshjelp').reduce((n, r) => n + (r.biler ?? 0), 0)
    const vrakbiler      = rows.filter(r => r.innkjopstype === 'b2b_scrap').reduce((n, r) => n + (r.biler ?? 0), 0)
    const plattform      = plattformMap.get(ym) ?? 0

    // Netto: unique qualifying sales (dedup by hs_deal_id) + plattform leads not in sales.
    const qualifying = rows.filter(r =>
      r.salgstype === 'Kommisjon' ||
      r.salgstype === 'Fjernkommisjon' ||
      r.bonustype === 'Salgshjelp' ||
      r.innkjopstype === 'b2b_scrap'
    )
    const salesNettoMap = new Map<string, number>()
    for (const r of qualifying) {
      const key = r.hs_deal_id ?? `_id_${r.id}`
      salesNettoMap.set(key, (salesNettoMap.get(key) ?? 0) + (r.biler ?? 0))
    }
    const salesNetto = [...salesNettoMap.values()].reduce((s, b) => s + b, 0)
    const qualifyingDealIds = new Set(
      qualifying.map(r => r.hs_deal_id).filter((id): id is string => Boolean(id))
    )
    const monthIds = plattformLeadIdsByMonth[ym]
    const plattformNetto = monthIds
      ? monthIds.filter(id => !qualifyingDealIds.has(id)).length
      : plattform
    const netto = salesNetto + plattformNetto

    return { month: ym, kommisjon, fjernkommisjon, salgshjelp, vrakbiler, plattform, netto }
  })
}

export default function KpiTiles({
  currentMonth, last30Days, period, onPeriodChange, prisSlices,
  salesThisMonth, salesLast30Days,
  currentMonthKonvPlattform, last30KonvPlattform,
  currentMonthSameDagPct, last30SameDagPct,
  salesByMonth, konvPlattformTrend,
  plattformLeadIdsMonth, plattformLeadIds30d, plattformLeadIdsByMonth,
}: KpiTilesProps) {
  const [npsHover,      setNpsHover]      = useState(false)
  const [showChart,     setShowChart]     = useState(false)
  const [selectedKanal, setSelectedKanal] = useState<KanalKey>('kommisjon')

  const metrics    = period === 'month' ? currentMonth    : last30Days
  const sales      = period === 'month' ? salesThisMonth  : salesLast30Days
  const fordSlices = buildFordSlices(sales)
  const konvPlt    = period === 'month' ? currentMonthKonvPlattform : last30KonvPlattform
  const konvPltRate  = konvPlt?.rate != null ? `${Math.round(konvPlt.rate * 100)}%` : '—'
  const konvPltCount = konvPlt?.count ?? 0

  const kommisjon  = sales.filter(s => s.salgstype === 'Kommisjon').reduce((n, s) => n + (s.biler ?? 0), 0)
  const fjernkomm  = sales.filter(s => s.salgstype === 'Fjernkommisjon').reduce((n, s) => n + (s.biler ?? 0), 0)
  const salgshjelp = sales.filter(s => s.bonustype === 'Salgshjelp').reduce((n, s) => n + (s.biler ?? 0), 0)
  const vrakbiler  = sales.filter(s => s.innkjopstype === 'b2b_scrap').reduce((n, s) => n + (s.biler ?? 0), 0)
  const plattform  = konvPlt?.count ?? 0

  // Netto: unique qualifying sales (dedup by hs_deal_id) + plattform leads not already
  // counted in sales (cross-source dedup via hs_object_id === hs_deal_id matching).
  const plattformIds = period === 'month' ? (plattformLeadIdsMonth ?? []) : (plattformLeadIds30d ?? [])
  const qualifyingSales = sales.filter(s =>
    s.salgstype === 'Kommisjon' ||
    s.salgstype === 'Fjernkommisjon' ||
    s.bonustype === 'Salgshjelp' ||
    s.innkjopstype === 'b2b_scrap'
  )
  const salesNettoMap = new Map<string, number>()
  for (const s of qualifyingSales) {
    const key = s.hs_deal_id ?? `_id_${s.id}`
    salesNettoMap.set(key, (salesNettoMap.get(key) ?? 0) + (s.biler ?? 0))
  }
  const salesNetto = [...salesNettoMap.values()].reduce((sum, b) => sum + b, 0)
  const qualifyingDealIds = new Set(
    qualifyingSales.map(s => s.hs_deal_id).filter((id): id is string => Boolean(id))
  )
  // If plattformIds is available (service-role fetch succeeded), subtract overlap.
  // Otherwise fall back to full plattform count (minimal double-counting in practice).
  const plattformNetto = plattformIds.length > 0
    ? plattformIds.filter(id => !qualifyingDealIds.has(id)).length
    : plattform
  const netto = salesNetto + plattformNetto

  const kanaler = [
    { key: 'kommisjon'      as KanalKey, label: 'Kommisjon',      value: kommisjon  },
    { key: 'fjernkommisjon' as KanalKey, label: 'Fjernkommisjon', value: fjernkomm  },
    { key: 'salgshjelp'     as KanalKey, label: 'Salgshjelp',     value: salgshjelp },
    { key: 'vrakbiler'      as KanalKey, label: 'Vrakbiler',      value: vrakbiler  },
    { key: 'plattform'      as KanalKey, label: 'Til plattform',  value: plattform  },
  ]

  const currentYear = new Date().getFullYear()
  const chartData = salesByMonth && konvPlattformTrend
    ? buildKanalerChartData(salesByMonth, konvPlattformTrend, currentYear, plattformLeadIdsByMonth ?? {})
    : []

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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">

        {/* 1. Biler kjøpt */}
        <div className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px]">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Biler kjøpt</p>
          <p className="text-kpi font-medium text-text-primary leading-tight">{fmtKjoptLeads(metrics.bilerKjopt)}</p>
        </div>

        {/* 2. Andel fullpris */}
        <BreakdownTile title="Andel fullpris" mainLabel="Pris" slices={prisSlices} />

        {/* 3. Konvertering */}
        <div className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px]">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konvertering</p>
          <p className="text-kpi font-medium text-text-primary leading-tight">{fmtKonvertering(metrics.konverteringsrate)}</p>
        </div>

        {/* 4. NPS */}
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

        {/* 5. Antall videre — col 5, row-span-2; clickable to expand chart */}
        <button
          type="button"
          onClick={() => setShowChart(v => !v)}
          className={`col-span-2 sm:col-span-1 sm:row-span-2 text-left bg-surface border rounded-card px-5 py-5 flex flex-col justify-center transition-colors
            ${showChart ? 'border-[var(--rebil-red)]' : 'border-border hover:border-text-muted'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Antall videre</p>
            <svg
              className={`w-4 h-4 text-text-muted transition-transform ${showChart ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <ul className="space-y-2.5">
            {kanaler.map(({ label, value }) => (
              <li key={label} className="flex items-center justify-between gap-4">
                <span className="text-sm text-text-secondary">{label}</span>
                <span className={`text-sm font-semibold tabular-nums ${value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                  {value}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text-primary">Netto antall videre</span>
            <span className="text-sm font-bold tabular-nums text-text-primary">{netto}</span>
          </div>
          <p className="mt-0.5 text-[10px] italic text-text-muted">En bil kan kun telles en gang</p>
        </button>

        {/* 6. Leads */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Leads</p>
          <p className="text-kpi font-medium text-text-muted leading-tight">{fmtKjoptLeads(metrics.leads)}</p>
          {metrics.leadsTotal > metrics.leads && (
            <p className="text-xs text-text-muted mt-1">{metrics.leadsTotal} håndterte</p>
          )}
        </div>

        {/* 7. Andel fastpris */}
        <BreakdownTile title="Andel Fastpris" mainLabel="Fastpris" slices={fordSlices} muted />

        {/* 8. Konv til plattform */}
        <div className="bg-surface border border-border rounded-card p-5 text-center">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konv til plattform</p>
          <p className="text-kpi font-medium text-text-primary leading-tight">{konvPltRate}</p>
          {konvPltCount > 0 && (
            <p className="text-xs text-text-muted mt-1">{konvPltCount} til plattform</p>
          )}
        </div>

        {/* 9. Kontakttid */}
        {(() => {
          const pct = period === 'month' ? currentMonthSameDagPct : last30SameDagPct
          return (
            <div className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px]">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Kontakttid</p>
              <p className="text-kpi font-medium text-text-primary leading-tight">
                {pct != null ? `${Math.round(pct * 100)}%` : '—'}
              </p>
              {pct != null && (
                <p className="text-xs text-text-muted mt-1">Kontaktet samme dag</p>
              )}
            </div>
          )
        })()}

      </div>

      {/* Expandable innkjøpskanaler chart */}
      {showChart && chartData.length > 0 && (
        <div className="mt-3 bg-surface border border-[var(--rebil-red)] rounded-card p-5">
          {/* Category selector */}
          <div className="flex flex-wrap gap-2 mb-5">
            {KANAL_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKanal(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${selectedKanal === key
                    ? 'bg-[var(--rebil-red)] text-white'
                    : 'bg-bg text-text-muted hover:text-text-primary border border-border'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                tickFormatter={ym => MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-border)', opacity: 0.5 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) return null
                  const ym = String(label)
                  const monthName = MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]
                  const val = payload[0]?.value
                  const kanalLabel = KANAL_OPTIONS.find(k => k.key === selectedKanal)?.label ?? selectedKanal
                  return (
                    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-text-primary mb-1">{monthName} {ym.slice(0, 4)}</p>
                      <p className="text-text-secondary">{kanalLabel}: {val ?? 0}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey={selectedKanal} fill={BRAND_RED} radius={[3, 3, 0, 0]}>
                <LabelList
                  dataKey={selectedKanal}
                  position="top"
                  style={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? v : ''}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
