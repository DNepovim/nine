import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { TUTORIAL_OPENING_TARGET, TUTORIAL_TARGETS } from '@/constants/tutorial'
import { tutorialBoardEntry } from '@/lib/tutorial-board'
import { bestOn, claimedTime, gameMachine } from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'
import { baseClockMs, challengeId, type Grid } from '@/modes'

// A name per run, because START and RESTART each deal a new one. Nothing here reads it —
// it belongs to the lifetime counters outside the machine — so a legible one will do.
let runs = 0
const nextRunId = () => `run-${++runs}`

const start = (mode: 'trainee' | 'accuracy' | 'speed') => {
  const actor = createActor(gameMachine)
  actor.start()
  actor.send({ type: 'SET_MODE', mode })
  actor.send({ type: 'START', now: 0, runId: nextRunId() })
  return actor
}

describe('mode selection + lives', () => {
  it('defaults to accuracy with 3 lives after START', () => {
    const actor = start('accuracy')
    expect(actor.getSnapshot().context.mode).toBe('accuracy')
    expect(actor.getSnapshot().context.lives).toBe(3)
  })

  it('trainee has infinite lives and never reaches gameOver on expiry', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    expect(actor.getSnapshot().context.lives).toBe(Number.POSITIVE_INFINITY)
    expect(actor.getSnapshot().value).toBe('playing')
  })
})

describe('a drilled run', () => {
  // HABIT: nine targets from the session's own drill, no ring, no lives. What
  // ends it is the drill being spent with the board clear — there is nothing else that
  // could, since no life can be lost.
  const HABIT = challengeId('habit')

  // Dials the grid to `value` the cheap way: the top-left key is worth 1, so `value`
  // presses on it reach any sum under ten. Used with small targets only.
  const dialTo = (
    actor: ReturnType<typeof createActor<typeof gameMachine>>,
    value: number,
  ) => {
    for (let press = 0; press < value; press++) {
      actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    }
  }

  const drilled = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: HABIT })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    return actor
  }

  it('claims no time for a race its window shut on before the drill was spent', () => {
    const actor = drilled()
    actor.send({ type: 'ADD_TARGET', value: 3, at: 0 })
    actor.send({ type: 'EXPIRE', now: 4000 })
    expect(actor.getSnapshot().value).toBe('gameOver')
    expect(claimedTime(actor.getSnapshot().context)).toBeNull()
  })

  it('plays on while any of the drill is still standing', () => {
    const actor = drilled()
    // Two dealt, one hit: the board is not clear, so the run is not over — even though
    // nothing here can ever cost a life.
    actor.send({ type: 'ADD_TARGET', value: 3, at: 0 })
    actor.send({ type: 'ADD_TARGET', value: 7, at: 0 })
    dialTo(actor, 3)
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    expect(actor.getSnapshot().value).toBe('playing')
  })

  it('plays on when the board clears but the drill has more to deal', () => {
    const actor = drilled()
    actor.send({ type: 'ADD_TARGET', value: 4, at: 0 })
    dialTo(actor, 4)
    // The board is empty and only one of the nine has been dealt. An empty board
    // between arrivals is not a finished run.
    expect(actor.getSnapshot().context.targets).toHaveLength(0)
    expect(actor.getSnapshot().value).toBe('playing')
  })

  it('ends the moment the last of the drill is taken', () => {
    const actor = drilled()
    // All nine dealt — `maxTargets` is nine, so none is refused — and eight already
    // down. Values are small and distinct so each is one run of presses on key zero.
    for (let value = 1; value <= 9; value++) {
      actor.send({ type: 'ADD_TARGET', value, at: 0 })
    }
    expect(actor.getSnapshot().context.nextTargetId).toBe(9)
    for (let value = 1; value <= 8; value++) {
      dialTo(actor, 1)
      expect(actor.getSnapshot().value).toBe('playing')
    }
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    dialTo(actor, 1)
    expect(actor.getSnapshot().context.targets).toHaveLength(0)
    expect(actor.getSnapshot().value).toBe('gameOver')
    // A race that went the distance claims its clock.
    const { context } = actor.getSnapshot()
    expect(claimedTime(context)).toBe(context.elapsedMs)
  })

  it('counts its arrivals from nought again on every run', () => {
    // The regression this pins, and it emptied the board completely. `nextTargetId`
    // climbs for the life of the machine on purpose — the display list keys a card's
    // animations on it, and a restart leaves the last run's cards still going — so a
    // drill indexed by the id starts the second run at nine, past the end of its own
    // list, and deals nothing at all for the rest of the run.
    const actor = drilled()
    for (let value = 1; value <= 9; value++) {
      actor.send({ type: 'ADD_TARGET', value, at: 0 })
    }
    expect(actor.getSnapshot().context.dealt).toBe(9)
    for (let press = 0; press < 9; press++) {
      actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')

    actor.send({ type: 'RESTART', now: 0, runId: nextRunId() })
    // The run's own count starts again; the ids do not, and must not.
    expect(actor.getSnapshot().context.dealt).toBe(0)
    expect(actor.getSnapshot().context.nextTargetId).toBeGreaterThanOrEqual(9)

    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const first = actor.getSnapshot().context.targets[0]
    if (first === undefined) throw new Error('a second run deals a first target')
    // Which is what the drill is indexed by: the first card of the second run is the
    // drill's first card, not its tenth.
    expect(first.seq).toBe(0)
  })

  it('does not end the second run the moment its board first goes clear', () => {
    // The other half of the same confusion, and the half that survived. The *ending* was
    // measured against `nextTargetId` too — so on the second run of a sitting the guard
    // was already satisfied before a single card had been dealt, and the run ended on the
    // first target taken. Nine cards became one.
    const actor = drilled()
    for (let value = 1; value <= 9; value++) {
      actor.send({ type: 'ADD_TARGET', value, at: 0 })
    }
    for (let press = 0; press < 9; press++) {
      actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')

    actor.send({ type: 'RESTART', now: 0, runId: nextRunId() })
    actor.send({ type: 'ADD_TARGET', value: 1, at: 0 })
    dialTo(actor, 1)

    // One of nine taken, eight still to come: the run goes on.
    expect(actor.getSnapshot().context.dealt).toBe(1)
    expect(actor.getSnapshot().value).toBe('playing')
  })

  it('stops the run clock when the drill ends it', () => {
    // The same thing a life running out does. `elapsedMs` is what the standings are
    // ordered by on this challenge, so a run that ended without folding its last
    // stretch in would post a time short by however long the final target took.
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: HABIT })
    actor.send({ type: 'START', now: 1000, runId: nextRunId() })
    for (let value = 1; value <= 9; value++) {
      actor.send({ type: 'ADD_TARGET', value, at: 1000 })
    }
    // One press per target: key zero is worth 1, so the sum climbs 1 … 9 and takes the
    // nine in order.
    for (let press = 0; press < 9; press++) {
      actor.send({ type: 'PRESS', index: 0, delta: 1, now: 5000 })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')
    expect(actor.getSnapshot().context.playingSince).toBeNull()
    expect(actor.getSnapshot().context.elapsedMs).toBe(4000)
  })
})

