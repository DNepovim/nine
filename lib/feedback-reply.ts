import { isArray, isNonEmptyString, isObject } from 'narrowland'

// What the player wrote, and when. Quoted above the answer so the reply has its question
// in front of it — see supabase/migrations/20260925000000_feedback_reply_quote.sql.
export type FeedbackQuote = {
  message: string
  // ISO 8601, straight from `created_at`. Kept as the string the server sent and turned
  // into a date only at the moment it is drawn: the value travels through state and props
  // that are compared by identity, and a `Date` would be a new object every render.
  sentAt: string
}

// One answer waiting for the player. The id is only ever handed back to
// `mark_feedback_reply_seen`; nothing on this side reads it for meaning.
export type FeedbackReply = {
  id: string
  answer: string
  // Null from a server that predates the quote migration — a cached bundle talking to a
  // database that has not been pushed, or a local stack that has not been reset. The
  // dialog then draws the answer alone, which is what it drew before the quote existed.
  quote: FeedbackQuote | null
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

    return [{ id, answer: trimmed, quote: toQuote(row) }]
  })
}

// The quote is the optional half of a row: anything missing or unusable about it drops
// the quote, never the reply. An answer that arrives without its question is worth far
// more than no answer at all.
function toQuote(row: Record<string, unknown>): FeedbackQuote | null {
  const { message, created_at: createdAt } = row
  if (!isNonEmptyString(message) || !isNonEmptyString(createdAt)) return null

  const trimmed = message.trim()
  if (!isNonEmptyString(trimmed)) return null

  // A date the platform cannot read would render as "Invalid Date" under the player's own
  // words. Better to show the words undated.
  if (Number.isNaN(Date.parse(createdAt))) return null

  return { message: trimmed, sentAt: createdAt }
}

// The date over the quote — "SEP 23, 2026" in English, "23. ZÁŘ 2026" in Czech: the
// month named rather than numbered, and upper case like every other small label in the
// app. Which of day and month comes first is the locale's business, not ours.
//
// `Intl` rather than hand-rolled month names, which would be twelve translatable strings
// for one decorative line. It is guarded because this repo has been bitten by Hermes'
// `Intl` before (see `lib/leaderboard-period.ts`, which computes Prague's offset by hand
// rather than trusting a named time zone); month names are a far lighter ask than zones,
// but a dialog that throws while drawing a nicety is not a trade worth making. The
// fallback is the ISO day, which is wrong in no language.
export function sentOnLabel(sentAt: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .format(new Date(sentAt))
      .toLocaleUpperCase(locale)
  } catch {
    return sentAt.slice(0, 10)
  }
}
