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
