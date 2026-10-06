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
import type { Award } from '@/lib/winnings'
import type { AwardBlock } from '@/lib/winnings-announcement'
import { DIFFICULTIES, getDifficultyColor, labelOf } from '@/modes'

// What the player won while they were away, in words.
//
// One window is one sentence: the day or the week, the boards that went their way, and what
// each was taken with. The payout per board is not here on purpose — see the winnings card
// — and neither is the total, which is the card's own last line.
//
// Fixed phrasings, unlike the weekly recap's pools. A recap has six week shapes and says the
// same thing every Monday unless it is given variety; winnings are the player's own and are
// read once, where the thing that matters is being understood rather than being surprising.

// A window's opening clause. The two differ by more than a word so that a week never reads
// as a day — it is worth twice as much and a player should not have to check the date to
// know which they are looking at.
const LEAD = {
  day: msg`On [DATE] you took [B] with [S]`,
  week: msg`In the week of [DATE] you took [B] with [S]`,
} as const

// Boards after the first. Two templates rather than a joined list: a comma and the word
// "and" are punctuation a language owns — Czech writes "A, B a C" — and `Array.join` cannot
// be translated at all. Everything inside each template is the translator's to rearrange.
//
// Both carry their own leading space or comma, which is why neither starts with a letter.
const MORE = msg`, [B] with [S]`
const LAST = msg` and [B] with [S]`

// A board in a sentence: its own name in its own colour, the mode's gradient read at its
// difficulty, exactly as the recap sets one.
const boardSegment = (award: Award, t: Translate): Segment => ({
  text: `${t(labelOf(award.mode))} · ${t(DIFFICULTIES[award.difficulty].label)}`,
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
export function blockSentence(block: AwardBlock, t: Translate): Sentence | null {
  const [first, ...rest] = block.awards
  if (first === undefined) return null

  const lead = fill(t(LEAD[block.period]), {
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
export const winningsSentences = (
  blocks: readonly AwardBlock[],
  t: Translate,
): Sentence[] => blocks.map((block) => blockSentence(block, t)).filter(isNotNull)
