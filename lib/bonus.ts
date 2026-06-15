// Bonus calculation — steps 1–8. Pure functions, no side effects.
// Never change a formula. Flag if anything looks wrong.

import type { Rep, SaleRow, NpsRow, AvvikRow, EttersalgRow, BonusResult, ConversionFactorRow, NpsBonusRow } from './types'
import { CONVERSION_FACTORS, TIER_COL_INDEX } from '@/config/conversionFactors'
import { NPS_BONUS } from '@/config/npsBonus'

// Look up conversion factor for a given rate and tier.
// When dbFactors is provided (precise rows from Supabase), uses those with full decimal precision.
// Falls back to the hardcoded config table (floors to nearest 0.5) when dbFactors is absent.
// Input: rate (convRate %), tier, optional dbFactors  Output: factor (number >= 1.0)
function lookupConvFactor(
  rate: number,
  tier: 'IK' | 'Senior' | 'Spesialist',
  dbFactors?: ConversionFactorRow[]
): number {
  if (dbFactors && dbFactors.length > 0) {
    // konvertering in DB is decimal (0.105 = 10.5%); rate is in %
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

  // Fallback: hardcoded config table (floors to nearest 0.5%)
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

// Look up NPS bonus for a given score.
// Floors score to nearest 10, finds last table row where row[0] <= floored score.
// Uses precise DB rows when available, falls back to hardcoded config.
// Input: score (integer NPS score), optional dbRows  Output: bonus NOK
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

// Compute full bonus result for a rep in the current calendar month.
// Input: rep, saleRows/leadRows/npsRows filtered to current month and rep kode
// Output: BonusResult
export function computeBonus(
  rep: Rep,
  saleRows: SaleRow[],
  leadCount: number,
  npsRows: NpsRow[],
  convFactors?: ConversionFactorRow[],
  npsBonusTable?: NpsBonusRow[],
  avvikRows?: AvvikRow[],
  ettersalgRows?: EttersalgRow[]
): BonusResult {
  // Step 1 — Base bonus: SUM(bonus) for all rows (null → 0; Avslått rows included)
  const baseBonus = saleRows.reduce((sum, r) => sum + (r.bonus ?? 0), 0)

  // Step 2 — Conversion rate
  const carsThisMonth = saleRows.filter(r => r.biler > 0).reduce((sum, r) => sum + r.biler, 0)
  const leadsThisMonth = leadCount
  // Edge: leadsThisMonth === 0 → convRate = 0, convFactor = 1.0, skip lookup
  const convRate = leadsThisMonth === 0 ? 0 : (carsThisMonth / leadsThisMonth) * 100

  // Step 3 — Conversion factor lookup (skip if no leads)
  const convFactor = leadsThisMonth === 0 ? 1.0 : lookupConvFactor(convRate, rep.tier, convFactors)

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
  const npsBonus = npsScore === null ? 0 : lookupNpsBonus(npsScore, npsBonusTable)

  // Step 6b — LQ bonus: kr 300 per LQ car
  const lqCars = saleRows.filter(r => r.lq && r.biler > 0).reduce((sum, r) => sum + r.biler, 0)
  const lqBonus = lqCars * 300

  // Step 6c — Avvik deduction: kr 100 per avvik (rows already filtered to this month)
  const avvikDeduction = (avvikRows?.length ?? 0) * 100

  // Step 6d — Ettersalg deduction: kr 500 per endelig avgjort ettersalg
  const ettersalgDeduction = (ettersalgRows?.filter(r => r.endelig_avgjort).length ?? 0) * 500

  // Step 7 — Total and projected bonus
  const totalBonus = bonusEtterKonvertering + npsBonus + lqBonus - avvikDeduction - ettersalgDeduction
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
    lqBonus,
    avvikDeduction,
    ettersalgDeduction,
    totalBonus,
    projectedBonus,
    perCarAvg,
  }
}
