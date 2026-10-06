import { describe, expect, it } from 'vitest'

import { DIFFICULTY_ORDER, type Headline } from '@/modes'

import { emptyBoardLine } from './empty-board'
import type { LeaderboardTab } from './leaderboard-period'

const HEADLINES: Headline[] = ['acc', 'spd']
const TABS: LeaderboardTab[] = ['today', 'week', 'forever']

const everyLine = () =>
  HEADLINES.flatMap((headline) =>
    DIFFICULTY_ORDER.flatMap((difficulty) =>
      TABS.map((tab) => emptyBoardLine(headline, difficulty, tab).message ?? ''),
    ),
  )

describe('emptyBoardLine', () => {
  it('answers for every board and period', () => {
    for (const line of everyLine()) expect(line.length).toBeGreaterThan(0)
  })

  it('says something different on each of them', () => {
    const lines = everyLine()
    expect(new Set(lines).size).toBe(lines.length)
  })

  // The panel is one fixed height in every state (see BODY_HEIGHT in tab-panel.tsx), so
  // a line that wraps is the board growing a row it does not have. Thirty-four characters
  // is what fits on one line of 9px mono at the narrowest width the panel is drawn at.
  it('keeps every line to one line of the panel', () => {
    for (const line of everyLine()) expect(line.length).toBeLessThanOrEqual(34)
  })

  // The same dashes — UNAVAILABLE — and — OFFLINE — wear: a board saying nothing always
  // looks the same, whatever it is saying.
  it('wears the panel dashes', () => {
    for (const line of everyLine()) {
      expect(line.startsWith('— ')).toBe(true)
      expect(line.endsWith(' —')).toBe(true)
    }
  })
})
