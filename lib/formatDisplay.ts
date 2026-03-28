// Display formatting for KPIs and charts — consistent decimals across the app.

/** Kjøpt / Leads: whole numbers, no decimals */
export function fmtKjoptLeads(n: number): string {
  return Math.round(n).toLocaleString('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/** Konvertering: one decimal + % */
export function fmtKonvertering(rate: number | null): string {
  if (rate === null) return '—'
  return (
    rate.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
  )
}

/** NPS: whole number, no decimals */
export function fmtNps(score: number | null): string {
  if (score === null) return '—'
  return Math.round(score).toLocaleString('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export type TrendMetric = 'bilerKjopt' | 'leads' | 'konverteringsrate' | 'npsScore'

/** Single value for trend bar labels / tooltips */
export function fmtTrendMetric(metric: TrendMetric, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  switch (metric) {
    case 'konverteringsrate':
      return fmtKonvertering(value)
    case 'npsScore':
      return fmtNps(value)
    default:
      return fmtKjoptLeads(value)
  }
}
