import { describe, expect, it } from 'vitest'

import { TUTORIAL_STEP_COUNT } from '@/constants/tutorial'

import {
  clampStep,
  FINISHED_PROGRESS,
  NO_PROGRESS,
  parseTutorialProgress,
  serializeTutorialProgress,
  tutorialLaunch,
} from './tutorial-progress'

describe('parseTutorialProgress', () => {
  it('treats a missing value as never started', () => {
    expect(parseTutorialProgress(null)).toEqual(NO_PROGRESS)
  })

  it('reads a stored step', () => {
    expect(parseTutorialProgress('{"finished":false,"step":3}')).toEqual({
      finished: false,
      step: 3,
    })
  })

  it('ignores the step once finished is set', () => {
    expect(parseTutorialProgress('{"finished":true,"step":2}')).toEqual(FINISHED_PROGRESS)
  })

  it('clamps a step beyond the last screen', () => {
    expect(parseTutorialProgress('{"step":99}').step).toBe(TUTORIAL_STEP_COUNT - 1)
  })

  it('clamps a negative step', () => {
    expect(parseTutorialProgress('{"step":-4}').step).toBe(0)
  })

  it('falls back to never started for malformed JSON', () => {
    expect(parseTutorialProgress('{oops')).toEqual(NO_PROGRESS)
  })

  it('falls back to never started when the shape is wrong', () => {
    expect(parseTutorialProgress('{"step":"three"}')).toEqual(NO_PROGRESS)
  })

  it('falls back to never started for a payload with no usable fields', () => {
    expect(parseTutorialProgress('{}')).toEqual(NO_PROGRESS)
  })
})

describe('serializeTutorialProgress', () => {
  it('omits the step when there is none', () => {
    expect(serializeTutorialProgress(FINISHED_PROGRESS)).toBe('{"finished":true}')
  })

  it('writes the step mid-run', () => {
    expect(serializeTutorialProgress({ finished: false, step: 2 })).toBe(
      '{"finished":false,"step":2}',
    )
  })

  it('round-trips through parse', () => {
    const progress = { finished: false, step: 4 }
    expect(parseTutorialProgress(serializeTutorialProgress(progress))).toEqual(progress)
  })
})

describe('tutorialLaunch', () => {
  it('opens at the first screen on a fresh install', () => {
    expect(tutorialLaunch(NO_PROGRESS)).toBe('fresh')
  })

  it('offers to resume when a step is stored', () => {
    expect(tutorialLaunch({ finished: false, step: 2 })).toBe('resume')
  })

  it('stays out of the way once finished', () => {
    expect(tutorialLaunch(FINISHED_PROGRESS)).toBe('hidden')
  })
})

describe('clampStep', () => {
  it('keeps an in-range step', () => {
    expect(clampStep(2)).toBe(2)
  })

  it('truncates a fractional step', () => {
    expect(clampStep(2.7)).toBe(2)
  })

  it('bounds both ends', () => {
    expect(clampStep(-1)).toBe(0)
    expect(clampStep(TUTORIAL_STEP_COUNT + 5)).toBe(TUTORIAL_STEP_COUNT - 1)
  })
})