describe('per mode × difficulty stats shape', () => {
  it('opens empty, and reads a board nobody has played as a blank one', () => {
    // Sparse on purpose: a store keyed by name cannot be exhaustive over a mode list
    // that grows every time a challenge opens, so an unplayed board has no entry and
    // `bestOn` is what makes that the same answer as a played one with nothing on it.
    const actor = createActor(gameMachine)
    actor.start()
    const { stats } = actor.getSnapshot().context
    expect(stats).toEqual({})
    expect(bestOn(stats, 'accuracy', 'hard')).toEqual({ score: 0, hits: 0 })
    expect(bestOn(stats, 'speed', 'extreme')).toEqual({ score: 0, hits: 0 })
    expect(bestOn(stats, 'challenge/never-registered', 'hard')).toEqual({
      score: 0,
      hits: 0,
    })
  })
})

describe('HYDRATE_STATS', () => {
  it('keeps the bests of modes that keep a board', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({
      type: 'HYDRATE_STATS',
      stats: { accuracy: { hard: { score: 400, hits: 9 } } },
    })
    expect(bestOn(actor.getSnapshot().context.stats, 'accuracy', 'hard')).toEqual({
      score: 400,
      hits: 9,
    })
  })

  it('drops the best of a mode that keeps none', () => {
    // Stated as the rule rather than as Trainee's name. Trainee no longer records one,
    // but players from before that change still have a value on disk, and loading it
    // would keep firing the personal-best celebration on the first hit of a practice run.
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({
      type: 'HYDRATE_STATS',
      stats: { trainee: { easy: { score: 999, hits: 40 } } },
    })
    expect(bestOn(actor.getSnapshot().context.stats, 'trainee', 'easy').score).toBe(0)
  })

  it('drops the best of a mode nothing is registered under', () => {
    // A challenge long out of the catalog. Its boards are not addressable, and writing
    // them back would keep them on disk forever.
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({
      type: 'HYDRATE_STATS',
      stats: { 'challenge/long-gone': { hard: { score: 500, hits: 10 } } },
    })
    expect(actor.getSnapshot().context.stats).toEqual({})
  })
})

describe('accuracy streak (optimal trigger)', () => {
  it('increments on par hits and resets on a non-par hit', () => {
    const actor = start('accuracy')

    // Target value=9: from empty grid, index 8 (weight=9) → press once → sum=9. par=1.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // par 1, userSteps 1 → optimal
    expect(actor.getSnapshot().context.streak).toBe(1)
    expect(actor.getSnapshot().context.score).toBeGreaterThan(0)

    // Target value=11: grid[8]=1 (sum=9). Need sum=11, add 2. index 1 or 3 (weight=2), press once. par=1.
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    // Non-optimal: press index 0 twice (sum 9→10→11). par=1, userSteps=2 → non-optimal hit.
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 }) // sum=10, miss
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 }) // sum=11, hit (userSteps=2, par=1)
    expect(actor.getSnapshot().context.streak).toBe(0) // reset
  })
})

describe('pausing', () => {
  it('holds on to a target whose clock ran out as the pause landed', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0

    actor.send({ type: 'PAUSE', now: 0 })
    // In flight when the pause hit: dropping it here is what let a player pause a
    // target away, and taking a life for it would punish them for pausing.
    actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    expect(actor.getSnapshot().context.lives).toBe(3)
  })

  it('makes it cost a life once the run is going again', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0

    actor.send({ type: 'PAUSE', now: 0 })
    actor.send({ type: 'RESUME', now: 0 })
    actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    expect(actor.getSnapshot().context.targets).toHaveLength(0)
    expect(actor.getSnapshot().context.lives).toBe(2)
  })
})

describe('strikes', () => {
  it('tallies the hits that landed on a streak, and only those', () => {
    const actor = start('accuracy')

    // Optimal, so it triggers the streak and carries a multiplier — a strike.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.strikes).toBe(1)

    // Two steps where par was one: a hit, but not a strike.
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.hits).toBe(2)
    expect(actor.getSnapshot().context.strikes).toBe(1)
  })

  it('starts a new run at zero — the tally describes one run', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.strikes).toBe(1)

    actor.send({ type: 'PAUSE', now: 0 })
    actor.send({ type: 'MENU' })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    expect(actor.getSnapshot().context.strikes).toBe(0)
  })
})

describe('accuracy streak (second optimal)', () => {
  it('doubles on consecutive par hits and caps at 3 consecutive (×8)', () => {
    const actor = start('accuracy')

    // Hit 1: value=9, par=1, optimal → streak=1
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.streak).toBe(1)

    // Hit 2: grid[8]=1 (sum=9). value=18, par=1 (press index 8 once: 1→2, sum=18). optimal → streak=2
    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.streak).toBe(2)
  })
})

describe('accuracy life loss', () => {
  // Four presses that cancel out (up, down, up, down on the ×1 key) waste four
  // steps against whatever target is live without ever touching its sum, then the
  // fifth reaches value=9 in one step on the ×9 key — five steps against a par of
  // one is accuracyFactor(1, 5) = 0, well under every difficulty's wastefulThreshold
  // (the actor here defaults to 'hard', whose bar is 0.2 — see DIFFICULTIES).
  const wasteThenHit = (actor: ReturnType<typeof start>) => {
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
  }

  it('costs a life on a wasteful hit, and marks that hit', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    wasteThenHit(actor)
    const snap = actor.getSnapshot()
    expect(snap.context.lives).toBe(2)
    expect(snap.context.hitBatch.hits[0]?.costLife).toBe(true)
  })

  it('leaves lives and the mark alone on an ordinary hit', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // par 1, userSteps 1 — optimal
    const snap = actor.getSnapshot()
    expect(snap.context.lives).toBe(3)
    expect(snap.context.hitBatch.hits[0]?.costLife).toBe(false)
  })

  it('does not apply the rule outside Accuracy', () => {
    // Same wasteful shape, but Speed has no accuracy-driven life loss — only an
    // expired target costs a life there.
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    wasteThenHit(actor)
    const snap = actor.getSnapshot()
    expect(snap.context.lives).toBe(3)
    expect(snap.context.hitBatch.hits[0]?.costLife).toBe(false)
  })

  it('takes only one life when one press wastes two targets at once, and blames only the first', () => {
    const actor = start('accuracy')
    // Two targets sharing the same value, both wasted identically — one press clears
    // both, and only one heart should go for it.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    wasteThenHit(actor)
    const snap = actor.getSnapshot()
    expect(snap.context.lives).toBe(2)
    const hits = snap.context.hitBatch.hits
    expect(hits).toHaveLength(2)
    expect(hits.filter((h) => h.costLife)).toHaveLength(1)
    expect(hits[0]?.costLife).toBe(true)
    expect(hits[1]?.costLife).toBe(false)
  })
})

