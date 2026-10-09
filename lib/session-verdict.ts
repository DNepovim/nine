import { isNetworkFailure } from '@/lib/connectivity'

// What a stored session turns out to be worth when a launch looks at it. Three answers
// rather than a boolean, because the two ways a session can be bad are not the same thing
// to the player: one took their profile away and one took nothing from anybody.
export type SessionVerdict =
  // It stands. This is who they are.
  | 'live'
  // The server has stopped recognising the session while the profile it names is still
  // there: somebody restored this profile onto another device, and this one has lost it.
  | 'revoked'
  // The session names nobody — the auth row is gone, which a local `db:reset` does to
  // every device at once and a deletion in the dashboard does to one.
  | 'gone'

// The three reads a launch makes, as the only three things about them that matter here.
export type SessionReads = {
  // From the profile row read. Null means the server answered, whatever it answered.
  profileError: { message: string } | null
  // Whether that answer carried a row.
  profileFound: boolean
  // From `auth.getUser()` — the only read that asks whether the session itself still
  // exists. Nothing else can: PostgREST takes an access token on its signature alone, so
  // a revoked session goes on reading and writing for the rest of that token's hour.
  accountError: { message: string } | null
}

export function sessionVerdict({
  profileError,
  profileFound,
  accountError,
}: SessionReads): SessionVerdict {
  // Offline is not a verdict. A player on a train must keep their session rather than be
  // signed out of it and handed an identity they never asked for, so a request that never
  // arrived — in either read — settles nothing and the session stands.
  if (profileError !== null && isNetworkFailure(profileError.message)) return 'live'
  if (accountError !== null && isNetworkFailure(accountError.message)) return 'live'

  // Refused by the auth server with the profile row still there. Paired with the row
  // rather than read off the error's spelling, which is Supabase's to change: a refusal
  // *with* a row is a session taken away, while a refusal with the row gone is the user
  // themselves gone — and that must never tell this player their profile moved.
  if (accountError !== null && profileError === null && !profileFound) return 'gone'
  if (accountError !== null) return 'revoked'

  // No row, from a server that answered. `maybeSingle` is what draws that line: an absent
  // profile comes back as null with no error, while a request that never arrived comes
  // back with one — and that one was ruled out above.
  if (profileError === null && !profileFound) return 'gone'

  return 'live'
}
