const SHORT_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// An ISO day ('2026-08-10') as '10 August 2026'. Parsed by hand rather than
// through Date, which would read a bare ISO day as UTC and can shift it a day
// backwards for anyone west of Greenwich.
export function formatReleaseDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) return iso
  const [, year, month, day] = match
  const name = MONTHS[Number(month) - 1]
  if (name === undefined) return iso
  return `${Number(day)} ${name} ${year ?? ''}`.trim()
}

// A bare ISO day ('2026-09-22') as '22 SEP'. Parsed by hand for the same reason
// `formatReleaseDate` is: `Date` reads a bare ISO day as UTC and shifts it a day
// backwards for anyone west of Greenwich — and a day that is the whole subject of the
// line it sits on is the worst possible one to be off by one.
export function formatShortDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) return iso
  const [, , month, day] = match
  const name = SHORT_MONTHS[Number(month) - 1]
  return name === undefined ? iso : `${Number(day)} ${name}`
}

// A full ISO timestamp ('2026-09-17T08:31:00.000Z') as '17 SEP', on the reader's own
// clock. Unlike `formatReleaseDate` this takes an instant rather than a bare day, so
// `Date` can be trusted with it: an instant carries its own zone, and reading it back in
// local time is what makes "the day I earned this" say what the player remembers.
export function formatShortDate(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const month = SHORT_MONTHS[at.getMonth()]
  return month === undefined ? '' : `${at.getDate()} ${month}`
}
