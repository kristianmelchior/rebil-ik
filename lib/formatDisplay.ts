// Display formatting for KPIs and charts — consistent decimals across the app.

/** Currency NOK — "kr X XXX" (Norwegian locale). */
export function fmtKr(n: number): string {
  return `kr ${Math.round(n).toLocaleString('nb-NO')}`
}

/** Purchase date as d.m.yy (nb-NO), from YYYY-MM-DD or ISO datetime. */
export function fmtDatoKjoptShort(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return '—'
  const head = String(raw).trim().slice(0, 10)
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head)
  const d = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(head)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  })
}

/** HH:MM 24h from ISO or date string. */
export function formatTimeHm(isoOrDate: string): string | null {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return null
  const h = d.getHours()
  const m = d.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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
