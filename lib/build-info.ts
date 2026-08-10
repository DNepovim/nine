// build:web stamps EXPO_PUBLIC_BUILD_ID as `<sha>-<yymmdd.HHMM>`. Under
// `expo start` it isn't set at all, so everything here degrades to a dev label
// rather than pretending to know which build is running.

// Metro statically replaces process.env.EXPO_PUBLIC_*, so this must be a
// literal member access — a dynamic lookup would come back undefined.
const RAW = process.env.EXPO_PUBLIC_BUILD_ID

export type BuildInfo = { sha: string | null; builtAt: Date | null; label: string }

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const STAMP = /^([0-9a-f]{7,40})-(\d{2})(\d{2})(\d{2})\.(\d{2})(\d{2})$/

const pad = (n: number) => String(n).padStart(2, '0')

export function parseBuildId(raw: string | undefined): BuildInfo {
  if (raw === undefined || raw === '') return { sha: null, builtAt: null, label: 'dev' }

  const match = STAMP.exec(raw)
  if (match === null) {
    // Unrecognised shape — still better to show it verbatim than to hide it.
    return { sha: null, builtAt: null, label: raw }
  }

  const [, sha, yy, mm, dd, hh, min] = match
  const builtAt = new Date(
    2000 + Number(yy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
  )
  const month = MONTHS[builtAt.getMonth()] ?? '???'
  const when = `${builtAt.getDate()} ${month} ${builtAt.getFullYear()}, ${pad(builtAt.getHours())}:${pad(builtAt.getMinutes())}`

  return { sha: sha ?? null, builtAt, label: `${sha ?? '?'} · ${when}` }
}

export const buildInfo = (): BuildInfo => parseBuildId(RAW)
