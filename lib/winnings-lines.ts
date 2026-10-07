import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { isNotNull } from 'narrowland'

import {
  dayLabel,
  fill,
  plain,
  type Segment,
  type Sentence,
  type Translate,
} from '@/lib/prose'
import { idSeed, seeded } from '@/lib/rng'
import type { Award, WinPeriod } from '@/lib/winnings'
import type { AwardBlock } from '@/lib/winnings-announcement'
import { codeOf, DIFFICULTIES, getDifficultyColor } from '@/modes'

// What the player won while they were away, in words.
//
// One window is one sentence: the day or the week, the boards that went their way, and what
// each was taken with. The payout per board is not here on purpose — see the winnings card
// — and neither is the total, which is the card's own last line.
//
// Unlike the weekly recap, a player reads several of these at once — a week away is four or
// five windows — and that is what the pools below are for. A recap needs variety because it
// comes every Monday and would otherwise say the same thing every Monday; winnings need it
// because the sentences are stacked, and five openings in the same words read as a form
// letter rather than as five things that happened.

// ─── What every phrasing has to end with ────────────────────────────────────────────────
//
// **A lead ends with its first board: `[B] with [S]`.** The clauses that follow it are list
// items joined onto that tail, so a variant that put the score before the board, or ended
// anywhere else, would come apart the moment a window had two boards in it. Everything
// before the tail is the translator's to rearrange.
//
// **A week variant always says the week.** A day is worth half of one, and a player should
// not have to look at the date to know which of the two they are being told about.

type Pool = readonly [MessageDescriptor, ...MessageDescriptor[]]

const LEADS = {
  day: [
    msg`On [DATE] you took [B] with [S]`,
    msg`[DATE] was yours — [B] with [S]`,
    msg`Nobody beat you on [DATE]: [B] with [S]`,
    msg`You finished [DATE] on top of [B] with [S]`,
    msg`[DATE] went your way: [B] with [S]`,
  ],
  week: [
    msg`In the week of [DATE] you took [B] with [S]`,
    msg`The week of [DATE] was yours — [B] with [S]`,
    msg`The week of [DATE] ended in your hands: [B] with [S]`,
    msg`Nobody caught you in the week of [DATE]: [B] with [S]`,
  ],
} as const satisfies Record<WinPeriod, Pool>

// Boards after the first. Two templates rather than a joined list: a comma and the word
// "and" are punctuation a language owns — Czech writes "A, B a C" — and `Array.join` cannot
// be translated at all. Everything inside each template is the translator's to rearrange.
//
// Both carry their own leading space or comma, which is why neither starts with a letter.
// No pool for these: variety belongs to the opening, where two sentences are compared, and
// a list that changed how it punctuated itself halfway down would read as a mistake.
const MORE = msg`, [B] with [S]`
const LAST = msg` and [B] with [S]`

// A board in a sentence: its code rather than its name — "SPD EXT", the same two words the
// profile's medal list and the compare rows put a board in — in its mode's gradient read at
// its difficulty.
//
// Spelled out in full until the card became a stack of sentences. "SPEED · EXTREME" is three
// quarters of a line, and with one in every sentence the card wrapped on all of them; the
// code is the form a player already reads boards in everywhere else they are listed.
const boardSegment = (award: Award, t: Translate): Segment => ({
  text: `${t(codeOf(award.mode))} ${t(DIFFICULTIES[award.difficulty].code)}`,
  kind: 'board',
  color: getDifficultyColor(award.mode, award.difficulty),
})

const scoreSegment = (award: Award): Segment => ({
  text: award.score.toLocaleString(),
  kind: 'score',
})

const clause = (template: string, award: Award, t: Translate): Sentence =>
  fill(template, { B: boardSegment(award, t), S: scoreSegment(award) })

// One block, as one sentence. Null for a block with nothing in it, which the server does not
// send and the card therefore never draws — but a block is a list and an empty one has no
// opening clause to build the rest on.
//
// `turn` picks the opening: the pools are walked rather than sampled, so a card's windows
// come out in different words without two of them ever having to be compared for it. Out of
// range is fine — it wraps.
export function blockSentence(
  block: AwardBlock,
  t: Translate,
  turn = 0,
): Sentence | null {
  const [first, ...rest] = block.awards
  if (first === undefined) return null

  const pool = LEADS[block.period]
  const lead = fill(t(pool[turn % pool.length] ?? pool[0]), {
    DATE: dayLabel(block.wonOn, t),
    B: boardSegment(first, t),
    S: scoreSegment(first),
  })

  // The last board is joined with "and", every one before it with a comma. With a single
  // board neither runs and the lead is the whole sentence.
  const tail = rest.flatMap((award, index) =>
    clause(t(index === rest.length - 1 ? LAST : MORE), award, t),
  )

  // The full stop is appended rather than written into each template: it would otherwise
  // have to appear in three of them and be dropped from two, and a translator cannot see
  // which of those they are holding.
  return [...lead, ...tail, plain('.')]
}

// Every window the player is owed a sentence about, in the order `awardBlocks` already put
// them in: newest first, and biggest first inside each.
// Mapped and filtered rather than flat-mapped: a `Sentence` is itself an array, so
// flattening would spill every block's segments into one long sentence.
//
// Where each window's opening comes from in its pool: a starting offset per period, and then
// one step down the pool per window of that period. Stepping rather than drawing is what
// guarantees the thing the card is actually judged on — that no two sentences in front of
// the player open the same way — which five independent draws could not promise. The offset
// is seeded on the windows themselves, so a popup dismissed and opened again says what it
// said the first time.
export const winningsSentences = (
  blocks: readonly AwardBlock[],
  t: Translate,
): Sentence[] => {
  const rng = seeded(
    idSeed(blocks.map((block) => `${block.period}:${block.wonOn}`).join()),
  )
  const start = {
    day: Math.floor(rng() * LEADS.day.length),
    week: Math.floor(rng() * LEADS.week.length),
  } as const satisfies Record<WinPeriod, number>

  return blocks
    .map((block, index) => {
      // How many windows of this period have already had a sentence. Counted rather than
      // carried along, so this stays a plain map over the blocks — there are never more
      // than a handful of them.
      const earlier = blocks
        .slice(0, index)
        .filter((before) => before.period === block.period).length
      return blockSentence(block, t, start[block.period] + earlier)
    })
    .filter(isNotNull)
}

// Every phrasing, flat. Exported for one thing only: the catalog test, which checks that a
// Czech variant carries the same tokens its English source does. A translation that drops a
// token loses the sentence's subject and says so to nobody.
export const ALL_PHRASINGS: readonly MessageDescriptor[] = [
  ...Object.values(LEADS).flat(),
  MORE,
  LAST,
]
