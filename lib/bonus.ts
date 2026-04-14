// Bonus calculation — steps 1–8. Pure functions, no side effects.
// Never change a formula. Flag if anything looks wrong.

import type { Rep, SaleRow, NpsRow, BonusResult } from './types'
import { CONVERSION_FACTORS, TIER_COL_INDEX } from '@/config/conversionFactors'
import { NPS_BONUS } from '@/config/npsBonus'

// Look up conversion factor for a given rate and tier.
// Floors rate to nearest 0.5, finds last table row where row[0] <= floored rate.
// Input: rate (convRate %), tier  Output: factor (number >= 1.0)
function lookupConvFactor(rate: number, tier: 'IK' | 'Senior' | 'Spesialist'): number {
  const floored = Math.floor(rate / 0.5) * 0.5
  const col = TIER_COL_INDEX[tier]

  // Above table maximum — use last row
  if (floored > 19.5) return CONVERSION_FACTORS[CONVERSION_FACTORS.length - 1][col]

  let result = 1.0
  for (const row of CONVERSION_FACTORS) {
    if (row[0] <= floored) result = row[col]
    else break
  }
  return result
}

// Look up NPS bonus for a given score.
// Floors score to nearest 10, finds last table row where row[0] <= floored score.
// Input: score (integer NPS score)  Output: bonus NOK
function lookupNpsBonus(score: number): number {
  const floored = Math.floor(score / 10) * 10
  let result = 0
  for (const row of NPS_BONUS) {
    if (row[0] <= floored) result = row[1]
    else break
  }
  return result
}

// Compute full bonus result for a rep in the current calendar month.
// Input: rep, saleRows/leadRows/npsRows filtered to current month and rep kode
// Output: BonusResult
export function computeBonus(
  rep: Rep,
  saleRows: SaleRow[],
  leadCount: number,
  npsRows: NpsRow[]
): BonusResult {
  // Step 1 — Base bonus: SUM(bonus) for all rows (null → 0; Avslått rows included)
  const baseBonus = saleRows.reduce((sum, r) => sum + (r.bonus ?? 0), 0)

  // Step 2 — Conversion rate
  const carsThisMonth = saleRows.filter(r => r.biler > 0).reduce((sum, r) => sum + r.biler, 0)
  const leadsThisMonth = leadCount
  // Edge: leadsThisMonth === 0 → convRate = 0, convFactor = 1.0, skip lookup
  const convRate = leadsThisMonth === 0 ? 0 : (carsThisMonth / leadsThisMonth) * 100

  // Step 3 — Conversion factor lookup (skip if no leads)
  const convFactor = leadsThisMonth === 0 ? 1.0 : lookupConvFactor(convRate, rep.tier)

  // Step 4 — Bonus breakdown for display
  const bonusBiler = baseBonus                                // display line 1
  const konverteringsbonus = Math.round(baseBonus * (convFactor - 1)) // display line 2
  const bonusEtterKonvertering = Math.round(baseBonus * convFactor)   // sum of lines 1+2

  // Step 5 — NPS score: average of nps_adj_score, rounded, null if no rows
  const npsValues = npsRows.map(r => r.nps_adj_score)
  const npsScore = npsValues.length === 0
    ? null
    : Math.round(npsValues.reduce((s, v) => s + v, 0) / npsValues.length)

  // Step 6 — NPS bonus lookup
  const npsBonus = npsScore === null ? 0 : lookupNpsBonus(npsScore)

  // Step 7 — Total and projected bonus
  const totalBonus = bonusEtterKonvertering + npsBonus
  const today = new Date()
  const daysElapsed = today.getDate() // 1-based current day
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const projectedBonus = Math.round(totalBonus * (daysInMonth / daysElapsed))

  // Step 8 — Per-car average (null if no cars this month — display as "—")
  const perCarAvg = carsThisMonth === 0 ? null : Math.round(baseBonus / carsThisMonth)

  return {
    baseBonus,
    carsThisMonth,
    leadsThisMonth,
    convRate,
    convFactor,
    bonusBiler,
    konverteringsbonus,
    bonusEtterKonvertering,
    npsScore,
    npsBonus,
    totalBonus,
    projectedBonus,
    perCarAvg,
  }
}
