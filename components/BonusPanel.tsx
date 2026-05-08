'use client'

// Part 3 — bonus breakdown with month selector and what-if simulation.
// Current month only: two inputs (Konvertering %, NPS score) drive client-side recalc.
// baseBonus and carsThisMonth are always fixed from server data.
// Past months: shows server-computed figures, no what-if inputs (v1 scope).

import { useEffect, useState } from 'react'
import type { BonusResult, Rep, SaleRow, ConversionFactorRow, NpsBonusRow } from '@/lib/types'
import CarsTable from '@/components/CarsTable'
import { CONVERSION_FACTORS, TIER_COL_INDEX } from '@/config/conversionFactors'
import { NPS_BONUS } from '@/config/npsBonus'

// Norwegian month names indexed 0–11
const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

// Format 'YYYY-MM' key as "Mars 2026"
// Input: ym ('YYYY-MM')  Output: Norwegian label string
function monthLabel(ym: string): string {
  const [year, mon] = ym.split('-')
  return `${MONTH_NAMES[parseInt(mon, 10) - 1]} ${year}`
}

// Format a number as "kr X XXX" with Norwegian locale
// Input: n (number)  Output: string
function fmtKr(n: number): string {
  return `kr ${Math.round(n).toLocaleString('nb-NO')}`
}

/** Round to nearest 0.5 — matches the factor table step size. */
function roundConvHalfStep(n: number): number {
  return Math.round(n * 2) / 2
}

// Look up conversion factor — mirrors lib/bonus.ts lookupConvFactor for client-side what-if.
// Uses precise DB factors when available, falls back to hardcoded config.
// Input: rate (%), tier, optional dbFactors  Output: factor
function lookupConvFactor(
  rate: number,
  tier: 'IK' | 'Senior' | 'Spesialist',
  dbFactors?: ConversionFactorRow[]
): number {
  if (rate <= 0) return 1.0

  if (dbFactors && dbFactors.length > 0) {
    const rateDecimal = rate / 100
    const floored = Math.floor(rateDecimal / 0.005) * 0.005
    let result = 1.0
    for (const row of dbFactors) {
      if (row.konvertering <= floored + 0.000001) {
        result = tier === 'Spesialist' ? row.faktor_spesialist
               : tier === 'Senior'    ? row.faktor_senior
               : row.faktor_ik
      } else break
    }
    return result
  }

  // Fallback: hardcoded config
  const floored = Math.floor(rate / 0.5) * 0.5
  const col = TIER_COL_INDEX[tier]
  if (floored > 19.5) return CONVERSION_FACTORS[CONVERSION_FACTORS.length - 1][col]
  let result = 1.0
  for (const row of CONVERSION_FACTORS) {
    if (row[0] <= floored) result = row[col]
    else break
  }
  return result
}

// Look up NPS bonus — same logic as lib/bonus.ts but client-side for what-if.
// Uses precise DB rows when available, falls back to hardcoded config.
// Input: score (integer), optional dbRows  Output: bonus NOK
function lookupNpsBonus(score: number, dbRows?: NpsBonusRow[]): number {
  const floored = Math.floor(score / 10) * 10

  if (dbRows && dbRows.length > 0) {
    let result = 0
    for (const row of dbRows) {
      if (row.nps_threshold <= floored) result = row.bonus
      else break
    }
    return result
  }

  // Fallback: hardcoded config
  let result = 0
  for (const row of NPS_BONUS) {
    if (row[0] <= floored) result = row[1]
    else break
  }
  return result
}

interface BonusPanelProps {
  bonus:             BonusResult
  bonusByMonth:      Record<string, BonusResult>
  rep:               Rep
  salesByMonth:      Record<string, SaleRow[]>
  lastUpdated:       string
  conversionFactors: ConversionFactorRow[]
  npsBonus:          NpsBonusRow[]
  onMonthChange:     (month: string) => void
}

