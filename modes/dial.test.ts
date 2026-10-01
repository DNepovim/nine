import { describe, expect, it } from 'vitest'

import { computePar, parTable } from '@/machines/scoring'

import {
  cellCount,
  cellsOf,
  defineDial,
  emptyGrid,
  NINE_DIAL,
  pressGrid,
  setGrid,
  sumOf,
  weightAt,
  weightRows,
} from '.'

describe('the nine dial', () => {
  it('is the dial the game has always been played on', () => {
    expect(cellCount(NINE_DIAL)).toBe(9)
    expect([...NINE_DIAL.weights]).toEqual([1, 2, 3, 2, 4, 6, 3, 6, 9])
    expect(NINE_DIAL.digits).toBe(10)
    expect(NINE_DIAL.maxSum).toBe(324)
  })

  it('derives a weight from row order × column order', () => {
    expect(weightAt(NINE_DIAL, 0)).toBe(1)
    expect(weightAt(NINE_DIAL, 4)).toBe(4)
    expect(weightAt(NINE_DIAL, 8)).toBe(9)
    // Off the end is nothing rather than a crash.
    expect(weightAt(NINE_DIAL, 99)).toBe(0)
  })

  it('lays the weights back out in rows for the guide', () => {
    expect(weightRows(NINE_DIAL).map((row) => [...row])).toEqual([
      [1, 2, 3],
      [2, 4, 6],
      [3, 6, 9],
    ])
  })

  it('adds the dial up by weight', () => {
    expect(sumOf(NINE_DIAL, emptyGrid(NINE_DIAL))).toBe(0)
    expect(sumOf(NINE_DIAL, [9, 9, 9, 9, 9, 9, 9, 9, 9])).toBe(324)
    expect(sumOf(NINE_DIAL, [6, 2, 8, 2, 6, 2, 5, 4, 8])).toBe(185)
  })

  it('wraps a stepped key at both ends', () => {
    const top = NINE_DIAL.digits - 1
    expect(pressGrid(NINE_DIAL, emptyGrid(NINE_DIAL), 0, 1)[0]).toBe(1)
    expect(pressGrid(NINE_DIAL, emptyGrid(NINE_DIAL), 0, -1)[0]).toBe(top)
    const full = emptyGrid(NINE_DIAL).map(() => top)
    expect(pressGrid(NINE_DIAL, full, 4, 1)[4]).toBe(0)
  })

  it('leaves every other key alone', () => {
    const pressed = pressGrid(NINE_DIAL, emptyGrid(NINE_DIAL), 3, 1)
    expect(pressed).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0])
    expect(setGrid(pressed, 3, 9)).toEqual([0, 0, 0, 9, 0, 0, 0, 0, 0])
  })

  it('counts its keys in the order they are drawn', () => {
    expect(cellsOf(NINE_DIAL)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })
})

// The point of the whole abstraction: a dial nothing in the engine was written for.
describe('a dial the game was not built around', () => {
  const FOUR = defineDial({ id: 'four', rows: 2, cols: 2, weights: [3, 6, 9, 12] })
  const FIVES = defineDial({ id: 'fives', rows: 3, cols: 3, digits: 6 })

  it('derives its ceiling from its weights and its digits', () => {
    expect(FOUR.maxSum).toBe(9 * (3 + 6 + 9 + 12))
    // Nine keys weighted 1…9, each counting to five: 36 × 5.
    expect(FIVES.maxSum).toBe(5 * 36)
    expect(FIVES.maxSum).toBe(180)
  })

  it('opens on as many zeros as it has keys', () => {
    expect(emptyGrid(FOUR)).toEqual([0, 0, 0, 0])
    expect(cellCount(FOUR)).toBe(4)
  })

  it('wraps a key at the ceiling it actually has', () => {
    expect(pressGrid(FIVES, emptyGrid(FIVES), 0, -1)[0]).toBe(5)
    expect(
      pressGrid(
        FIVES,
        emptyGrid(FIVES).map(() => 5),
        0,
        1,
      )[0],
    ).toBe(0)
  })

  it('is solvable by the same scoring DP, with no nines in it', () => {
    // Every weight is a multiple of three, so only multiples of three are reachable.
    expect(computePar(FOUR, emptyGrid(FOUR), 9)).toBe(1)
    expect(computePar(FOUR, emptyGrid(FOUR), 21)).toBe(2)
    const table = parTable(FOUR, emptyGrid(FOUR))
    expect(table[9]).toBe(1)
    expect(table[10]).toBe(Number.POSITIVE_INFINITY)
    // A sum past the ceiling is not reachable, and `computePar` says so with a nought.
    expect(computePar(FOUR, emptyGrid(FOUR), FOUR.maxSum + 1)).toBe(0)
  })

  it('never asks a key for a digit it does not have', () => {
    // The top asks every one of the nine keys for a 5, and on a six-digit key a 5 is one
    // step down from a 0 — the wrap is the key's own range, not a hard-coded ten. Nine
    // keys, one step each.
    expect(computePar(FIVES, emptyGrid(FIVES), FIVES.maxSum)).toBe(9)
  })
})
