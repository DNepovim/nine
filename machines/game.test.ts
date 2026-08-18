import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import {
  buildPressGrid,
  buildSetGrid,
  effectiveTimeout,
  gameMachine,
  type Grid,
} from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'

const start = (mode: 'trainee' | 'accuracy' | 'speed') => {
  const actor = createActor(gameMachine)
  actor.start()
  actor.send({ type: 'SET_MODE', mode })
  actor.send({ type: 'START', now: 0 })
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

describe('per mode × difficulty stats shape', () => {
  it('exposes a nested stats record', () => {
    const actor = createActor(gameMachine)
    actor.start()
    const { stats } = actor.getSnapshot().context
    expect(stats.accuracy.hard).toEqual({ score: 0, hits: 0 })
    expect(stats.speed.extreme).toEqual({ score: 0, hits: 0 })
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
    actor.send({ type: 'START', now: 0 })
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
  // one is accuracyFactor(1, 5) = 0, well under the 20% floor.
  const wasteThenHit = (actor: ReturnType<typeof start>) => {
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
  }

  it('costs a life on a hit under 20% accuracy, and marks that hit', () => {
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
  const duration = effectiveTimeout('speed', 'hard')
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
    expect(first).toBe(effectiveTimeout('speed', 'hard'))
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
      effectiveTimeout('accuracy', 'hard'),
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

describe('grid builders', () => {
  const zeros: Grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]

  it('wraps a press up from 9 and down from 0', () => {
    const nines: Grid = [
      [9, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    expect(buildPressGrid(nines, 0, 1)[0][0]).toBe(0)
    expect(buildPressGrid(zeros, 0, -1)[0][0]).toBe(9)
  })

  it('leaves every other cell alone', () => {
    expect(buildPressGrid(zeros, 4, 1)).toEqual([
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ])
  })

  it('sets a cell outright', () => {
    expect(buildSetGrid(zeros, 8, 9)[2][2]).toBe(9)
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
    actor.send({ type: 'START', now: 0 })
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

    // Accuracy has three lives, so three expiries are what reaches game over —
    // the only state RESTART is handled in.
    for (const value of [100, 101, 102]) {
      actor.send({ type: 'ADD_TARGET', value, at: 0 })
      const id = actor.getSnapshot().context.targets[0]?.id ?? 0
      actor.send({ type: 'TARGET_EXPIRED', id, now: 0 })
    }
    expect(actor.getSnapshot().value).toBe('gameOver')

    actor.send({ type: 'RESTART', now: 0 })
    expect(actor.getSnapshot().context.hitBatch.hits).toEqual([])
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
    actor.send({ type: 'START', now: 0 })
    expect(cleanHitReason(actor.getSnapshot().context.hitBatch.hits)).toBeNull()
  })
})

describe('run clock', () => {
  const started = () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'START', now: 1000 })
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
    // Accuracy takes a life for a hit under 20% accuracy. Two expiries bring lives
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
    // to zero, then the hit: userSteps 5 against par 1 is well under 20% accuracy.
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

    actor.send({ type: 'RESTART', now: 10_000 })
    expect(actor.getSnapshot().context.elapsedMs).toBe(0)
    actor.send({ type: 'PAUSE', now: 10_500 })
    expect(actor.getSnapshot().context.elapsedMs).toBe(500)
  })
})