describe('speed streak (fast trigger)', () => {
  const duration = baseClockMs('speed', 'hard')
  // A hit counts as fast while at least FAST_HIT_THRESHOLD of the ring remains, so
  // these are comfortably inside and outside that window.
  const fast = Math.round(duration * 0.1)
  const slow = Math.round(duration * 0.9)

  it('increments on a fast hit', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: fast })
    expect(actor.getSnapshot().context.streak).toBe(1)
  })

  it('builds across consecutive fast hits', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: fast })
    actor.send({ type: 'ADD_TARGET', value: 18, at: fast })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: fast * 2 })
    expect(actor.getSnapshot().context.streak).toBe(2)
  })

  it('resets on a slow hit — the streak is a chain, not a tally', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: fast })
    expect(actor.getSnapshot().context.streak).toBe(1)

    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: slow })
    expect(actor.getSnapshot().context.streak).toBe(0)
  })

  it('resets on expiry', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: fast })
    expect(actor.getSnapshot().context.streak).toBe(1)

    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    expect(actor.getSnapshot().context.streak).toBe(0)
  })

  it('no longer depends on clearing the board', () => {
    const actor = start('speed')
    // Two targets, one hit: the board is not cleared, but the hit was fast.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'ADD_TARGET', value: 200, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: fast })
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    expect(actor.getSnapshot().context.streak).toBe(1)
  })
})

describe('speed ramp', () => {
  it('stamps each target with the clock it spawned under', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    const first = actor.getSnapshot().context.targets[0]?.duration
    expect(first).toBe(baseClockMs('speed', 'hard'))
  })

  it('gives a later target a tighter clock than an earlier one', () => {
    const actor = start('speed')
    // Land a hit so the run has progress, then spawn again.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    const early = actor.getSnapshot().context.targets[0]?.duration ?? 0
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    const later = actor.getSnapshot().context.targets[0]?.duration ?? 0
    expect(later).toBeLessThan(early)
  })

  it('leaves a target already in flight on its original clock', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 200, at: 0 })
    const before = actor.getSnapshot().context.targets[0]?.duration
    // A hit on a different target advances the run, tightening the clock for
    // whatever spawns next — but this one keeps the ring it started with.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const survivor = actor.getSnapshot().context.targets.find((t) => t.value === 200)
    expect(survivor?.duration).toBe(before)
  })

  it('does not ramp accuracy', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    expect(actor.getSnapshot().context.targets[0]?.duration).toBe(
      baseClockMs('accuracy', 'hard'),
    )
  })
})

describe('run stat accumulators', () => {
  it('accumulates accSum and spdSum after a hit', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // par 1, userSteps 1 → accFactor=1
    const { accSum, spdSum, hits } = actor.getSnapshot().context
    expect(hits).toBe(1)
    expect(accSum).toBeCloseTo(1) // perfect accuracy
    expect(spdSum).toBeGreaterThanOrEqual(0)
    expect(spdSum).toBeLessThanOrEqual(1)
  })

  it('keeps the best single hit, not the last one', () => {
    const actor = start('accuracy')
    // An optimal hit, taken at once: both factors as high as they go.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const peak = actor.getSnapshot().context
    expect(peak.bestAcc).toBeCloseTo(1)
    expect(peak.bestSpd).toBeCloseTo(1)

    // Then a worse one — a wasted step, and most of the ring spent. Neither best
    // may follow it down.
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 10_000 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 10_000 })
    const after = actor.getSnapshot().context
    expect(after.hits).toBe(2)
    expect(after.bestAcc).toBeCloseTo(1)
    expect(after.bestSpd).toBeCloseTo(1)
  })

  it('raises a best when a later hit beats it', () => {
    const actor = start('accuracy')
    // A wasteful first hit: par 1, two steps → accFactor 1 - 1/3.
    actor.send({ type: 'ADD_TARGET', value: 2, at: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.bestAcc).toBeCloseTo(2 / 3)

    // Then an optimal one, which is what the run's best becomes.
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.bestAcc).toBeCloseTo(1)
  })

  it('starts a fresh run with no best to beat', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    actor.send({ type: 'PAUSE', now: 100 })
    actor.send({ type: 'RESTART', now: 200, runId: nextRunId() })
    const context = actor.getSnapshot().context
    expect(context.bestAcc).toBe(0)
    expect(context.bestSpd).toBe(0)
  })

  it('restarts straight from a live run, without a pause', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    actor.send({ type: 'RESTART', now: 200, runId: nextRunId() })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('playing')
    expect(snapshot.context.score).toBe(0)
    expect(snapshot.context.hits).toBe(0)
    expect(snapshot.context.targets).toHaveLength(0)
  })
})

describe('hit batch reports the route', () => {
  it('carries the steps taken and the par for an optimal hit', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    // Index 8 carries weight 9, so one press from the empty grid lands 9 exactly.
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const [hit] = actor.getSnapshot().context.hitBatch.hits
    expect(hit?.steps).toBe(1)
    expect(hit?.par).toBe(1)
  })

  it('counts wasted presses in steps while par stays as it was', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    // Up and back down on the ×1 key, then the ×9 key: three steps for a one-step
    // target, which is exactly what the debrief exists to name.
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const [hit] = actor.getSnapshot().context.hitBatch.hits
    expect(hit?.steps).toBe(3)
    expect(hit?.par).toBe(1)
  })
})

