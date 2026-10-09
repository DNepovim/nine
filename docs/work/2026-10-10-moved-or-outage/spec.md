# Moved, or just a bad minute

Slug: moved-or-outage
Stage: build
Next: /verify moved-or-outage
Track: small
Branch: fix/moved-or-outage
Started: 2026-10-10

## Problem

A Supabase outage reads as "somebody restored this profile onto another phone". The app
marks the profile moved, signs out, and hands the player a fresh anonymous account — and a
player with no confirmed address has no way back to their career.

The cause is one mistake made in three places: the code splits a failed request **two**
ways — it never arrived, or it was refused — when there are **three**. A 503, a 500 or a
429 arrived and was not a refusal, but `!isNetworkFailure(message)` sorts it in with the
refusals, and a refusal is the one thing that licenses the irreversible act.

Found by `/code-review` over the claimed-winnings diff, on work that had already shipped.

## Appetite

**An evening.** Make a refusal something the code has to establish rather than something
it assumes from the absence of a network error. No new error taxonomy, no schema, no copy.

## Shape

The player is on a train, or Supabase is having five bad minutes. Their launch asks the
three questions it always asks — the profile row, the features, `auth.getUser()` — and two
of them come back 503. Today that is a verdict; after this it is nothing at all, and the
session stands.

What changes is the standard of evidence, in two steps.

**A retryable auth error settles nothing.** supabase-js already sorts its own failures:
`AuthRetryableFetchError` covers the request that never left _and_ every 500–530 that came
back, and the client drops the stored session only for errors that are not that. So the app
stops asking `isNetworkFailure` about the message — which reads transport phrasings and
cannot see a 503 — and asks the library's own `isAuthRetryableFetchError` about the error.
Not a taxonomy this app invents; one it defers to, so the list of codes stays Supabase's to
maintain.

**And a refusal still has to be paired.** `sessionVerdict` already holds that idea and
applies it to only one of its two branches: `'gone'` requires the profile read to have
_succeeded_ and come back empty, and says so. `'revoked'` asks nothing about the profile
read at all. Giving it the same pairing makes the both-failed case fall through to `'live'`.

The pairing alone is not enough, and it is worth writing down why rather than rediscovering
it: GoTrue and PostgREST are **different services**. An auth-only outage answers
`getUser()` with a 503 while the profile row serves perfectly — which pairs beautifully and
still means nothing. That is the likeliest shape of a real auth incident, so the retryable
check is the load-bearing half and the pairing is the second line.

Then the two sites that decide on their own, without going through that function:

- The launch's `getSession()` branch marks the profile moved on any non-network error,
  before `inspectSession` has run at all.
- The two-minute foreground check signs out on any non-network `getUser()` error, with no
  second read to pair against. It already has `inspectSession` available and the user id to
  call it with.

Both stop concluding from one error. `sessionVerdict` stays the only thing in the app that
decides a profile has moved.

### Areas

- **`lib/session-verdict.ts`** — one branch gains the pairing the branch above it has.
- **`hooks/use-supabase-auth.ts`** — the launch's `getSession()` branch and the two-minute
  `check()` stop deciding for themselves.
- **`lib/session-verdict.test.ts`** — the third state, which the seven existing tests
  cannot cover because it is not a concept yet.
- **Not touched** — `isNetworkFailure` and its phrase list, the schema, any copy, anything
  in `modes/`.

### A mode's business or the engine's?

Neither. Nothing here reaches `modes/`, reads a mode's name, or touches `RunRules`.

### Does it need a flag?

No. It is a fix to shipped behaviour and strictly safer than what it replaces; a flag would
mean choosing to leave some players on the broken path.

## In

- `'revoked'` requires the profile row to have been read, not merely to have not failed.
- The launch's `getSession()` branch and the two-minute check defer to that one decision.
- A test per site, including the case that nothing covers today.

## Out

- **An error taxonomy of our own.** `isAuthRetryableFetchError` is supabase-js's, and
  deferring to it is one import. Building a parallel `unreachable | faulty | refused`
  vocabulary and threading it through `connectivity.ts` was the day-or-two option and stays
  out.
- **A strike counter** — requiring N refusals before acting. More state, and the pairing
  already removes the failure mode that motivated it.
- **A route back for a player already wrongly reset.** Real, and its own item: a profile
  with no address that has been replaced is not recoverable by anything in this shape.
- **Touching `isNetworkFailure`.** Its phrase list is for transport failures and is correct
  at that job. The bug is what the _absence_ of a match is taken to mean.

## Rabbit holes

- ~~**What supabase-js does with the stored session on a 5xx refresh.**~~ **Settled during
  the build.** `lib/fetch.js` turns every 500–530 into an `AuthRetryableFetchError`, and
  `GoTrueClient` calls `_removeSession()` only for errors that are _not_ retryable. A 5xx
  keeps the session — so that site was a wrong note on an otherwise healthy launch rather
  than a lost profile, which is the good direction. It also handed the work its mechanism.
- **The two-minute check's cost.** Routing it through `inspectSession` turns one request
  into three, every two minutes, for every player holding a confirmed address. Either
  narrow `inspectSession` for this caller or accept the cost deliberately — do not discover
  it after the fact.
- **Do not start reading error spellings.** `session-verdict.ts` deliberately avoids it and
  says why: the wording is Supabase's to change. The pairing is the mechanism; a
  `message.includes('403')` creeping in is this work going wrong.

## Tasks

