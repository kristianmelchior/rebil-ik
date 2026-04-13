'use client'

// Part 2 — trend chart (12 months). Two-row metric toggle.
// Row 1: standard bar+line for Kjøpt/Leads/Konvertering/NPS.
// Row 2: stacked 100% bar for Fullpris/Fastpris distributions; disabled for Konv plt./Kontakttid.

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip,
  LabelList,
} from 'recharts'
import type { PeriodMetrics, PrisDistPoint, FordDistPoint } from '@/lib/types'
import type { TrendMetric } from '@/lib/formatDisplay'
import { fmtTrendMetric } from '@/lib/formatDisplay'

const BRAND_RED = 'var(--rebil-red)'
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

type ExtMetric = TrendMetric | 'prisDist' | 'fordDist'

// ─── Row 1 options (mirrors KpiTiles row) ────────────────────────────────────
const ROW1: { label: string; value: ExtMetric }[] = [
  { label: 'Kjøpt',        value: 'bilerKjopt'        },
  { label: 'Fullpris',     value: 'prisDist'          },
  { label: 'Konvertering', value: 'konverteringsrate' },
  { label: 'NPS',          value: 'npsScore'          },
]

// ─── Row 2 options (mirrors InsightTiles row) ─────────────────────────────────
const ROW2: { label: string; value: ExtMetric; disabled?: boolean }[] = [
  { label: 'Leads',        value: 'leads'             },
  { label: 'Fastpris',     value: 'fordDist'          },
  { label: 'Konv plt.',    value: 'konverteringsrate', disabled: true },
  { label: 'Kontakttid',   value: 'npsScore',          disabled: true },
]

// ─── Colors ───────────────────────────────────────────────────────────────────
const PRIS_COLORS  = { pris: BRAND_RED, rabatt1: '#777', rabatt2: '#aaa', minstepris: '#ccc' }
const FORD_COLORS  = { fastpris: BRAND_RED, kommisjon: '#777', salgshjelp: '#aaa' }
const GREY         = '#999'
const STROKE_COLOR = '#111'

// ─── Tooltip for standard chart ───────────────────────────────────────────────
function StandardTooltip({
  active, payload, label, metric,
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
      <p className="text-text-secondary">Deg: {!Number.isNaN(rep) ? fmtTrendMetric(metric, rep) : '—'}</p>
      <p className="text-text-secondary">Median: {!Number.isNaN(med) ? fmtTrendMetric(metric, med) : '—'}</p>
    </div>
  )
}

