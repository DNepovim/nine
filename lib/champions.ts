import type { Period } from '@/lib/announcements'
import { type Difficulty, type ScoredMode } from '@/modes'

// Who is currently standing where, for every mark the app draws in front of a name.
//
// Two of the three are boards: the all-time record on each mode's Extreme board — the
// hardest a mode has, over the longest window it keeps — one player each, because gold is
// rank one. The third is a **session**, which is not a board at all and is why this is no
// longer a `Record<ScoredMode, …>`: the shape used to say "one per scored mode" and now
// says "one per mark", which is what it was always being used for.
export type Champions = {
  accuracy: string | null
  speed: string | null
  // Whoever took the most recently closed session — see `last_session_winner`. Held here
  // beside the boards so one read of one context answers for every mark on a name, rather
  // than a second provider threaded to the same six places.
  challenge: string | null
}

export const NO_CHAMPIONS: Champions = { accuracy: null, speed: null, challenge: null }

// What one board read can say about who leads it: an id, nobody, or — `undefined` —
// nothing at all, because the request did not come back.
//
// The distinction is the whole point. `null` is an answer: that board has no champion.
// A failed request is not an answer, and folding the two together used to take the mark
// off a player who still held the board, because one flaky read out of the two wrote
// `null` over a good id and nothing ever asked again.
export type ChampionRead = string | null | undefined

// A fresh set of reads over what is already known. Whatever answered replaces what it
// answered for; whatever did not is left exactly as it was.
export function mergeChampions(
  prev: Champions,
  reads: Partial<Record<keyof Champions, ChampionRead>>,
): Champions {
  const kept = (key: keyof Champions): string | null =>
    reads[key] === undefined ? prev[key] : reads[key]
  return {
    accuracy: kept('accuracy'),
    speed: kept('speed'),
    challenge: kept('challenge'),
  }
}

// The mark a player wears in front of their name, anywhere their name appears.
//
// One bird per standing. An owl for Accuracy — patience and an exact eye — an eagle for
// Speed's dive, and a phoenix for whoever took the last challenge: a bird that burns down
// and comes back is exactly what a session standing is, held until the next one closes
// rather than kept.
//
// Keyed by the standing rather than listed loose, so the three can be walked in the order
// they are drawn and a fourth standing cannot arrive without a bird to go with it.
const BIRD_MARKS = {
  accuracy: '🦉',
  speed: '🦅',
  challenge: '🐦‍🔥',
} as const satisfies Record<keyof Champions, string>

// Every standing there is, in the order its bird is drawn: the two boards, then the
// session. A tuple rather than `Object.keys`, which would type as `string[]` and lose the
// exhaustiveness the map above is written for.
const STANDINGS = ['accuracy', 'speed', 'challenge'] as const

// All three at once, and the only mark that is not a bird. It **replaces** them rather
// than joining them — a player holding everything wears one crown, not a row of three,
// which is what makes the crown mean more than the birds it is made of.
const CROWN = '👑'

// Every mark a name can wear. `TitleMark` keys its copy on this union: a mark the player
// cannot have explained to them is a mark they will guess at.
export type PlayerMark = (typeof BIRD_MARKS)[keyof typeof BIRD_MARKS] | typeof CROWN

// Every mark this player wears, in the order they are drawn.
//
// A list rather than one mark, because the three standings are independent claims that
// can be true at once — holding Extreme Accuracy does not stop you having taken
// yesterday's challenge — and a single value meant whichever was tested first silently
// won. The full set is the one case that collapses, to the crown.
export function playerMarks(
  userId: string | null,
  champions: Champions,
): readonly PlayerMark[] {
  if (userId === null) return []
  const held = STANDINGS.filter((standing) => champions[standing] === userId)
  if (held.length === STANDINGS.length) return [CROWN]
  return held.map((standing) => BIRD_MARKS[standing])
}

// Whether this player holds both Extreme all-time boards at once — a reign rather than a
// record. Named rather than left as a comparison against a mark: this is the fact the
// UNTOUCHABLE achievement is about, and it is deliberately **not** the crown any more.
// The crown became all three standings when the phoenix joined them; the achievement's
// shipped copy still says both boards, so the two parted ways and the name says which
// this one is.
export const holdsBothBoards = (userId: string | null, champions: Champions): boolean =>
  userId !== null && champions.accuracy === userId && champions.speed === userId

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