describe('a new run does not inherit the last one', () => {
  it('empties the hit batch on START while keeping its seq climbing', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const landed = actor.getSnapshot().context.hitBatch
    expect(landed.hits).toHaveLength(1)

    actor.send({ type: 'PAUSE', now: 0 })
    actor.send({ type: 'MENU' })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    const fresh = actor.getSnapshot().context.hitBatch
    // Emptied, so nothing describes a press from the previous run — but the seq
    // keeps climbing, because the UI keys its animations on it.
    expect(fresh.hits).toEqual([])
    expect(fresh.seq).toBe(landed.seq)
  })

  it('empties it on RESTART too', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.hitBatch.hits).toHaveLength(1)

    // Accuracy has three lives, so three expiries are what reaches game over.
    for (const value of [100, 101, 102]) {
      actor.send({ type: 'ADD_TARGET', value, at: 0 })
      const id = actor.getSnapshot().context.targets[0]?.id ?? 0
      actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')

    actor.send({ type: 'RESTART', now: 0, runId: nextRunId() })
    expect(actor.getSnapshot().context.hitBatch.hits).toEqual([])
  })

  it('deals a fresh run when RESTART comes from a pause', () => {
    // RESTART used to be a game-over event only. The pause screen offers it now, which
    // means it has to land on a run that is still standing: score on the board, lives
    // spent, targets in the air. All of it goes.
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    actor.send({ type: 'PAUSE', now: 1000 })
    expect(actor.getSnapshot().value).toBe('paused')
    expect(actor.getSnapshot().context.score).toBeGreaterThan(0)

    actor.send({ type: 'RESTART', now: 2000, runId: nextRunId() })
    const after = actor.getSnapshot()
    expect(after.value).toBe('playing')
    expect(after.context.score).toBe(0)
    expect(after.context.hits).toBe(0)
    expect(after.context.targets).toEqual([])
    expect(after.context.hitBatch.hits).toEqual([])
  })

  it('gives a restarted run target ids the abandoned one never used', () => {
    // The bug this pins: ids restarted at 0 with every run, so the first target of a
    // fresh run wore the id of one still animating off the board from the last. The
    // display list keys on that id, mistook the arrival for the departure, and dropped
    // it — a restart from a pause that opened on an empty board.
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    const spent = actor.getSnapshot().context.targets.map((t) => t.id)

    actor.send({ type: 'PAUSE', now: 1000 })
    actor.send({ type: 'RESTART', now: 2000, runId: nextRunId() })
    actor.send({ type: 'ADD_TARGET', value: 7, at: 2000 })
    const [fresh] = actor.getSnapshot().context.targets
    expect(spent).not.toContain(fresh?.id)
  })

  it('times a pause-restarted run from the restart, not from the first start', () => {
    // The paused run's elapsed time must not follow it into the fresh one, or a
    // speed board would record a run that began before the player asked for it.
    const actor = start('accuracy')
    actor.send({ type: 'PAUSE', now: 30_000 })
    actor.send({ type: 'RESTART', now: 45_000, runId: nextRunId() })
    expect(actor.getSnapshot().context.playingSince).toBe(45_000)
    expect(actor.getSnapshot().context.elapsedMs).toBe(0)
  })

  it('carries no clean hit from another mode into a trainee run', () => {
    // The bug this pins: seq is monotonic across modes, so a Trainee run opened
    // with Accuracy's last hit still in the batch — earning a confetti shower and
    // filling the stat row before the player had touched the dial.
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(cleanHitReason(actor.getSnapshot().context.hitBatch.hits)).not.toBeNull()

    // Leaving a run goes through pause: MENU is not handled while playing.
    actor.send({ type: 'PAUSE', now: 0 })
    actor.send({ type: 'MENU' })
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    expect(cleanHitReason(actor.getSnapshot().context.hitBatch.hits)).toBeNull()
  })
})

describe('run clock', () => {
  const started = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'START', now: 1000, runId: nextRunId() })
    return actor
  }

  it('starts at zero', () => {
    const actor = started()
    expect(actor.getSnapshot().context.elapsedMs).toBe(0)
  })

  it('freezes at whatever it reached the instant PAUSE lands', () => {
    const actor = started()
    actor.send({ type: 'PAUSE', now: 6000 })
    expect(actor.getSnapshot().context.elapsedMs).toBe(5000)
  })

  it('does not count time spent in the pause menu', () => {
    const actor = started()
    actor.send({ type: 'PAUSE', now: 6000 }) // 5s played
    actor.send({ type: 'RESUME', now: 30_000 }) // 24s in the pause menu, uncounted
    actor.send({ type: 'PAUSE', now: 33_000 }) // 3s more played
    expect(actor.getSnapshot().context.elapsedMs).toBe(8000)
  })

  it('finalizes on a PRESS that ends the run', () => {
    // Accuracy takes a life for a wasteful hit. Two expiries bring lives
    // to one, then a hit wasted enough to cost the last one ends the run on PRESS
    // rather than on an expiry — the branch TARGET_EXPIRED does not cover.
    const actor = started()
    for (const at of [1500, 2500]) {
      actor.send({ type: 'ADD_TARGET', value: 100, at })
      const id = actor.getSnapshot().context.targets[0]?.id ?? 0
      actor.send({ type: 'TARGET_EXPIRED', id, now: at })
    }
    expect(actor.getSnapshot().context.lives).toBe(1)

    // par 1 (index 8, weight 9, from an empty grid). Four wasted steps that net back
    // to zero, then the hit: userSteps 5 against par 1 is well under the wasteful bar.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 2500 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 3000 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 3100 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 3200 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 3300 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 4000 })

    expect(actor.getSnapshot().value).toBe('gameOver')
    expect(actor.getSnapshot().context.elapsedMs).toBe(3000)
  })

  it('finalizes on a SET_CELL that ends the run', () => {
    const actor = started()
    for (const at of [1500, 2500]) {
      actor.send({ type: 'ADD_TARGET', value: 100, at })
      const id = actor.getSnapshot().context.targets[0]?.id ?? 0
      actor.send({ type: 'TARGET_EXPIRED', id, now: at })
    }
    expect(actor.getSnapshot().context.lives).toBe(1)

    // SET_CELL to the value already there still counts as a step against the target
    // — the grid does not move, but the press did — so four calls waste four steps
    // as plainly as four PRESSes would.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 2500 })
    for (const now of [3000, 3100, 3200, 3300]) {
      actor.send({ type: 'SET_CELL', index: 0, value: 0, now })
    }
    actor.send({ type: 'SET_CELL', index: 8, value: 1, now: 4000 })

    expect(actor.getSnapshot().value).toBe('gameOver')
    expect(actor.getSnapshot().context.elapsedMs).toBe(3000)
  })

  it('resets to zero on RESTART, timed from the restart rather than the first START', () => {
    const actor = started()
    for (const at of [1500, 2500, 3500]) {
      actor.send({ type: 'ADD_TARGET', value: 100, at })
      const id = actor.getSnapshot().context.targets[0]?.id ?? 0
      actor.send({ type: 'TARGET_EXPIRED', id, now: at })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')

    actor.send({ type: 'RESTART', now: 10_000, runId: nextRunId() })
    expect(actor.getSnapshot().context.elapsedMs).toBe(0)
    actor.send({ type: 'PAUSE', now: 10_500 })
    expect(actor.getSnapshot().context.elapsedMs).toBe(500)
  })
})

