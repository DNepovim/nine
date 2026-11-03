// A **remark**: the written half of a **rating**, asked on the rating dialog's second step
// and read only by an admin on the challenge's page in the lab. Not feedback — that word
// is what a player sends through TELL US, and a remark is never answered.
//
// Pure, beside `lib/session-rating.ts`. The write is `remarkSession` in
// `lib/session-ratings.ts`.

// How long a remark may be. The text area's `maxLength` and the column's check constraint
// both say 500 — see 20261103010000_rating_remark.sql. A line about one session, shorter
// than a message's 800, because the page lists all of a challenge's at once.
export const MAX_REMARK_LENGTH = 500

// What SEND would write: the text trimmed, or null when there is nothing in it. The
// server trims too and refuses a blank — this is what keeps SEND shut before it gets
// the chance.
export const remarkOf = (text: string): string | null => {
  const trimmed = text.trim()
  return trimmed === '' ? null : trimmed
}
