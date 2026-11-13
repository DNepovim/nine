import { describe, expect, it } from 'vitest'

import {
  CHALLENGE_WORD,
  challengeId,
  DIFFICULTIES,
  getDifficultyColor,
  gradientOf,
  type ModeId,
} from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

import { accentFor, subtitleFor, wordmarkFor } from './run-title'

const CHALLENGE: ModeId = challengeId('drift')

describe('accentFor', () => {
  it('paints a permanent mode in its first stop', () => {
    expect(accentFor('accuracy')).toBe(gradientOf('accuracy')[0])
  })

  it('paints a challenge in the ink of its own second stop', () => {
    expect(accentFor(CHALLENGE)).toBe(challengeInk(gradientOf(CHALLENGE)[1]))
  })
})

describe('wordmarkFor', () => {
  it('follows the rung on a permanent mode', () => {
    expect(wordmarkFor('speed', 'hard')).toBe(getDifficultyColor('speed', 'hard'))
  })

  it('takes the row’s ink on a challenge', () => {
    expect(wordmarkFor(CHALLENGE, 'hard')).toBe(accentFor(CHALLENGE))
  })
})

describe('subtitleFor', () => {
  it('says the rung on a mode that uses difficulty', () => {
    expect(subtitleFor('accuracy', true, 'extreme')).toBe(DIFFICULTIES.extreme.label)
  })

  it('says nothing on one that does not', () => {
    expect(subtitleFor('trainee', false, 'easy')).toBeNull()
  })

  it('says CHALLENGE on a challenge', () => {
    expect(subtitleFor(CHALLENGE, false, 'easy')).toBe(CHALLENGE_WORD)
  })
})