describe('run identity', () => {
  // Every run gets its own number, because the per-run bookkeeping outside the machine
  // has no other way to tell one from the next: PLAY AGAIN goes straight from gameOver
  // to playing, and RESTART from a pause never leaves `playing` at all, so nothing a
  // screen can watch goes quiet in between.
  it('counts up on every fresh run, and holds still otherwise', () => {
    const actor = start('accuracy')
    const first = actor.getSnapshot().context.runSeq

    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.runSeq).toBe(first)

    actor.send({ type: 'PAUSE', now: 1000 })
    actor.send({ type: 'RESUME', now: 2000 })
    expect(actor.getSnapshot().context.runSeq).toBe(first)

    // RESTART from a pause deals a new run without `playing` ever being left.
    actor.send({ type: 'PAUSE', now: 2500 })
    actor.send({ type: 'RESTART', now: 3000, runId: nextRunId() })
    const second = actor.getSnapshot().context.runSeq
    expect(second).toBeGreaterThan(first)

    // Three expiries reach game over on Accuracy, and PLAY AGAIN deals the next run.
    for (const value of [100, 101, 102]) {
      actor.send({ type: 'ADD_TARGET', value, at: 3000 })
      const id = actor.getSnapshot().context.targets[0]?.id ?? 0
      actor.send({ type: 'TARGET_EXPIRED', id, now: 3000 })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')
    expect(actor.getSnapshot().context.runSeq).toBe(second)

    actor.send({ type: 'RESTART', now: 4000, runId: nextRunId() })
    expect(actor.getSnapshot().context.runSeq).toBeGreaterThan(second)
  })
})

describe('trainee timeout set mid-run', () => {
  const traineeAt = (ms: number) => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_PLAYER_CLOCK', ms, now: 0 })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    return actor
  }

  it('moves a live target onto the new clock, keeping the share it had left', () => {
    const actor = traineeAt(10_000)
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    // A quarter of the ring gone, and the player doubles the clock: three quarters of
    // twenty seconds is fifteen, not the seven and a half it had a moment ago.
    actor.send({ type: 'SET_PLAYER_CLOCK', ms: 20_000, now: 2_500 })
    const target = actor.getSnapshot().context.targets[0]
    expect(target?.duration).toBe(20_000)
    expect(20_000 - (2_500 - (target?.spawnedAt ?? 0))).toBe(15_000)
  })

  it('shortens a live target the same way', () => {
    const actor = traineeAt(10_000)
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'SET_PLAYER_CLOCK', ms: 4_000, now: 5_000 })
    const target = actor.getSnapshot().context.targets[0]
    expect(target?.duration).toBe(4_000)
    // Half the ring left, of four seconds now.
    expect(4_000 - (5_000 - (target?.spawnedAt ?? 0))).toBe(2_000)
  })

  it('leaves a run in another mode on the clock it was dealt', () => {
    const actor = start('speed')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    const before = actor.getSnapshot().context.targets[0]
    actor.send({ type: 'SET_PLAYER_CLOCK', ms: 20_000, now: 1_000 })
    expect(actor.getSnapshot().context.targets[0]).toEqual(before)
  })
})

describe('a pause stops the targets as well as the score', () => {
  const hit = (pauseAt: number, resumeAt: number, pressAt: number) => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    actor.send({ type: 'ADD_TARGET', value: 1, at: 0 })
    actor.send({ type: 'PAUSE', now: pauseAt })
    actor.send({ type: 'RESUME', now: resumeAt })
    // The dial's top-left cell has weight 1, so one press takes the sum to 1.
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: pressAt })
    return actor.getSnapshot().context.hitBatch.hits[0]
  }

  it('gives a target back the clock it was frozen with', () => {
    // A minute in the pause screen is a minute nobody played. The ring the player is
    // looking at freezes; before this the machine's own reading did not, so the pie
    // showed half a clock left and the hit scored as though there were none.
    expect(hit(100, 60_000, 60_100)?.progress).toBeGreaterThan(0.9)
  })

  it('charges the target for the time actually played', () => {
    // Both runs played exactly 1000ms before the press; only one of them spent a
    // minute in the pause screen in between.
    const paused = hit(1_000, 60_000, 60_000)
    const straight = hit(1_000, 1_000, 1_000)
    expect(paused?.progress).toBeCloseTo(straight?.progress ?? 0, 5)
  })

  it('leaves the clock of an unpaused run exactly as it was', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    actor.send({ type: 'ADD_TARGET', value: 1, at: 0 })
    const before = actor.getSnapshot().context.targets[0]?.spawnedAt
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 500 })
    expect(before).toBe(0)
  })
})

