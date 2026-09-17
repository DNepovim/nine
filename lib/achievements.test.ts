import { describe, expect, it } from 'vitest'

import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  groupIds,
  TITLE_MAX,
  type AchievementId,
} from '@/constants/achievements'
import { MAX_MESSAGE_LENGTH } from '@/lib/announcements'
import { emptyCareer, observeHeld, type Career } from '@/lib/career'
import type { BoardStanding } from '@/lib/medals'
import type { Stats } from '@/machines/game'

import { earned, isEarnedBy, progressOf, type AchievementFacts } from './achievements'

const emptyStats = (): Stats => {
  const board = { score: 0, hits: 0 }
  const perDifficulty = () => ({ easy: board, hard: board, extreme: board })
  return {
    trainee: perDifficulty(),
    accuracy: perDifficulty(),
    speed: perDifficulty(),
  }
}

const withBest = (
  mode: 'accuracy' | 'speed',
  difficulty: 'easy' | 'hard' | 'extreme',
  score: number,
): Stats => {
  const stats = emptyStats()
  return { ...stats, [mode]: { ...stats[mode], [difficulty]: { score, hits: 0 } } }
}

const facts = (over: Partial<AchievementFacts> = {}): AchievementFacts => ({
  career: emptyCareer(),
  stats: emptyStats(),
  run: {
    mode: 'accuracy',
    difficulty: 'easy',
    score: 0,
    hits: 0,
    maxStreak: 0,
    cleanHits: 0,
    parHits: 0,
    longestRoute: 0,
    elapsedMs: 0,
    avgAccuracy: 0,
    avgSpeed: 0,
    personalBest: false,
    finished: false,
    endedAt: new Date('2026-09-17T12:00:00.000Z'),
  },
  standings: [],
  crown: false,
  crossed: [],
  tutorialDone: false,
  now: new Date('2026-09-17T12:00:00.000Z'),
  ...over,
})

const career = (over: Partial<Career> = {}): Career => ({ ...emptyCareer(), ...over })

const standing = (over: Partial<BoardStanding> = {}): BoardStanding => ({
  mode: 'accuracy',
  difficulty: 'easy',
  period: 'ever',
  rank: 1,
  score: 900,
  ...over,
})

describe('the catalogue', () => {
  it('fits every title in the announcement bar', () => {
    const longest = Math.max(
      ...ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].title.length),
    )
    expect(longest).toBeLessThanOrEqual(TITLE_MAX)
    // The bar's own cap, minus the longest template's prefix. A title that fits TITLE_MAX
    // and not this would mean the two numbers had drifted apart.
    expect(TITLE_MAX + 'Unlocked: '.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
  })

  it('gives every achievement a unique title', () => {
    const titles = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('never wears an emblem the app already owns', () => {
    // 🦉 and 🦅 are the game-over screen's Extreme all-time birds, and the crown belongs
    // to the achievement that *is* the crown.
    const emblems = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].emblem)
    expect(emblems).not.toContain('🦉')
    expect(emblems).not.toContain('🦅')
    expect(emblems.filter((e) => e === '👑')).toEqual(['👑'])
  })

  it('puts every id in exactly one group', () => {
    const grouped = ACHIEVEMENT_GROUPS.flatMap((group) => groupIds(group))
    // Order-insensitive: the groups partition the catalogue, but a group's own order is
    // the catalogue's, not this comparison's business.
    expect(new Set(grouped)).toEqual(new Set(ACHIEVEMENT_IDS))
    expect(grouped).toHaveLength(ACHIEVEMENT_IDS.length)
  })
})

