import { describe, expect, it } from 'vitest'

import { announcementFor, brokeOwnRecord } from './announcements'

describe('brokeOwnRecord', () => {
  it('is true when the run passes the best it started with', () => {
    expect(brokeOwnRecord(1200, 1000)).toBe(true)
  })

  it('is false while the run is still behind', () => {
    expect(brokeOwnRecord(900, 1000)).toBe(false)
  })

  it('is false when the run only equals the best', () => {
    expect(brokeOwnRecord(1000, 1000)).toBe(false)
  })

  it('is false on a first scoring run — there was no record to break', () => {
    expect(brokeOwnRecord(1200, 0)).toBe(false)
  })

  it('is false before the first hit of a run', () => {
    expect(brokeOwnRecord(0, 1000)).toBe(false)
  })
})

describe('announcementFor', () => {
  it('pairs an id with its message', () => {
    expect(announcementFor('record')).toEqual({
      id: 'record',
      message: 'YOU BEAT YOUR BEST',
    })
  })
})
