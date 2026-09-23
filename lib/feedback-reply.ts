import { isArray, isNonEmptyString, isObject } from 'narrowland'

// One answer waiting for the player. The id is only ever handed back to
// `mark_feedback_reply_seen`; nothing on this side reads it for meaning.
export type FeedbackReply = {
  id: string
  answer: string
}

// Pure, and in its own file for the same reason `feedback-outcome.ts` is: the module
// that fetches reaches for `lib/supabase`, which pulls in AsyncStorage, which does not
// load under vitest's node environment.

// What `my_feedback_replies` returned, narrowed to rows a dialog can actually be drawn
// from. The RPC hands back untyped data, and every failure here is the same failure —
// something arrived that is not an answer — so all of it comes out as "no reply owed"
// rather than as an error nobody could act on. Silence is the right failure mode for
// this: the answer stays unseen on the server and comes round again next launch.
export function toReplies(data: unknown): FeedbackReply[] {
  if (!isArray(data)) return []

  return data.flatMap((row) => {
    if (!isObject<Record<string, unknown>>(row)) return []

    const { id, answer } = row
    if (!isNonEmptyString(id) || !isNonEmptyString(answer)) return []

    // An answer of spaces is one somebody started and did not write. It would show as an
    // empty dialog, which reads as a bug rather than as a reply.
    const trimmed = answer.trim()
    if (!isNonEmptyString(trimmed)) return []

    return [{ id, answer: trimmed }]
  })
}
