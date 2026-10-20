import { describe, expect, it } from 'vitest'

import { CARD_GAP, PIE_SIZE } from '@/constants/game'
import {
  DRILL_MIN_SIZE,
  drillFor,
  drillPlaces,
  drillSize,
  drillValues,
  type DrillPlace,
} from '@/lib/drill'
import { NINE_DIAL } from '@/modes'

// One literal session id, and the nine it must always deal.
//
// The whole point of this file. A drill is a promise made to a window that is already
// open: change the hash, the generator, or the order anything is drawn in, and every
// player part-way through learning a session's nine finds a different nine, with the
// standings behind them still claiming to be about the old ones. These literals are
// what makes that change a failing test rather than a silent one.
const SEED = '3f8a1c2e-5b4d-4e7a-9c01-6d2f8b3a7e45'

describe('drillValues', () => {
  it('deals the same nine for a session id, in the same order, every time', () => {
    const first = drillValues(SEED, NINE_DIAL, 9)
    expect(first).toEqual(drillValues(SEED, NINE_DIAL, 9))
    // Written out rather than snapshotted, and that is the point: `vitest -u` rewrites a
    // snapshot without anybody reading the diff, which is precisely the silent change
    // this test exists to catch. These nine are the contract — if they have to be
    // edited, a live session's targets moved under its players.
    expect(first).toEqual([145, 82, 261, 43, 24, 313, 205, 3, 278])
  })

  it('deals a different nine for a different session', () => {
    const other = '0b17d9e4-2a3c-4f58-8e6b-1c9d4a7f2b30'
    expect(drillValues(SEED, NINE_DIAL, 9)).not.toEqual(drillValues(other, NINE_DIAL, 9))
  })

  it('never repeats a value and never deals nought', () => {
    const values = drillValues(SEED, NINE_DIAL, 9)
    expect(new Set(values).size).toBe(9)
    expect(values).not.toContain(0)
  })

  it('stays inside the range the dial reaches', () => {
    for (const value of drillValues(SEED, NINE_DIAL, 9)) {
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThanOrEqual(NINE_DIAL.maxSum)
    }
  })
})

describe('drillSize', () => {
  it('never draws a card bigger than every other mode draws', () => {
    expect(drillSize(9, 2000, 2000)).toBe(PIE_SIZE)
  })

  it('shrinks the card when nine will not fit the canvas', () => {
    expect(drillSize(9, 320, 300)).toBeLessThan(PIE_SIZE)
  })

  it('never shrinks past the size a three-digit target is readable at', () => {
    expect(drillSize(9, 120, 100)).toBe(DRILL_MIN_SIZE)
  })

  it('answers with a size nine cards could actually be arranged at', () => {
    // The bug this replaces: the size came from the canvas *area*, which nine squares
    // can satisfy while being impossible to arrange — three of them cannot fit a box
    // narrower than three of them, however cleverly they are placed.
    const size = drillSize(9, 340, 300)
    expect(size * 3 + CARD_GAP * 4).toBeLessThanOrEqual(340)
    expect(size * 3 + CARD_GAP * 4).toBeLessThanOrEqual(300)
  })
})

// Whether two cards share any pixel. The honest test, and the one the first version of
// this file got wrong: it compared the distance between two cards' top-left corners
// against one card's width, which two squares can satisfy while overlapping by a
// quarter of their area.
const overlap = (a: DrillPlace, b: DrillPlace): boolean =>
  a.at.x < b.at.x + b.size &&
  a.at.x + a.size > b.at.x &&
  a.at.y < b.at.y + b.size &&
  a.at.y + a.size > b.at.y

const pairs = (cards: readonly DrillPlace[]): [DrillPlace, DrillPlace][] =>
  cards.flatMap((a, i) => cards.slice(i + 1).map((b): [DrillPlace, DrillPlace] => [a, b]))

const CANVASES = [
  [340, 300],
  [300, 280],
  [420, 400],
  [280, 240],
  [390, 220],
] as const

