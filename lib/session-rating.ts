import { isOneOf } from 'narrowland'

// A **rating**: one player's answer to "how was this one?" for one **session** they
// played, asked once on the intro straight after that session's **summary**.
//
// Nine answers, because the question is put on a dial of nine keys — the player rates a
// challenge the way they played it. 1 is NOT FOR ME and 9 is MORE OF THIS; nothing in
// between is named, and nothing reads the figure back in the app yet. Not the **fortune**,
// which is "never a rating": that one is points, this one is an opinion.
//
// Everything here is pure. The write is `lib/session-ratings.ts`, the asking is
// `hooks/use-session-rating.ts`, and the dialog is `rating-overlay.tsx`.
export const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export type Rating = (typeof RATINGS)[number]

export const isRating = (value: number): value is Rating => isOneOf(value, RATINGS)