describe('restoring a run the app was closed on', () => {
  const run = {
    grid: [1, 2, 3, 4, 5, 6, 7, 8, 9] as Grid,
    hits: 6,
    score: 4200,
    mode: 'speed' as const,
    difficulty: 'extreme' as const,
    lives: 2,
    streak: 3,
    maxStreak: 4,
    strikes: 5,
    accSum: 4.5,
    spdSum: 3.25,
    bestAcc: 0.875,
    bestSpd: 0.5,
    targets: [
      {
        id: 11,
        seq: 4,
        value: 88,
        spawnedAt: 1_000,
        duration: 5_000,
        refAt: 1_000,
        refGrid: [0, 0, 0, 0, 0, 0, 0, 0, 0] as Grid,
        par: 3,
        userSteps: 1,
        drift: 0 as const,
      },
    ],
    nextTargetId: 12,
    dealt: 5,
    elapsedMs: 42_000,
    runSeq: 7,
    runId: 'run-restored',
    tutorial: false,
  }

  it('lands paused rather than playing', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    expect(actor.getSnapshot().value).toBe('paused')
  })

  it('brings the whole run back with it', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    const context = actor.getSnapshot().context
    expect(context.score).toBe(4200)
    expect(context.mode).toBe('speed')
    expect(context.difficulty).toBe('extreme')
    expect(context.lives).toBe(2)
    expect(context.streak).toBe(3)
    expect(context.bestAcc).toBe(0.875)
    expect(context.bestSpd).toBe(0.5)
    expect(context.elapsedMs).toBe(42_000)
    expect(context.runSeq).toBe(7)
    expect(context.targets).toEqual(run.targets)
  })

  it('comes back with no clock running and nothing floating', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    expect(actor.getSnapshot().context.playingSince).toBeNull()
    expect(actor.getSnapshot().context.hitBatch.hits).toEqual([])
  })

  it('resumes into the run it restored rather than a fresh one', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    actor.send({ type: 'RESUME', now: 50_000 })
    expect(actor.getSnapshot().value).toBe('playing')
    expect(actor.getSnapshot().context.score).toBe(4200)
    expect(actor.getSnapshot().context.playingSince).toBe(50_000)
  })

  it('counts the next run on from the restored one', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    actor.send({ type: 'RESTART', now: 0, runId: nextRunId() })
    expect(actor.getSnapshot().context.runSeq).toBe(8)
    expect(actor.getSnapshot().context.score).toBe(0)
  })

  // What keeps a resumed run from being counted as a second one: it posts its counters
  // while it is still being played, and the server holds them against this name.
  it('comes back under the name it was put away with', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    expect(actor.getSnapshot().context.runId).toBe('run-restored')
  })

  it('leaves the restored run its name when it is resumed and played on', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'RESTORE', run, now: 0 })
    actor.send({ type: 'RESUME', now: 50_000 })
    expect(actor.getSnapshot().context.runId).toBe('run-restored')
  })
})

describe('what a run is called', () => {
  it('takes the name START deals it', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'START', now: 0, runId: 'run-first' })
    expect(actor.getSnapshot().context.runId).toBe('run-first')
  })

  it('has no name on the intro, where nothing is ever posted', () => {
    const actor = createActor(gameMachine)
    actor.start()
    expect(actor.getSnapshot().context.runId).toBe('')
  })

  it('takes a new one on every restart, so two runs are never one', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'START', now: 0, runId: 'run-first' })
    actor.send({ type: 'PAUSE', now: 100 })
    actor.send({ type: 'RESTART', now: 200, runId: 'run-second' })
    expect(actor.getSnapshot().context.runId).toBe('run-second')
  })

  it('keeps it across a pause and a resume, which are one run', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'START', now: 0, runId: 'run-first' })
    actor.send({ type: 'PAUSE', now: 100 })
    actor.send({ type: 'RESUME', now: 900 })
    expect(actor.getSnapshot().context.runId).toBe('run-first')
  })
})

describe('the tutorial', () => {
  // Trainee on the Easy board, which is what the welcome and the guide's TRY IT both
  // deal. What makes it the tutorial is the flag on START, not the mode.
  const startTutorial = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, runId: nextRunId(), tutorial: true })
    return actor
  }

  // The opening walked to its target: the three taps the lesson guides, in the order
  // `computeKeyPlan` gives them — ⑨ then ⑥ then ④. Pinned as a route in
  // machines/tutorial-lesson.test.ts; here it is just the way to land the first hit.
  const hitTheOpening = (actor: ReturnType<typeof startTutorial>, now = 100) => {
    for (const index of [8, 7, 4]) {
      actor.send({ type: 'PRESS', index, delta: 1, now })
    }
  }

  it('is off in a run started without it', () => {
    expect(start('trainee').getSnapshot().context.tutorial).toBe(false)
  })

  it('opens holding one target of its own', () => {
    const actor = startTutorial()
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
  })

  it('holds the board to one target, where Easy would take three', () => {
    const actor = startTutorial()
    actor.send({ type: 'ADD_TARGET', value: 40, at: 0 })
    actor.send({ type: 'ADD_TARGET', value: 60, at: 0 })
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    // The one it opened with, not the ones offered after it.
    expect(actor.getSnapshot().context.targets[0]?.value).toBe(TUTORIAL_OPENING_TARGET)
  })

  it('takes the next target once the one standing is hit', () => {
    const actor = startTutorial()
    hitTheOpening(actor)
    expect(actor.getSnapshot().context.targets).toHaveLength(0)
    actor.send({ type: 'ADD_TARGET', value: 40, at: 200 })
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
  })

  it('scores a hit as if no clock had run, however long it took', () => {
    const actor = startTutorial()
    // Well past the clock the target was dealt — in any other run this would have
    // expired, and a hit landed here would carry no speed at all.
    hitTheOpening(actor, 10 * 60 * 1000)
    const hit = actor.getSnapshot().context.hitBatch.hits[0]
    expect(hit?.spdFactor).toBe(1)
    expect(actor.getSnapshot().context.spdSum).toBe(1)
  })

  it('stays the tutorial across a pause and a resume', () => {
    const actor = startTutorial()
    actor.send({ type: 'PAUSE', now: 1000 })
    actor.send({ type: 'RESUME', now: 2000 })
    expect(actor.getSnapshot().context.tutorial).toBe(true)
  })

  it('deals another tutorial on RESTART rather than dropping into practice', () => {
    const actor = startTutorial()
    actor.send({ type: 'PAUSE', now: 1000 })
    actor.send({ type: 'RESTART', now: 2000, runId: nextRunId() })
    expect(actor.getSnapshot().context.tutorial).toBe(true)
  })

  it('is left behind by the next run started without it', () => {
    const actor = startTutorial()
    // Out through the pause screen, which is the only way back to the intro from a run.
    actor.send({ type: 'PAUSE', now: 1000 })
    actor.send({ type: 'MENU' })
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'START', now: 3000, runId: nextRunId() })
    expect(actor.getSnapshot().context.tutorial).toBe(false)
  })
})

