import { setupI18n } from '@lingui/core'
import type { MessageDescriptor } from '@lingui/core'
import { describe, expect, it } from 'vitest'

import type { Translate } from '@/lib/prose'
import type { Award } from '@/lib/winnings'
import { awardBlocks } from '@/lib/winnings-announcement'
import { ALL_PHRASINGS, blockSentence, winningsSentences } from '@/lib/winnings-lines'
import { messages as cs } from '@/locales/cs/messages'
import { messages as en } from '@/locales/en/messages'

// An instance per locale rather than activating one on the shared `i18n`: two resolvers are
// alive at once here, and a shared instance would mean the last `activate` decided what both
// of them returned.
const resolverFor = (locale: 'en' | 'cs'): Translate => {
  const scoped = setupI18n({ locale, messages: { en, cs } })
  return (descriptor: MessageDescriptor) => scoped._(descriptor)
}

const t = resolverFor('en')

const won = (
  mode: Award['mode'],
  difficulty: Award['difficulty'],
  score: number,
  wonOn: string,
  period: Award['period'] = 'day',
  rank: Award['rank'] = 1,
): Award => ({ period, mode, difficulty, wonOn, score, rank })

const textOf = (sentence: readonly { text: string }[]): string =>
  sentence.map((segment) => segment.text).join('')

describe('blockSentence', () => {
  it('tells a single board with the date and the score it was taken with', () => {
    const [block] = awardBlocks([won('speed', 'extreme', 31219, '2026-10-05')])
    expect(block).toBeDefined()
    if (block === undefined) return
    expect(textOf(blockSentence(block, t) ?? [])).toBe(
      'On 5 Oct you took SPD EXT with 31,219.',
    )
  })

  it('joins two boards with "and" rather than a comma', () => {
    const [block] = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05'),
      won('accuracy', 'hard', 9404, '2026-10-05'),
    ])
    expect(block).toBeDefined()
    if (block === undefined) return
    expect(textOf(blockSentence(block, t) ?? [])).toBe(
      'On 5 Oct you took SPD EXT with 31,219 and ACC HRD with 9,404.',
    )
  })

  it('commas every board but the last', () => {
    const [block] = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05'),
      won('accuracy', 'hard', 9404, '2026-10-05'),
      won('speed', 'easy', 6100, '2026-10-05'),
    ])
    expect(block).toBeDefined()
    if (block === undefined) return
    expect(textOf(blockSentence(block, t) ?? [])).toBe(
      'On 5 Oct you took SPD EXT with 31,219, ACC HRD with 9,404 and SPD ESY with 6,100.',
    )
  })

  it('tells a week so it cannot be mistaken for a day', () => {
    const [block] = awardBlocks([won('speed', 'extreme', 29050, '2026-09-14', 'week')])
    expect(block).toBeDefined()
    if (block === undefined) return
    expect(textOf(blockSentence(block, t) ?? [])).toBe(
      'In the week of 14 Sep you took SPD EXT with 29,050.',
    )
  })

  it('colours each board with its own difficulty and leaves the score uncoloured', () => {
    const [block] = awardBlocks([won('speed', 'extreme', 31219, '2026-10-05')])
    expect(block).toBeDefined()
    if (block === undefined) return
    const sentence = blockSentence(block, t) ?? []
    const board = sentence.find((segment) => segment.kind === 'board')
    const score = sentence.find((segment) => segment.kind === 'score')
    expect(board?.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(score?.color).toBeUndefined()
  })

  it('has nothing to say about a window with no awards in it', () => {
    expect(
      blockSentence({ period: 'day', wonOn: '2026-10-05', rank: 1, awards: [] }, t),
    ).toBeNull()
  })
})

describe('the podium in words', () => {
  const sentenceFor = (award: Award, turn = 0): string => {
    const [block] = awardBlocks([award])
    if (block === undefined) return ''
    return textOf(blockSentence(block, t, turn) ?? [])
  }

  it('says a second place rather than calling it a win', () => {
    const text = sentenceFor(won('speed', 'extreme', 31219, '2026-10-05', 'day', 2))
    expect(text).toContain('second')
    expect(text).toContain('SPD EXT with 31,219')
  })

  it('says a third place', () => {
    expect(sentenceFor(won('accuracy', 'hard', 9404, '2026-10-05', 'day', 3))).toContain(
      'third',
    )
  })

  // Every pool is walked, not sampled, so every rotation of a second- or third-place pool
  // has to still be about that step. A variant that read as a win would be the card
  // telling a player they took a board they came third on.
  it('never reads a lesser step as a win, whichever opening it draws', () => {
    for (const period of ['day', 'week'] as const) {
      for (const rank of [2, 3] as const) {
        for (let turn = 0; turn < 6; turn++) {
          const text = sentenceFor(
            won('speed', 'extreme', 31219, '2026-10-05', period, rank),
            turn,
          )
          expect(text, text).not.toContain('was yours')
          expect(text, text).not.toContain('Nobody')
          expect(text, text).not.toContain('you took SPD')
        }
      }
    }
  })

  it('lists three boards of one step under one opening', () => {
    const [block] = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05', 'day', 2),
      won('accuracy', 'hard', 9404, '2026-10-05', 'day', 2),
      won('speed', 'easy', 2000, '2026-10-05', 'day', 2),
    ])
    expect(block).toBeDefined()
    if (block === undefined) return
    const text = textOf(blockSentence(block, t) ?? [])
    // One "second", three boards, one full stop.
    expect(text.match(/second/g)).toHaveLength(1)
    expect(text).toContain(' and ')
    expect(text.endsWith('.')).toBe(true)
  })

  it('gives a day its own sentence per step it placed on', () => {
    const blocks = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05', 'day', 1),
      won('accuracy', 'hard', 9404, '2026-10-05', 'day', 2),
      won('speed', 'easy', 2000, '2026-10-05', 'day', 3),
    ])
    const sentences = winningsSentences(blocks, t).map(textOf)
    expect(sentences).toHaveLength(3)
    // Matched against the whole pool rather than one variant: which opening a step draws
    // is seeded, and pinning the assertion to one of the two would make this test a
    // record of today's seed instead of of the step.
    expect(sentences[1]).toMatch(/second|one place short/)
    expect(sentences[2]).toMatch(/third|on the podium/)
  })
})

