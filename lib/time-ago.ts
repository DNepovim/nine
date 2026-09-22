// How long ago a moment was, in the quiet register the board rows use beside a nickname.
//
// Written rather than pulled in: date-fns and friends produce prose ("about 2 hours
// ago") for a slot that is 7px tall and shares its space with NOT PUBLISHED, and
// Intl.RelativeTimeFormat is no shorter and varies by JS engine. A dozen lines here
// are exact, testable and always the same width.
//
// Every unit is a word rather than a letter. `5M`, `3H` and `2MO` asked one letter at
// 7px to carry the whole difference between a minute, an hour and a month — M and H are
// nearly the same shape at that size, and M read as either minute or month however it
// was spelled. No pair of `min` / `hrs` / `days` / `wks` / `mths` / `yrs` can be
// confused for another.
//
// Lower case, unlike everything else on the row. This is the one thing on a board that
// is not a claim — the rank, the name and the score are all shouted, and the moment
// behind them is an aside. NOT PUBLISHED keeps its capitals in the same slot for exactly
// that reason: it is a warning, not an aside.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
// Calendar months and years vary; these averages only decide which bucket a label
// falls in and by how much it rounds, where being a day out is not worth a calendar.
const MONTH = 30 * DAY
const YEAR = 365 * DAY

// Ordered coarsest-last: the first unit the gap reaches is the one it is said in. Both
// spellings are carried rather than an `s` appended, because `1 mth` is not `1 mths` and
// a column that reads as a bug is not worth the one character it saves.
const UNITS = [
  { ms: YEAR, one: 'yr', many: 'yrs' },
  { ms: MONTH, one: 'mth', many: 'mths' },
  { ms: WEEK, one: 'wk', many: 'wks' },
  { ms: DAY, one: 'day', many: 'days' },
  { ms: HOUR, one: 'hr', many: 'hrs' },
  { ms: MINUTE, one: 'min', many: 'min' },
] as const

// Under a minute, and anything dated in the future — a clock skewed a few seconds
// ahead of the server must not produce "in 3 seconds" on a record that already exists.
const JUST_NOW = 'now'

// `at` is an ISO timestamp from the server; `now` is passed in rather than read, so
// this stays pure and a test can pin the clock.
export function timeAgo(at: string, now: number): string | null {
  const then = Date.parse(at)
  if (Number.isNaN(then)) return null

  const gap = now - then
  const unit = UNITS.find(({ ms }) => gap >= ms)
  if (unit === undefined) return JUST_NOW

  const count = Math.floor(gap / unit.ms)
  return `${count} ${count === 1 ? unit.one : unit.many} ago`
}
