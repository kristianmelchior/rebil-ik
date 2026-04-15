/**
 * Norwegian public holiday utilities + business-day counter.
 *
 * Fixed holidays (same date every year):
 *   1 jan  — Nyttårsdag
 *   1 mai  — Arbeidernes dag
 *  17 mai  — Grunnlovsdag
 *  25 des  — 1. juledag
 *  26 des  — 2. juledag
 *
 * Moveable holidays (relative to Easter Sunday):
 *  Easter − 3  — Skjærtorsdag
 *  Easter − 2  — Langfredag
 *  Easter + 0  — 1. påskedag
 *  Easter + 1  — 2. påskedag
 *  Easter + 39 — Kristi himmelfartsdag
 *  Easter + 49 — 1. pinsedag
 *  Easter + 50 — 2. pinsedag
 */

/** Returns Easter Sunday for the given year (Meeus/Jones/Butcher algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-based
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns a Set of 'YYYY-MM-DD' strings for all Norwegian public holidays in `year`. */
export function norwegianHolidays(year: number): Set<string> {
  const easter = easterSunday(year)
  const dates = [
    // Fixed
    new Date(year, 0,  1),  // Nyttårsdag
    new Date(year, 4,  1),  // Arbeidernes dag
    new Date(year, 4, 17),  // Grunnlovsdag
    new Date(year, 11, 25), // 1. juledag
    new Date(year, 11, 26), // 2. juledag
    // Moveable (relative to Easter)
    addDays(easter, -3),    // Skjærtorsdag
    addDays(easter, -2),    // Langfredag
    easter,                  // 1. påskedag
    addDays(easter,  1),    // 2. påskedag
    addDays(easter, 39),    // Kristi himmelfartsdag
    addDays(easter, 49),    // 1. pinsedag
    addDays(easter, 50),    // 2. pinsedag
  ]
  return new Set(dates.map(toYMD))
}

// Cache holidays per year so we don't recompute on every call
const holidayCache = new Map<number, Set<string>>()

function isHoliday(date: Date): boolean {
  const y = date.getFullYear()
  if (!holidayCache.has(y)) holidayCache.set(y, norwegianHolidays(y))
  return holidayCache.get(y)!.has(toYMD(date))
}

/**
 * Count business days (Mon–Fri, excluding Norwegian public holidays) that
 * have elapsed since `from`. The start date itself is NOT counted.
 *
 * Examples (ignoring holidays):
 *   from=Friday,  today=Monday  → 1  (only Monday)
 *   from=Friday,  today=Tuesday → 2  (Monday + Tuesday)
 *   from=Thursday,today=Monday  → 2  (Friday + Monday)
 */
export function businessDaysSince(from: Date, today: Date = new Date()): number {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)

  const end = new Date(today)
  end.setHours(0, 0, 0, 0)

  if (end <= start) return 0

  let count = 0
  const d = new Date(start)
  d.setDate(d.getDate() + 1) // start counting the day after `from`

  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6 && !isHoliday(d)) count++
    d.setDate(d.getDate() + 1)
  }

  return count
}

/**
 * Returns true if a deal should be considered rotten.
 * @param dateStr   ISO date string from the DB (create_date or last_activity_at)
 * @param days      Threshold in business days (Mon–Fri, excl. Norwegian holidays)
 */
export function isRotten(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr) return false
  return businessDaysSince(new Date(dateStr)) >= days
}