describe('winningsSentences', () => {
  it('gives one sentence per window, newest first', () => {
    const blocks = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05'),
      won('accuracy', 'hard', 9404, '2026-10-04'),
      won('speed', 'extreme', 29050, '2026-09-28', 'week'),
    ])
    const sentences = winningsSentences(blocks, t)
    expect(sentences).toHaveLength(3)
    expect(textOf(sentences[0] ?? [])).toContain('5 Oct')
    expect(textOf(sentences[1] ?? [])).toContain('4 Oct')
    expect(textOf(sentences[2] ?? [])).toContain('week of 28 Sep')
  })

  it('keeps each window its own sentence rather than spilling them together', () => {
    const blocks = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05'),
      won('accuracy', 'hard', 9404, '2026-10-04'),
    ])
    // A Sentence is itself an array, so a flatMap here would collapse both windows into one
    // run of segments and the card would draw a single paragraph.
    for (const sentence of winningsSentences(blocks, t)) {
      expect(textOf(sentence).endsWith('.')).toBe(true)
    }
  })
})

describe('the Czech winnings', () => {
  const czech = resolverFor('cs')

  it('names the date the way Czech writes a short one', () => {
    const [block] = awardBlocks([won('speed', 'extreme', 31219, '2026-10-05')])
    expect(block).toBeDefined()
    if (block === undefined) return
    const text = textOf(blockSentence(block, czech) ?? [])
    expect(text).toContain('5. 10.')
    expect(text).not.toContain('Oct')
  })

  it('still joins three boards into one sentence', () => {
    const [block] = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05'),
      won('accuracy', 'hard', 9404, '2026-10-05'),
      won('speed', 'easy', 6100, '2026-10-05'),
    ])
    expect(block).toBeDefined()
    if (block === undefined) return
    const text = textOf(blockSentence(block, czech) ?? [])
    // Three boards, two joins, one full stop — whatever words Czech puts around them.
    expect(text.endsWith('.')).toBe(true)
    expect(text).not.toMatch(/\[\w+\]/)
  })
})

describe('the openings', () => {
  it('never opens two sentences of a card the same way', () => {
    const days = ['2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01']
    const blocks = awardBlocks(
      days.map((day, index) => won('speed', 'extreme', 10000 + index, day)),
    )
    // Every figure out — the day of the month and the score are what these sentences are
    // meant to differ by. What is left is the phrasing, and no two of those may match.
    const openings = winningsSentences(blocks, t).map((sentence) =>
      textOf(sentence).replace(/[\d,]+/g, ''),
    )
    expect(new Set(openings).size).toBe(openings.length)
  })

  it('tells a day and a week apart however it opens them', () => {
    // Every rotation of the week pool, so no variant can quietly read as a day.
    for (let turn = 0; turn < 8; turn++) {
      const [block] = awardBlocks([won('speed', 'extreme', 29050, '2026-09-14', 'week')])
      expect(block).toBeDefined()
      if (block === undefined) return
      expect(textOf(blockSentence(block, t, turn) ?? [])).toContain('week of 14 Sep')
    }
  })

  it('never opens two sentences of one step the same way', () => {
    const days = ['2026-10-05', '2026-10-04', '2026-10-03']
    const blocks = awardBlocks(
      days.map((day, index) => won('speed', 'extreme', 10000 + index, day, 'day', 2)),
    )
    const openings = winningsSentences(blocks, t).map((sentence) =>
      textOf(sentence).replace(/[\d,]+/g, ''),
    )
    // Three windows out of a pool of two: the third wraps onto the first, which is the
    // pool being walked rather than running out.
    expect(new Set(openings).size).toBe(2)
  })

  it('says the same thing to a player who dismisses the popup and opens it again', () => {
    const blocks = awardBlocks([
      won('speed', 'extreme', 31219, '2026-10-05'),
      won('accuracy', 'hard', 9404, '2026-10-04'),
      won('speed', 'extreme', 29050, '2026-09-28', 'week'),
    ])
    const once = winningsSentences(blocks, t).map(textOf)
    const again = winningsSentences(blocks, t).map(textOf)
    expect(again).toEqual(once)
  })
})

describe('the Czech catalog', () => {
  // Sorted so the comparison is about which tokens a variant carries, not the order it
  // uses them in — a Czech sentence puts them where Czech puts them.
  const tokensIn = (text: string): string[] =>
    [...text.matchAll(/\[(\w+)\]/g)]
      .map((match) => match[1] ?? '')
      .sort((a, b) => a.localeCompare(b))

  it('carries every token its English source does', () => {
    const czech = resolverFor('cs')
    for (const phrasing of ALL_PHRASINGS) {
      const source = t(phrasing)
      expect(tokensIn(czech(phrasing)), `translation of: ${source}`).toEqual(
        tokensIn(source),
      )
    }
  })

  it('ends every phrasing with the board it lists, so the clauses after it fit', () => {
    const czech = resolverFor('cs')
    for (const phrasing of ALL_PHRASINGS) {
      expect(czech(phrasing).endsWith('[S]'), czech(phrasing)).toBe(true)
      expect(t(phrasing).endsWith('[S]'), t(phrasing)).toBe(true)
    }
  })
})
