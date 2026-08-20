import { describe, expect, it } from 'vitest'

import { feedbackOutcome, MAX_FEEDBACK_LENGTH } from './feedback-outcome'

describe('feedbackOutcome', () => {
  it('is sent when the server answered without an error', () => {
    expect(feedbackOutcome(null)).toBe('sent')
  })

  it('is offline when the request never reached the server', () => {
    expect(feedbackOutcome({ message: 'Failed to fetch' })).toBe('offline')
    expect(feedbackOutcome({ message: 'Network request failed' })).toBe('offline')
  })

  it('is refused when the server answered and rejected the row', () => {
    expect(
      feedbackOutcome({ message: 'new row violates row-level security policy' }),
    ).toBe('refused')
  })

  // The distinction the UI hangs on: offline is worth retrying with the same message,
  // refused is not going to start working on its own.
  it('never reports sent for any error', () => {
    for (const message of ['Load failed', 'permission denied', '']) {
      expect(feedbackOutcome({ message })).not.toBe('sent')
    }
  })
})

describe('MAX_FEEDBACK_LENGTH', () => {
  // The column's check constraint is written against this number
  // (supabase/migrations/20260819000000_feedback.sql). If they disagree, the input
  // accepts a message the database then refuses.
  it('matches the length the feedback column accepts', () => {
    expect(MAX_FEEDBACK_LENGTH).toBe(800)
  })
})
