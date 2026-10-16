import { describe, expect, it } from 'vitest'

import { stateOf } from '@/lib/admin/message-state'

describe('stateOf', () => {
  it('is owed while there is no answer and nobody set it aside', () => {
    expect(stateOf({ answer: null, dismissedAt: null })).toBe('owed')
  })

  it('is answered once there are words to deliver', () => {
    expect(stateOf({ answer: 'Fixed in the next build.', dismissedAt: null })).toBe(
      'answered',
    )
  })

  it('is set aside when it was, and only while it has no answer', () => {
    expect(stateOf({ answer: null, dismissedAt: 1_760_000_000_000 })).toBe('dismissed')
  })

  it('reads answered over set aside, so a row holding both is never drawn as unanswered', () => {
    // The server cannot write this row — answering clears `dismissed_at` — and the rule
    // still has to decide, because the alternative is a screen offering to answer a
    // message whose reply the player may already have read.
    expect(stateOf({ answer: 'Noted, thank you.', dismissedAt: 1_760_000_000_000 })).toBe(
      'answered',
    )
  })

  it('reads an empty answer as an answer, which is what the column means', () => {
    // Not reachable either: the check constraint is 1 to 800 characters after trimming,
    // so an empty string never reaches a row. Null is the only "no answer" there is, and
    // this holds the predicate to that rather than to truthiness.
    expect(stateOf({ answer: '', dismissedAt: null })).toBe('answered')
  })
})
