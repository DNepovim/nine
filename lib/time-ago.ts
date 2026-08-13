// How long ago a moment was, in the clipped register the board rows use.
//
// Written rather than pulled in: date-fns and friends produce prose ("about 2 hours
// ago") for a slot that is 7px tall and shares its space with NOT PUBLISHED, and
// Intl.RelativeTimeFormat is no shorter and varies by JS engine. A dozen lines here
// are exact, testable and always the same width.
//
// Minutes are M and months MO, because a lone M beside a score would read as either.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
// Calendar months and years vary; these averages only decide which bucket a label
// falls in and by how much it rounds, where being a day out is not worth a calendar.
const MONTH = 30 * DAY
const YEAR = 365 * DAY

// Ordered coarsest-last: the first unit the gap reaches is the one it is said in.
const UNITS = [
  { ms: YEAR, suffix: 'Y' },
  { ms: MONTH, suffix: 'MO' },
  { ms: WEEK, suffix: 'W' },
  { ms: DAY, suffix: 'D' },
  { ms: HOUR, suffix: 'H' },
  { ms: MINUTE, suffix: 'M' },
] as const

// Under a minute, and anything dated in the future — a clock skewed a few seconds
// ahead of the server must not produce "in 3 seconds" on a record that already exists.
const JUST_NOW = 'NOW'

// `at` is an ISO timestamp from the server; `now` is passed in rather than read, so
// this stays pure and a test can pin the clock.
export function timeAgo(at: string, now: number): string | null {
  const then = Date.parse(at)
  if (Number.isNaN(then)) return null

  const gap = now - then
  const unit = UNITS.find(({ ms }) => gap >= ms)
  if (unit === undefined) return JUST_NOW

  return `${Math.floor(gap / unit.ms)}${unit.suffix} AGO`
}
