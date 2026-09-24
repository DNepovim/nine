import { i18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'

import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  groupIds,
  TITLE_MAX,
} from '@/constants/achievements'
import { MAX_MESSAGE_LENGTH } from '@/lib/announcements'
import { emptyCareer, observeHeld, type Career } from '@/lib/career'
import { LOCALES } from '@/lib/i18n/locale'
import type { BoardStanding } from '@/lib/medals'
import { messages as cs } from '@/locales/cs/messages'
import { messages as en } from '@/locales/en/messages'
import { DIFFICULTY_ORDER, type Stats } from '@/machines/game'

import {
  achievementAnnouncement,
  achievementCard,
  earned,
  isEarnedBy,
  NO_RUN,
  progressOf,
  stageProgress,
  type AchievementFacts,
} from './achievements'

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
  it('fits every title in the announcement bar, in every language', () => {
    // Measured from the compiled catalogs rather than the source literals: Czech runs
    // longer than English, and a bar that fits the source is not a bar that fits.
    i18n.load({ en, cs })
    for (const locale of LOCALES) {
      i18n.activate(locale)
      const longest = Math.max(
        ...ACHIEVEMENT_IDS.map((id) => i18n._(ACHIEVEMENTS[id].title).length),
      )
      expect(longest, locale).toBeLessThanOrEqual(TITLE_MAX)
    }
    // The bar's own cap, minus the longest template's prefix. A title that fits TITLE_MAX
    // and not this would mean the two numbers had drifted apart.
    expect(TITLE_MAX + 'Unlocked: '.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
  })

  it('gives every achievement a unique title', () => {
    const titles = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('lends a champion mark only to the achievement that is that mark', () => {
    // 🦉, 🦅 and 👑 mean something everywhere else in the app — one Extreme all-time
    // board, the other, both — so each is worn by exactly the one achievement about it
    // and by nothing else.
    const emblems = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].emblem)
    expect(emblems.filter((e) => e === '🦉')).toEqual(['🦉'])
    expect(emblems.filter((e) => e === '🦅')).toEqual(['🦅'])
    expect(emblems.filter((e) => e === '👑')).toEqual(['👑'])
    expect(ACHIEVEMENTS.theOwl.emblem).toBe('🦉')
    expect(ACHIEVEMENTS.theEagle.emblem).toBe('🦅')
    expect(ACHIEVEMENTS.untouchable.emblem).toBe('👑')
  })

  it('gives every achievement a unique emblem', () => {
    const emblems = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].emblem)
    expect(new Set(emblems).size).toBe(emblems.length)
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
    expect(
      isEarnedBy('upARung', facts({ run: { ...facts().run, mode: 'trainee' } })),
    ).toBe(false)
  })

  it('wants a hit on Extreme, not merely the board opened', () => {
    // Opening the hardest board and bailing is not going into the deep. UP A RUNG
    // still asks only that Hard was played — this is the one that asks for a landing.
    const opened = facts({ run: { ...facts().run, difficulty: 'extreme', hits: 0 } })
    expect(isEarnedBy('intoTheDeep', opened)).toBe(false)

    const landed = facts({ run: { ...facts().run, difficulty: 'extreme', hits: 1 } })
    expect(isEarnedBy('intoTheDeep', landed)).toBe(true)
  })

  it('does not hand it over for a hit on an easier board', () => {
    const hard = facts({ run: { ...facts().run, difficulty: 'hard', hits: 12 } })
    expect(isEarnedBy('intoTheDeep', hard)).toBe(false)
  })

  it('does not count a trainee hit on Extreme', () => {
    // Trainee is unscored practice; it does not put you on a board at all.
    const practice = facts({
      run: { ...facts().run, mode: 'trainee', difficulty: 'extreme', hits: 9 },
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
      isEarnedBy('surgeon', facts({ stats: withBest('accuracy', 'hard', 3000) }), 'hard'),
    ).toBe(true)
  })

  it('keeps the two ladders apart', () => {
    const f = facts({ run: { ...facts().run, mode: 'speed', score: 1200 } })
    expect(isEarnedBy('slipstream', f)).toBe(true)
    expect(isEarnedBy('fineWork', f)).toBe(false)
  })

  it('asks a staged ladder for the board it is being asked about', () => {
    // FINE WORK is 1 000 whichever board; the stage is which board it was met on. A
    // huge score on Hard says nothing about the Extreme stage — that is the whole
    // point of staging, and what MOUNTAINEER used to say on its own.
    const hard = facts({ stats: withBest('accuracy', 'hard', 5000) })
    expect(isEarnedBy('fineWork', hard, 'hard')).toBe(true)
    expect(isEarnedBy('fineWork', hard, 'extreme')).toBe(false)

    const extreme = facts({ stats: withBest('accuracy', 'extreme', 1000) })
    expect(isEarnedBy('fineWork', extreme, 'extreme')).toBe(true)
    // And a harder board never stands in for an easier one.
    expect(isEarnedBy('fineWork', extreme, 'easy')).toBe(false)
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

  it('asks a mastery achievement for the board it is being asked about', () => {
    // The mastery figures are kept per board because the rows are staged: a clean
    // twenty-five on Easy is not a clean twenty-five on Extreme.
    const hard = facts({
      career: career({ bestCleanHitsBy: { easy: 0, hard: 30, extreme: 0 } }),
    })
    expect(isEarnedBy('unscathed', hard, 'hard')).toBe(true)
    expect(isEarnedBy('unscathed', hard, 'easy')).toBe(false)
    expect(isEarnedBy('unscathed', hard, 'extreme')).toBe(false)
  })

  it('clears the stage the run in progress is on, and no other', () => {
    const f = facts({
      run: { ...facts().run, mode: 'speed', difficulty: 'extreme', maxStreak: 10 },
    })
    expect(isEarnedBy('flawlessTen', f, 'extreme')).toBe(true)
    expect(isEarnedBy('flawlessTen', f, 'easy')).toBe(false)
  })

  it('clears no stage from a trainee run', () => {
    // Trainee has no difficulty selector, so the difficulty it carries is not a board.
    const practice = facts({
      run: {
        ...facts().run,
        mode: 'trainee',
        difficulty: 'easy',
        hits: 40,
        cleanHits: 40,
        parHits: 30,
        avgAccuracy: 100,
      },
    })
    for (const stage of DIFFICULTY_ORDER) {
      expect(isEarnedBy('unscathed', practice, stage)).toBe(false)
      expect(isEarnedBy('perfectRoute', practice, stage)).toBe(false)
      expect(isEarnedBy('deadEye', practice, stage)).toBe(false)
    }
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

  it('keeps a board achievement to the difficulty it was reached on', () => {
    // A podium on Easy and a podium on Extreme were the same row until these were
    // staged; the stage is the difficulty, and either mode counts towards it.
    const f = facts({
      standings: [standing({ mode: 'speed', difficulty: 'hard', rank: 3 })],
    })
    expect(isEarnedBy('onTheBoard', f, 'hard')).toBe(true)
    expect(isEarnedBy('onTheBoard', f, 'easy')).toBe(false)
    expect(isEarnedBy('topOfTheBoard', f, 'hard')).toBe(false)
  })

  it('does not hand a medal to a player with no score', () => {
    const f = facts({ standings: [standing({ rank: 1, score: 0 })] })
    expect(isEarnedBy('onTheBoard', f)).toBe(false)
  })

  it("earns a bird for first all-time on that mode's Extreme board", () => {
    const owl = facts({
      standings: [standing({ mode: 'accuracy', difficulty: 'extreme', rank: 1 })],
    })
    expect(isEarnedBy('theOwl', owl)).toBe(true)
    expect(isEarnedBy('theEagle', owl)).toBe(false)
  })

  it('gives no bird for second place, another period or an easier board', () => {
    const second = standing({ mode: 'speed', difficulty: 'extreme', rank: 2 })
    expect(isEarnedBy('theEagle', facts({ standings: [second] }))).toBe(false)
    const today = standing({ mode: 'speed', difficulty: 'extreme', period: 'today' })
    expect(isEarnedBy('theEagle', facts({ standings: [today] }))).toBe(false)
    const hard = standing({ mode: 'speed', difficulty: 'hard' })
    expect(isEarnedBy('theEagle', facts({ standings: [hard] }))).toBe(false)
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
    expect(isEarnedBy('heldSpeed', six, 'extreme')).toBe(false)
    const seven = facts({ career: held, now: new Date('2026-09-17T11:00:00.000Z') })
    expect(isEarnedBy('heldSpeed', seven, 'extreme')).toBe(true)
  })

  it('keeps a HELD achievement to its own board', () => {
    const held = observeHeld(emptyCareer(), ['speed:extreme'], '2026-09-01T10:00:00.000Z')
    const f = facts({ career: held })
    expect(isEarnedBy('heldSpeed', f, 'extreme')).toBe(true)
    expect(isEarnedBy('heldSpeed', f, 'easy')).toBe(false)
    expect(isEarnedBy('heldAccuracy', f, 'extreme')).toBe(false)
  })
})

describe('the secret ones', () => {
  const ended = (over: Partial<AchievementFacts['run']> = {}): AchievementFacts =>
    facts({ run: { ...facts().run, finished: true, ...over } })

  it('earns GOOSE EGG for a scored run that scored nothing', () => {
    expect(isEarnedBy('gooseEgg', ended({ score: 0 }))).toBe(true)
    expect(isEarnedBy('gooseEgg', ended({ score: 10 }))).toBe(false)
    // Trainee keeps no score, so scoring none of it is not the joke.
    expect(isEarnedBy('gooseEgg', ended({ mode: 'trainee', score: 0 }))).toBe(false)
  })

  it('earns IN AND OUT for a run over in seconds', () => {
    expect(isEarnedBy('inAndOut', ended({ elapsedMs: 9_000 }))).toBe(true)
    expect(isEarnedBy('inAndOut', ended({ elapsedMs: 11_000 }))).toBe(false)
  })

  it('earns ROUGH PATCH on the fifth poor run, counting the one just finished', () => {
    const four = career({ poorRunStreak: 4 })
    expect(isEarnedBy('roughPatch', facts({ career: four }))).toBe(false)
    const fifth = facts({
      career: four,
      run: { ...facts().run, finished: true, score: 0 },
    })
    expect(isEarnedBy('roughPatch', fifth)).toBe(true)
    const good = facts({
      career: four,
      run: { ...facts().run, finished: true, score: 900 },
    })
    expect(isEarnedBy('roughPatch', good)).toBe(false)
  })

  it('earns SCENIC ROUTE for a slow twenty in Speed, mid-run', () => {
    const slow = facts({
      run: { ...facts().run, mode: 'speed', hits: 20, avgSpeed: 12 },
    })
    expect(isEarnedBy('scenicRoute', slow)).toBe(true)
    const quick = facts({
      run: { ...facts().run, mode: 'speed', hits: 20, avgSpeed: 55 },
    })
    expect(isEarnedBy('scenicRoute', quick)).toBe(false)
    const wrongMode = facts({
      run: { ...facts().run, mode: 'accuracy', hits: 20, avgSpeed: 12 },
    })
    expect(isEarnedBy('scenicRoute', wrongMode)).toBe(false)
  })

  it('earns ETERNAL STUDENT for half an hour of practice', () => {
    const long = facts({ run: { ...facts().run, mode: 'trainee', elapsedMs: 1_900_000 } })
    expect(isEarnedBy('eternalStudent', long)).toBe(true)
    const scored = facts({ run: { ...facts().run, mode: 'speed', elapsedMs: 1_900_000 } })
    expect(isEarnedBy('eternalStudent', scored)).toBe(false)
  })

  it('earns TOUCH GRASS from the longest run ever, this one included', () => {
    expect(
      isEarnedBy('touchGrass', facts({ career: career({ longestRunMs: 3_700_000 }) })),
    ).toBe(true)
    expect(isEarnedBy('touchGrass', ended({ elapsedMs: 3_700_000 }))).toBe(true)
    expect(isEarnedBy('touchGrass', ended({ elapsedMs: 600_000 }))).toBe(false)
  })

  it('earns ROUND NUMBER only on an exact thousand', () => {
    expect(isEarnedBy('roundNumber', ended({ score: 3000 }))).toBe(true)
    expect(isEarnedBy('roundNumber', ended({ score: 3001 }))).toBe(false)
    // Nothing is not a round number, it is nothing — GOOSE EGG has that one.
    expect(isEarnedBy('roundNumber', ended({ score: 0 }))).toBe(false)
  })

  it('earns PALINDROME on four digits or more that read both ways', () => {
    expect(isEarnedBy('palindrome', ended({ score: 1221 }))).toBe(true)
    expect(isEarnedBy('palindrome', ended({ score: 12321 }))).toBe(true)
    expect(isEarnedBy('palindrome', ended({ score: 1234 }))).toBe(false)
    expect(isEarnedBy('palindrome', ended({ score: 99 }))).toBe(false)
  })

  it('earns NINE NINE NINE on the 999th target of a career', () => {
    const nearly = career({ hits: 990 })
    expect(isEarnedBy('nineNineNine', facts({ career: nearly }))).toBe(false)
    const there = facts({ career: nearly, run: { ...facts().run, hits: 9 } })
    expect(isEarnedBy('nineNineNine', there)).toBe(true)
  })

  it('earns GOOD SPORT for five rooms and no wins', () => {
    const played = career({ multiplayerRuns: 5 })
    expect(isEarnedBy('goodSport', facts({ career: played }))).toBe(true)
    const won = career({ multiplayerRuns: 5, multiplayerWins: 1 })
    expect(isEarnedBy('goodSport', facts({ career: won }))).toBe(false)
  })

  it('earns NO JOKE only on the first of April', () => {
    const on = (iso: string): AchievementFacts => {
      const day = new Date(iso)
      day.setHours(12, 0, 0, 0)
      return ended({ endedAt: day })
    }
    expect(isEarnedBy('noJoke', on('2027-04-01'))).toBe(true)
    expect(isEarnedBy('noJoke', on('2027-04-02'))).toBe(false)
    expect(isEarnedBy('noJoke', on('2027-01-04'))).toBe(false)
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
    const ids = earned(f).map((award) => award.id)
    expect(ids.indexOf('firstHit')).toBeLessThan(ids.indexOf('tenRuns'))
  })
})

describe('between runs', () => {
  // The intro screen is not a run. The machine still holds the last run's score, hits and
  // streak there — it clears them as the next run starts — while the mode and difficulty
  // follow the selector the player is tapping. `NO_RUN` is what the rules are handed
  // instead, and every case below was earned on a board nobody had played.

  it('does not clear a score ladder on the board the selector is showing', () => {
    // 15 000 in Accuracy on Easy, then HOME, then Speed and Extreme on the selector.
    const played = facts({
      run: { ...facts().run, mode: 'speed', difficulty: 'extreme', score: 15000 },
    })
    expect(isEarnedBy('terminalVelocity', played, 'extreme')).toBe(true)
    expect(isEarnedBy('terminalVelocity', facts({ run: NO_RUN }), 'extreme')).toBe(false)
  })

  it('does not land a hit on Extreme by selecting Extreme', () => {
    expect(isEarnedBy('intoTheDeep', facts({ run: NO_RUN }), 'speed')).toBe(false)
  })

  it('does not carry the last run’s streak onto another board', () => {
    expect(isEarnedBy('maxMultiplier', facts({ run: NO_RUN }), 'extreme')).toBe(false)
  })

  it('does not play a mode by tapping its tab', () => {
    const f = facts({
      career: career({ modesPlayed: ['trainee', 'accuracy'] }),
      run: NO_RUN,
    })
    expect(isEarnedBy('allThree', f)).toBe(false)
    expect(progressOf('allThree', f)).toBe(0)
  })

  it('does not play a Hard board by selecting one', () => {
    expect(isEarnedBy('upARung', facts({ run: NO_RUN }))).toBe(false)
  })

  it('still earns everything the career and the stats answer for', () => {
    // Nothing is lost by dropping the run: a finished one is in the career and the stats
    // by the time this pass runs, which is what makes the ladders retroactive at all.
    const f = facts({ stats: withBest('speed', 'easy', 15000), run: NO_RUN })
    expect(isEarnedBy('terminalVelocity', f, 'easy')).toBe(true)
    expect(isEarnedBy('terminalVelocity', f, 'hard')).toBe(false)
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

describe('stageProgress', () => {
  it('differs per board for a staged achievement', () => {
    // The three bars under a staged row read this. A big score on Hard must not fill
    // the Extreme bar — that is the same rule the stages themselves keep.
    const f = facts({ stats: withBest('accuracy', 'hard', 600) })
    // Every stage of both axes, so one shape answers for a row staged either way. The
    // mode keys are zero here because FINE WORK is staged by board: its rule reads a
    // difficulty, and there is no such thing as its progress on Accuracy.
    expect(stageProgress('fineWork', f)).toStrictEqual({
      easy: 0,
      hard: 600,
      extreme: 0,
      accuracy: 0,
      speed: 0,
    })
  })

  it('answers the same on every board for an unstaged one', () => {
    // FIRST HIT counts career hits and never looks at the board, so one bar is drawn
    // and all three answers agree.
    const f = facts({ career: career({ hits: 1 }) })
    const p = stageProgress('firstHit', f)
    expect(p.easy).toBe(p.hard)
    expect(p.hard).toBe(p.extreme)
  })

  it('clamps to the target, so a bar can never overrun', () => {
    const f = facts({ stats: withBest('accuracy', 'easy', 99999) })
    expect(stageProgress('fineWork', f).easy).toBe(1000)
  })
})

describe('achievementCard', () => {
  it('opens on the one that was asked about', () => {
    const awards = [
      { id: 'firstHit', stage: null },
      { id: 'fineWork', stage: 'easy' },
    ] as const
    expect(achievementCard(awards, 'fineWork')).toEqual({
      ids: ['firstHit', 'fineWork'],
      start: 1,
    })
  })

  it('gives two stages of one achievement a single page', () => {
    const awards = [
      { id: 'fineWork', stage: 'easy' },
      { id: 'fineWork', stage: 'hard' },
    ] as const
    expect(achievementCard(awards, 'fineWork')).toEqual({ ids: ['fineWork'], start: 0 })
  })

  it('opens one that is not in the list on its own', () => {
    expect(achievementCard([{ id: 'firstHit', stage: null }], 'fineWork')).toEqual({
      ids: ['fineWork'],
      start: 0,
    })
  })

  it('answers a run that earned nothing', () => {
    expect(achievementCard([], 'firstHit')).toEqual({ ids: ['firstHit'], start: 0 })
  })
})

describe('achievementAnnouncement', () => {
  it('names the achievement with its emblem and shouts its title', () => {
    i18n.load({ en, cs })
    i18n.activate('en')
    const announcement = achievementAnnouncement('firstHit', 0)
    expect(announcement.id).toBe('achievement')
    expect(announcement.message).toBe(
      `${ACHIEVEMENTS.firstHit.emblem} FIRST HIT achieved`,
    )
  })

  it('carries the achievement itself, so the bar can open its card', () => {
    expect(achievementAnnouncement('firstHit', 0).achievement).toBe('firstHit')
  })

  it('fits the bar for every achievement, in every language', () => {
    // The end of what the title cap is for: TITLE_MAX bounds the title, this bounds the
    // line the bar actually draws, emblem and wording included.
    i18n.load({ en, cs })
    for (const locale of LOCALES) {
      i18n.activate(locale)
      for (const id of ACHIEVEMENT_IDS) {
        const { message } = achievementAnnouncement(id, 0)
        expect(message.length, `${locale} ${id}`).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
      }
    }
  })
})
