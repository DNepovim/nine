# Running a challenge's window — Plan

Spec: docs/work/2026-10-16-session-controls/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261016020000_session_controls.sql` — `settings` table seeded at 2160, two columns on `challenge_sessions`, `set_setting`, `close_challenge_session_early`, `extend_challenge_session`, the two tightened guards, `open_sessions_with_leaders` dropped and recreated
- [x] 2. Replayed locally with `pnpm db:reset` — **not** `pnpm db:push`, which targets the linked project (production). Verified: resolved teaser 2160 through the RPC, a per-session `60` beating it, `0` legal, `-1` refused by the check constraint
- [x] 3. `lib/challenge-session.ts` — `teaserOpensAt(opensAt, teaserMinutes)`, `cardSession` off each row's own figure, `shownByStatus`; drop the three `leaderboard-period` imports
- [x] 4. `lib/challenge-session.test.ts` — the new arithmetic, two rows teasing at different times, every subset of the three statuses
- [x] 5. `lib/session-board.ts` + `lib/admin/sessions.ts` — `teaserMinutes` and `extendedAt` on both row types; `closeSessionEarly`, `extendSession`. **The two types differ**: `OpenSession.teaserMinutes` is `number` (resolved by the RPC), `AdminSession.teaserMinutes` is `number | null` (the raw column) — the planner is the one screen that must tell an override from an inherited figure. The spec said `number` for both
- [x] 6. `lib/admin/settings.ts` — read and write the general figure
- [x] 7. `constants/buttons.ts` — the four new ids
- [x] 8. `components/overlays/admin-segments.tsx` — the optional multi-select mode, without disturbing its three existing callers
- [x] 9. `components/overlays/admin-sessions.tsx` — three toggles with counts, LIVE + PLANNED lit, the all-dark empty state, the ANNOUNCE AHEAD field
- [x] 10. `components/overlays/admin-session.tsx` — the per-session field, the live form's lockdown, CLOSE EARLY with its confirm, EXTEND with its hours/minutes dialog. A live span is drawn as read-only rows (new `admin-when-row.tsx`) rather than disabled pickers — `DateTimeField` has no `disabled` prop and adding one would touch two platform variants for a worse reading
- [x] 11. `components/overlays/challenge-countdown.tsx` — `onArrive`, fired once at `until` and stable across renders
- [x] 12. `hooks/use-session-card.ts` — re-reckon on that arrival, teaser→live only
- [x] 13. `components/overlays/challenge-card.tsx` — `challenge` not `event`, and the given-more-time line
- [x] 14. `pnpm i18n:extract` + Czech — **thirteen** strings, not ten; `CLAUDE.md` gains its three rows

## Verification log

**Verdict — 2026-10-16: 8 PASS, 1 FAIL, 5 SKIPPED.** The suite is green and every
server-side guard holds under a real impersonated admin. One new criterion was added by
this stage and fails. Five criteria describe things a player sees or presses and were not
driven — Chrome automation was declined for this pass, and they are recorded as skipped
rather than assumed.

Server guards were exercised for real, not read: `set local request.jwt.claims` with the
dev admin's id makes `auth.uid()` resolve and `has_feature(…,'admin')` true, so every RPC
below ran through `require_admin()` exactly as the app calls it. All inside transactions
that were rolled back.

| #   | Criterion                                    | Result   | Evidence                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Three loose chips with counts, no ALL        | SKIPPED  | Visual. `FILTERS` holds exactly the three statuses and `AdminPills` renders `flex-row flex-wrap gap-2`, but nothing looked at it.                                                                                                                                                                                                 |
| 2   | LIVE+PLANNED lit; PAST adds                  | SKIPPED  | Logic covered by `shownByStatus` tests over every subset; the screen wiring was not driven.                                                                                                                                                                                                                                       |
| 3   | All dark → empty state                       | SKIPPED  | Same. `isEmptyArray([...lit])` → "No filters are on." is present but unseen.                                                                                                                                                                                                                                                      |
| 4   | Cog → ANNOUNCE AHEAD; 3 h applies            | PARTIAL  | Server half **passes**: `set_setting('teaser_minutes',180)` → both sessions resolve to 180 through the RPC. The cog and the window were not driven.                                                                                                                                                                               |
| 5   | A per-session figure beats the general       | PASS     | `set_setting(180)` + `edit_challenge_session(…, 60)` → one session 60, the other 180, and `settings` still 180. The override wins and the general holds.                                                                                                                                                                          |
| 6   | A live session's challenge/start/end refused | PASS     | Editing a live row's end raises; editing its challenge raises; `cancel` raises. An identical-values edit is accepted as the no-op it is.                                                                                                                                                                                          |
| 7   | Cancel refused for any scored session        | PASS     | Scored upcoming → raises; scored **expired** → raises; unplayed upcoming → deletes; unplayed expired → deletes. The "booked the wrong thing" escape survives.                                                                                                                                                                     |
| 8   | Close early shuts it, board untouched        | PASS     | Board fingerprint identical across the call — 3 rows, 5270 total, same md5. `closes_at` lands within 2 s of now, the row leaves `open_sessions_with_leaders()`, and `session_board()` still returns all three.                                                                                                                    |
| 9   | Extend +1 h 30; overlap refused              | PASS     | 21:52 → 23:22, exactly +90 min, `extended_at` set. Extending into the next booking of the same challenge raises the same overlap message planning gives. Zero, negative and a non-live session all raise.                                                                                                                         |
| 10  | The card says it was given more time         | SKIPPED  | Visual. The column, the card line and a gallery fixture all exist; nothing watched it, including across a restart.                                                                                                                                                                                                                |
| 11  | The card reads challenge, never event        | PASS     | Source says "challenge starts in"; no `event` in either card file; catalogs carry it in both languages. The only `event` left in the catalogs is the word "eventually" in an achievements string. Czech is `<0/> začíná za`, which names no category word — as the build notes flagged.                                           |
| 12  | Teaser flips to live on the tick, no reload  | SKIPPED  | **The one that most wanted driving.** `onArrive` is held in a ref and fires once behind a `watched` guard, and `reckon` re-reads cached rows — but whether the flip actually happens, and whether the screen stays off a once-a-second re-render, is exactly what a human watching answers.                                       |
| 13  | `pnpm check` green, Czech included           | PASS     | 0 lint errors (167 warnings, all pre-existing — same count before this work), Prettier clean, types clean, Knip clean, 1891 tests, 790 messages, 0 missing.                                                                                                                                                                       |
| 14  | The resolved teaser never arrives `null`     | **FAIL** | With the `settings` row absent, `open_sessions_with_leaders()` returns `teaser_minutes = null`. `OpenSession.teaserMinutes` is typed `number`, and `teaserOpensAt` computes `opensAt - teaserMinutes * 60_000` — `null * 60_000` is `0`, so **every teaser silently switches off** and nothing raises. Review focus #4 made real. |

### What reopens

Criterion 14 only, and it is a small fix with two honest shapes — `spec` named both:

- **Coalesce to a literal in SQL** — `coalesce(s.teaser_minutes, (select …), 2160)`. Keeps
  the client type honest and keeps one opinion about a missing figure.
- **Admit null in the type** and have the client decide. Puts a second opinion in a second
  place, which is the thing review focus #4 exists to warn about.

The first is recommended. Task 1 (the migration) reopens; nothing else does.

### Observations for `review`, not criteria

- **A no-op edit of a live session clears its teaser override.** `edit_challenge_session`
  only gets past the live guard when mode, start and end are all unchanged — and then
  writes `teaser_minutes = p_teaser_minutes`, which defaults to null. No player
  consequence: a live session's teaser already fired, and the form hides SAVE when live, so
  this is reachable only by calling the RPC directly. Recorded because it is invisible.
- **`session_scores` cascades on session delete.** Confirmed in the schema, which is what
  makes criterion 7's guard the thing standing between an admin and a deleted board.

## Build notes

### What differs from the spec

- **The two row types are not the same shape.** The spec said `OpenSession` and
  `AdminSession` each gain `teaserMinutes: number`. They differ, and have to:
  `OpenSession.teaserMinutes` is `number`, resolved by the RPC's coalesce, while
  `AdminSession.teaserMinutes` is `number | null`, straight off the column. The planner is
  the one screen that must tell an override from an inherited figure, because that is the
  difference between a field with a number in it and a field left blank — resolving it for
  the admin would make every session look as though somebody had typed 2160 into it.
- **`plan` and `edit` gained a parameter the spec never mentioned.** Criterion 5 needs the
  form to _set_ a per-session teaser, and the Data section only described the column. Both
  RPCs now take `p_teaser_minutes`, and both are **dropped before being recreated**: a
  Postgres function is identified by name _and_ argument types, so a `create or replace`
  with one more parameter adds an overload and leaves the old arity sitting beside it for
  the client to go on calling. Verified afterwards that exactly five functions exist with
  one arity each.
- **Thirteen strings, not the ten the spec listed.** The extras are
  `ANNOUNCE AHEAD (HOURS)`, `Blank uses the general figure.`, `No filters are on.`,
  `Nothing in these states.` and the close-early dialog's body.
- **Four new component files, where the spec named none.** `code-guide` forbids inline
  sub-components even when single-use, so the extend dialog's number field became
  `admin-number-field.tsx`, and the rest follow the same rule: `admin-teaser-field.tsx`,
  `admin-extend-dialog.tsx`, `admin-when-row.tsx`.
- **`dev/challenge-card-variant.tsx` was not in the spec's file table.** The typechecker
  found it: four `OpenSession` fixtures for the card gallery. Its `last-minute` case now
  carries an `extendedAt`, so the gallery actually shows the given-more-time line — a
  gallery with no variant for a new state is a gallery that stops doing its job.

### Decisions taken at a fork

- **A live span is drawn, not disabled.** The spec said the form "shows them and will not
  take a change". `DateTimeField` has no `disabled` prop and adding one would mean editing
  two platform variants, so a live session renders read-only rows (`WhenRow`) instead. It
  also reads better: a picker that refuses on tap says the same thing a beat later, and
  only to somebody who tried.
- **`onArrive` is held in a ref, not named in the deps.** Review focus #1's trap exactly.
  A caller passing an inline arrow would otherwise tear the interval down and re-arm it on
  every parent render. There is no `react-hooks` plugin in `eslint.config.mjs`, so nothing
  would have caught this.
- **A clock mounted already past `until` announces nothing.** `watched` records whether the
  component began with time left; only a crossing it actually saw is worth a call. Without
  it, a card mounted on a closed session would fire into a re-reckon on every mount.
- **`pnpm db:push` was not run.** Plan task 2 said to, but that script targets the linked
  project, which is production. Local replay is `pnpm db:reset`.

### Left deliberately undone

- **A live session closing still needs a restart.** Review focus #2, and the spec asks for
  only the teaser→live flip. `reckon` is general enough to fix the other boundaries; wiring
  it to them is a decision about the frozen-card rule, not a build detail.
- **`lib/admin/settings.test.ts` was not created.** The spec made it conditional on the
  module gaining arithmetic worth pinning, and it did not — it is a read and a write.

### The criteria, as the build sees them

Honest reading, not a verification — several of these need the app running or an
authenticated admin, which `verify` has and this stage does not.

| #   | Claim                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Believed met.** Three toggles, counts on each, ALL removed.                                                                                                                                                                                                                                          |
| 2   | **Believed met.** `LIT_ON_ARRIVAL`; `shownByStatus` adds rather than replaces, covered by tests over every subset.                                                                                                                                                                                     |
| 3   | **Believed met.** Empty set → "No filters are on.", a third empty state beside the two that existed.                                                                                                                                                                                                   |
| 4   | **Cannot claim.** Every piece is in place and the coalesce was checked in SQL, but nothing has driven the field end to end.                                                                                                                                                                            |
| 5   | **Partly claimed.** Verified directly against the database (a row at 60 beating the general 2160); the form writing it has not been driven.                                                                                                                                                            |
| 6   | **Partly claimed.** The screen half is built. The server half is written and read but never exercised — `require_admin()` needs an authenticated admin, which psql-as-postgres is not.                                                                                                                 |
| 7   | **Cannot claim.** Same reason as 6. The guard is written; nothing has called it.                                                                                                                                                                                                                       |
| 8   | **Cannot claim.** The function leaves `session_scores` alone by construction, but no run has proved the board survives.                                                                                                                                                                                |
| 9   | **Cannot claim.** The clash check is in the function; the refusal has not been provoked.                                                                                                                                                                                                               |
| 10  | **Cannot claim.** Column, card line and fixture are all there; it has not been watched across a restart.                                                                                                                                                                                               |
| 11  | **Met, with a wrinkle.** English now reads "challenge starts in". **The Czech never said "event"** — it is `<0/> začíná za`, which names no category word at all, so the criterion is satisfied but nothing in Czech changed. Worth knowing before `verify` goes looking for a diff that is not there. |
| 12  | **Cannot claim, and the one to drive hardest.** The mechanism is there and the once-a-second trap is guarded, but whether the card actually flips on the tick is exactly what a human watching it answers.                                                                                             |
| 13  | **Met.** 0 lint errors (167 pre-existing warnings), Prettier clean, types clean, Knip clean, 1891 tests, catalogs at 789 with 0 missing.                                                                                                                                                               |

## Build notes — second pass, 2026-10-16 (after verify)

Criterion 14 was the handback. Fixing it turned up three things the first pass had got
wrong, two of them invisible to every gate in the repo.

- **Criterion 14, fixed in SQL only.** `open_sessions_with_leaders` coalesces to a literal
  `2160` as a third arm. The literal repeats the seed rather than sharing a constant with
  it, which is the point: the seed is what the figure starts as, this is what the resolve
  falls back to when the row is not there to be read. Nothing was added on the client —
  review focus #4 is precisely about not having two opinions.

- **`pnpm db:test` existed and the spec never mentioned it.** `supabase/tests/*.sql`, run
  against the local stack, and the runner's own comment says it is "the only automated test
  the resolve has — the rules live in SQL on purpose, and mirroring them in TypeScript to
  reach Vitest would create the second copy the design exists to avoid." The spec's Tests
  section sent every assertion to Vitest and so covered none of the guards. Six assertion
  blocks now cover the teaser resolve (including the null regression), the live-window
  guards, and extend.

- **The score guard on `cancel` was not new.** `20261012000000_session_scores.sql` added it
  the day boards arrived. The first pass read the original definition in
  `20261010020000` and reimplemented it with different wording, which broke an existing
  assertion. The message is now verbatim again and the score check sits first, so every
  refusal that already existed is unchanged in both condition and wording. **This corrects
  the verification log**: criterion 7's score half was pre-existing, and only the live
  guard is new.

- **The live-edit lock was the wrong condition, and two shipped tests said so.**
  `session_scores.sql` asserted that an unplayed session is re-pointable and that a played
  session's span still moves — both on a live session. Keying the lock on liveness broke
  both. Resolved by asking: the lock is now on the **board**, agreed as "protect scores, not
  liveness". So a live session nobody has touched is still fully editable, a played one
  refuses its challenge _and_ its span, and EXTEND is the one way a played window moves.
  Criteria 6 and 7 amended; the superseded assertion in `session_scores.sql` was rewritten
  with a dated note saying what changed and why.

- **`AdminSession` gained `played`.** The form has to lock on the same condition the server
  does, and it had no way to know. Read through PostgREST's embedded aggregate —
  `session_scores(count)` — rather than a fifth RPC. `live` still governs EXTEND and CLOSE
  EARLY, which are about the clock; `locked` governs the fields, which are about the board.

- **My own test polluted the suite.** The first draft set `role = 'admin'` on the first
  profile and never put it back, and `challenge_sessions.sql` runs before `features.sql`,
  whose opening assertion is that the first profile has no role. Both blocks now restore
  what they found, the way `features.sql` already did. Worth recording: the broad
  `exception when raise_exception` handlers in that draft also swallowed "not
  authenticated" and read it as the guard refusing — every handler now asserts on the
  message, so a test cannot pass for the wrong reason.

### State

`pnpm db:test`: 3 files, all passing, from a clean reset. Criterion 14's regression is now
covered by an assertion rather than by a person remembering to delete a row.

## Review — 2026-10-16

`/code-review high` **stalled on the first attempt** (600s, no progress — almost certainly
the diff size; the two `.po` catalogs alone are ~390 lines of noise). Re-run scoped to the
source under review, which completed. Recorded because a stalled reviewer that nobody
mentions reads later as a reviewer that found nothing.

### Review focus, confirmed one by one

| #   | Confirmed by                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `onArrive` is held in `announce`, synced by its own `[onArrive]` effect; the tick effect's deps are `[now, until]` with no callback in them, so an inline arrow from the parent cannot re-arm the interval. |
| 2   | Only the teaser clock announces — `onArrive` is passed at `challenge-card.tsx:127` (counting to `opensAt`); the live clock counting to `closesAt` is given nothing. The vanishing card stays frozen.        |
| 3   | Three `challenge_session_clashes` call sites — extend, plan, edit — and the extend path is asserted in `supabase/tests/challenge_sessions.sql`.                                                             |
| 4   | No client-side fallback exists; the sole `coalesce` is in SQL, now with a literal third arm and an assertion pinning it.                                                                                    |
| 5   | `'an unplayed expired session should still be deletable'` is asserted. The escape survives.                                                                                                                 |

### Findings fixed

1. **`openedAt` froze while this screen could now change a window's status** (medium, and a
   real regression). Before CLOSE EARLY existed, nothing here could move a session between
   states, so freezing the clock at mount was safe. After closing one early the rows
   reloaded but the clock did not: the row kept its LIVE chip and dot, still counted under
   the LIVE filter, and reopening its form offered EXTEND on writes the server then
   refused. `openedAt` is re-seeded with every read — the clock moves when the data does,
   and still never on its own, so a window closing by itself cannot pull a row out from
   under a thumb.
2. **A negative general teaser would have killed every teaser silently.**
   `teaser_minutes` had a floor; `settings.int_value` did not, and `set_setting` validated
   nothing. A negative figure makes `teaserOpensAt` compute `opensAt + X`, and a teaser
   needs both `now < opensAt` and `now >= teaserOpensAt` — never both true. The same
   silent, app-wide failure criterion 14 was about, left open on the other side. Floored by
   a constraint and named by the RPC; asserted.
3. **A half-typed teaser silently dropped an override.** Anything unparseable mapped to
   null, which means _inherit_ — so clearing the field to retype and saving mid-way removed
   a session's override without refusing anything. Blank still means inherit; garbage is
   now refused by `canSave`.
4. **`extended_at` outlived the extension.** Extending a live unplayed session and then
   editing the end back left the mark set, so the card told every player "Given more time."
   about a window that was not. Cleared when the end is rewritten by hand, kept when it is
   not; both asserted.
5. **The `watched` guard could strand a teaser permanently.** It latched at first render,
   so if `Date.now()` crossed `until` between the read and that render it skipped the
   interval and never announced — a card stuck on "starts in 0ʰ" until relaunch, the exact
   failure the prop was added to prevent. Dropped. Announcing on a mount already past the
   mark costs one re-render and cannot loop; a permanently wrong card is not a close call.
6. **A comment overstated the server's rule.** Hiding SAVE on `locked` does put one write
   out of reach the server would allow — `teaser_minutes`. Kept (a played session's teaser
   is already behind it) and the comment now says so instead of claiming otherwise.
7. **No cancellation guard on the teaser modal's read.** Every other async read in the app
   keeps a `dropped` ref; this one set state on an unmounted component. Added.

Plus one found before the reviewer reported, same class as all of the above: the teaser
modal **swallowed both its read error and its write error**, leaving either a dead field
with no figure or a SAVE that appeared to do nothing. A dialog has no error slot the way
`AdminScreen` does, so it carries its own now.

### Deliberately left

- **Finding 7 — `AdminSession.extendedAt` is read nowhere.** True. Deleting it and
  re-adding it is churn: `admin-list-polish` is already shaped to rebuild that row, and an
  EXTENDED mark belongs there. Added as a task on that item rather than removed here.
- **Blank-means-inherit** stays as designed (criterion 5). Only unparseable input changed.

### Simplify

Run by hand rather than through four agents — a standing instruction in this session says
not to call the Agent tool unasked, and user instructions outrank a skill's method.

- **Reuse:** the hours↔minutes conversion sits at three call sites, but they differ in the
  only interesting part — blank means 0, invalid, or inherit. Unifying them would abstract
  the uninteresting half. What _was_ duplicated is `Math.round(minutes / 60)` plus an
  identical paragraph explaining its rounding, in two files. Extracted as `minutesAsHours`
  in `lib/duration.ts`, with a colocated test pinning the rounding, and the two paragraphs
  collapsed to a pointer.
- **Efficiency:** the three chip counts each ran their own pass over the rows on every
  render, asking `spanStatus` the same question about the same row three times. One
  `reduce` now.
- **Altitude:** checked finding 1's fix in particular — re-seeding the clock with the read
  is the right depth, not a bandaid; the alternative (making `spanStatus` always read live
  time) would undo a deliberate freeze.

### Worth their own work item later

- **`cancel` and `edit` disagree about liveness on purpose**, and nothing on screen says
  so. An admin who finds CANCEL SESSION missing on a live unplayed session has to infer
  why. A sentence on the form would do it.
- **A played session's teaser is unreachable from the UI** (finding 6). Harmless today;
  it stops being harmless if a teaser ever means something mid-window.

### State

`pnpm check` green — 0 errors, 167 pre-existing warnings, Prettier clean, types clean,
Knip clean, 1894 tests, 790 messages with 0 missing. `pnpm db:test` — 3 files, all passing
from a clean reset.

**Three of these fixes are behavioural** (1, 2, 4) and this item already skipped `verify`
once at the user's instruction. They are covered by SQL assertions but have not been
driven in the app.

### Shipped

`3311aef` on `main`, 2026-10-16. The migration was pushed to production before the commit
(additive, and the live client's RPC calls still bind because the new parameters carry
defaults) — so production's schema is ahead of its bundle, which is the safe direction.
Not deployed.
