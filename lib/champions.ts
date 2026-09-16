import type { Period } from '@/lib/announcements'
import type { Difficulty, ScoredMode } from '@/machines/modes'

// Who holds the all-time record on each mode's Extreme board — the hardest board a mode
// has, over the longest window it keeps. One player each, because gold is rank one.
export type Champions = Record<ScoredMode, string | null>

export const NO_CHAMPIONS: Champions = { accuracy: null, speed: null }

// What one board read can say about who leads it: an id, nobody, or — `undefined` —
// nothing at all, because the request did not come back.
//
// The distinction is the whole point. `null` is an answer: that board has no champion.
// A failed request is not an answer, and folding the two together used to take the mark
// off a player who still held the board, because one flaky read out of the two wrote
// `null` over a good id and nothing ever asked again.
export type ChampionRead = string | null | undefined

// A fresh pair of reads over what is already known. Boards that answered replace what
// they answered for; boards that did not are left exactly as they were.
export function mergeChampions(
  prev: Champions,
  reads: Record<ScoredMode, ChampionRead>,
): Champions {
  return {
    accuracy: reads.accuracy === undefined ? prev.accuracy : reads.accuracy,
    speed: reads.speed === undefined ? prev.speed : reads.speed,
  }
}

// The mark a player wears in front of their name, anywhere their name appears.
//
// Both boards is a crown; one is that mode's bird. Accuracy is an owl for what it asks
// — patience and an exact eye — and Speed an eagle for the dive.
const CHAMPION_MARKS = {
  both: '👑',
  accuracy: '🦉',
  speed: '🦅',
} as const

export type ChampionMark = (typeof CHAMPION_MARKS)[keyof typeof CHAMPION_MARKS]

export function championMark(
  userId: string | null,
  champions: Champions,
): ChampionMark | null {
  if (userId === null) return null
  const accuracy = champions.accuracy === userId
  const speed = champions.speed === userId
  if (accuracy && speed) return CHAMPION_MARKS.both
  if (accuracy) return CHAMPION_MARKS.accuracy
  if (speed) return CHAMPION_MARKS.speed
  return null
}

// How loudly the game-over screen celebrates what the run just took.
//
// `crown` is the rarest thing in the game — the all-time Extreme record in one mode
// while already holding the other. `bird` is one of them. `wash` is any other all-time
// record, which is a real achievement but not a reign, so it gets the colour and the
// celebration without the full treatment. Everything else is the plain screen, which
// still loops the day's or the week's effect behind it.
export type RecordScreen = 'crown' | 'bird' | 'wash' | 'plain'

const otherMode = {
  accuracy: 'speed',
  speed: 'accuracy',
} as const satisfies Record<ScoredMode, ScoredMode>

export function recordScreen({
  record,
  mode,
  difficulty,
  userId,
  champions,
}: {
  // The biggest board this run took, or null if it took none.
  record: Period | null
  mode: ScoredMode
  difficulty: Difficulty
  userId: string | null
  // Read after the run: taking Extreme's all-time record makes the player this mode's
  // champion, so the question is only ever about the other one.
  champions: Champions
}): RecordScreen {
  if (record !== 'ever') return 'plain'
  if (difficulty !== 'extreme') return 'wash'
  const holdsOther = userId !== null && champions[otherMode[mode]] === userId
  return holdsOther ? 'crown' : 'bird'
}
