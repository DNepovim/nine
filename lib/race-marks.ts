import type { VerdictKey } from '@/lib/compare'

// The pair of animals over the two nicknames on the comparison table: how the race between
// these two careers is going, told the way a race is told.
//
// A player who holds an Extreme all-time board already wears a crown, an owl or an eagle
// over their name — that is a standing, it is theirs wherever their name appears, and
// nothing here replaces it. This is for everybody else, which is almost everybody: the box
// over the name would otherwise be empty on both sides of the card.
//
// Keyed off the verdict rather than off the tally, so the animals and the sentence under
// them are the same reading of the same table. A pair that said *neck and neck* over a line
// that said *this one is over* would be the card arguing with itself.

// One glyph per side, or null on a card where neither player has started.
export type RaceMarks = { mine: string | null; theirs: string | null }

// Three distances, and an animal apiece for each end of them.
//
// A rout is a cheetah and a snail: the fastest thing on land against the slowest joke about
// speed, which is the only pair wide enough for a gap no evening is going to close. A clear
// lead is the hare and the tortoise, because that fable is exactly what a two-to-four row
// margin is — a real lead, and not a settled one. Close is two racehorses, one each, because
// at a row apart neither of them is the slow one.
//
// A dead heat gets the racehorses too. It is the closest a table can be, and the animal
// saying so is the one that already means *still running*.
//
// Two careers with nothing in them get nothing. There is no race to draw yet, and a pair of
// horses over two players who have never finished a run would be the card inventing one.
const RACE_MARKS = {
  routMine: { mine: '🐆', theirs: '🐌' },
  routTheirs: { mine: '🐌', theirs: '🐆' },
  clearMine: { mine: '🐇', theirs: '🐢' },
  clearTheirs: { mine: '🐢', theirs: '🐇' },
  closeMine: { mine: '🐎', theirs: '🐎' },
  closeTheirs: { mine: '🐎', theirs: '🐎' },
  even: { mine: '🐎', theirs: '🐎' },
  unplayed: { mine: null, theirs: null },
} as const satisfies Record<VerdictKey, RaceMarks>

export const raceMarks = (verdict: VerdictKey): RaceMarks => RACE_MARKS[verdict]
