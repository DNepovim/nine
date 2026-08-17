import { describe, expect, it } from 'vitest'

import {
  CLEAN_RUN,
  initialStepUp,
  invitePool,
  MIN_HITS,
  MIN_RUN_MS,
  openerPool,
  stepUpMessage,
  stepUpReducer,
  type StepUpFacts,
  type StepUpState,
} from './step-up'

const facts = (over: Partial<StepUpFacts> = {}): StepUpFacts => ({
  clean: true,
  hits: MIN_HITS,
  elapsedMs: MIN_RUN_MS,
  playedScored: false,
  ...over,
})

// Feeds a sequence of batches through, as the hook does across a run.
const play = (inputs: StepUpFacts[], from: StepUpState = initialStepUp()) =>
  inputs.reduce<{ state: StepUpState; offers: number }>(
    (acc, next) => {
      const step = stepUpReducer(acc.state, next)
      return { state: step.state, offers: acc.offers + (step.offer ? 1 : 0) }
    },
    { state: from, offers: 0 },
  )

const cleanRun = (count: number, over: Partial<StepUpFacts> = {}) =>
  Array.from({ length: count }, () => facts(over))

describe('stepUpReducer', () => {
  it('offers once a clean run reaches the bar', () => {
    expect(play(cleanRun(CLEAN_RUN)).offers).toBe(1)
  })

  it('says nothing one hit short of the bar', () => {
    expect(play(cleanRun(CLEAN_RUN - 1)).offers).toBe(0)
  })

  it('starts the run over on a hit that was not clean', () => {
    const inputs = [
      ...cleanRun(CLEAN_RUN - 1),
      facts({ clean: false }),
      ...cleanRun(CLEAN_RUN - 1),
    ]
    expect(play(inputs).offers).toBe(0)
  })

  it('offers only once however long the run goes on', () => {
    expect(play(cleanRun(CLEAN_RUN * 4)).offers).toBe(1)
  })

  it('holds off until the run has enough hits behind it', () => {
    // A lucky opening: the clean run is there, the evidence is not.
    expect(play(cleanRun(CLEAN_RUN, { hits: MIN_HITS - 1 })).offers).toBe(0)
  })

  it('holds off until the player has been at it a while', () => {
    expect(play(cleanRun(CLEAN_RUN, { elapsedMs: MIN_RUN_MS - 1 })).offers).toBe(0)
  })

  it('never offers to someone who has played a scored board', () => {
    expect(play(cleanRun(CLEAN_RUN * 2, { playedScored: true })).offers).toBe(0)
  })

  it('keeps counting a clean run while the floors are unmet, so the offer lands late', () => {
    const early = cleanRun(CLEAN_RUN, { hits: 2, elapsedMs: 0 })
    const later = play([...early, facts()])
    expect(later.offers).toBe(1)
  })
})

describe('stepUpMessage', () => {
  it('picks the first of each pool at the bottom of the range', () => {
    expect(stepUpMessage(0, 0)).toEqual({
      opener: openerPool()[0],
      invite: invitePool()[0],
    })
  })

  it('picks the last of each pool at the top of the range', () => {
    const openers = openerPool()
    const invites = invitePool()
    expect(stepUpMessage(0.999, 0.999)).toEqual({
      opener: openers[openers.length - 1],
      invite: invites[invites.length - 1],
    })
  })

  it('clamps a roll of exactly 1 rather than falling off the end', () => {
    const message = stepUpMessage(1, 1)
    expect(openerPool()).toContain(message.opener)
    expect(invitePool()).toContain(message.invite)
  })

  it('rolls the two halves independently', () => {
    expect(stepUpMessage(0, 0.999).invite).not.toBe(stepUpMessage(0, 0).invite)
  })

  it('takes the streak count from the threshold rather than spelling it out', () => {
    // Raising CLEAN_RUN must not leave the words claiming the old number.
    expect(openerPool().some((line) => line.includes(String(CLEAN_RUN)))).toBe(true)
  })

  it('offers more than one way of saying each half', () => {
    expect(openerPool().length).toBeGreaterThan(1)
    expect(invitePool().length).toBeGreaterThan(1)
  })
})