describe('rewinding a tutorial', () => {
  // A tutorial run standing on the board `hits` says, started fresh.
  const tutorialAt = (hits: number) => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, runId: nextRunId(), tutorial: true })
    actor.send({ type: 'REWIND', board: hits, now: 1 })
    return actor
  }

  it('puts the run back on that board’s grid, target and hit count', () => {
    const { context } = tutorialAt(3).getSnapshot()
    expect(context.hits).toBe(3)
    expect(context.grid).toEqual(tutorialBoardEntry(3))
    expect(context.targets).toHaveLength(1)
    expect(context.targets[0]?.value).toBe(TUTORIAL_TARGETS[3])
  })

  it('goes back to the opening board too', () => {
    const { context } = tutorialAt(0).getSnapshot()
    expect(context.hits).toBe(0)
    expect(context.grid).toEqual(tutorialBoardEntry(0))
    expect(context.targets[0]?.value).toBe(TUTORIAL_TARGETS[0])
  })

  // The target has to arrive under an id nothing on screen is still animating out under,
  // for the same reason a fresh run spends one: the display list keys a target's
  // animations on it, and an id dealt twice reads as the departing target.
  it('deals the target a fresh id', () => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, runId: nextRunId(), tutorial: true })
    const before = actor.getSnapshot().context.targets[0]?.id
    actor.send({ type: 'REWIND', board: 2, now: 1 })
    expect(actor.getSnapshot().context.targets[0]?.id).not.toBe(before)
  })

  it('stays in play', () => {
    expect(tutorialAt(2).getSnapshot().value).toBe('playing')
  })

  // The guard, and the reason the event can be sent from a screen that does not check
  // first: a run that is not a tutorial has no scripted board to be put back to.
  it('is ignored in a run that is not a tutorial', () => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'hard' })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    const before = actor.getSnapshot().context.grid
    actor.send({ type: 'REWIND', board: 2, now: 1 })
    const { context } = actor.getSnapshot()
    expect(context.hits).toBe(0)
    expect(context.grid).toEqual(before)
  })

  // Past the script there is no board to go back to. Nothing asks, but a rewind that
  // dealt an undefined target would put a blank card on the board.
  it('is ignored past the end of the script', () => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, runId: nextRunId(), tutorial: true })
    actor.send({ type: 'REWIND', board: TUTORIAL_TARGETS.length, now: 1 })
    expect(actor.getSnapshot().context.hits).toBe(0)
  })
})

describe('the whole-dial streak', () => {
  // `challenge/four-keys` is the one mode on it. Its dial is 2×2 weighted [1, 2, 2, 4],
  // so one press of each key sums to 9 and a single press of the 4 key sums to 4.
  const start = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'challenge/four-keys' })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    return actor
  }

  it('builds on a target taken with every key', () => {
    const actor = start()
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    for (const index of [0, 1, 2, 3]) {
      actor.send({ type: 'PRESS', index, delta: 1, now: 0 })
    }
    expect(actor.getSnapshot().context.hits).toBe(1)
    expect(actor.getSnapshot().context.streak).toBe(1)
  })

  it('does not build on a target taken with one key', () => {
    // The cheapest route to 4 is a single press of the 4 key — par, and worth more per
    // point than the long way round. That it earns no streak is the whole trade.
    const actor = start()
    actor.send({ type: 'ADD_TARGET', value: 4, at: 0 })
    actor.send({ type: 'PRESS', index: 3, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.hits).toBe(1)
    expect(actor.getSnapshot().context.streak).toBe(0)
  })

  it('is broken by a hit that left a key alone', () => {
    // A chain, unlike the `clear` rule it replaced, which nothing a player did could
    // break. Build it, then take the cheap route and watch it go.
    const actor = start()
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    for (const index of [0, 1, 2, 3]) {
      actor.send({ type: 'PRESS', index, delta: 1, now: 0 })
    }
    expect(actor.getSnapshot().context.streak).toBe(1)

    actor.send({ type: 'ADD_TARGET', value: 13, at: 0 })
    // 9 + 4: one more press of the 4 key, leaving the other three where they are.
    actor.send({ type: 'PRESS', index: 3, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.hits).toBe(2)
    expect(actor.getSnapshot().context.streak).toBe(0)
  })
})

// The one way into game over that is not about the run: the **session**'s window shut
// under it. The machine has never heard of a session and does not learn about one here —
// it is told the run is over, and the only thing it does differently from a last life is
// leave every figure of the run alone.
describe('a window shutting under a live run', () => {
  it('ends the run without taking a life or touching what it scored', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const before = actor.getSnapshot().context

    actor.send({ type: 'EXPIRE', now: 1000 })

    const after = actor.getSnapshot()
    expect(after.value).toBe('gameOver')
    // Not a life loss. A run cut short by the clock on the contest is not a run the
    // player lost, and the title it ends on says so.
    expect(after.context.lives).toBe(before.lives)
    expect(after.context.score).toBe(before.score)
    expect(after.context.hits).toBe(before.hits)
    expect(after.context.streak).toBe(before.streak)
  })

  it('stops the clock the way every other way into game over stops it', () => {
    const actor = start('speed')
    actor.send({ type: 'EXPIRE', now: 4000 })
    const { context } = actor.getSnapshot()
    expect(context.elapsedMs).toBe(4000)
    expect(context.playingSince).toBeNull()
  })

  it('is ignored while paused — the pause screen is not taken away mid-read', () => {
    const actor = start('accuracy')
    actor.send({ type: 'PAUSE', now: 500 })
    actor.send({ type: 'EXPIRE', now: 1000 })
    expect(actor.getSnapshot().value).toBe('paused')
  })

  it('ends the run on the resume that follows instead', () => {
    const actor = start('accuracy')
    actor.send({ type: 'PAUSE', now: 500 })
    actor.send({ type: 'EXPIRE', now: 1000 })
    actor.send({ type: 'RESUME', now: 1500 })
    actor.send({ type: 'EXPIRE', now: 1600 })
    expect(actor.getSnapshot().value).toBe('gameOver')
  })

  it('does nothing on the intro or on a run that has already ended', () => {
    const idle = createActor(gameMachine)
    idle.start()
    idle.send({ type: 'EXPIRE', now: 0 })
    expect(idle.getSnapshot().value).toBe('menu')

    const over = start('accuracy')
    over.send({ type: 'EXPIRE', now: 1000 })
    const settled = over.getSnapshot().context.elapsedMs
    // A second one arriving a tick later — the wake and the strip can both land — must
    // not restart the clock or move anything the screen is already drawing.
    over.send({ type: 'EXPIRE', now: 9000 })
    expect(over.getSnapshot().value).toBe('gameOver')
    expect(over.getSnapshot().context.elapsedMs).toBe(settled)
  })
})

