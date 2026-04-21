// Norwegian public holiday and workday utilities.
// Uses the Anonymous Gregorian algorithm for Easter calculation.

function easterDate(year: number): Date {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

function norwegianHolidays(year: number): Set<string> {
  const easter = easterDate(year)
  return new Set([
    `${year}-01-01`,           // Nyttårsdag
    ymd(addDays(easter, -3)),  // Skjærtorsdag
    ymd(addDays(easter, -2)),  // Langfredag
    ymd(easter),               // Første påskedag
    ymd(addDays(easter, 1)),   // Andre påskedag
    `${year}-05-01`,           // Arbeidernes dag
    `${year}-05-17`,           // Grunnlovsdag
    ymd(addDays(easter, 39)),  // Kristi himmelfartsdag
    ymd(addDays(easter, 49)),  // Første pinsedag
    ymd(addDays(easter, 50)),  // Andre pinsedag
    `${year}-12-25`,           // Første juledag
    `${year}-12-26`,           // Andre juledag
  ])
}

function isWorkday(d: Date, holidays: Set<string>): boolean {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6 && !holidays.has(ymd(d))
}

/** Total workdays in a given month (1-indexed). */
export function workdaysInMonth(year: number, month: number): number {
  const h = norwegianHolidays(year)
  let count = 0
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    if (isWorkday(d, h)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** Workdays elapsed so far in the given month, up to and including today. */
export function elapsedWorkdaysInMonth(year: number, month: number): number {
  const h = norwegianHolidays(year)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let count = 0
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1 && d <= today) {
    if (isWorkday(d, h)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}
