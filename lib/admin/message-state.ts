// What a message is, as one word rather than two nullable columns read in the right
// order.
//
// Its own file, and pure, for the reason `feedback-outcome.ts` is one beside
// `feedback-submission.ts`: `lib/admin/feedback.ts` reaches for `lib/supabase`, which
// pulls in AsyncStorage, which does not load under vitest's node environment. This is the
// half worth testing, so this is the half that has to be reachable.

export type MessageState = 'owed' | 'answered' | 'dismissed'

// Structural rather than `AdminMessage`, which lives in the module that cannot be
// imported here. It is also the honest signature: these two columns are the whole of what
// the question is about.
export type MessageStanding = {
  answer: string | null
  dismissedAt: number | null
}

// The single reading of those two columns. The filter above the list, the chip on the row
// and the pair of buttons under it all ask this same question, and three readings of the
// same two columns is three chances to disagree.
//
// **Answered beats set aside.** No row the server writes can hold both — answering clears
// `dismissed_at`, see 20261016000000_feedback_dismiss.sql — and this still decides it,
// because a row that somehow held both would otherwise be drawn as unanswered while
// carrying a reply the player may already have read.
export const stateOf = (message: MessageStanding): MessageState => {
  if (message.answer !== null) return 'answered'
  return message.dismissedAt === null ? 'owed' : 'dismissed'
}
