import { describe, expect, it } from 'vitest'

import { inviteMessage } from './invite-message'

describe('inviteMessage', () => {
  it('names the best and the board it was set on', () => {
    expect(inviteMessage('accuracy', 'hard', 4820)).toBe(
      'My best at Nine is 4820 — Accuracy, Hard. Think you can beat it?',
    )
  })

  it('describes the game instead when the board has no best yet', () => {
    expect(inviteMessage('speed', 'extreme', 0)).toBe(
      'Nine buttons, one number to hit. Come take a run at it.',
    )
  })

  it('never brags on trainee, which keeps no board', () => {
    expect(inviteMessage('trainee', 'easy', 9999)).toBe(
      'Nine buttons, one number to hit. Come take a run at it.',
    )
  })
})