- [x] 1. `lib/session-verdict.ts` — `'revoked'` requires `profileError === null && profileFound`; the both-failed case falls through to `'live'`. Comment why the pairing is the evidence.
- [x] 2. `lib/session-verdict.test.ts` — both reads refused by a server that answered, a lone auth refusal with the row present, and a 503 pair. The seven existing tests must pass unchanged.
- [x] 3. `lib/session-verdict.ts` — `SessionReads` gains `accountRetryable`; a retryable auth error returns `'live'` the way a network failure does. Tests for the auth-only outage.
- [x] 4. `hooks/use-supabase-auth.ts` — the launch's `getSession()` branch asks `isAuthRetryableFetchError` instead of `isNetworkFailure`, and `inspectSession` feeds the new field.
- [x] 5. `hooks/use-supabase-auth.ts` — the two-minute `check()` decides via `sessionVerdict` rather than a lone `getUser()` error, and acts only on `'revoked'`. Note the request cost in a comment.

## Acceptance criteria

1. `sessionVerdict` with both reads carrying a non-network error returns `'live'`.
2. A real revocation — auth refuses, profile row reads and is present — still returns
   `'revoked'`, and the launch still leaves the moved note.
3. A profile row that reads and is absent still returns `'gone'`, with or without an auth
   error.
4. The two-minute check does not sign out when `getUser()` fails with a retryable error —
   including an auth-only outage, where the profile row still reads perfectly. A genuine
   revocation is still caught within one interval.
5. Nothing in the diff matches on an error's wording, and no list of status codes is
   written here — the one that exists belongs to supabase-js.
6. `pnpm check` green, the seven existing `session-verdict` tests unchanged.

## Build notes

Five tasks, all landed. ESLint 0 errors (87 pre-existing warnings), `tsc` clean, 1645
tests — the four new ones all in `session-verdict.test.ts`.

**The spec was amended mid-build, and this is the reason.** Task 5 exposed that the
pairing — a refusal only counts beside a profile read that answered — does not close the
hole it was chosen for. GoTrue and PostgREST are separate services, so an auth-only outage
answers `getUser()` with a 503 while the profile row serves perfectly: the two reads agree,
the pairing is satisfied, and the player still loses their career. That is the likeliest
shape of a real auth incident, which made it the wrong thing to leave out. Agreed with the
user before writing the code; the Shape, the Out list, criteria 4 and 5 and the task list
were all edited to match, so `verify` is held to what shipped.

**The rabbit hole paid off rather than costing.** Reading `@supabase/auth-js` settled the
question the spec said to settle first and handed the work its mechanism in the same
breath: `lib/fetch.js` turns every 500–530 into an `AuthRetryableFetchError`, and
`GoTrueClient` only calls `_removeSession()` for errors that are _not_ retryable. So a 5xx
keeps the session, which made the launch's `getSession()` branch a wrong note on an
otherwise healthy launch rather than a lost profile — and `isAuthRetryableFetchError`, which
`@supabase/supabase-js` re-exports, is the classification all three sites needed.

**Decisions at a fork.**

- **The guard is asked of the error object, not the message.** This is the opposite of what
  the file did and it is deliberate: `isNetworkFailure` reads transport phrasings off a
  string, and a 503 does not read like one. Using the library's own predicate also keeps the
  list of codes Supabase's to maintain, which is the spirit of the existing comment about
  error spellings being theirs to change.
- **`accountRetryable` is passed into `sessionVerdict` rather than computed there.** It
  keeps the function pure over three answers with no opinion about which client fetched
  them, and leaves its two callers free to say where the flag came from.
- **The two-minute check does its own two reads instead of calling `inspectSession`.** The
  spec's rabbit hole said to decide this rather than discover it: `inspectSession` would
  have been three requests every two minutes, and its feature read buys nothing here. Two
  it is, and the comment says so.
- **That check acts on `'revoked'` only, not on `'gone'`.** A profile row that vanishes
  under a running app is not this check's business and the next launch will meet it; acting
  on it here would be a second place deciding the same thing.
- **`isNetworkFailure` left `use-supabase-auth.ts` entirely** — both call sites moved to the
  library guard, so the import went. It is untouched in `session-verdict.ts`, where it still
  answers for the _profile_ read, which is PostgREST's and not auth's.

**One honest deviation from criterion 6.** It asks that the seven existing
`session-verdict` tests be unchanged. The seven `it` blocks are untouched; the `reads()`
helper they share gained `accountRetryable: false` as a default, because the type did. No
test's inputs or expectations moved.

**My own read of the criteria, before `verify` does it properly.**

| #   | Believe satisfied        | On what evidence                                                                                                                                                                        |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Yes                      | `stands when the server answered both reads badly`, over four real outage phrasings.                                                                                                    |
| 2   | Yes                      | `is revoked when…` and `is still revoked when the refusal is not retryable`. The launch's `markProfileMoved()` on a `'revoked'` verdict is untouched.                                   |
| 3   | Yes                      | The two pre-existing `gone` tests, unchanged.                                                                                                                                           |
| 4   | Yes, unproven in the app | `stands when auth alone is down and the profile row reads perfectly` proves the verdict; the check returns on anything but `'revoked'`. Driving a real outage is `verify`'s to attempt. |
| 5   | Yes                      | The diff adds no status list and no message match. The one `isNetworkFailure` that remains is pre-existing and answers for the profile read.                                            |
| 6   | Yes, with the note above | ESLint, `tsc`, 1645 tests green. `pnpm check` as one command is `verify`'s to run.                                                                                                      |

**Not covered by a test.** The two `use-supabase-auth.ts` sites, for the reason recorded in
the previous item: this repo has no hook tests and no `@testing-library`. Both rest on
reading, and the auth-only outage is the case `verify` should try hardest to stage.
