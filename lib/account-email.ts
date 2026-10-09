import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { isNetworkFailure } from '@/lib/connectivity'

// The rules about an address and the six digits that confirm it, kept apart from the
// network that carries them — the same split `lib/score-submission.ts` makes from
// `lib/local-scores.ts`, and for the same reason: everything here is decidable without a
// server, so it is decided without one and tested without one.
//
// `hooks/use-supabase-auth.ts` is the other half. It does the round trips and nothing
// else; every answer it gives back is one of the problems named below.

// Which of the two things one typed address turned out to mean. Decided by the server
// rather than by the player: an address nobody has is attached to the account they are
// signed in as, and an address somebody already has is the way back onto that profile.
//
// The player never picks between them and is never asked to. They type the address that is
// theirs; what follows is whichever of these it was.
export type EmailBranch = 'attach' | 'restore'

// Why a card is showing a red line. One union for both cards, because a player meets the
// same handful of walls whichever of the two they are standing in front of.
export type EmailProblem =
  // Not an address. Refused here, before anything is sent.
  | 'shape'
  // The address already has an account on it. Never shown: this is the signal the whole
  // flow pivots on — `sendCode` meets it, reads it as "that profile is probably yours",
  // and goes and fetches it instead. Kept in the union and in the lines below because it
  // is the honest reading of what the server said, and because a map that stays total
  // cannot be caught out by a future path that does surface it.
  | 'taken'
  // Not six digits. Refused here, like `shape`.
  | 'bad_code'
  // Six digits that the server would not take. Wrong or too old, and it cannot tell us
  // which — see `AUTH_PROBLEMS`.
  | 'expired'
  // Too many asks in too short a time.
  | 'rate_limited'
  // The request never arrived. The card says so and keeps what was typed.
  | 'offline'
  // Something else. Nothing is lost; try again.
  | 'unknown'

// How long the resend button stays dim after a code goes out.
//
// This number has a hard constraint on it, learned the hard way: it must be **at or above
// the server's own floor**, which is `max_frequency` in supabase/config.toml for the local
// stack and `smtp_max_frequency` in the dashboard for production. Below it, the button
// lights up while the server is still refusing — `over_email_send_rate_limit`, a 429, and
// no mail handed to the sender at all — so the one press a player is invited to make is
// the one press that cannot work. Production sat on Supabase's 60s default against this
// 30s for exactly that reason.
//
// Thirty seconds, and the floor set under it rather than this raised to meet a default: a
// button that can be pressed twice a second invites a player to press it twice a second
// and then meet `rate_limited`, which reads as the app being broken rather than as them
// being quick.
export const RESEND_COOLDOWN_MS = 30_000

// Six digits, and exactly six, because the server is told to send six: `otp_length` in
// supabase/config.toml for the local stack, and the same number in the dashboard for
// production, which that file never reaches. Change one and the other has to follow — a
// server on another length sends a code this card has no room for.
export const CODE_LENGTH = 6

const CODE_SHAPE = /^\d{6}$/

// Deliberately loose. The authority on whether an address exists is whether a code
// arrives at it, and a stricter pattern buys nothing against that while turning away
// addresses that are real — a single-letter domain label, a plus tag, a long new TLD.
// What this is for is the honest typo: a missing @, a stray space, nothing after the dot.
const ADDRESS_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

// What goes to the server, and what a card echoes back. Addresses are case-insensitive in
// every part anyone actually uses one in, and a phone's keyboard capitalises the first
// letter of a field by default — so a player who types their own address the way their
// phone offers it must not end up with a second, differently-spelled one.
export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase()

// Null when there is nothing wrong with it. Takes the raw text rather than the normalized
// form so a caller cannot forget to normalize first and have this answer about something
// else than what it is about to send.
export const addressProblem = (raw: string): EmailProblem | null =>
  ADDRESS_SHAPE.test(normalizeEmail(raw)) ? null : 'shape'

export const codeProblem = (raw: string): EmailProblem | null =>
  CODE_SHAPE.test(raw.trim()) ? null : 'bad_code'

// What each error code Supabase answers with means in the words a card can draw.
//
// `otp_expired` is the one worth knowing about: it is what comes back for a code that is
// wrong *and* for a code that is merely old, because telling the two apart would be a way
// of testing codes. So `expired` is drawn as "wrong or expired", and `bad_code` is kept
// for the only case we can be certain of — six digits that were never six digits.
const AUTH_PROBLEMS = {
  email_exists: 'taken',
  user_already_exists: 'taken',
  email_address_invalid: 'shape',
  validation_failed: 'shape',
  otp_expired: 'expired',
  over_email_send_rate_limit: 'rate_limited',
  over_request_rate_limit: 'rate_limited',
} as const satisfies Record<string, EmailProblem>

const isKnownCode = (code: string): code is keyof typeof AUTH_PROBLEMS =>
  Object.hasOwn(AUTH_PROBLEMS, code)

// A Supabase auth failure, in the terms the cards speak. Takes the two fields it needs
// rather than the error object, so nothing here depends on a type from the client.
//
// The network check comes first and beats every code: a request that never arrived has no
// answer to read, and `message` is all it left behind.
export function authProblem({
  code,
  message,
}: {
  code?: string
  message: string
}): EmailProblem {
  if (isNetworkFailure(message)) return 'offline'
  if (code !== undefined && isKnownCode(code)) return AUTH_PROBLEMS[code]
  return 'unknown'
}

// Seconds left before the resend button comes back, or 0 once it has. Rounded up, so the
// last fraction of a second reads as "1" rather than as a button that says 0 and still
// does nothing.
export function cooldownRemaining(sentAt: number | null, now: number): number {
  if (sentAt === null) return 0
  const elapsed = now - sentAt
  if (elapsed >= RESEND_COOLDOWN_MS) return 0
  return Math.ceil((RESEND_COOLDOWN_MS - Math.max(elapsed, 0)) / 1000)
}

// What each problem reads as on the card that met it. Kept beside the union rather than
// in the components, so the two cards cannot word the same wall differently and a new
// problem cannot ship without a line — `satisfies` is what enforces the second half.
//
// `expired` says "wrong or expired" because that is the truth: the server answers the same
// way for a code that was never right and one that merely sat too long, and inventing a
// distinction it did not make would send a player hunting for a code they typed correctly.
//
// Every line here is one short sentence, and the two that used to carry a second clause
// after a dash have lost it. They are drawn in a band of fixed height under the frames —
// see `email-code-modal.tsx` — so a line long enough to wrap is a line that draws outside
// its own space. What came after the dash was advice the card gives anyway: RESEND CODE is
// on screen beneath the very message that said to ask for a new one.
export const EMAIL_PROBLEM_LINES = {
  shape: msg`That does not look like an email address.`,
  taken: msg`That address is already on another profile.`,
  bad_code: msg`A code is six digits.`,
  expired: msg`That code is wrong or has expired.`,
  rate_limited: msg`Too many tries. Give it a few minutes.`,
  offline: msg`No connection — nothing was sent.`,
  unknown: msg`Something went wrong, try again.`,
} as const satisfies Record<EmailProblem, MessageDescriptor>
