import { PERIODS, type AnnouncementId, type Period } from '@/lib/announcements'

// Which board a crossing puts the player on top of.
//
// The two openings count as the same claim as taking a record outright: an empty board
// with your score on it is a board you lead, and the medal says where you stand rather
// than how you got there. A personal best is not a medal — it belongs to you, not to a
// board, and nobody else can see it. Nor is anything a rival did.
//
// Every id is listed rather than the medal-worthy few, so a new announcement cannot be
// added without deciding whether it ends the run with a medal.
const MEDAL_PERIOD = {
  ever: 'ever',
  week: 'week',
  today: 'today',
  weekFirst: 'week',
  todayFirst: 'today',

  record: null,

  todayRaised: null,
  weekRaised: null,
  everRaised: null,
  todayLost: null,
  weekLost: null,
  everLost: null,
} as const satisfies Record<AnnouncementId, Period | null>

// The boards this run took, biggest first — PERIODS drives the order, so two ids naming
// the same board (taking the week's record and opening it) can only ever produce one
// medal.
export const medalPeriods = (crossed: readonly AnnouncementId[]): Period[] =>
  PERIODS.filter((period) => crossed.some((id) => MEDAL_PERIOD[id] === period))

// The boards the run is still on top of, checked against the records as they stand.
//
// Taking a board and holding it are different claims, and the run only announces the
// first. A rival who goes past you while you are still playing does not make the
// announcement wrong — it was true when it was said — but it does make the medal wrong,
// and the medal is what stays on screen. A record we could not read leaves the claim
// alone: an unknown record has taken nothing.
export const heldPeriods = (
  medals: readonly Period[],
  score: number,
  records: Record<Period, number | null>,
): Period[] =>
  medals.filter((period) => {
    const record = records[period]
    return record === null || score >= record
  })