describe('NO SLIP', () => {
  const NO_SLIP = challengeId('no-slip')

  const started = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: NO_SLIP })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    return actor
  }

  it('plays on through exact hits and ends on the first that is not', () => {
    const actor = started()
    // Par 1 on the bottom-right key, taken in one press: exact, so the heart stays.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().value).toBe('playing')
    expect(actor.getSnapshot().context.lives).toBe(3)

    // 11 from 9 is one press on the 2 key. Taken the long way round — up and back on
    // the 1 key first — it is three, which is a slip, and a slip takes every heart left:
    // the end of the run.
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 1, delta: 1, now: 0 })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe('gameOver')
    expect(snap.context.lives).toBe(0)
    expect(snap.context.hits).toBe(2)
  })

  it('doubles nothing and counts no strike, a board-clearing hit included', () => {
    const actor = started()
    // One target, taken exactly: the board is empty after it, which Trainee's rule would
    // have doubled and counted as a strike.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const { context } = actor.getSnapshot()
    expect(context.targets).toHaveLength(0)
    expect(context.strikes).toBe(0)
    expect(context.hitBatch.hits[0]?.multiplier).toBe(1)
  })

  it('lets a target run out for one heart, as any mode that spends them', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    expect(actor.getSnapshot().value).toBe('playing')
    expect(actor.getSnapshot().context.lives).toBe(2)
  })

  it('takes every heart left on a slip, however many there are', () => {
    const actor = started()
    // A wasted press, then the target: two steps against par 1.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const snap = actor.getSnapshot()
    expect(snap.context.lives).toBe(0)
    expect(snap.value).toBe('gameOver')
  })
})

describe("Trainee's doubled rule", () => {
  it('doubles a hit that empties the board and counts it as a strike, building no streak', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const { context } = actor.getSnapshot()
    expect(context.hitBatch.hits[0]?.multiplier).toBe(2)
    expect(context.strikes).toBe(1)
    expect(context.streak).toBe(0)
  })

  it('leaves a hit that does not empty the board alone', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'ADD_TARGET', value: 40, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.hitBatch.hits[0]?.multiplier).toBe(1)
  })
})

describe('claimedTime', () => {
  it('is nothing for a run whose standings are not a race', () => {
    const actor = start('accuracy')
    actor.send({ type: 'EXPIRE', now: 4000 })
    expect(claimedTime(actor.getSnapshot().context)).toBeNull()
  })
})

describe('DRIFT', () => {
  const DRIFT = challengeId('drift')

  const started = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: DRIFT })
    actor.send({ type: 'START', now: 0, runId: nextRunId() })
    return actor
  }

  // The 1 key, pressed up `times` times at `now`: the sum climbs one at a time.
  const pressUp = (actor: ReturnType<typeof started>, times: number, now: number) => {
    for (let press = 0; press < times; press++) {
      actor.send({ type: 'PRESS', index: 0, delta: 1, now })
    }
  }

  it('hits the number a target shows at the press, not the one it arrived as', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 3, at: 0, drift: 1 })
    // Two seconds on it reads 5. Dialling through 3 on the way does not take it.
    pressUp(actor, 3, 2000)
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    pressUp(actor, 2, 2000)
    expect(actor.getSnapshot().context.targets).toHaveLength(0)
    expect(actor.getSnapshot().context.hits).toBe(1)
  })

  it('drifts the other way just as well', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0, drift: -1 })
    pressUp(actor, 6, 3000)
    expect(actor.getSnapshot().context.hits).toBe(1)
  })

  it('builds the streak on a hit in the first second and breaks it on a later one', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 2, at: 0, drift: 1 })
    pressUp(actor, 2, 500)
    expect(actor.getSnapshot().context.streak).toBe(1)
    expect(actor.getSnapshot().context.strikes).toBe(1)
    // A second target, taken after it has moved: the chain goes.
    actor.send({ type: 'ADD_TARGET', value: 4, at: 1000, drift: 1 })
    pressUp(actor, 3, 2500)
    expect(actor.getSnapshot().context.hits).toBe(2)
    expect(actor.getSnapshot().context.streak).toBe(0)
  })

  // 12 in two presses, by way of 9 — past nothing a target arriving at 10 reads.
  const dialTwelve = (actor: ReturnType<typeof started>) => {
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 100 })
    actor.send({ type: 'PRESS', index: 2, delta: 1, now: 100 })
  }

  it('takes a target the moment it drifts onto the sum already dialled', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 10, at: 0, drift: 1 })
    dialTwelve(actor) // the sum is 12, by way of 9; the target still reads 10
    expect(actor.getSnapshot().context.targets).toHaveLength(1)
    // At two seconds it reads 12, which is what the dial already says.
    actor.send({ type: 'TICK', now: 2000 })
    const { context } = actor.getSnapshot()
    expect(context.targets).toHaveLength(0)
    expect(context.hits).toBe(1)
    // Caught on its way, not before it moved: no strike.
    expect(context.strikes).toBe(0)
  })

  it('leaves a target whose ring has run out to its expiry, even on the sum', () => {
    const actor = started()
    // Falling from 29 it reads 12 at 17 s — half a second after its 16.5 s ring is out.
    actor.send({ type: 'ADD_TARGET', value: 29, at: 0, drift: -1 })
    dialTwelve(actor)
    expect(actor.getSnapshot().context.targets[0]?.duration).toBe(16_500)
    actor.send({ type: 'TICK', now: 17_000 })
    expect(actor.getSnapshot().context.hits).toBe(0)
  })

  it('leaves the run alone on a tick that lands on nothing', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 50, at: 0, drift: 1 })
    dialTwelve(actor)
    const before = actor.getSnapshot().context
    expect(before.targets).toHaveLength(1)
    actor.send({ type: 'TICK', now: 2000 })
    const after = actor.getSnapshot().context
    expect(after.targets).toEqual(before.targets)
    expect(after.hitBatch).toBe(before.hitBatch)
  })

  it('counts no press for a tick', () => {
    const actor = started()
    actor.send({ type: 'ADD_TARGET', value: 10, at: 0, drift: 1 })
    actor.send({ type: 'ADD_TARGET', value: 50, at: 0, drift: 1 })
    dialTwelve(actor)
    const steps = actor
      .getSnapshot()
      .context.targets.find((t) => t.value === 50)?.userSteps
    actor.send({ type: 'TICK', now: 2000 })
    // The other target's reference is reset by the hit, as a press's would be.
    expect(
      actor.getSnapshot().context.targets.find((t) => t.value === 50)?.userSteps,
    ).toBe(0)
    expect(steps).toBe(2)
  })

  it('scores two hits with the same time left the same, however long the route', () => {
    const quick = started()
    quick.send({ type: 'ADD_TARGET', value: 9, at: 0, drift: 1 })
    quick.send({ type: 'PRESS', index: 8, delta: 1, now: 500 }) // one press on the 9 key
    const roundabout = started()
    roundabout.send({ type: 'ADD_TARGET', value: 9, at: 0, drift: 1 })
    pressUp(roundabout, 9, 500) // nine presses on the 1 key
    expect(quick.getSnapshot().context.score).toBe(roundabout.getSnapshot().context.score)
  })
})
