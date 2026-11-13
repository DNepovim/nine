import { describe, expect, it } from 'vitest'

import { list, percent, seconds } from './knowledge-figures'

describe('seconds', () => {
  it('writes a clock to a tenth of a second', () => {
    expect(seconds(4250)).toBe('4.3s')
    expect(seconds(0)).toBe('0.0s')
  })
})

describe('percent', () => {
  it('rounds a share to a whole percent', () => {
    expect(percent(0.125)).toBe('13%')
    expect(percent(1)).toBe('100%')
  })
})

describe('list', () => {
  it('writes figures one after another, slashed', () => {
    expect(list([1, 0.5, 0.1])).toBe('1 / 0.5 / 0.1')
    expect(list([])).toBe('')
  })
})