describe('first steps', () => {
  it('earns FIRST HIT on the first target of the first run', () => {
    expect(isEarnedBy('firstHit', facts({ run: { ...facts().run, hits: 1 } }))).toBe(true)
  })

  it('earns FIRST HIT retroactively from a career that already has hits', () => {
    expect(isEarnedBy('firstHit', facts({ career: career({ hits: 400 }) }))).toBe(true)
  })

  it('earns ALL THREE only once every mode has been played', () => {
    const two = facts({
      career: career({ modesPlayed: ['trainee', 'accuracy'] }),
      run: { ...facts().run, mode: 'accuracy' },
    })
    expect(isEarnedBy('allThree', two)).toBe(false)
    const three = facts({
      career: career({ modesPlayed: ['trainee', 'accuracy'] }),
      run: { ...facts().run, mode: 'speed' },
    })
    expect(isEarnedBy('allThree', three)).toBe(true)
  })

  it('does not count a trainee run as having played a difficulty', () => {
    const practice = facts({
      run: { ...facts().run, mode: 'trainee', difficulty: 'extreme' },
    })
    expect(isEarnedBy('intoTheDeep', practice)).toBe(false)
  })
})

describe('the score ladders', () => {
  it('earns an accuracy rung from the run in progress', () => {
    const f = facts({ run: { ...facts().run, mode: 'accuracy', score: 1200 } })
    expect(isEarnedBy('fineWork', f)).toBe(true)
    expect(isEarnedBy('surgeon', f)).toBe(false)
  })

  it('earns an accuracy rung retroactively from a stored best', () => {
    expect(
      isEarnedBy('surgeon', facts({ stats: withBest('accuracy', 'hard', 3000) })),
    ).toBe(true)
  })

  it('keeps the two ladders apart', () => {
    const f = facts({ run: { ...facts().run, mode: 'speed', score: 1200 } })
    expect(isEarnedBy('slipstream', f)).toBe(true)
    expect(isEarnedBy('fineWork', f)).toBe(false)
  })

  it('earns MOUNTAINEER only on the Accuracy Extreme board', () => {
    expect(
      isEarnedBy('mountaineer', facts({ stats: withBest('accuracy', 'hard', 5000) })),
    ).toBe(false)
    expect(
      isEarnedBy('mountaineer', facts({ stats: withBest('accuracy', 'extreme', 1000) })),
    ).toBe(true)
  })
})

describe('mastery', () => {
  it('earns MAX MULTIPLIER at the third streak, where ×8 caps', () => {
    const f = (maxStreak: number) => facts({ run: { ...facts().run, maxStreak } })
    expect(isEarnedBy('maxMultiplier', f(2))).toBe(false)
    expect(isEarnedBy('maxMultiplier', f(3))).toBe(true)
  })

  it('earns UNSCATHED from a clean stretch, not from a finished run', () => {
    expect(
      isEarnedBy('unscathed', facts({ run: { ...facts().run, cleanHits: 25 } })),
    ).toBe(true)
  })

  it('refuses DEAD EYE on a run too short to have an average', () => {
    const short = facts({ run: { ...facts().run, hits: 8, avgAccuracy: 100 } })
    expect(isEarnedBy('deadEye', short)).toBe(false)
    const long = facts({ run: { ...facts().run, hits: 20, avgAccuracy: 95 } })
    expect(isEarnedBy('deadEye', long)).toBe(true)
  })
})

describe('endurance', () => {
  it('counts the run in progress towards the lifetime hits', () => {
    const f = facts({ career: career({ hits: 995 }), run: { ...facts().run, hits: 5 } })
    expect(isEarnedBy('thousandHits', f)).toBe(true)
  })

  it('counts a finished run towards the run total, and an unfinished one not', () => {
    const nine = career({ runs: 9 })
    expect(isEarnedBy('tenRuns', facts({ career: nine }))).toBe(false)
    expect(
      isEarnedBy(
        'tenRuns',
        facts({ career: nine, run: { ...facts().run, finished: true } }),
      ),
    ).toBe(true)
  })

  it('earns a day streak during the run that continues it', () => {
    const yesterday = career({ lastDay: '2026-09-16', dayStreak: 1 })
    expect(isEarnedBy('twoInARow', facts({ career: yesterday }))).toBe(true)
  })

  it('does not earn a day streak after a gap', () => {
    const lastWeek = career({ lastDay: '2026-09-01', dayStreak: 6 })
    expect(isEarnedBy('twoInARow', facts({ career: lastWeek }))).toBe(false)
  })

  it('earns ALL SIX BOARDS as the last board is opened', () => {
    const five = career({
      boardsPlayed: [
        'accuracy:easy',
        'accuracy:hard',
        'accuracy:extreme',
        'speed:easy',
        'speed:hard',
      ],
    })
    expect(isEarnedBy('allSixBoards', facts({ career: five }))).toBe(false)
    const f = facts({
      career: five,
      run: { ...facts().run, mode: 'speed', difficulty: 'extreme', score: 10 },
    })
    expect(isEarnedBy('allSixBoards', f)).toBe(true)
  })
})