export default function BonusPanel({
  bonus, bonusByMonth, rep, salesByMonth, lastUpdated, conversionFactors, npsBonus, onMonthChange,
}: BonusPanelProps) {
  const currentMonthKey = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  // Available months sorted newest first
  const months = Object.keys(salesByMonth).sort((a, b) => b.localeCompare(a))

  const [selectedMonth,    setSelectedMonth]    = useState(currentMonthKey)
  const [simConvRate,      setSimConvRate]      = useState(() => roundConvHalfStep(bonus.convRate))
  const [simNpsScore,      setSimNpsScore]      = useState(bonus.npsScore ?? 40)
  const [simEstimatedCars, setSimEstimatedCars] = useState(bonus.carsThisMonth)

  // Conversion calculator state
  const [calcOpen,       setCalcOpen]       = useState(false)
  const [calcLeads,      setCalcLeads]      = useState(bonus.leadsThisMonth)
  const [calcBiler,      setCalcBiler]      = useState(bonus.carsThisMonth)
  const [calcAdjLeads,   setCalcAdjLeads]   = useState<string>('0')
  const [calcAdjBiler,   setCalcAdjBiler]   = useState<string>('0')

  const calcTotalLeads = Math.max(1, calcLeads + (parseInt(calcAdjLeads, 10) || 0))
  const calcTotalBiler = Math.max(0, calcBiler + (parseInt(calcAdjBiler, 10) || 0))
  const calcResult     = roundConvHalfStep((calcTotalBiler / calcTotalLeads) * 100)

  // Re-sync from server when selecting inneværende måned (e.g. after viewing a past month)
  useEffect(() => {
    if (selectedMonth !== currentMonthKey) return
    setSimConvRate(roundConvHalfStep(bonus.convRate))
    setSimNpsScore(bonus.npsScore ?? 40)
    setSimEstimatedCars(bonus.carsThisMonth)
  }, [selectedMonth, currentMonthKey, bonus])

  // Per-car average from actual sales (null if no cars yet)
  const perCarAvg = bonus.carsThisMonth > 0
    ? Math.round(bonus.baseBonus / bonus.carsThisMonth)
    : null

  // Estimated base bonus: per-car avg × estimated cars (falls back to actual baseBonus if no avg yet)
  const simEstimatedBaseBonus = perCarAvg !== null
    ? perCarAvg * simEstimatedCars
    : bonus.baseBonus

  // Derived what-if values — recalculated on every render from input state
  const simConvFactor             = lookupConvFactor(simConvRate, rep.tier, conversionFactors)
  const simNpsBonus               = lookupNpsBonus(simNpsScore, npsBonus)
  const simKonverteringsbonus     = Math.round(simEstimatedBaseBonus * (simConvFactor - 1))
  const simBonusEtterKonvertering = Math.round(simEstimatedBaseBonus * simConvFactor)
  const simTotalBonus             = simBonusEtterKonvertering + simNpsBonus

  const isEstimating = simEstimatedCars !== bonus.carsThisMonth

  function handleMonthChange(month: string) {
    setSelectedMonth(month)
    onMonthChange(month)
  }

  const isCurrentMonth = selectedMonth === currentMonthKey

  // Norwegian formatted date from ISO string
  const updatedLabel = new Date(lastUpdated).toLocaleString('nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // For past months: use server-computed BonusResult if available, else derive from sales rows
  const pastBonus     = !isCurrentMonth ? (bonusByMonth[selectedMonth] ?? null) : null
  const pastSales     = salesByMonth[selectedMonth] ?? []
  const pastBaseBonus = pastSales.reduce((sum, r) => sum + (r.bonus ?? 0), 0)
  const pastCarsCount = pastSales.filter(r => r.biler > 0).reduce((sum, r) => sum + r.biler, 0)

  // Display values — use what-if sim for current month, server-computed past data for other months
  const displayBaseBonus          = isCurrentMonth ? simEstimatedBaseBonus : (pastBonus?.baseBonus ?? pastBaseBonus)
  const displayCarsCount          = isCurrentMonth ? simEstimatedCars      : (pastBonus?.carsThisMonth ?? pastCarsCount)
  const displayKonverteringsbonus = isCurrentMonth ? simKonverteringsbonus : (pastBonus?.konverteringsbonus ?? 0)
  const displayNpsBonus           = isCurrentMonth ? simNpsBonus           : (pastBonus?.npsBonus ?? 0)
  const displayTotal              = isCurrentMonth ? simTotalBonus         : (pastBonus?.totalBonus ?? pastBaseBonus)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-text-primary">Bonus og bilsliste</h2>
        {/* Inline style permitted per UI spec for this element only */}
        <select
          value={selectedMonth}
          onChange={e => handleMonthChange(e.target.value)}
          style={{
            background: 'white', border: '1px solid #E0E0E0', borderRadius: '8px',
            padding: '5px 12px', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', outline: 'none', width: '160px',
          }}
        >
          {months.map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      <>
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Bonus</p>
        <div className="flex gap-4 mb-4">
          {/* Cars — editable for current month, locked for past */}
          <div className="bg-surface border border-border rounded-card p-4 flex-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              {isCurrentMonth ? 'Estimert antall biler' : 'Antall biler'}
            </p>
            <input
              type="number"
              step={1}
              min={0}
              value={isCurrentMonth ? simEstimatedCars : displayCarsCount}
              onChange={e => {
                if (!isCurrentMonth) return
                const v = parseInt(e.target.value, 10)
                setSimEstimatedCars(Number.isNaN(v) ? 0 : Math.max(0, v))
              }}
              disabled={!isCurrentMonth}
              className="border border-border rounded-lg px-3 py-2 text-base font-medium text-text-primary w-full focus:border-[var(--rebil-red)] outline-none disabled:bg-bg disabled:text-text-muted disabled:cursor-default"
            />
            {isCurrentMonth && (
              <p className="text-xs text-text-hint mt-1.5">
                {bonus.carsThisMonth} solgt så langt
              </p>
            )}
          </div>

          {/* Konvertering — editable for current month, locked for past */}
          <div className="bg-surface border border-border rounded-card p-4 flex-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konvertering</p>
            <input
              type="number"
              step={0.5}
              min={0.5}
              max={25}
              value={isCurrentMonth ? simConvRate : Math.round((pastBonus?.convRate ?? 0) * 10) / 10}
              onChange={e => {
                if (!isCurrentMonth) return
                const v = parseFloat(e.target.value)
                setSimConvRate(Number.isNaN(v) ? 0 : roundConvHalfStep(v))
              }}
              disabled={!isCurrentMonth}
              className="border border-border rounded-lg px-3 py-2 text-base font-medium text-text-primary w-full focus:border-[var(--rebil-red)] outline-none disabled:bg-bg disabled:text-text-muted disabled:cursor-default"
            />
            <p className="text-xs text-text-hint mt-1.5">
              Faktor: {isCurrentMonth ? simConvFactor : (pastBonus?.convFactor ?? 1)} ({rep.tier})
            </p>

            {/* Conversion calculator toggle */}
            {isCurrentMonth && (
              <button
                type="button"
                onClick={() => setCalcOpen(o => !o)}
                className="mt-2 text-[11px] text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="1" y="1" width="10" height="10" rx="1.5"/>
                  <path d="M3 3h2M7 3h2M3 6h2M7 6h2M3 9h2M7 9h2"/>
                </svg>
                {calcOpen ? 'Skjul kalkulator' : 'Konverteringskalkulator'}
              </button>
            )}

            {/* Inline calculator panel */}
            {isCurrentMonth && calcOpen && (
              <div className="mt-3 border border-border rounded-lg p-3 bg-bg text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-text-muted mb-1">Biler (estimert)</label>
                    <input
                      type="number" min={0} value={calcBiler}
                      onChange={e => setCalcBiler(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full border border-border rounded px-2 py-1 text-xs font-medium text-text-primary focus:border-[var(--rebil-red)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-muted mb-1">Leads som teller</label>
                    <input
                      type="number" min={1} value={calcLeads}
                      onChange={e => setCalcLeads(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full border border-border rounded px-2 py-1 text-xs font-medium text-text-primary focus:border-[var(--rebil-red)] outline-none"
                    />
                  </div>
                </div>
                <div className="border-t border-border/60 pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-text-muted mb-1">Justér biler</label>
                    <input
                      type="text" inputMode="numeric" value={calcAdjBiler}
                      onChange={e => { if (/^-?\d*$/.test(e.target.value)) setCalcAdjBiler(e.target.value) }}
                      className="w-full border border-border rounded px-2 py-1 text-xs font-medium text-text-primary focus:border-[var(--rebil-red)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-muted mb-1">Justér leads</label>
                    <input
                      type="text" inputMode="numeric" value={calcAdjLeads}
                      onChange={e => { if (/^-?\d*$/.test(e.target.value)) setCalcAdjLeads(e.target.value) }}
                      className="w-full border border-border rounded px-2 py-1 text-xs font-medium text-text-primary focus:border-[var(--rebil-red)] outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-text-muted">
                    {calcTotalBiler}/{calcTotalLeads} leads →{' '}
                    <span className="font-semibold text-text-primary">{calcResult}%</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSimConvRate(calcResult); setCalcOpen(false) }}
                    className="text-[11px] font-medium px-2.5 py-1 rounded bg-text-primary text-white hover:opacity-80 transition-opacity"
                  >
                    Bruk denne →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* NPS — editable for current month, locked for past */}
          <div className="bg-surface border border-border rounded-card p-4 flex-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">NPS</p>
            <input
              type="number"
              step={10}
              min={-40}
              max={90}
              value={isCurrentMonth ? simNpsScore : (pastBonus?.npsScore ?? 0)}
              onChange={e => {
                if (!isCurrentMonth) return
                setSimNpsScore(parseInt(e.target.value, 10) || 0)
              }}
              disabled={!isCurrentMonth}
              className="border border-border rounded-lg px-3 py-2 text-base font-medium text-text-primary w-full focus:border-[var(--rebil-red)] outline-none disabled:bg-bg disabled:text-text-muted disabled:cursor-default"
            />
            <p className="text-xs text-text-hint mt-1.5">
              NPS-bonus: {fmtKr(isCurrentMonth ? simNpsBonus : (pastBonus?.npsBonus ?? 0))}
            </p>
          </div>
        </div>
      </>

      {/* Bonus breakdown card */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">Bonus biler ({displayCarsCount} biler)</span>
          <span className="text-text-primary">{fmtKr(displayBaseBonus)}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">Konverteringsbonus</span>
          <span className="text-text-primary">{fmtKr(displayKonverteringsbonus)}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">NPS-bonus (minst 10 biler)</span>
          <span className="text-text-primary">{fmtKr(displayNpsBonus)}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">Annet</span>
          <span className="text-text-primary">kr 0</span>
        </div>
        <div className="flex justify-between font-medium text-base border-t border-border pt-3.5 mt-1">
          <span className="text-text-primary">
            {isCurrentMonth && isEstimating ? 'Estimert total bonus' : 'Total bonus så langt'}
          </span>
          <span className="text-text-primary">{fmtKr(displayTotal)}</span>
        </div>

        <p className="text-xs text-text-hint text-right mt-3">
          {isCurrentMonth
            ? `Data oppdatert: ${updatedLabel}`
            : 'Avsluttet måned — endelige tall'}
        </p>
      </div>

      <CarsTable
        sales={salesByMonth[selectedMonth] ?? []}
        convFactor={isCurrentMonth ? simConvFactor : 1}
      />
    </section>
  )
}
