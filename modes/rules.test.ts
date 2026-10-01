import { describe, expect, it } from 'vitest'

import { TUTORIAL_LABEL } from '@/constants/tutorial'

import {
  baseClockMs,
  descriptionOf,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getDifficultyColor,
  gradientOf,
  labelOf,
  lerpColor,
  MODE_ORDER,
  rampedTimeout,
  runLabel,
  runRules,
  runSubmode,
  spawnInterval,
  streakMultiplier,
} from '.'

// A mode × rung, resolved the way the engine resolves one.
const rules = (mode: string, difficulty: 'easy' | 'hard' | 'extreme') =>
  runRules(mode, difficulty)

describe('the clock a run starts on', () => {
  it('scales the mode base timeout by the difficulty scale', () => {
    expect(baseClockMs('speed', 'extreme')).toBe(7334) // 14667 * 0.5
    expect(baseClockMs('accuracy', 'easy')).toBe(31900) // 22000 * 1.45
    expect(baseClockMs('accuracy', 'hard')).toBe(16500)
  })

  it('keeps Speed one and a half times faster than Accuracy at every difficulty', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const ratio = baseClockMs('accuracy', difficulty) / baseClockMs('speed', difficulty)
      expect(ratio).toBeCloseTo(1.5, 2)
    }
  })

  it('ignores the rung a mode pins for itself', () => {
    // Trainee fixes Easy, so whatever the intro last had selected changes nothing.
    for (const difficulty of DIFFICULTY_ORDER) {
      expect(baseClockMs('trainee', difficulty)).toBe(baseClockMs('trainee', 'easy'))
    }
  })
})

describe('rampedTimeout', () => {
  const speed = rules('speed', 'hard')
  const base = speed.clock.base

  it('starts a run at the mode timeout', () => {
    expect(rampedTimeout(speed, 0)).toBe(base)
  })

  it('closes half the slack every twelve hits', () => {
    // floor is 55% of base, so 45% of base is up for grabs.
    const floor = base * 0.55
    expect(rampedTimeout(speed, 12)).toBe(Math.round(floor + (base - floor) / 2))
    expect(rampedTimeout(speed, 24)).toBe(Math.round(floor + (base - floor) / 4))
  })

  it('contracts by less and less — the rate itself decays', () => {
    const at = (hits: number) => rampedTimeout(speed, hits)
    const first = at(0) - at(12)
    const second = at(12) - at(24)
    const third = at(24) - at(36)
    expect(second).toBeLessThan(first)
    expect(third).toBeLessThan(second)
    // Each window gives up roughly half of what the one before it did.
    expect(second / first).toBeCloseTo(0.5, 1)
  })

  it('never falls below the floor, however long the run', () => {
    // The curve approaches the floor from above and never crosses it, though
    // rounding lands it exactly on the floor once the gap is sub-millisecond.
    const floor = Math.round(base * 0.55)
    expect(rampedTimeout(speed, 500)).toBe(floor)
    expect(rampedTimeout(speed, 5000)).toBe(floor)
    expect(rampedTimeout(speed, 200)).toBeGreaterThanOrEqual(floor)
  })

  it('decreases monotonically', () => {
    let prev = Number.POSITIVE_INFINITY
    for (let hits = 0; hits <= 100; hits += 5) {
      const next = rampedTimeout(speed, hits)
      expect(next).toBeLessThanOrEqual(prev)
      prev = next
    }
  })

  it('leaves the clock alone in every mode that does not ramp it', () => {
    // Accuracy ramps too, but its spawn gap rather than its clock — deliberation is
    // what it asks for, so the ring a target gets must not shrink.
    for (const mode of ['trainee', 'accuracy']) {
      const flat = rules(mode, 'hard')
      expect(rampedTimeout(flat, 0)).toBe(flat.clock.base)
      expect(rampedTimeout(flat, 200)).toBe(flat.clock.base)
    }
  })

  it('treats a negative hit count as the start of a run', () => {
    expect(rampedTimeout(speed, -5)).toBe(base)
  })
})