// ─── Tooltip for stacked dist chart ──────────────────────────────────────────
function DistTooltip({
  active, payload, label, keys, labels,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; fill?: string }>
  label?: unknown
  keys: string[]
  labels: string[]
}) {
  if (!active || !payload?.length || label == null) return null
  const ym = String(label)
  const monthName = MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-text-primary mb-1">{monthName}</p>
      {keys.map((k, i) => {
        const entry = payload.find(p => p.dataKey === k)
        const v = typeof entry?.value === 'number' ? entry.value : 0
        return (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: entry?.fill as string }} />
            <span className="text-text-secondary">{labels[i]}: {Math.round(v)}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TrendChartsProps {
  trend?:          (PeriodMetrics & { month: string })[]
  medianTrend?:    (PeriodMetrics & { month: string })[]
  prisDistTrend?:  PrisDistPoint[]
  fordDistTrend?:  FordDistPoint[]
}

export default function TrendCharts({ trend = [], medianTrend = [], prisDistTrend = [], fordDistTrend = [] }: TrendChartsProps) {
  const [metric, setMetric] = useState<ExtMetric>('npsScore')

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const isDistMetric = metric === 'prisDist' || metric === 'fordDist'

  // ── Standard chart data (only computed for standard metrics) ──
  const standardData = isDistMetric ? [] : trend.map((point, i) => {
    const isFuture = point.month > currentMonthKey
    const m = metric as TrendMetric
    return {
      month:  point.month,
      rep:    isFuture ? null : ((point[m] as number | null) ?? 0),
      median: isFuture ? null : ((medianTrend[i]?.[m] as number | null) ?? 0),
    }
  })

  // ── Pris dist chart data (0–100) ──
  const prisData = prisDistTrend.map(p => ({
    month:     p.month,
    pris:      p.month > currentMonthKey ? null : +(p.pris      * 100).toFixed(1),
    rabatt1:   p.month > currentMonthKey ? null : +(p.rabatt1   * 100).toFixed(1),
    rabatt2:   p.month > currentMonthKey ? null : +(p.rabatt2   * 100).toFixed(1),
    minstepris:p.month > currentMonthKey ? null : +(p.minstepris* 100).toFixed(1),
  }))

  // ── Ford dist chart data (0–100) ──
  const fordData = fordDistTrend.map(p => ({
    month:     p.month,
    fastpris:  p.month > currentMonthKey ? null : +(p.fastpris  * 100).toFixed(1),
    kommisjon: p.month > currentMonthKey ? null : +(p.kommisjon * 100).toFixed(1),
    salgshjelp:p.month > currentMonthKey ? null : +(p.salgshjelp* 100).toFixed(1),
  }))

  function yAxisTickFormatter(v: number): string {
    if (isDistMetric) return `${Math.round(v)}%`
    if (metric === 'konverteringsrate') return v.toLocaleString('nb-NO', { maximumFractionDigits: 1 })
    return Math.round(v).toLocaleString('nb-NO')
  }

  const pillBase = 'rounded-pill text-xs font-medium px-3.5 py-1 transition-colors'

  const xAxisProps = {
    dataKey: 'month' as const,
    tickFormatter: (ym: string) => MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1],
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 11, fill: '#888888' },
  }

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 11, fill: '#888888' },
    width: 40,
    tickFormatter: yAxisTickFormatter,
  }

  return (
    <section>
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-medium text-text-primary">Trend</h2>

        {/* Two-row pill toggle — both rows share the same width */}
        <div className="flex flex-col gap-1.5 w-[340px]">
          {/* Row 1 */}
          <div className="flex bg-[#EBEBEB] rounded-pill p-[3px] gap-0.5">
            {ROW1.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setMetric(opt.value)}
                className={
                  opt.value === metric
                    ? `${pillBase} flex-1 bg-[var(--rebil-red)] text-white`
                    : `${pillBase} flex-1 bg-transparent text-text-muted hover:text-text-primary`
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Row 2 */}
          <div className="flex bg-[#EBEBEB] rounded-pill p-[3px] gap-0.5">
            {ROW2.map(opt => (
              <button
                key={opt.label}
                onClick={() => !opt.disabled && setMetric(opt.value)}
                className={
                  opt.disabled
                    ? `${pillBase} flex-1 text-text-muted cursor-default opacity-40`
                    : opt.value === metric
                      ? `${pillBase} flex-1 bg-[var(--rebil-red)] text-white`
                      : `${pillBase} flex-1 bg-transparent text-text-muted hover:text-text-primary`
                }
                disabled={opt.disabled}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card p-6">
        <ResponsiveContainer width="100%" height={260}>

          {/* ── Pris distribution chart ── */}
          {metric === 'prisDist' ? (
            <ComposedChart data={prisData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#F0F0F0" />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} domain={[0, 100]} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <DistTooltip
                    active={active} payload={payload} label={label}
                    keys={['pris', 'rabatt1', 'rabatt2', 'minstepris']}
                    labels={['Pris', 'Rabattnivå 1', 'Rabattnivå 2', 'Minstepris']}
                  />
                )}
              />
              <Bar dataKey="pris" stackId="a" fill={PRIS_COLORS.pris} stroke={STROKE_COLOR} strokeWidth={0.5}>
                <LabelList
                  dataKey="pris"
                  position="center"
                  fill="#fff"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? `${Math.round(v)}%` : ''}
                />
              </Bar>
              <Bar dataKey="rabatt1"    stackId="a" fill={PRIS_COLORS.rabatt1}    stroke={STROKE_COLOR} strokeWidth={0.5} />
              <Bar dataKey="rabatt2"    stackId="a" fill={PRIS_COLORS.rabatt2}    stroke={STROKE_COLOR} strokeWidth={0.5} />
              <Bar dataKey="minstepris" stackId="a" fill={PRIS_COLORS.minstepris} stroke={STROKE_COLOR} strokeWidth={0.5} radius={[3, 3, 0, 0]} />
            </ComposedChart>

          /* ── Ford distribution chart ── */
          ) : metric === 'fordDist' ? (
            <ComposedChart data={fordData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#F0F0F0" />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} domain={[0, 100]} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <DistTooltip
                    active={active} payload={payload} label={label}
                    keys={['fastpris', 'kommisjon', 'salgshjelp']}
                    labels={['Fastpris', 'Kommisjon', 'Salgshjelp']}
                  />
                )}
              />
              <Bar dataKey="fastpris" stackId="a" fill={FORD_COLORS.fastpris} stroke={STROKE_COLOR} strokeWidth={0.5}>
                <LabelList
                  dataKey="fastpris"
                  position="center"
                  fill="#fff"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? `${Math.round(v)}%` : ''}
                />
              </Bar>
              <Bar dataKey="kommisjon"  stackId="a" fill={FORD_COLORS.kommisjon}   stroke={STROKE_COLOR} strokeWidth={0.5} />
              <Bar dataKey="salgshjelp" stackId="a" fill={FORD_COLORS.salgshjelp}  stroke={STROKE_COLOR} strokeWidth={0.5} radius={[3, 3, 0, 0]} />
            </ComposedChart>

          /* ── Standard bar + median line ── */
          ) : (
            <ComposedChart data={standardData} margin={{ top: 28, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#F0F0F0" />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip
                content={({ active, payload: pl, label: lbl }) => (
                  <StandardTooltip active={active} payload={pl} label={lbl} metric={metric as TrendMetric} />
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
                    return fmtTrendMetric(metric as TrendMetric, v)
                  }}
                />
              </Bar>
              <Line dataKey="median" stroke="#111111" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </ComposedChart>
          )}
        </ResponsiveContainer>

        {/* Legend */}
        {isDistMetric ? (
          <div className="flex justify-end gap-5 mt-3">
            {metric === 'prisDist' ? (
              <>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: PRIS_COLORS.pris }} /><span className="text-xs text-text-secondary">Pris</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: PRIS_COLORS.rabatt1 }} /><span className="text-xs text-text-secondary">Rabattnivå 1</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: PRIS_COLORS.rabatt2 }} /><span className="text-xs text-text-secondary">Rabattnivå 2</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: PRIS_COLORS.minstepris }} /><span className="text-xs text-text-secondary">Minstepris</span></div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: FORD_COLORS.fastpris }} /><span className="text-xs text-text-secondary">Fastpris</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: FORD_COLORS.kommisjon }} /><span className="text-xs text-text-secondary">Kommisjon</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: FORD_COLORS.salgshjelp }} /><span className="text-xs text-text-secondary">Salgshjelp</span></div>
              </>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </section>
  )
}
