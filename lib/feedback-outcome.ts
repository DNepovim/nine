import { isNetworkFailure } from '@/lib/connectivity'

// The pure half of sending feedback, split from `feedback-submission.ts` so it can be
// tested: that module reaches for `lib/supabase`, which imports AsyncStorage, which does
// not load under vitest's node environment.

// How long a message may be. The input's `maxLength` and the column's check constraint
// are both this number — a player who can type it is a player the database will accept.
export const MAX_FEEDBACK_LENGTH = 800

// How the send went. The two failures are not the same thing to a player: `offline` is
// the same message worth sending again in a minute, `refused` is the server having
// answered and said no, which asking again will not change.
export type FeedbackSent = 'sent' | 'offline' | 'refused'

export function feedbackOutcome(error: { message: string } | null): FeedbackSent {
  if (error === null) return 'sent'
  if (isNetworkFailure(error.message)) return 'offline'
  return 'refused'
}