describe('spawnInterval', () => {
  const speed = rules('speed', 'hard')
  const accuracy = rules('accuracy', 'hard')
  const trainee = rules('trainee', 'easy')

  it('is a third of the clock a target would get right now', () => {
    for (const hits of [0, 20, 60]) {
      expect(spawnInterval(speed, hits)).toBe(Math.round(rampedTimeout(speed, hits) / 3))
    }
  })

  it('tightens with the ramp, so the dial keeps its density', () => {
    const start = spawnInterval(speed, 0)
    const later = spawnInterval(speed, 60)
    expect(later).toBeLessThan(start)
    // Lifetime over cadence is what sets how many targets share the board; holding
    // it at 3 is the point of ramping the cadence alongside the clock.
    expect(rampedTimeout(speed, 60) / later).toBeCloseTo(3, 1)
  })

  it('follows a clock handed to it rather than the one the rules would give', () => {
    // Trainee's clock is the player's to set, and the gap has to move with it.
    expect(spawnInterval(trainee, 0, 12000)).toBe(4000)
    expect(spawnInterval(trainee, 0, 18000)).toBe(6000)
  })

  it('holds Trainee at seven seconds once a third of its clock would be longer', () => {
    // The two rules meet at 21 s rather than stepping: a third of it is the cap exactly.
    expect(spawnInterval(trainee, 0, 21000)).toBe(7000)
    expect(spawnInterval(trainee, 0, 21001)).toBe(7000)
    expect(spawnInterval(trainee, 0, 60000)).toBe(7000)
  })

  it('caps the rules own clock too, which is past the cap on its own', () => {
    // Every mode but Trainee calls the two-argument form, so it has to keep answering
    // the same as the three-argument one does for the clock the rules hand out.
    expect(trainee.clock.base / 3).toBeGreaterThan(7000)
    expect(spawnInterval(trainee, 0)).toBe(7000)
  })

  it('stays flat in Trainee, which ramps nothing', () => {
    expect(spawnInterval(trainee, 0)).toBe(spawnInterval(trainee, 200))
  })

  it('tightens in Accuracy while its clock holds still', () => {
    expect(rampedTimeout(accuracy, 60)).toBe(accuracy.clock.base)
    expect(spawnInterval(accuracy, 60)).toBeLessThan(spawnInterval(accuracy, 0))
  })

  it('rides the same curve in Accuracy as the clock does in Speed', () => {
    const start = spawnInterval(accuracy, 0)
    const floor = start * 0.55
    expect(spawnInterval(accuracy, 12)).toBe(Math.round(floor + (start - floor) / 2))
    expect(spawnInterval(accuracy, 24)).toBe(Math.round(floor + (start - floor) / 4))
  })

  it('never lets Accuracy spawn faster than the floor', () => {
    const floor = Math.round(spawnInterval(accuracy, 0) * 0.55)
    expect(spawnInterval(accuracy, 5000)).toBe(floor)
    expect(spawnInterval(accuracy, 200)).toBeGreaterThanOrEqual(floor)
  })

  it('lets the Accuracy dial fill up, unlike Speed which holds its density', () => {
    // Same ring, shorter gap, so more targets share the board as the run goes on —
    // which is where Accuracy's pressure comes from.
    const density = (hits: number) =>
      rampedTimeout(accuracy, hits) / spawnInterval(accuracy, hits)
    expect(density(60)).toBeGreaterThan(density(0))
  })
})

describe('streakMultiplier', () => {
  it('doubles per trigger and caps at 8', () => {
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(1)).toBe(2)
    expect(streakMultiplier(2)).toBe(4)
    expect(streakMultiplier(3)).toBe(8)
    expect(streakMultiplier(4)).toBe(8)
    expect(streakMultiplier(10)).toBe(8)
  })
})

