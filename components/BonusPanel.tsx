'use client'

// Part 3 — bonus breakdown with month selector and what-if simulation.
// Current month only: two inputs (Konvertering %, NPS score) drive client-side recalc.
// baseBonus and carsThisMonth are always fixed from server data.
// Past months: shows server-computed figures, no what-if inputs (v1 scope).

import { useEffect, useState } from 'react'
import type { BonusResult, Rep, SaleRow } from '@/lib/types'
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

/** One decimal for konvertering % input (matches display rules). */
function roundConvOneDecimal(n: number): number {
  return Math.round(n * 10) / 10
}

// Look up conversion factor — same logic as lib/bonus.ts but client-side for what-if
// Input: rate (%), tier  Output: factor
function lookupConvFactor(rate: number, tier: 'IK' | 'Senior' | 'Spesialist'): number {
  if (rate <= 0) return 1.0
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

// Look up NPS bonus — same logic as lib/bonus.ts but client-side for what-if
// Input: score (integer)  Output: bonus NOK
function lookupNpsBonus(score: number): number {
  const floored = Math.floor(score / 10) * 10
  let result = 0
  for (const row of NPS_BONUS) {
    if (row[0] <= floored) result = row[1]
    else break
  }
  return result
}

interface BonusPanelProps {
  bonus:          BonusResult
  rep:            Rep
  salesByMonth:   Record<string, SaleRow[]>
  lastUpdated:    string
  onMonthChange:  (month: string) => void
}

export default function BonusPanel({
  bonus, rep, salesByMonth, lastUpdated, onMonthChange,
}: BonusPanelProps) {
  const currentMonthKey = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  // Available months sorted newest first
  const months = Object.keys(salesByMonth).sort((a, b) => b.localeCompare(a))

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey)
  const [simConvRate,   setSimConvRate]   = useState(() => roundConvOneDecimal(bonus.convRate))
  const [simNpsScore,   setSimNpsScore]   = useState(bonus.npsScore ?? 40)

  // Re-sync from server when selecting inneværende måned (e.g. after viewing a past month)
  useEffect(() => {
    if (selectedMonth !== currentMonthKey) return
    setSimConvRate(roundConvOneDecimal(bonus.convRate))
    setSimNpsScore(bonus.npsScore ?? 40)
  }, [selectedMonth, currentMonthKey, bonus])

  // Derived what-if values — recalculated on every render from input state
  const simConvFactor            = lookupConvFactor(simConvRate, rep.tier)
  const simNpsBonus              = lookupNpsBonus(simNpsScore)
  const simKonverteringsbonus    = Math.round(bonus.baseBonus * (simConvFactor - 1))
  const simBonusEtterKonvertering = Math.round(bonus.baseBonus * simConvFactor)
  const simTotalBonus            = simBonusEtterKonvertering + simNpsBonus

  function handleMonthChange(month: string) {
    setSelectedMonth(month)
    onMonthChange(month)
  }

  const isCurrentMonth = selectedMonth === currentMonthKey

  // Norwegian formatted date from ISO string
  const updatedLabel = new Date(lastUpdated).toLocaleString('nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Display values — use what-if sim for current month, server data for past months
  const displayKonverteringsbonus = isCurrentMonth ? simKonverteringsbonus : bonus.konverteringsbonus
  const displayNpsBonus           = isCurrentMonth ? simNpsBonus           : bonus.npsBonus
  const displayTotal              = isCurrentMonth ? simTotalBonus         : bonus.totalBonus

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

      {isCurrentMonth && (
        <>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Bonus</p>
          <div className="flex gap-4 mb-4">
            {/* Konvertering what-if input */}
            <div className="bg-surface border border-border rounded-card p-4 flex-1">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Konvertering</p>
              <input
                type="number"
                step={0.1}
                min={1}
                max={20}
                value={simConvRate}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setSimConvRate(Number.isNaN(v) ? 0 : roundConvOneDecimal(v))
                }}
                className="border border-border rounded-lg px-3 py-2 text-base font-medium text-text-primary w-full focus:border-[var(--rebil-red)] outline-none"
              />
              <p className="text-xs text-text-hint mt-1.5">
                Faktor: {simConvFactor} ({rep.tier})
              </p>
            </div>

            {/* NPS what-if input */}
            <div className="bg-surface border border-border rounded-card p-4 flex-1">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">NPS</p>
              <input
                type="number"
                step={10}
                min={-40}
                max={90}
                value={simNpsScore}
                onChange={e => setSimNpsScore(parseInt(e.target.value, 10) || 0)}
                className="border border-border rounded-lg px-3 py-2 text-base font-medium text-text-primary w-full focus:border-[var(--rebil-red)] outline-none"
              />
              <p className="text-xs text-text-hint mt-1.5">
                NPS-bonus: {fmtKr(simNpsBonus)}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Bonus breakdown card */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">Bonus biler ({bonus.carsThisMonth} biler)</span>
          <span className="text-text-primary">{fmtKr(bonus.baseBonus)}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">Konverteringsbonus</span>
          <span className="text-text-primary">{fmtKr(displayKonverteringsbonus)}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">NPS-bonus</span>
          <span className="text-text-primary">{fmtKr(displayNpsBonus)}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-[#F0F0F0] text-sm">
          <span className="text-text-secondary">Annet</span>
          <span className="text-text-primary">kr 0</span>
        </div>
        <div className="flex justify-between font-medium text-base border-t border-border pt-3.5 mt-1">
          <span className="text-text-primary">Total bonus så langt</span>
          <span className="text-text-primary">{fmtKr(displayTotal)}</span>
        </div>

        <p className="text-xs text-text-hint text-right mt-3">
          {isCurrentMonth
            ? `Data oppdatert: ${updatedLabel}`
            : 'Avsluttet måned — endelige tall'}
        </p>
      </div>
    </section>
  )
}
