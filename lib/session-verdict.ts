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
  // Whether supabase-js called that error retryable, from its own
  // `isAuthRetryableFetchError`. True for the request that never left and for every
  // 500–530 that came back, which is the distinction this file cannot draw for itself:
  // a message is all it has, and a 503 does not read like one.
  //
  // Passed in rather than computed here so this stays a pure function over three answers,
  // with no opinion about which client fetched them.
  accountRetryable: boolean
}

export function sessionVerdict({
  profileError,
  profileFound,
  accountError,
  accountRetryable,
}: SessionReads): SessionVerdict {
  // Offline is not a verdict. A player on a train must keep their session rather than be
  // signed out of it and handed an identity they never asked for, so a request that never
  // arrived — in either read — settles nothing and the session stands.
  if (profileError !== null && isNetworkFailure(profileError.message)) return 'live'
  if (accountError !== null && isNetworkFailure(accountError.message)) return 'live'

  // Neither is a server that answered badly, which is the one this file used to get wrong.
  // An auth error only says the request did not succeed; a 503, a 500 or a rate limit are
  // all ways for that to happen without anybody taking anything away. supabase-js has
  // already sorted its own failures into retryable and not, so that judgement is taken
  // from it rather than guessed at from the wording.
  //
  // This is the load-bearing half rather than the pairing below it, and the reason is that
  // GoTrue and PostgREST are **different services**: an auth-only outage answers this read
  // with a 503 while the profile row serves perfectly, so the two reads agreeing proves
  // nothing on its own.
  if (accountError !== null && accountRetryable) return 'live'

  // A refusal the client did not call retryable, with the profile read having *answered*.
  //
  // The pairing is the second line rather than the first — see above for why it cannot be
  // the first — but it still earns its place: a profile read that failed leaves nobody to
  // say whether the row is there, and the row is what tells the two bad verdicts apart. A
  // refusal with the row still there is a session taken away; a refusal with the row gone
  // is the user themselves gone, and that must never tell this player their profile moved.
  // Read off the row rather than the error's spelling, which is Supabase's to change.
  //
  // Everything else falls through to `live`. Refusing to guess is the whole point: this is
  // the only function in the app that can conclude a profile has moved, and that conclusion
  // costs the player their career on this device.
  if (accountError !== null && profileError === null) {
    return profileFound ? 'revoked' : 'gone'
  }

  // No row, from a server that answered. `maybeSingle` is what draws that line: an absent
  // profile comes back as null with no error, while a request that never arrived comes
  // back with one — and that one was ruled out above.
  if (profileError === null && !profileFound) return 'gone'

  return 'live'
}