describe('the rules each shipped mode resolves to', () => {
  it('orders and keys line up', () => {
    expect(MODE_ORDER).toEqual(['trainee', 'accuracy', 'speed'])
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'hard', 'extreme'])
    expect(DIFFICULTIES.extreme.maxTargets).toBe(4)
  })

  it('spends no lives in practice and three everywhere else', () => {
    expect(rules('trainee', 'easy').lives.count).toBe(Number.POSITIVE_INFINITY)
    expect(rules('trainee', 'easy').lives.expiryCosts).toBe(false)
    expect(rules('accuracy', 'hard').lives.count).toBe(3)
    expect(rules('speed', 'hard').lives.expiryCosts).toBe(true)
  })

  it('costs a life for a wasteful hit only where the mode says so', () => {
    expect(rules('accuracy', 'hard').lives.wasteful).toBeCloseTo(0.2)
    expect(rules('speed', 'hard').lives.wasteful).toBeNull()
    expect(rules('trainee', 'easy').lives.wasteful).toBeNull()
  })

  it('reports the factor each mode weighs more, without being told', () => {
    // Derived from the blend rather than declared beside it, so a mode cannot score
    // four-fifths on the route and report the clock.
    expect(rules('accuracy', 'hard').scoring.headline).toBe('acc')
    expect(rules('speed', 'hard').scoring.headline).toBe('spd')
    // Practice weighs the route two to one. Nothing reads it — both screens that show a
    // factor are behind `scored` — but the answer still follows the blend.
    expect(rules('trainee', 'easy').scoring.headline).toBe('acc')
    expect(rules('trainee', 'easy').capabilities.scored).toBe(false)
  })

  it('gives each mode the streak its own play is made of', () => {
    expect(rules('speed', 'hard').scoring.streak).toBe('fast')
    expect(rules('accuracy', 'hard').scoring.streak).toBe('optimal')
    expect(rules('trainee', 'easy').scoring.streak).toBe('none')
  })

  it('takes how many targets share the dial from the rung', () => {
    expect(rules('speed', 'extreme').spawn.maxTargets).toBe(4)
    expect(rules('speed', 'hard').spawn.maxTargets).toBe(3)
  })

  it('tightens the wasteful-hit bar as difficulty eases rather than as it hardens', () => {
    expect(DIFFICULTIES.easy.wastefulThreshold).toBeCloseTo(0.25)
    expect(DIFFICULTIES.hard.wastefulThreshold).toBeCloseTo(0.2)
    expect(DIFFICULTIES.extreme.wastefulThreshold).toBeCloseTo(0.15)
  })

  it('falls back to a playable run for a mode nothing is registered under', () => {
    // A challenge whose window closed while a run of it was being restored. The player
    // lands on a run that works rather than on a blank screen.
    const gone = runRules('challenge/not-a-thing', 'hard')
    expect(gone.clock.base).toBe(baseClockMs('accuracy', 'hard'))
  })
})

describe('the tutorial submode', () => {
  const lesson = runRules('trainee', 'easy', true)
  const practice = runRules('trainee', 'easy', false)

  it('takes the clock off without taking the clock away', () => {
    // The ring is still the length it was — a target carries one, and the hit is scored
    // against it — but none of it runs down.
    expect(lesson.clock.countsDown).toBe(false)
    expect(practice.clock.countsDown).toBe(true)
    expect(lesson.clock.base).toBe(practice.clock.base)
  })

  it('holds the dial to one target and runs no cadence', () => {
    expect(lesson.spawn.maxTargets).toBe(1)
    expect(lesson.spawn.cadence).toBe(false)
    expect(practice.spawn.cadence).toBe(true)
  })

  it('keeps every target within reach of the one just hit', () => {
    expect(lesson.spawn.reach).toBeGreaterThan(0)
    expect(practice.spawn.reach).toBeNull()
  })

  it('takes the coaching off but leaves the hints on the keys', () => {
    expect(lesson.capabilities.coached).toBe(false)
    expect(lesson.capabilities.keyHints).toBe(true)
    expect(practice.capabilities.coached).toBe(true)
  })

  it('is still Trainee underneath — same mode, same dial, same lives', () => {
    expect(lesson.mode).toBe('trainee')
    expect(lesson.dial).toBe(practice.dial)
    expect(lesson.lives.count).toBe(Number.POSITIVE_INFINITY)
  })

  it('opens on a dial of its own with a target already standing', () => {
    const submode = runSubmode(true)
    expect(submode?.opening?.target).toBe(submode?.script?.(0))
    expect(submode?.opening?.grid.length).toBe(practice.dial.rows * practice.dial.cols)
  })
})

describe('colors and descriptions', () => {
  it('mode gradient stops chain correctly (end of N = start of N+1)', () => {
    expect(gradientOf('trainee')[1]).toBe(gradientOf('accuracy')[0])
    expect(gradientOf('accuracy')[1]).toBe(gradientOf('speed')[0])
    expect(gradientOf('speed')[1]).toBe(gradientOf('arcade')[0])
    expect(descriptionOf('speed').message?.length ?? 0).toBeGreaterThan(0)
  })

  it('getDifficultyColor returns gradient endpoints for easy/extreme and hex for others', () => {
    expect(getDifficultyColor('speed', 'easy')).toBe(gradientOf('speed')[0])
    expect(getDifficultyColor('speed', 'extreme')).toBe(gradientOf('speed')[1])
    expect(getDifficultyColor('accuracy', 'hard')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('lerpColor interpolates linearly between two hex colors', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('runLabel', () => {
  it('names the mode in every run that is not a submode', () => {
    for (const mode of MODE_ORDER) {
      expect(runLabel(mode, null)).toBe(labelOf(mode))
    }
  })

  it('names the tutorial rather than the Trainee it is built out of', () => {
    expect(runLabel('trainee', runSubmode(true))).toBe(TUTORIAL_LABEL)
    expect(runLabel('trainee', runSubmode(true))).not.toBe(labelOf('trainee'))
  })
})
