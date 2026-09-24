import { describe, expect, it } from 'vitest'

import {
  dropAnnouncement,
  NOTHING,
  queueAnnouncement,
  type Waiting,
} from './announcement-queue'
import { announcementFor, type AnnouncementId } from './announcements'

const own = (id: AnnouncementId): Waiting => ({
  announcement: announcementFor(id, 0),
  own: true,
})

const theirs = (id: AnnouncementId): Waiting => ({
  announcement: announcementFor(id, 0, 'RIVAL'),
  own: false,
})

const ids = (queue: readonly Waiting[]) => queue.map((waiting) => waiting.announcement.id)

describe('queueAnnouncement', () => {
  it('stacks announcements in the order they arrive', () => {
    const queue = [theirs('todayRaised'), theirs('achievement')].reduce(
      queueAnnouncement,
      NOTHING,
    )
    expect(ids(queue)).toEqual(['todayRaised', 'achievement'])
  })

  it('puts your own records ahead of everything that is not yours', () => {
    const queue = [theirs('achievement'), own('today')].reduce(queueAnnouncement, NOTHING)
    expect(ids(queue)).toEqual(['today', 'achievement'])
  })

  it('keeps two of your own records in the order they were crossed', () => {
    const queue = [own('record'), theirs('achievement'), own('ever')].reduce(
      queueAnnouncement,
      NOTHING,
    )
    expect(ids(queue)).toEqual(['record', 'ever', 'achievement'])
  })
})

describe('dropAnnouncement', () => {
  it('drops the one that took the bar, not the one that jumped ahead of it', () => {
    const waiting = theirs('achievement')
    const queue = [waiting, own('week')].reduce(queueAnnouncement, NOTHING)
    expect(ids(dropAnnouncement(queue, waiting))).toEqual(['week'])
  })
})
