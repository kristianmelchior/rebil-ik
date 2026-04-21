'use client'

// Part 2 — trend chart (12 months). Two-row metric toggle.
// Row 1: standard bar+line for Kjøpt/Leads/Konvertering/NPS.
// Row 2: stacked 100% bar for Fullpris/Fastpris distributions; disabled for Konv plt./Kontakttid.

import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip,
  LabelList,
} from 'recharts'
import type { PeriodMetrics, PrisDistPoint, FordDistPoint, KonvPlattformPoint, KontakttidPoint } from '@/lib/types'
import type { TrendMetric } from '@/lib/formatDisplay'
import { fmtTrendMetric } from '@/lib/formatDisplay'
import { workdaysInMonth, elapsedWorkdaysInMonth } from '@/lib/workdays'

const BRAND_RED = 'var(--rebil-red)'
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

type ExtMetric = TrendMetric | 'prisDist' | 'fordDist' | 'leadstildeling' | 'konvPlattform' | 'kontakttid'

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
  { label: 'Konv plt.',    value: 'konvPlattform'                    },
  { label: 'Kontakttid',   value: 'kontakttid'                        },
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

// ─── Tooltip for stacked leads chart ─────────────────────────────────────────
function LeadsTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>
  label?: unknown
}) {
  if (!active || !payload?.length || label == null) return null
  const ym = String(label)
  const monthName = MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]
  const trueRaw  = payload.find(p => p.dataKey === 'leadsTrue')?.value
  const falseRaw = payload.find(p => p.dataKey === 'leadsFalse')?.value
  const medRaw   = payload.find(p => p.dataKey === 'medianTotal')?.value
  const trueVal  = typeof trueRaw  === 'number' ? trueRaw  : NaN
  const falseVal = typeof falseRaw === 'number' ? falseRaw : NaN
  const medVal   = typeof medRaw   === 'number' ? medRaw   : NaN
  const total = !Number.isNaN(trueVal) && !Number.isNaN(falseVal) ? trueVal + falseVal : NaN
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-text-primary mb-1">{monthName}</p>
      <p className="text-text-secondary">Totalt: {!Number.isNaN(total) ? total : '—'}</p>
      <p className="text-text-secondary">Teller: {!Number.isNaN(trueVal) ? trueVal : '—'}</p>
      <p className="text-text-secondary">Helgevakt, teller ikke: {!Number.isNaN(falseVal) ? falseVal : '—'}</p>
      <p className="text-text-secondary">Median totalt: {!Number.isNaN(medVal) ? Math.round(medVal) : '—'}</p>
    </div>
  )
}

// ─── Tooltip for konv plattform chart ────────────────────────────────────────
function KonvPlattformTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>
  label?: unknown
}) {
  if (!active || !payload?.length || label == null) return null
  const ym = String(label)
  const monthName = MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]
  const rateRaw  = payload.find(p => p.dataKey === 'rate')?.value
  const countRaw = payload.find(p => p.dataKey === 'count')?.value
  const rate  = typeof rateRaw  === 'number' ? rateRaw  : NaN
  const count = typeof countRaw === 'number' ? countRaw : NaN
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-text-primary mb-1">{monthName}</p>
      <p className="text-text-secondary">Konv. plattform: {!Number.isNaN(rate) ? `${Math.round(rate)}%` : '—'}</p>
      <p className="text-text-secondary">Til plattform: {!Number.isNaN(count) ? count : '—'}</p>
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

