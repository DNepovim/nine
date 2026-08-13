import { describe, expect, it } from 'vitest'

import { medalPeriods } from './record-medals'

describe('medalPeriods', () => {
  it('gives no medal to a run that crossed nothing', () => {
    expect(medalPeriods([])).toEqual([])
  })

  it('names the board a record was taken on', () => {
    expect(medalPeriods(['today'])).toEqual(['today'])
  })

  it('orders the boards biggest first, however they arrived', () => {
    expect(medalPeriods(['today', 'ever', 'week'])).toEqual(['ever', 'week', 'today'])
  })

  it('counts opening an empty board as leading it', () => {
    expect(medalPeriods(['todayFirst', 'weekFirst'])).toEqual(['week', 'today'])
  })

  it('gives one medal for a board both taken and opened', () => {
    expect(medalPeriods(['week', 'weekFirst'])).toEqual(['week'])
  })

  it('gives no medal for a personal best — no board knows about it', () => {
    expect(medalPeriods(['record'])).toEqual([])
  })

  it('gives no medal for what a rival did', () => {
    expect(medalPeriods(['everRaised', 'todayLost'])).toEqual([])
  })
})
