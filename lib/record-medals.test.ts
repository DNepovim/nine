import { describe, expect, it } from 'vitest'

import { heldPeriods, medalPeriods } from './record-medals'

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

describe('heldPeriods', () => {
  const records = { ever: 900, week: 700, today: 500 }

  it('keeps a medal the run still leads', () => {
    expect(heldPeriods(['today'], 500, records)).toEqual(['today'])
  })

  it('drops a medal a rival took while the run was still going', () => {
    expect(heldPeriods(['today'], 400, records)).toEqual([])
  })

  it('keeps a claim on a record it could not read', () => {
    expect(heldPeriods(['today'], 10, { ...records, today: null })).toEqual(['today'])
  })

  it('checks each board on its own', () => {
    expect(heldPeriods(['ever', 'week', 'today'], 800, records)).toEqual([
      'week',
      'today',
    ])
  })

  it('has nothing to check when the run took nothing', () => {
    expect(heldPeriods([], 5000, records)).toEqual([])
  })
})
