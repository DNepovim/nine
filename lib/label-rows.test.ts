import { describe, expect, it } from 'vitest'

import { labelRows, SOFT_HYPHEN } from './label-rows'

describe('labelRows', () => {
  it('gives each word of a name its own row', () => {
    expect(labelRows('FOUR BY FOUR')).toEqual(['FOUR', 'BY', 'FOUR'])
  })

  it('breaks a single word where its soft hyphen says', () => {
    expect(labelRows(`GLIM${SOFT_HYPHEN}PSE`)).toEqual(['GLIM', 'PSE'])
    expect(labelRows(`ZÁ${SOFT_HYPHEN}BLESK`)).toEqual(['ZÁ', 'BLESK'])
  })

  it('leaves a name with no break as one row', () => {
    expect(labelRows('HABIT')).toEqual(['HABIT'])
  })

  it('never produces an empty row', () => {
    expect(labelRows(`  FOUR   KEYS ${SOFT_HYPHEN}`)).toEqual(['FOUR', 'KEYS'])
  })
})
