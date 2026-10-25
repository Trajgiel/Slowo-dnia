/** Local calendar day `YYYY-MM-DD` (device time zone), as the prototype's `dayKey`. */
export type DayKey = string

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Local date of `date` as `YYYY-MM-DD` (getFullYear / getMonth / getDate, not UTC). */
export function dayKey(date: Date): DayKey {
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** `YYYY-MM-DD` → `DD.MM` for the screen; empty or missing key → empty string (prototype `fmtDate`). */
export function formatDayMonth(key: DayKey | null | undefined): string {
  return key ? `${key.slice(8, 10)}.${key.slice(5, 7)}` : ''
}

/** A copy of `date` moved by `days` local calendar days (setDate, so DST days are still one day). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}
