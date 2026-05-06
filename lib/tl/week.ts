// ISO week helpers for the Vurdering feature.

/**
 * Returns the ISO 8601 week string for a given date, e.g. '2026-W19'.
 * Monday is the first day of the week (ISO standard).
 */
export function toIsoWeek(date: Date): string {
  // Copy the date so we don't mutate the original
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number (Sunday = 7)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Returns the ISO week string for today, e.g. '2026-W19'. */
export function currentIsoWeek(): string {
  return toIsoWeek(new Date())
}

/**
 * Returns a human-readable label for an ISO week string.
 * e.g. '2026-W19' → 'Uke 19, 2026'
 */
export function isoWeekLabel(week: string): string {
  const m = week.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return week
  return `Uke ${parseInt(m[2], 10)}, ${m[1]}`
}

/**
 * Returns the Monday date of an ISO week string.
 * e.g. '2026-W19' → Date(2026-05-04)
 */
export function isoWeekMonday(week: string): Date {
  const m = week.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return new Date()
  const year = parseInt(m[1], 10)
  const weekNo = parseInt(m[2], 10)
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (weekNo - 1) * 7)
  return monday
}

/**
 * Returns an array of the last N week strings (most recent first).
 */
export function recentWeeks(n: number): string[] {
  const weeks: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    weeks.push(toIsoWeek(d))
    d.setDate(d.getDate() - 7)
  }
  return weeks
}
