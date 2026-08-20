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
  TUTORIAL_HITS,
  type StepUpFacts,
  type StepUpState,
} from './step-up'

const facts = (over: Partial<StepUpFacts> = {}): StepUpFacts => ({
  clean: true,
  hits: MIN_HITS,
  elapsedMs: MIN_RUN_MS,
  playedScored: false,
  fromTutorial: false,
  ...over,
})

// Feeds a sequence of batches through, as the hook does across a run.
const play = (inputs: StepUpFacts[], from: StepUpState = initialStepUp()) =>
  inputs.reduce<{ state: StepUpState; offers: number; last: string | null }>(
    (acc, next) => {
      const step = stepUpReducer(acc.state, next)
      return {
        state: step.state,
        offers: acc.offers + (step.offer === null ? 0 : 1),
        last: step.offer ?? acc.last,
      }
    },
    { state: from, offers: 0, last: null },
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

  it('names which bar was cleared', () => {
    expect(play(cleanRun(CLEAN_RUN)).last).toBe('clean')
  })
})

// A run started from the tutorial's closing CTA. The player has just been taught the
// game and has never seen a scored board, so the offer is owed to them on hit count
// alone — how well those hits went is beside the point.
describe('stepUpReducer, straight out of the tutorial', () => {
  const fromTutorial = (count: number, over: Partial<StepUpFacts> = {}) =>
    Array.from({ length: count }, (_unused, index) =>
      facts({ fromTutorial: true, hits: index + 1, ...over }),
    )

  it('offers on hit count alone, with nothing clean about the run', () => {
    const messy = fromTutorial(TUTORIAL_HITS, { clean: false })
    expect(play(messy).offers).toBe(1)
    expect(play(messy).last).toBe('tutorial')
  })

  it('says nothing one hit short', () => {
    expect(play(fromTutorial(TUTORIAL_HITS - 1, { clean: false })).offers).toBe(0)
  })

  it('does not wait out the clock the clean bar waits out', () => {
    expect(play(fromTutorial(TUTORIAL_HITS, { clean: false, elapsedMs: 0 })).offers).toBe(
      1,
    )
  })

  it('still offers only once', () => {
    expect(play(fromTutorial(TUTORIAL_HITS * 3, { clean: false })).offers).toBe(1)
  })

  it('stays quiet for a veteran replaying the tutorial', () => {
    // They already know the boards exist, so there is nothing to introduce.
    const played = fromTutorial(TUTORIAL_HITS * 2, { clean: false, playedScored: true })
    expect(play(played).offers).toBe(0)
  })

  it('leaves a run not started from the tutorial on the clean bar', () => {
    const messy = Array.from({ length: TUTORIAL_HITS * 2 }, (_unused, index) =>
      facts({ clean: false, hits: index + 1 }),
    )
    expect(play(messy).offers).toBe(0)
  })

  it('takes whichever bar comes first when a tutorial run is also playing well', () => {
    // Five clean hits arrive well before twelve of anything.
    expect(play(cleanRun(CLEAN_RUN, { fromTutorial: true })).last).toBe('clean')
  })
})

describe('stepUpMessage', () => {
  it('picks the first of each pool at the bottom of the range', () => {
    expect(stepUpMessage('clean', 0, 0)).toEqual({
      opener: openerPool('clean')[0],
      invite: invitePool()[0],
    })
  })

  it('picks the last of each pool at the top of the range', () => {
    const openers = openerPool('clean')
    const invites = invitePool()
    expect(stepUpMessage('clean', 0.999, 0.999)).toEqual({
      opener: openers[openers.length - 1],
      invite: invites[invites.length - 1],
    })
  })

  it('clamps a roll of exactly 1 rather than falling off the end', () => {
    const message = stepUpMessage('clean', 1, 1)
    expect(openerPool('clean')).toContain(message.opener)
    expect(invitePool()).toContain(message.invite)
  })

  it('rolls the two halves independently', () => {
    expect(stepUpMessage('clean', 0, 0.999).invite).not.toBe(
      stepUpMessage('clean', 0, 0).invite,
    )
  })

  it('takes the streak count from the threshold rather than spelling it out', () => {
    // Raising CLEAN_RUN must not leave the words claiming the old number.
    expect(openerPool('clean').some((line) => line.includes(String(CLEAN_RUN)))).toBe(
      true,
    )
  })

  it('offers more than one way of saying each half', () => {
    expect(openerPool('clean').length).toBeGreaterThan(1)
    expect(openerPool('tutorial').length).toBeGreaterThan(1)
    expect(invitePool().length).toBeGreaterThan(1)
  })

  it('never congratulates a tutorial run on how it went', () => {
    // The tutorial offer fires whatever the hits looked like, so an opener claiming
    // a streak or good play would be telling a player something untrue about it.
    expect(openerPool('tutorial')).not.toEqual(
      expect.arrayContaining([...openerPool('clean')]),
    )
    for (const line of openerPool('tutorial')) {
      expect(line).not.toContain(String(CLEAN_RUN))
    }
  })

  it('draws tutorial openers from their own pool', () => {
    expect(openerPool('tutorial')).toContain(stepUpMessage('tutorial', 0, 0).opener)
  })
})
