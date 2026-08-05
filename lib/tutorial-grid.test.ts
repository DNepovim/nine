import { describe, expect, it } from 'vitest'

import {
  cellWeight,
  dialCell,
  dialValue,
  emptyCells,
  setCell,
  sumCells,
} from './tutorial-grid'

describe('dialValue', () => {
  it('steps up and down', () => {
    expect(dialValue(4, 1)).toBe(5)
    expect(dialValue(4, -1)).toBe(3)
  })

  it('wraps at both ends', () => {
    expect(dialValue(9, 1)).toBe(0)
    expect(dialValue(0, -1)).toBe(9)
  })
})

describe('cellWeight', () => {
  it('weights the top-left cell ×1 and the bottom-right ×9', () => {
    expect(cellWeight(0)).toBe(1)
    expect(cellWeight(8)).toBe(9)
  })

  it('matches row order × column order for every cell', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(cellWeight)).toEqual([
      1, 2, 3, 2, 4, 6, 3, 6, 9,
    ])
  })
})

describe('emptyCells', () => {
  it('returns nine zeroes', () => {
    expect(emptyCells()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('sumCells', () => {
  it('is zero for an empty grid', () => {
    expect(sumCells(emptyCells())).toBe(0)
  })

  it('weights each cell by its position', () => {
    expect(sumCells(setCell(emptyCells(), 0, 9))).toBe(9)
    expect(sumCells(setCell(emptyCells(), 8, 9))).toBe(81)
  })

  it('reaches 324 when every cell is maxed', () => {
    expect(sumCells(Array.from({ length: 9 }, () => 9))).toBe(324)
  })

  it('adds the coarse and fine contributions of the strategy lesson', () => {
    const cells = setCell(setCell(emptyCells(), 8, 2), 0, 2)
    expect(sumCells(cells)).toBe(20)
  })
})

describe('dialCell', () => {
  it('adds one to the addressed cell only', () => {
    expect(dialCell(emptyCells(), 4, 1)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0])
  })

  it('wraps 9 up to 0', () => {
    expect(dialCell(setCell(emptyCells(), 0, 9), 0, 1)[0]).toBe(0)
  })

  it('wraps 0 down to 9', () => {
    expect(dialCell(emptyCells(), 0, -1)[0]).toBe(9)
  })

  it('leaves the input untouched', () => {
    const cells = emptyCells()
    dialCell(cells, 0, 1)
    expect(cells[0]).toBe(0)
  })
})

describe('setCell', () => {
  it('replaces the addressed cell', () => {
    expect(setCell(emptyCells(), 2, 9)).toEqual([0, 0, 9, 0, 0, 0, 0, 0, 0])
  })

  it('leaves the input untouched', () => {
    const cells = emptyCells()
    setCell(cells, 2, 9)
    expect(cells[2]).toBe(0)
  })
})