describe('drillPlaces', () => {
  it('puts the same cards in the same places on the same canvas, every time', () => {
    expect(drillPlaces(SEED, 9, 340, 300)).toEqual(drillPlaces(SEED, 9, 340, 300))
  })

  it('places every card, in dealing order', () => {
    const cards = drillPlaces(SEED, 9, 340, 300)
    expect(cards).toHaveLength(9)
    expect(cards.map((card) => card.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('never overlaps two cards, on any canvas the app runs at', () => {
    // The assertion the board was failing in front of a player — 64 drawn across 65.
    // Walked over several canvases rather than one, because the arrangement gives up
    // its gap and then its size as the board gets tighter, and the promise has to hold
    // through both.
    for (const [width, height] of CANVASES) {
      for (const [a, b] of pairs(drillPlaces(SEED, 9, width, height))) {
        expect(overlap(a, b)).toBe(false)
      }
    }
  })

  it('keeps every card inside the canvas', () => {
    for (const [width, height] of CANVASES) {
      for (const card of drillPlaces(SEED, 9, width, height)) {
        expect(card.at.x).toBeGreaterThanOrEqual(0)
        expect(card.at.y).toBeGreaterThanOrEqual(0)
        expect(card.at.x + card.size).toBeLessThanOrEqual(width)
        expect(card.at.y + card.size).toBeLessThanOrEqual(height)
      }
    }
  })

  it('draws the cards at different sizes', () => {
    // A board of one repeated circle is nine positions to remember; a board of
    // different circles is one picture.
    const sizes = new Set(drillPlaces(SEED, 9, 340, 300).map((card) => card.size))
    expect(sizes.size).toBeGreaterThan(3)
  })

  it('keeps every card readable', () => {
    for (const card of drillPlaces(SEED, 9, 300, 260)) {
      expect(card.size).toBeGreaterThanOrEqual(DRILL_MIN_SIZE)
      expect(card.size).toBeLessThanOrEqual(PIE_SIZE)
    }
  })

  it('scatters rather than gridding — no two cards share a column or a row', () => {
    const cards = drillPlaces(SEED, 9, 340, 300)
    expect(new Set(cards.map((card) => Math.round(card.at.x))).size).toBe(9)
    expect(new Set(cards.map((card) => Math.round(card.at.y))).size).toBe(9)
  })

  it('moves the places when the canvas changes but not the values', () => {
    expect(drillPlaces(SEED, 9, 300, 280)).not.toEqual(drillPlaces(SEED, 9, 420, 360))
    expect(drillValues(SEED, NINE_DIAL, 9)).toEqual(drillValues(SEED, NINE_DIAL, 9))
  })
})

describe('drillFor', () => {
  const drilled = { spawn: { drill: 9 } }
  const rolling = { spawn: { drill: null } }

  it('answers with nothing for a mode that rolls its targets', () => {
    expect(drillFor(rolling, 'accuracy', 'a-session')).toBeNull()
    expect(drillFor(rolling, 'accuracy', null)).toBeNull()
  })

  it('takes the session as its seed when there is one', () => {
    expect(drillFor(drilled, 'challenge/habit', 'a-session')).toEqual({
      seed: 'a-session',
      count: 9,
    })
  })

  it('still deals a drill with no session at all', () => {
    // The hole this closes. A drilled mode reached any way but the challenge dialog —
    // a mode pill once its window opens, PLAY AGAIN, a dev screen — used to fall back
    // to rolling: random targets, a respawn the instant the board cleared, and a card
    // replaced the moment it was hit. A drilled mode is always drilled; a session only
    // changes *which* nine.
    expect(drillFor(drilled, 'challenge/habit', null)).toEqual({
      seed: 'challenge/habit',
      count: 9,
    })
  })

  it('deals a different nine per session, and one of its own with none', () => {
    const one = drillFor(drilled, 'challenge/habit', 'session-one')
    const two = drillFor(drilled, 'challenge/habit', 'session-two')
    const none = drillFor(drilled, 'challenge/habit', null)
    if (one === null || two === null || none === null) throw new Error('all drilled')
    const nine = (seed: string) => drillValues(seed, NINE_DIAL, 9)
    expect(nine(one.seed)).not.toEqual(nine(two.seed))
    expect(nine(none.seed)).not.toEqual(nine(one.seed))
  })
})
