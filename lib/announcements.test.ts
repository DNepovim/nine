import { describe, expect, it } from 'vitest'

import {
  ANNOUNCEMENT_IDS,
  announcementFor,
  crossedRecords,
  hasBoardRecord,
  MAX_MESSAGE_LENGTH,
  messageFor,
  messagePool,
  type RecordTargets,
} from './announcements'

const targets = (over: Partial<RecordTargets> = {}): RecordTargets => ({
  record: 1000,
  today: 2000,
  week: 3000,
  ever: 4000,
  ...over,
})

describe('crossedRecords', () => {
  it('is empty while the run is behind every record', () => {
    expect(crossedRecords(900, targets())).toEqual([])
  })

  it('reports the personal best once passed', () => {
    expect(crossedRecords(1500, targets())).toEqual(['record'])
  })

  it('reports every record passed, biggest first', () => {
    expect(crossedRecords(3500, targets())).toEqual(['week', 'today', 'record'])
  })

  it('reports all four on an all-time run', () => {
    expect(crossedRecords(5000, targets())).toEqual(['ever', 'week', 'today', 'record'])
  })

  it('does not count equalling a record as beating it', () => {
    expect(crossedRecords(2000, targets())).toEqual(['record'])
  })

  it('ignores unknown board records, so offline only leaves the personal best', () => {
    expect(
      crossedRecords(9999, targets({ today: null, week: null, ever: null })),
    ).toEqual(['record'])
  })

  it('ignores a zero record — an untouched board is not a record to beat', () => {
    expect(
      crossedRecords(500, targets({ record: 0, today: 0, week: 0, ever: 0 })),
    ).toEqual([])
  })

  it('handles a board whose records are out of order', () => {
    // Nothing guarantees today <= week <= ever if the boards refreshed at different
    // moments, so the filter must not assume an ordering.
    expect(crossedRecords(2500, targets({ today: 3000, week: 2000 }))).toEqual([
      'week',
      'record',
    ])
  })
})

// What decides whether a crossing is worth publishing to the board mid-run. A
// personal best concerns nobody else, so it must not.
describe('hasBoardRecord', () => {
  it('is false for a personal best alone', () => {
    expect(hasBoardRecord(['record'])).toBe(false)
  })

  it('is false when nothing was crossed', () => {
    expect(hasBoardRecord([])).toBe(false)
  })

  it("is true for today's board", () => {
    expect(hasBoardRecord(['today'])).toBe(true)
  })

  it('is true for the week board', () => {
    expect(hasBoardRecord(['week'])).toBe(true)
  })

  it('is true for the all-time board', () => {
    expect(hasBoardRecord(['ever'])).toBe(true)
  })

  it('is true when a board record came alongside a personal best', () => {
    expect(hasBoardRecord(['ever', 'week', 'today', 'record'])).toBe(true)
  })

  it("is false for a rival's announcement, which is nothing of ours to publish", () => {
    expect(hasBoardRecord(['everRaised', 'todayLost'])).toBe(false)
  })
})

// Straight from the source, so a new announcement is covered by these tests the
// moment it is added rather than when someone remembers to update a list here.
const IDS = ANNOUNCEMENT_IDS

// The longest name displayName will ever produce.
const LONGEST_NAME = 'ABCDEFGHIJ'

// messageFor substitutes the name token, so expectations must be rendered too.
const rendered = (template: string, name = 'SOMEONE') =>
  template.replaceAll('{name}', name)

describe('messageFor', () => {
  it('picks the first line at the bottom of the range', () => {
    for (const id of IDS) {
      expect(messageFor(id, 0)).toBe(rendered(messagePool(id)[0] ?? ''))
    }
  })

  it('picks the last line at the top of the range', () => {
    for (const id of IDS) {
      const pool = messagePool(id)
      expect(messageFor(id, 0.999)).toBe(rendered(pool[pool.length - 1] ?? ''))
    }
  })

  it('spreads evenly across the pool', () => {
    const pool = messagePool('record')
    // Four lines, so each quarter of the range maps to one of them.
    expect(pool.map((_, i) => messageFor('record', (i + 0.5) / pool.length))).toEqual([
      ...pool,
    ])
    // 'record' carries no name token, so its pool renders unchanged.
  })

  it('clamps a roll of exactly 1 rather than falling off the end', () => {
    for (const id of IDS) {
      const pool = messagePool(id)
      expect(messageFor(id, 1)).toBe(rendered(pool[pool.length - 1] ?? ''))
    }
  })

  it('clamps a negative roll', () => {
    expect(messageFor('record', -0.5)).toBe(messagePool('record')[0])
    expect(messageFor('everLost', -0.5)).toBe(rendered(messagePool('everLost')[0] ?? ''))
  })
})

describe('message pools', () => {
  it('gives every record more than one line', () => {
    for (const id of IDS) {
      expect(messagePool(id).length).toBeGreaterThan(1)
    }
  })

  it('has no duplicate lines within a pool', () => {
    for (const id of IDS) {
      const pool = messagePool(id)
      expect(new Set(pool).size).toBe(pool.length)
    }
  })

  it('keeps every line short enough for the bar, once a name is substituted', () => {
    for (const id of IDS) {
      for (const message of messagePool(id)) {
        const rendered = message.replaceAll('{name}', LONGEST_NAME)
        expect(rendered.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
      }
    }
  })

  it('gives every rival announcement a name to say', () => {
    const rivalIds = IDS.filter((id) => id.endsWith('Raised') || id.endsWith('Lost'))
    expect(rivalIds).toHaveLength(6)
    for (const id of rivalIds) {
      for (const message of messagePool(id)) {
        expect(message).toContain('{name}')
      }
    }
  })

  it('leaves your own announcements free of a name token', () => {
    for (const id of ['record', 'today', 'week', 'ever'] as const) {
      for (const message of messagePool(id)) {
        expect(message).not.toContain('{name}')
      }
    }
  })

  it('shouts only the rival name — the prose stays in sentence case', () => {
    for (const id of IDS) {
      for (const message of messagePool(id)) {
        const prose = message.replaceAll('{name}', '')
        // Something in the prose must be lower case, i.e. it is not all shouting.
        expect(prose).not.toBe(prose.toUpperCase())
      }
    }
  })

  it('never mentions speed — these fire in Accuracy too', () => {
    for (const id of IDS) {
      for (const message of messagePool(id)) {
        expect(message).not.toMatch(/FAST|SPEED|QUICK|LIGHTSPEED/i)
      }
    }
  })
})

describe('announcementFor', () => {
  it('pairs an id with a line from its pool', () => {
    for (const id of ['record', 'today', 'week', 'ever'] as const) {
      const announcement = announcementFor(id, 0.5)
      expect(announcement.id).toBe(id)
      expect(messagePool(id)).toContain(announcement.message)
    }
  })

  it('substitutes the rival name', () => {
    expect(announcementFor('everLost', 0.5, 'BOLT').message).toContain('BOLT')
  })

  it('falls back to SOMEONE when no name is supplied', () => {
    expect(messageFor('todayRaised', 0)).toContain('SOMEONE')
  })
})