describe('boards', () => {
  it('earns TOP OF THE BOARD from a gold on any period', () => {
    const f = facts({ standings: [standing({ period: 'today', rank: 1 })] })
    expect(isEarnedBy('topOfTheBoard', f)).toBe(true)
  })

  it('does not hand a medal to a player with no score', () => {
    const f = facts({ standings: [standing({ rank: 1, score: 0 })] })
    expect(isEarnedBy('onTheBoard', f)).toBe(false)
  })

  it('earns EARLY BIRD from opening the day or the week', () => {
    expect(isEarnedBy('earlyBird', facts({ crossed: ['weekFirst'] }))).toBe(true)
    expect(isEarnedBy('earlyBird', facts({ crossed: ['record'] }))).toBe(false)
  })
})

describe('held boards', () => {
  it('earns a HELD board after seven whole days', () => {
    const held = observeHeld(emptyCareer(), ['speed:extreme'], '2026-09-10T10:00:00.000Z')
    const six = facts({ career: held, now: new Date('2026-09-16T22:00:00.000Z') })
    expect(isEarnedBy('heldSpeedExtreme', six)).toBe(false)
    const seven = facts({ career: held, now: new Date('2026-09-17T11:00:00.000Z') })
    expect(isEarnedBy('heldSpeedExtreme', seven)).toBe(true)
  })

  it('keeps a HELD achievement to its own board', () => {
    const held = observeHeld(emptyCareer(), ['speed:extreme'], '2026-09-01T10:00:00.000Z')
    const f = facts({ career: held })
    expect(isEarnedBy('heldSpeedExtreme', f)).toBe(true)
    expect(isEarnedBy('heldAccExtreme', f)).toBe(false)
  })
})

describe('secret', () => {
  it('earns NIGHT SHIFT only on a finished run in the small hours', () => {
    const at = (hour: number) => {
      const d = new Date('2026-09-17T12:00:00.000Z')
      d.setHours(hour, 30, 0, 0)
      return d
    }
    expect(
      isEarnedBy(
        'nightShift',
        facts({ run: { ...facts().run, finished: true, endedAt: at(3) } }),
      ),
    ).toBe(true)
    expect(
      isEarnedBy(
        'nightShift',
        facts({ run: { ...facts().run, finished: true, endedAt: at(9) } }),
      ),
    ).toBe(false)
    // Mid-run it cannot be known: the run has not ended yet.
    expect(
      isEarnedBy('nightShift', facts({ run: { ...facts().run, endedAt: at(3) } })),
    ).toBe(false)
  })
})

describe('earned', () => {
  it('returns nothing at all for a fresh install that has not played', () => {
    expect(earned(facts())).toEqual([])
  })

  it('returns ids in catalogue order', () => {
    const f = facts({ career: career({ hits: 1, runs: 10 }), tutorialDone: true })
    const ids: AchievementId[] = earned(f)
    expect(ids.indexOf('firstHit')).toBeLessThan(ids.indexOf('tenRuns'))
  })
})

describe('progressOf', () => {
  it('counts towards a target', () => {
    expect(progressOf('thousandHits', facts({ career: career({ hits: 340 }) }))).toBe(340)
  })

  it('clamps at the target rather than running past it', () => {
    expect(progressOf('thousandHits', facts({ career: career({ hits: 9999 }) }))).toBe(
      1000,
    )
  })

  it('answers zero for an achievement with nothing to count', () => {
    expect(progressOf('graduate', facts({ tutorialDone: true }))).toBe(0)
  })
})
