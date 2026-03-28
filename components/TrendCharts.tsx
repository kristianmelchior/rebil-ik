'use client'

// Part 2 — trend chart (13 months). ComposedChart: Bar for rep, dashed Line for team median.
// Metric toggle: Kjøpt / Leads / Konvertering / NPS. Custom legend, right-aligned.

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip,
  LabelList,
} from 'recharts'
import type { PeriodMetrics } from '@/lib/types'
import type { TrendMetric } from '@/lib/formatDisplay'
import { fmtTrendMetric } from '@/lib/formatDisplay'
import ToggleGroup from './ToggleGroup'

/** Matches `globals.css` :root --rebil-red */
const BRAND_RED = 'var(--rebil-red)'

// Norwegian month abbreviations indexed 0–11
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

// Read a nullable metric value from PeriodMetrics, defaulting null to 0 for the chart
function getValue(metrics: PeriodMetrics, metric: TrendMetric): number {
  return (metrics[metric] as number | null) ?? 0
}

const METRIC_OPTIONS = [
  { label: 'Kjøpt',         value: 'bilerKjopt'        },
  { label: 'Leads',         value: 'leads'             },
  { label: 'Konvertering',  value: 'konverteringsrate' },
  { label: 'NPS',           value: 'npsScore'          },
]

interface TrendChartsProps {
  trend:        (PeriodMetrics & { month: string })[]
  medianTrend:  (PeriodMetrics & { month: string })[]
}

function TrendTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>
  label?: unknown
  metric: TrendMetric
}) {
  if (!active || !payload?.length || label == null) return null
  const ym = String(label)
  const monthName = MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]
  const repRaw = payload.find(p => p.dataKey === 'rep')?.value
  const medRaw = payload.find(p => p.dataKey === 'median')?.value
  const rep = typeof repRaw === 'number' ? repRaw : repRaw != null ? Number(repRaw) : NaN
  const med = typeof medRaw === 'number' ? medRaw : medRaw != null ? Number(medRaw) : NaN

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-text-primary mb-1">{monthName}</p>
      <p className="text-text-secondary">
        Deg: {!Number.isNaN(rep) ? fmtTrendMetric(metric, rep) : '—'}
      </p>
      <p className="text-text-secondary">
        Median: {!Number.isNaN(med) ? fmtTrendMetric(metric, med) : '—'}
      </p>
    </div>
  )
}

export default function TrendCharts({ trend, medianTrend }: TrendChartsProps) {
  const [metric, setMetric] = useState<TrendMetric>('npsScore')

  const currentMonthKey = new Date().toISOString().slice(0, 7)

  const chartData = trend.map((point, i) => {
    const isFuture = point.month > currentMonthKey
    return {
      month:  point.month,
      rep:    isFuture ? null : getValue(point, metric),
      median: isFuture ? null : getValue(medianTrend[i] ?? point, metric),
    }
  })

  function yAxisTickFormatter(v: number): string {
    switch (metric) {
      case 'konverteringsrate':
        return v.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
      case 'npsScore':
        return Math.round(v).toLocaleString('nb-NO')
      default:
        return Math.round(v).toLocaleString('nb-NO')
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-text-primary">Trend</h2>
        <ToggleGroup
          options={METRIC_OPTIONS}
          value={metric}
          onChange={v => setMetric(v as TrendMetric)}
        />
      </div>

      <div className="bg-surface border border-border rounded-card p-6">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 28, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#F0F0F0" />
            <XAxis
              dataKey="month"
              tickFormatter={(ym: string) => MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#888888' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#888888' }}
              width={40}
              tickFormatter={yAxisTickFormatter}
            />
            <Tooltip
              content={({ active, payload: pl, label: lbl }) => (
                <TrendTooltip active={active} payload={pl} label={lbl} metric={metric} />
              )}
            />
            <Bar dataKey="rep" fill={BRAND_RED} radius={[3, 3, 0, 0]}>
              <LabelList
                position="top"
                fill="#111111"
                fontSize={11}
                valueAccessor={entry => {
                  const v = (entry.payload as { rep?: number | null }).rep
                  if (v == null) return ''
                  return fmtTrendMetric(metric, v)
                }}
              />
            </Bar>
            <Line
              dataKey="median"
              stroke="#111111"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex justify-end gap-5 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: BRAND_RED }} />
            <span className="text-xs text-text-secondary">Deg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-0.5 bg-text-primary" />
            <span className="text-xs text-text-secondary">Median</span>
          </div>
        </div>
      </div>
    </section>
  )
}