// ─── Split progress bar ───────────────────────────────────────────────────────
// Left zone (2/3): 0 → target. Right zone (1/3): target → target×1.5 (overflow).
// Dark grey when under target, green when at or above.
function SplitProgressBar({ value, target }: { value: number; target: number }) {
  const isOver = target > 0 && value >= target
  const fillColor = isOver ? '#22c55e' : '#555555'
  const leftFillPct = target > 0 ? Math.min(100, Math.round((Math.min(value, target) / target) * 100)) : 0
  const rightFillPct = isOver
    ? Math.min(100, Math.round(((value - target) / (target * 0.5)) * 100))
    : 0
  return (
    <div className="relative">
      <div className="flex h-7 items-stretch">
        <div className="relative bg-[#EBEBEB] rounded-l-full overflow-hidden" style={{ flex: 2 }}>
          <div className="h-full transition-all" style={{ width: `${leftFillPct}%`, backgroundColor: fillColor }} />
        </div>
        <div className="w-[2px] bg-[#aaaaaa] shrink-0 self-stretch" />
        <div className="relative bg-[#EBEBEB] rounded-r-full overflow-hidden" style={{ flex: 1 }}>
          {rightFillPct > 0 && (
            <div className="h-full transition-all" style={{ width: `${rightFillPct}%`, backgroundColor: '#22c55e' }} />
          )}
        </div>
      </div>
      <span
        className="absolute text-xs text-text-muted whitespace-nowrap"
        style={{ left: 'calc(66.67%)', top: '100%', marginTop: '3px', transform: 'translateX(-50%)' }}
      >
        Target = {target}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TrendChartsProps {
  trend?:                (PeriodMetrics & { month: string })[]
  medianTrend?:          (PeriodMetrics & { month: string })[]
  prisDistTrend?:        PrisDistPoint[]
  fordDistTrend?:        FordDistPoint[]
  konvPlattformTrend?:   KonvPlattformPoint[]
  kontakttidTrend?:      KontakttidPoint[]
  currentMonthMetrics?:  PeriodMetrics
  last30Metrics?:        PeriodMetrics
  repKode?:              string
}

export default function TrendCharts({
  trend = [], medianTrend = [], prisDistTrend = [], fordDistTrend = [],
  konvPlattformTrend = [], kontakttidTrend = [],
  currentMonthMetrics, last30Metrics, repKode,
}: TrendChartsProps) {
  const [metric, setMetric] = useState<ExtMetric>('npsScore')
  const [leadsTargetInput, setLeadsTargetInput] = useState('')
  const [leadsTarget, setLeadsTarget] = useState<number | null>(null)
  const [leadsPeriod, setLeadsPeriod] = useState<'month' | '30d'>('month')

  useEffect(() => {
    if (!repKode) return
    const saved = localStorage.getItem(`leads_target_${repKode}`)
    if (saved) {
      setLeadsTarget(Number(saved))
      setLeadsTargetInput(saved)
    } else {
      setLeadsTarget(null)
      setLeadsTargetInput('')
    }
  }, [repKode])

  function handleTargetChange(val: string) {
    setLeadsTargetInput(val)
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) {
      setLeadsTarget(n)
      if (repKode) localStorage.setItem(`leads_target_${repKode}`, String(n))
    } else if (val === '') {
      setLeadsTarget(null)
      if (repKode) localStorage.removeItem(`leads_target_${repKode}`)
    }
  }

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const isDistMetric = metric === 'prisDist' || metric === 'fordDist'

  // ── Stacked leads chart data ──
  const leadsData = metric !== 'leads' ? [] : trend.map((point, i) => {
    const isFuture = point.month > currentMonthKey
    return {
      month:       point.month,
      leadsTrue:   isFuture ? null : point.leads,
      leadsFalse:  isFuture ? null : Math.max(0, point.leadsTotal - point.leads),
      medianTotal: isFuture ? null : (medianTrend[i]?.leadsTotal ?? 0),
    }
  })

  // ── Konv plattform chart data ──
  const konvPlattformData = metric !== 'konvPlattform' ? [] : konvPlattformTrend.map(point => {
    const isFuture = point.month > currentMonthKey
    return {
      month: point.month,
      rate:  isFuture || point.rate === null ? null : +(point.rate * 100).toFixed(1),
      count: isFuture ? null : point.count,
    }
  })

  // ── Kontakttid chart data ──
  // Categories sorted alphabetically — "Samme dag" (S) naturally lands last → bottom of stack → red.
  const kontakttidCategories = metric !== 'kontakttid' ? [] :
    [...new Set(kontakttidTrend.flatMap(pt => Object.keys(pt.shares)))].sort()

  const kontakttidData = metric !== 'kontakttid' ? [] : kontakttidTrend.map(pt => {
    const isFuture = pt.month > currentMonthKey
    const row: Record<string, string | number | null> = { month: pt.month }
    if (!isFuture) {
      for (const cat of kontakttidCategories) {
        row[cat] = +((pt.shares[cat] ?? 0) * 100).toFixed(1)
      }
      row['avgDays'] = pt.avgDays
    } else {
      for (const cat of kontakttidCategories) row[cat] = null
      row['avgDays'] = null
    }
    return row
  })

  function kontakttidColor(idx: number): string {
    if (idx === 0) return BRAND_RED  // first in JSX = bottom of stack = "Samme dag"
    const greys = ['#555', '#777', '#999', '#aaa']
    return greys[Math.min(idx - 1, greys.length - 1)]
  }

  // ── Standard chart data (only computed for non-leads, non-dist, non-leadstildeling metrics) ──
  const standardData = (isDistMetric || metric === 'leads' || metric === 'leadstildeling' || metric === 'konvPlattform' || metric === 'kontakttid') ? [] : trend.map((point, i) => {
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

        {/* Three-row pill toggle */}
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
          {/* Row 3 */}
          <div className="flex bg-[#EBEBEB] rounded-pill p-[3px]">
            <button
              onClick={() => setMetric('leadstildeling')}
              className={
                metric === 'leadstildeling'
                  ? `${pillBase} flex-1 bg-[var(--rebil-red)] text-white`
                  : `${pillBase} flex-1 bg-transparent text-text-muted hover:text-text-primary`
              }
            >
              Leadstildeling
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card p-6">

        {/* ── Leadstildeling view ── */}
        {metric === 'leadstildeling' ? (() => {
          const today = new Date()
          const yr = today.getFullYear()
          const mo = today.getMonth() + 1
          const totalWd = workdaysInMonth(yr, mo)
          const elapsedWd = elapsedWorkdaysInMonth(yr, mo)
          const remainingWd = totalWd - elapsedWd

          const metrics = leadsPeriod === 'month' ? currentMonthMetrics : last30Metrics
          const actual = metrics?.leads ?? 0
          const actualTotal = metrics?.leadsTotal ?? 0

          const trendFactor = leadsPeriod === 'month' && remainingWd < totalWd && elapsedWd > 0
            ? totalWd / elapsedWd
            : 1
          const projected = Math.round(actual * trendFactor)

          const targetVal = leadsTarget ?? 0

          return (
            <div className="flex flex-col gap-8">
              {/* Controls */}
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-muted">Target antall leads</label>
                  <input
                    type="number"
                    min={1}
                    value={leadsTargetInput}
                    onChange={e => handleTargetChange(e.target.value)}
                    placeholder="Skriv inn target"
                    className="border border-border rounded-lg px-3 py-1.5 text-sm w-36 bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-[var(--rebil-red)]"
                  />
                </div>
                <div className="flex bg-[#EBEBEB] rounded-pill p-[3px] gap-0.5">
                  <button
                    onClick={() => setLeadsPeriod('month')}
                    className={leadsPeriod === 'month'
                      ? `${pillBase} bg-[var(--rebil-red)] text-white px-4`
                      : `${pillBase} bg-transparent text-text-muted hover:text-text-primary px-4`}
                  >
                    Inneværende måned
                  </button>
                  <button
                    onClick={() => setLeadsPeriod('30d')}
                    className={leadsPeriod === '30d'
                      ? `${pillBase} bg-[var(--rebil-red)] text-white px-4`
                      : `${pillBase} bg-transparent text-text-muted hover:text-text-primary px-4`}
                  >
                    Siste 30 dager
                  </button>
                </div>
              </div>

              {/* Bar 1: Faktisk teller-leads vs target */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Faktisk (Teller): <strong className="text-text-primary">{actual}</strong></span>
                  {targetVal === 0 && <span className="text-text-muted italic">Ingen target satt</span>}
                </div>
                {targetVal > 0
                  ? <SplitProgressBar value={actual} target={targetVal} />
                  : <div className="h-7 bg-[#EBEBEB] rounded-full" />
                }
              </div>

              {/* Bar 2: Projisert (trendlinje) vs target */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Trend (projisert): <strong className="text-text-primary">{targetVal > 0 ? projected : '—'}</strong></span>
                  {leadsPeriod === 'month' && (
                    <span className="text-text-muted">{elapsedWd} av {totalWd} arbeidsdager brukt</span>
                  )}
                </div>
                {targetVal > 0
                  ? <SplitProgressBar value={projected} target={targetVal} />
                  : <div className="h-7 bg-[#EBEBEB] rounded-full" />
                }
              </div>
            </div>
          )
        })() : (
        <>
        {metric === 'leads' && (
          <p className="text-xs text-text-muted text-right mb-2 italic">
            Overload leads, dvs leads over grense som ikke teller, er ikke lagt til enda
          </p>
        )}
        <ResponsiveContainer width="100%" height={260}>

          {/* ── Stacked leads chart ── */}
          {metric === 'leads' ? (
            <ComposedChart data={leadsData} margin={{ top: 28, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#F0F0F0" />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <LeadsTooltip active={active} payload={payload} label={label} />
                )}
              />
              <Bar dataKey="leadsTrue" stackId="ls" fill={BRAND_RED}>
                <LabelList
                  position="insideTop"
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? String(v) : ''}
                />
              </Bar>
              <Bar dataKey="leadsFalse" stackId="ls" fill="#CCCCCC" radius={[3, 3, 0, 0]} />
              <Line dataKey="medianTotal" stroke="#111111" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </ComposedChart>

          /* ── Pris distribution chart ── */
          ) : metric === 'prisDist' ? (
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

          /* ── Konv plattform: rate bar + count line ── */
          ) : metric === 'konvPlattform' ? (
            <ComposedChart data={konvPlattformData} margin={{ top: 28, right: 48, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#F0F0F0" />
              <XAxis {...xAxisProps} />
              <YAxis yAxisId="rate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888888' }} width={40} tickFormatter={v => `${Math.round(v)}%`} domain={[0, 100]} />
              <YAxis yAxisId="count" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888888' }} width={40} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <KonvPlattformTooltip active={active} payload={payload} label={label} />
                )}
              />
              <Bar yAxisId="rate" dataKey="rate" fill={BRAND_RED} radius={[3, 3, 0, 0]}>
                <LabelList
                  position="top"
                  fill="#111111"
                  fontSize={11}
                  formatter={(v: unknown) => typeof v === 'number' ? `${Math.round(v)}%` : ''}
                />
              </Bar>
              <Line yAxisId="count" dataKey="count" stroke="#111111" strokeWidth={1.5} dot={false}>
                <LabelList
                  position="top"
                  fill="#111111"
                  fontSize={11}
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? String(v) : ''}
                />
              </Line>
            </ComposedChart>

          /* ── Kontakttid: 100% stacked by category + plattform count line ── */
          ) : metric === 'kontakttid' ? (
            <ComposedChart data={kontakttidData} margin={{ top: 8, right: 48, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#F0F0F0" />
              <XAxis {...xAxisProps} />
              <YAxis yAxisId="dist" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888888' }} width={40} tickFormatter={v => `${Math.round(v)}%`} domain={[0, 100]} />
              <YAxis yAxisId="count" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888888' }} width={40} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) return null
                  const ym = String(label)
                  const monthName = MONTH_ABBR[parseInt(ym.slice(5, 7), 10) - 1]
                  const countEntry = payload.find(p => p.dataKey === 'avgDays')
                  return (
                    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-text-primary mb-1">{monthName}</p>
                      {[...kontakttidCategories].reverse().map(cat => {
                        const entry = payload.find(p => p.dataKey === cat)
                        const v = typeof entry?.value === 'number' ? entry.value : 0
                        return (
                          <div key={cat} className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: entry?.fill as string }} />
                            <span className="text-text-secondary">{cat}: {Math.round(v)}%</span>
                          </div>
                        )
                      })}
                      {countEntry && typeof countEntry.value === 'number' && (
                        <p className="text-text-secondary mt-1">Snitt kontakttid: {countEntry.value} dager</p>
                      )}
                    </div>
                  )
                }}
              />
              {kontakttidCategories.map((cat, idx) => (
                <Bar key={cat} yAxisId="dist" dataKey={cat} stackId="kt" fill={kontakttidColor(idx)} stroke={STROKE_COLOR} strokeWidth={0.5}
                  radius={idx === kontakttidCategories.length - 1 ? [3, 3, 0, 0] : undefined}>
                  {idx === 0 && (
                    <LabelList
                      dataKey={cat}
                      position="center"
                      fill="#fff"
                      fontSize={11}
                      fontWeight={600}
                      formatter={(v: unknown) => typeof v === 'number' && v > 0 ? `${Math.round(v)}%` : ''}
                    />
                  )}
                </Bar>
              ))}
              <Line yAxisId="count" dataKey="avgDays" stroke="#111111" strokeWidth={1.5} dot={false}>
                <LabelList
                  position="top"
                  fill="#111111"
                  fontSize={11}
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? `${v}d` : ''}
                />
              </Line>
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
        {metric === 'kontakttid' ? (
          <div className="flex justify-end flex-wrap gap-4 mt-3">
            {kontakttidCategories.map((cat, i) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm border border-[#111]" style={{ backgroundColor: kontakttidColor(i) }} />
                <span className="text-xs text-text-secondary">{cat}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-text-primary" />
              <span className="text-xs text-text-secondary">Snitt kontakttid</span>
            </div>
          </div>
        ) : isDistMetric ? (
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
        ) : metric === 'konvPlattform' ? (
          <div className="flex justify-end gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: BRAND_RED }} />
              <span className="text-xs text-text-secondary">Konv. til plattform</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-text-primary" />
              <span className="text-xs text-text-secondary">Antall til plattform</span>
            </div>
          </div>
        ) : metric === 'leads' ? (
          <div className="flex justify-end gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: BRAND_RED }} />
              <span className="text-xs text-text-secondary">Teller</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: '#CCCCCC' }} />
              <span className="text-xs text-text-secondary">Helgevakt, teller ikke</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-text-primary" />
              <span className="text-xs text-text-secondary">Median</span>
            </div>
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
        </>
        )}
      </div>
    </section>
  )
}
