import { describe, expect, it } from 'vitest'

import { TUTORIAL_STEP_COUNT } from '@/constants/tutorial'

import { clampStep, parseTutorialDone, serializeTutorialDone } from './tutorial'

describe('parseTutorialDone', () => {
  it('treats a missing value as never been through it', () => {
    expect(parseTutorialDone(null)).toBe(false)
  })

  it('reads the flag', () => {
    expect(parseTutorialDone('{"finished":true}')).toBe(true)
  })

  it('still reads a store written when a step was kept beside it', () => {
    expect(parseTutorialDone('{"finished":true,"step":2}')).toBe(true)
  })

  it('reads a half-finished first launch from an older build as not done', () => {
    expect(parseTutorialDone('{"finished":false,"step":3}')).toBe(false)
  })

  it('falls back to not done for malformed JSON', () => {
    expect(parseTutorialDone('{oops')).toBe(false)
  })

  it('falls back to not done for a value of the wrong shape', () => {
    expect(parseTutorialDone('{"finished":"yes"}')).toBe(false)
  })

  it('round-trips through serialize', () => {
    expect(parseTutorialDone(serializeTutorialDone(true))).toBe(true)
  })
})

describe('clampStep', () => {
  it('keeps a step inside the run of screens', () => {
    expect(clampStep(99)).toBe(TUTORIAL_STEP_COUNT - 1)
    expect(clampStep(-4)).toBe(0)
  })

  it('truncates a fractional step', () => {
    expect(clampStep(2.7)).toBe(2)
  })
})
