import { awardValue, type Award, type WinPeriod, type WinRank } from '@/lib/winnings'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/modes'

// How a launch groups what the player is owed, once the server has answered.
//
// Which windows those are is no longer a sum this file works out. It used to be: the
// stored marker held the last day announced, the span to ask for started the day after it,
// and that off-by-one was what the money hung on — a day out in either direction either
// re-announced yesterday or swallowed a win. The watermark on the player's profile holds
// that boundary now, and `my_unpaid_winnings` draws the span from it, so the device no
// longer has an opinion about what it is owed.
//
// What is left here is the brake. A player who has never placed on a board would otherwise
// ask the server about a span that only grows, on every launch, forever.

// Whether the server has already been asked today and answered that nothing is owed.
//
// Only ever today: a stored day in the past means the question is open again, which is
// what makes the first launch of a new day the one that asks. A device with nothing stored
// has never asked, so it asks — unlike the old marker, which started a wiped device at
// yesterday and quietly forfeited whatever was behind it.
export const askedToday = (stored: string | null, today: string): boolean =>
  stored === today

// One heading in the modal and the awards under it — a day or a week, at one step of the
// podium. Keyed by the step as well, so a sentence never has to say that one board was
// taken and the next one came third: a block is one rank throughout, which is what keeps
// the phrasings from multiplying by three.
export type AwardBlock = {
  period: WinPeriod
  wonOn: string
  rank: WinRank
  awards: Award[]
}

const boardOrder = (award: Award): number =>
  SCORED_MODES.indexOf(award.mode) * 10 + DIFFICULTY_ORDER.indexOf(award.difficulty)

// Days before weeks when two blocks fall on the same date, which only happens when a week
// is won on the Monday it began.
const PERIOD_ORDER = {
  day: 0,
  week: 1,
} as const satisfies Record<WinPeriod, number>

// Newest first, and biggest first inside a block.
//
// This ordering was once justified as "a ledger, not a narrative", against the table the
// card used to be. The card is prose now — one sentence per window — and the ordering
// outlived the argument, because both halves of it were really about *attention* rather
// than about tables: the most recent win is the one the player is likeliest to remember
// earning, and the largest is the one they came to see. A sentence wants its best clause
// first for the same reason a row wanted its best figure at the top.
//
// Still the opposite of the release catch-up, which runs oldest first so a returning player
// finishes on the latest news. Winnings are not a story being caught up on; each window
// stands by itself.
export function awardBlocks(awards: readonly Award[]): AwardBlock[] {
  const blocks = new Map<string, AwardBlock>()
  for (const award of awards) {
    const key = `${award.period}:${award.wonOn}:${award.rank}`
    const held = blocks.get(key)
    if (held === undefined) {
      blocks.set(key, {
        period: award.period,
        wonOn: award.wonOn,
        rank: award.rank,
        awards: [award],
      })
      continue
    }
    held.awards.push(award)
  }
  return [...blocks.values()]
    .map((block) => ({
      ...block,
      awards: [...block.awards].sort(
        (a, b) => awardValue(b) - awardValue(a) || boardOrder(a) - boardOrder(b),
      ),
    }))
    .sort(
      (a, b) =>
        (a.wonOn < b.wonOn ? 1 : a.wonOn > b.wonOn ? -1 : 0) ||
        PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period] ||
        // Gold, then silver, then bronze. The step a player is proudest of leads, which is
        // the same argument the ordering above it is made of.
        a.rank - b.rank,
    )
}
