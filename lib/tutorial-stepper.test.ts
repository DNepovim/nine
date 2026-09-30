import { describe, expect, it } from 'vitest'

import { TUTORIAL_TARGETS } from '@/constants/tutorial'
import {
  canGoBack,
  canGoForward,
  previousStep,
  stepState,
  TUTORIAL_STEPS,
} from '@/lib/tutorial-stepper'

describe('the stepper', () => {
  // The same pin the lesson's own list carries: a board added to the script without a
  // number to reach it by is a board the stepper cannot go back to.
  it('draws one number per scripted board', () => {
    expect(TUTORIAL_STEPS).toBe(TUTORIAL_TARGETS.length)
  })

  it('fills the board the player is standing on', () => {
    expect(stepState(2, 2, 4)).toBe('current')
  })

  it('opens every board already behind the furthest reached', () => {
    expect(stepState(0, 2, 4)).toBe('visited')
    expect(stepState(1, 2, 4)).toBe('visited')
    expect(stepState(3, 2, 4)).toBe('visited')
    expect(stepState(4, 2, 4)).toBe('visited')
  })

  // The no-skipping rule, seen from the numbers: a board nobody has reached cannot be
  // tapped to, however far along the row it sits.
  it('locks every board past the furthest reached', () => {
    expect(stepState(3, 2, 2)).toBe('locked')
    expect(stepState(4, 2, 2)).toBe('locked')
  })

  it('lets the player back from anywhere but the first board', () => {
    expect(canGoBack(0)).toBe(false)
    expect(canGoBack(1)).toBe(true)
    expect(canGoBack(TUTORIAL_TARGETS.length - 1)).toBe(true)
  })

  // Forward only for somebody who went back. A player who has never used the stepper
  // stands at their own furthest, and NEXT is dark for them the whole way through.
  it('only lets the player forward over ground they have covered', () => {
    expect(canGoForward(2, 2)).toBe(false)
    expect(canGoForward(1, 2)).toBe(true)
    expect(canGoForward(0, 4)).toBe(true)
  })

  // Past the script the run is a plain tutorial run, and `furthest` walks past the last
  // number. Every number is behind the player then, and only PREV is left.
  it('leaves the whole row open once the script has run out', () => {
    const past = TUTORIAL_TARGETS.length
    expect(stepState(past - 1, past, past)).toBe('visited')
    expect(canGoForward(past, past)).toBe(false)
    expect(canGoBack(past)).toBe(true)
  })

  // PREV from a rolled board, two targets past the sign-off. A step down from six would
  // ask for a board the script has not got, the machine would refuse it, and the arrow
  // would be lit over nothing — so the step down from anywhere past the script is onto
  // the last board the script has.
  it('steps back onto the last scripted board from past the script', () => {
    expect(previousStep(TUTORIAL_STEPS + 1)).toBe(TUTORIAL_STEPS - 1)
    expect(previousStep(TUTORIAL_STEPS)).toBe(TUTORIAL_STEPS - 1)
  })

  it('steps back one board from inside the script', () => {
    expect(previousStep(1)).toBe(0)
    expect(previousStep(TUTORIAL_STEPS - 1)).toBe(TUTORIAL_STEPS - 2)
  })

  // The other half of the same bound. A player who cleared the last board stands at a
  // furthest of five with only five numbers to stand on, so walking forward would run out
  // of row before it ran out of ground covered: NEXT goes dark on the last number and the
  // player plays that board to reach free play again.
  it('stops the walk forward on the last scripted board', () => {
    const cleared = TUTORIAL_STEPS
    expect(canGoForward(TUTORIAL_STEPS - 2, cleared)).toBe(true)
    expect(canGoForward(TUTORIAL_STEPS - 1, cleared)).toBe(false)
  })
})
