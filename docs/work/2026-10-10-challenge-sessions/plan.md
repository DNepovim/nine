# Challenge sessions — Plan

Spec: docs/work/2026-10-10-challenge-sessions/spec.md
Phase: one — the admin planner

## Tasks

- [x] 1. `package.json` + `constants/buttons.ts` — add `@react-native-community/datetimepicker`; add the seven `admin.*` ids
- [x] 2. `lib/challenge-session.ts` + `lib/challenge-session.test.ts` — `defaultSpan`, `withOpensAt`, `withClosesAt`, `isValidSpan`, `spanStatus`, `STATUS_LABEL`
- [x] 3. `components/date-time-field.tsx` + `.web.tsx` — one exported props type, imported by both — the type went to `types/date-time-field.ts` (Expo resolves a `@/components/…` import to the `.web` variant, so a type in the native file would resolve back to itself); also added `formatDayTime` to `lib/format-date.ts` with tests, which the spec did not name
- [x] 4. `components/overlays/admin-access.tsx` + `admin-overlay.tsx` — move the tabs and the person/role routing out whole; the hub is two buttons and DONE; the hub lost its WHO SEES WHAT subtitle to AdminAccess rather than gaining a new string
- [x] 5. `supabase/migrations/20261010020000_challenge_sessions.sql` + `supabase/tests/challenge_sessions.sql` — table, RLS, three RPCs
- [x] 6. `supabase/migrations/20261010010000_challenge_lab_rename.sql` + `constants/features.ts` + `components/overlays/menu-overlay.tsx` + `supabase/tests/features.sql` — the rename, `challenges`, `DEV_FEATURES` — plus `useAnyFlag` in `hooks/use-flags.tsx` and the key swap in `lib/features.test.ts`, neither named by the spec
- [x] 7. `lib/admin/sessions.ts` — the select and the three RPC wrappers
- [x] 8. `components/overlays/admin-sessions.tsx` — the list, newest start first, with the `inBuild` tag — the row went into `admin-session-row.tsx` of its own, per code-guide's one-component-per-file rule
- [x] 9. `components/overlays/admin-session.tsx` — one form for both plan and edit: the challenge picker (editable either way), the two fields, SAVE, CANCEL SESSION (offered whatever the state) — the picker went into `admin-challenge-picker.tsx` of its own
- [x] 10. `components/overlays/dev-overlay.tsx` — print each challenge's planned sessions; drop the local `statusOf`
- [x] 11. `CLAUDE.md` — the **session** row, and the clause on the **run** row
- [x] 12. `pnpm i18n:extract` + Czech by hand; `pnpm check`

## Verification log — phase one

**Verdict: 15 PASS, 0 FAIL, 1 PARTIAL (14 — web verified, iOS skipped by agreement).**
`pnpm check` exits 0. `pnpm db:test` green. Driven on web at `localhost:8081` against the
local Supabase stack, with four seeded sessions and the browser's own anonymous profile
granted `admin`.

Two things worth reading before the table: criterion 3 was called unverifiable in the
build notes and **is now genuinely verified** — see its row for the method. And one
fragility was found that is not a criterion failure; it is recorded under the table for
`review`.

| #   | Criterion                                                   | Result   | Evidence                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `FLAGS` / `DEV_FEATURES`, no `useFlag('dev')`               | PASS     | scratch vitest over the real constants; `tsc --noEmit` green. The `'dev'` strings left in `index.tsx` are the overlay name and the analytics door, not the feature key.                                                                                                                                               |
| 2   | Rename landed in every table                                | PASS     | `psql` after `db:reset`: 3 stacks on `challengeLab`, 0 rows naming `dev` in `features`/`role_features`/`user_features`, `challenges` present and inactive. Also seen on the person screen.                                                                                                                            |
| 3   | A revocation is carried across as a revocation              | **PASS** | `supabase db reset --version 20261010000000` to stop _before_ the rename, planted one `granted=false` and one `granted=true` on `dev`, then `supabase migration up`. Both survived with their direction intact, and `has_feature` returns false for the revoked person.                                               |
| 4   | `pnpm db:test`                                              | PASS     | Both SQL files, migrations included, 6 notices.                                                                                                                                                                                                                                                                       |
| 5   | DEV follows `challengeLab`, not `challenges`                | PASS     | Three states driven in the browser: holding it → DEV in the footer; revoked (nothing else touched) → DEV gone, ADMIN stays; `challenges` granted alone → still gone.                                                                                                                                                  |
| 6   | The hub, and BACK from a person                             | PASS     | ADMIN → two card rows over DONE. FEATURES → the three tabs unchanged. Opened ACE_9, pressed the back chevron, landed on the **people list**. Review focus 3 held.                                                                                                                                                     |
| 7   | The planner list                                            | PASS     | Newest start first; local Prague times; LIVE NOW / UPCOMING / EXPIRED (expired dimmed); `challenge/ghost-dial` drawn with its raw id and NOT IN THIS BUILD in red.                                                                                                                                                    |
| 8   | The defaults                                                | PASS     | PLAN SESSION opened on 12.10.2026 12:00 → 13.10.2026 12:00 with today being 11 Oct.                                                                                                                                                                                                                                   |
| 9   | Span-preserving move, DST included                          | PASS     | Scratch vitest over arbitrary inputs and both 2026 Prague boundaries. **And in the app**: start 12→20 Oct dragged the end 13→21 Oct; start 20→25 Oct dragged the end to 3 Nov, holding 9 days across a month end.                                                                                                     |
| 10  | SAVE shut on a bad span; the DB refuses too                 | PASS     | End set before the start → the end went red and SAVE greyed, start unmoved. `insert` with `closes_at <= opens_at` and with an inverted span both refused by `closes_after_opens`.                                                                                                                                     |
| 11  | Overlap refused, readable; different challenges may overlap | PASS     | In the app: "that challenge is already booked for part of that time" on the form. Via the RPCs: same-challenge overlap refused, non-overlapping accepted, two different challenges at the same instant both accepted.                                                                                                 |
| 12  | Editing a session persists                                  | PASS\*   | Span: edited 25 Oct → 28 Oct in the app, list showed 28 OCT → 6 NOV. Challenge: verified through `edit_challenge_session` (moved `mode_id`, and refused when moved onto a booked one). **\*The UI half of changing the challenge could not be driven — the catalog holds one challenge, so the picker has one pill.** |
| 13  | CANCEL in any state                                         | PASS     | Cancelled the **expired** session in the app; it left the list. Also exercised on an upcoming one via the RPC.                                                                                                                                                                                                        |
| 14  | Both pickers                                                | PARTIAL  | **Web PASS** — `datetime-local` drew the native field and calendar affordance, and criteria 8–10 all hold on it. **iOS SKIPPED** by agreement: it needs a simulator and a dev-client rebuild for a new native module, and production is the web bundle.                                                               |
| 15  | The DEV screen prints planned sessions                      | PASS     | FOUR KEYS shows `EXPIRED · challenge/four-keys` (its compiled window) with a PLANNED block under it listing all three of its sessions and each one's own state. The ghost session is correctly absent.                                                                                                                |
| 16  | `pnpm check`                                                | PASS     | Exits 0: i18n (687 messages, 0 missing Czech), lint, Prettier, types, Knip, 1676 tests. The four foreign lint errors the build notes named have been cleaned up by the other session.                                                                                                                                 |

### Found past the criteria

- **17 (new, for `review` not `build`): fast keyboard entry can blank a date field.**
  Typing two digits into a `datetime-local` segment faster than the browser's segment
  state machine settles left ENDS showing `dd.mm.yyyy, --:--` with React's state still
  holding the old instant, and a second attempt produced `21.10.202612, 00:--`. **At
  human speed it is correct** — keystroke-by-keystroke gave `02.10` red then `21.10`
  black — and a single rejected `input` event is re-synced by React, which I confirmed
  with the native setter. So this is not a criterion failure and not reproducible by
  hand; it is the known fragility of a controlled input whose `onChange` rejects
  intermediate values (`fromInputValue` returning null). Worth a look in `review`;
  the cheapest fix is probably to let the field hold its own draft string.
- **Czech and English are mixed on the planner by design.** `ČTYŘI TLAČÍTKA · 28 OCT
12:00 · UPCOMING` — the status words are deliberately untranslated (spec, Copy gate)
  and `SHORT_MONTHS` in `lib/format-date.ts` is English-only app-wide, which predates
  this phase and shows on profiles too. Flagged as a judgement call, not a defect.
- **Czech checked on screen, not just in the catalog**: VÝZVY, KDY VÝZVA BĚŽÍ,
  NAPLÁNOVAT TERMÍN, ZAČÁTEK / KONEC, ULOŽIT, NENÍ V TÉTO VERZI, and the empty state
  "Zatím není naplánovaný žádný termín." All read as Czech.
- **First launch is clean**: before the role was granted, the intro painted with no DEV
  and no ADMIN and no error.
- **The empty planner** draws its own line rather than an empty box.

### Environment notes

- The dev server on 8081 was already running and was reused; no second one was started.
- The local database was left with the four seeded sessions, every profile on `admin`,
  and no `user_features` overrides. The browser's language was returned to EN and the
  tab closed.

## Build notes

### What differs from the spec

- **The shared props type went to `types/date-time-field.ts`,** not beside the
  components. Expo resolves `@/components/date-time-field` to the `.web.tsx` variant on
  web, so a type exported from the native file and imported by the web one would have
  resolved back to itself. Both variants are now typed `DateTimeFieldComponent`, which
  is what makes `tsc` the guard Review focus 5 asked for.
- **`formatDayTime` added to `lib/format-date.ts`,** with four tests. The spec named no
  formatter and the planner needs one; it went where the other five live.
- **`useAnyFlag` added to `hooks/use-flags.tsx`.** The spec said the menu asks over
  `DEV_FEATURES` but named no hook. It reads the context once rather than calling
  `useFlag` per key, so the list's length never becomes part of the render's hook order.
- **Two components beyond the spec's file list,** both to satisfy code-guide's
  one-component-per-file rule: `admin-session-row.tsx` and `admin-challenge-picker.tsx`.
- **`challenge_session_clashes` is its own SQL function** rather than the same `exists`
  written twice, so `plan_` and `edit_` cannot drift apart on the one rule nothing but
  the SQL test holds.
- **The hub has no subtitle.** WHO SEES WHAT went with the tabs it describes, to
  `AdminAccess`, whose title is FEATURES. That is one fewer new string than the spec
  budgeted for, not one more.

### Decisions at forks

- **`onValueChange`, not `onChange`,** on both picker paths. `onChange` is deprecated in
  datetimepicker 9.x and ESLint fails on it. The new handler only fires when a value was
  chosen, so the dismissal branch the first draft carried is gone.
- **Android asks twice** — a date dialog, then a time dialog opened on what the first
  produced. Its picker does one at a time; iOS renders a `datetime` spinner inline.
- **`text-red-500` for an invalid field and for errors,** which is what the other admin
  screens already say. No theme token exists for a refusal and inventing one here would
  have been a palette change made inside a form.
- **`set role anon`, not `set local role`,** in the SQL test. psql runs each statement in
  its own transaction, so a LOCAL setting was reverted before the next statement — which
  had the whole read-policy block running as `postgres`, passing the read for the wrong
  reason and failing the write assertion for another.
- **Czech: a session is a `termín`,** which is the natural Czech for a scheduled slot, and
  a challenge is a `výzva`. Ten strings, zero missing.

### Deliberately undone

- **`ChallengeRow` stays inline in `dev-overlay.tsx`.** Code-guide forbids an inline
  named component, and that file already had one before this phase. Extracting it is
  neighbourhood tidying and belongs in its own item.

### Criterion 3 cannot be verified locally

A `user_features` row revoking `dev` is carried across as a revocation — the migration's
`insert … select` copies `granted` in both directions, and the comment above it says why.
But **no local test can prove it**: `supabase/seed.sql` runs _after_ the migrations, so a
fresh `pnpm db:reset` has no `dev` override to carry, and by the time the seed lands the
key no longer exists to create one. `supabase/tests/features.sql` asserts only that
nothing still names `dev`.

So this is a production check, to be run either side of the push:

```sql
-- Before `pnpm db:push`
select user_id, granted from user_features where feature_key = 'dev' order by user_id;
-- After. Same user_ids, same granted values.
select user_id, granted from user_features where feature_key = 'challengeLab' order by user_id;
```

### State of the gate

Green: `i18n:verify` (687 messages, 0 missing Czech), `prettier --check`, `tsc --noEmit`,
`knip`, `vitest` (1676 tests, 108 files), `pnpm db:test` (both SQL files, migrations
included).

`pnpm check` **fails on four ESLint errors that are not this build's**, all in another
session's uncommitted work in the same tree: `lib/arcade-layout.test.ts` (unused import),
`lib/town-marks.ts` (cognitive complexity, misleading array sort) and
`lib/town-marks.test.ts`. Linting everything but those three gives 0 errors. Every file
this phase touched lints clean on its own. That tree also carries unrelated edits to
`components/overlays/how-to-play-overlay.tsx` and `lib/rng.ts` — not this build's either.

### Not exercised in the app

Nothing here has been driven in a running app: criteria 5–8 and 10–15 are code-complete
and unverified, including both halves of the picker (criterion 14). That is `verify`'s
job and it is the bulk of what is left.

---

# Phase two — the challenge a player meets

## Tasks

- [x] 1. `modes/types.ts` + `modes/rules.ts` + `modes/registry.ts` — `board` on `Capabilities`, `board: true` in the base, `board: false` in `NO_TRAITS`
- [x] 2. **The eleven renames** — `use-board.ts` ×4, `machines/game.ts` ×2, `career.ts:191`, `score-submission.ts`, `invite-message.ts`, `best-scores-line.tsx`, `paused-overlay.tsx` (BoardMedals only). Exactly five `.scored` readers must remain — confirmed five
- [x] 3. `modes/definitions/trainee.ts` + `modes/challenges/define.ts` — Trainee's `board: false`; `defineChallenge` forces it **after** `patchRules`; `modes/rules.test.ts` + `registry.test.ts`
- [x] 4. `supabase/migrations/20261012000000_session_scores.sql` + `supabase/tests/session_scores.sql` — table, trigger, submit RPC, two reads, and `create or replace cancel_challenge_session` with the scores guard, and `create or replace cancel_challenge_session` with the scores guard
- [x] 5. `lib/leaderboard-period.ts` — `startOfDayInPrague`; `lib/challenge-session.ts` — `teaserOpensAt`, `cardSession`, `SessionCard`; both tested
- [x] 6. `lib/session-board.ts` + `hooks/use-session-card.ts` — the three server calls and the one session the intro draws
- [x] 7. `components/overlays/challenge-countdown.tsx` — the ticking figure, its own interval, its own file
- [x] 8. `lib/player-profile.ts` — `lifetimeOf`'s defaulted third argument and the RPC field; the stillness test
- [x] 9. `lib/local-scores.ts` + `lib/score-submission.ts` — `sessionId` on `LocalScore`, the session route, a closed session refusing cleanly
- [x] 10. `components/overlays/challenge-card.tsx` + `menu-overlay.tsx` — the card as the ALONE panel's first row; challenges out of `modeItems`
- [x] 11. `components/overlays/tab-panel.tsx` — the `emptyLine` override; `components/overlays/challenge-modal.tsx` — name, description, session board, START
- [x] 12. `app/(tabs)/index.tsx` — `runSession`, START from the modal, and the session board on game over
- [x] 13. `components/overlays/how-to-play-overlay.tsx` — the challenges chapter, gated on `challenges`
- [x] 14. `constants/buttons.ts` + `CLAUDE.md` + `pnpm i18n:extract` + Czech; `pnpm check`

## Verification log — phase two

**Verdict: 16 PASS, 0 FAIL, 2 PARTIAL (3 and 10).** Nothing hands backwards. Two findings
past the criteria are recorded below as 19 and 20, both for `review` rather than `build`.

`pnpm check` exits 0 and `pnpm db:test` passes all four SQL files. Driven on web at
`localhost:8081` against the local stack, with `challenges` switched on, a live session
and a teaser planned, and a real challenge run played through to game over.

| #   | Criterion                             | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `traitsOf` answers both halves        | PASS    | Scratch vitest over every registered mode, plus a mode nothing is registered under and arcade. Also checked `runRules` agrees with `traitsOf` at all three rungs — the two could have drifted and nothing else held them together.                                                                                                                                |
| 2   | No catalog entry can claim a board    | PASS    | Scratch vitest: three shapes of `capabilities` patch, on two different base modes, all forced to `board: false` — and the base modes themselves left untouched, so the force does not mutate what it reads.                                                                                                                                                       |
| 3   | A challenge run's screen              | PARTIAL | **Score readout: PASS**, present and showing 0 in DSEG7. **Strip blank but keeping its height: PASS**, a clear band between the hearts and the targets. **No board request: PASS by unit evidence** — `use-board.ts` is the only fetcher and every guard in it now reads `.board`, which criterion 1 proves is false here. **Pause screen: SKIPPED** — see below. |
| 4   | Other modes unchanged                 | PASS    | Accuracy's intro panel drew its full TODAY / THIS WEEK / EVER board with three rows; Trainee drew its tip card and no board; the tutorial ran and ended normally.                                                                                                                                                                                                 |
| 5   | The live card                         | PASS    | First row of the ALONE panel, above the pills: `FOUR KEYS · LEFT 2:09:31`, then `Nobody has played it yet.` and a chevron. The countdown went 2:08:59 → 2:08:55 across four seconds, so it ticks once a second. After a score landed it read `VERIFY leads · 1 840`. No challenge among the mode pills.                                                           |
| 6   | The teaser                            | PASS    | With the live session removed: `FOUR KEYS · OPENS IN 22:41:29`, and the challenge's description in place of a leader. The session opens the next day at 10:00, and the teaser was showing from Prague midnight.                                                                                                                                                   |
| 7   | Live beats teased; nothing stacks     | PASS    | A live session and a teased one of the same challenge both existed; the card drew the live one. One card, never two.                                                                                                                                                                                                                                              |
| 8   | A mode this build does not have       | PASS    | `challenge/ghost-dial` was teased and opened **three hours sooner** than the registered one. The card drew FOUR KEYS anyway and the console logged nothing — the unregistered row is filtered before the soonest-opening rule is applied.                                                                                                                         |
| 9   | The modal                             | PASS    | Name in the challenge's colour, `Four keys, two of them twins.`, `ONE WINDOW, ONE SET OF STANDINGS`, START and CLOSE. Empty: `— NOBODY HAS SCORED HERE —`. Populated: a gold rank-1 row, `VERIFY · 1 min ago · 1840` in DSEG7, highlighted as the player's own.                                                                                                   |
| 10  | START, the score, the game-over board | PARTIAL | **START: PASS** — dealt a FOUR KEYS run on its own 2×2 dial, two targets at once, two lives, `FOUR KEYS` in the top bar. **Game-over board: PASS** — the screen drew the session board, which only renders when `sessionId !== null`, so the session survived from START to game over. **A run's own score reaching the board: SKIPPED** — see below.             |
| 11  | The window and its grace              | PASS    | Probed to the second: closed 9m59s ago → accepted; 10m1s ago → refused; one second before opening → refused; unknown session → refused. The shipped test only straddled these loosely.                                                                                                                                                                            |
| 12  | No downgrade                          | PASS    | 300 → 50 left it at 300; → 900 raised it. Three submits, one row.                                                                                                                                                                                                                                                                                                 |
| 13  | Two airings, two contests             | PASS    | Two sessions of one challenge: the second started empty with the new run alone on it, and the first kept its 5000.                                                                                                                                                                                                                                                |
| 14  | Cancel refused once played            | PASS    | Refused with `2 players have already scored on it` — the count is players, not rows. An unplayed session still cancels. A direct delete still cascades the standings away.                                                                                                                                                                                        |
| 15  | Fortune                               | PASS    | Scratch vitest: a real career reads byte-identical with the argument omitted, with `[]`, and with both; a session adds exactly `scoreSum × scoreWeight`; `runs`, `hits`, `score`, `timeMs`, `accSum` and `spdSum` all unmoved.                                                                                                                                    |
| 16  | Offline and refusal                   | PASS    | `isNetworkFailure` returns false for all five sentences this feature's RPCs raise and true for three real network failures — which is the whole of the risk: a shut window read as offline would re-offer a score to a dead contest forever.                                                                                                                      |
| 17  | How to Play                           | PASS    | CHALLENGES appears in the contents between MODES and ARCADE, with the `challenges` feature held. The chapter's only use of "Nine" is the game's name; it says "The keys, the clock, the scoring, how many lives you get — any of it may be different", which is the opposite of promising nine keys.                                                              |
| 18  | `pnpm check`, `pnpm db:test`          | PASS    | Both green. `check` returned 1 once mid-session and 0 on a clean run with every step passing individually — a race with another session writing in this tree, not this work.                                                                                                                                                                                      |

### The two partials, precisely

- **Criterion 3's pause screen.** Not reached. A FOUR KEYS run has two lives and a 6.75s
  clock, so it ends in about twenty seconds, and the pause control did not take a
  synthetic click in four attempts across two runs. What is unverified is narrow: that the
  pause screen shows the score and RESTART RUN and _no_ board medals. The medals half
  follows from `paused-overlay.tsx:152` now reading `.board`, which criterion 1 proves
  false for a challenge; the other two follow from the two `.scored` readers left in that
  file. Worth a look by hand before shipping.
- **Criterion 10's score.** The dial is one `GestureDetector` running a pan, not nine
  pressables — by design, and `constants/buttons.ts` says so. Synthetic clicks and drags
  do not reach it, so no run could be made to score inside its clock. Closed as far as it
  goes another way: the real RPC was called through the page's own authenticated client
  (204), and the score then appeared on the card as `VERIFY leads · 1 840` and in the
  modal as a ranked row. So the server, the board read and both renders are proven. The
  one unproven link is the engine handing a non-zero score to `submitScore` — and the
  session id reaching that call _is_ proven, since the game-over screen drew the session
  board, which happens only when `runSession` is non-null at that moment.

### Found past the criteria

- **19 (new, for `review`): starting a challenge from the card plays the losing-heart
  animation for a life the player never had.** `HeartIcon` is keyed by index and the row
  is a fixed `[0, 1, 2]`, so moving from a three-life mode into the two-life challenge
  keeps all three mounted and heart 2 flips `filled: true → false` — which runs the
  _lost a life_ sequence: scale up, then fade out over 200ms. For the first fifth of a
  second of a challenge run the third heart is red and visibly dying. The lives
  themselves are correct: `runRules` resolves `count: 2`, the machine's context is 2
  after a `SET_MODE` + `START` pair (pinned by a scratch test), and a run reached from
  PLAY AGAIN — where the previous mode was already the challenge — draws two filled and
  one empty from the first frame.
- **20 (new, for `review`): a challenge's game-over screen names the wrong rung.** The
  badges read `FOUR KEYS · EASY` while the run was played at Hard — `FOUR_KEYS` pins
  `fixedDifficulty: 'hard'`, and `runRules(...).difficulty` confirms it. The screen is
  handed the machine's context difficulty, which is still whatever the intro last had.
  **Pre-existing** rather than introduced here: the challenge lab starts runs the same
  way and always has. Phase two is simply the first time a player can see it.
- **The first launch is clean.** Before the feature was granted, the intro painted with
  no card, no DEV and no ADMIN, and no error — the `challenges` guard covers the read as
  well as the card, so an ordinary player makes no request for sessions at all.
- **Cosmetic, not filed:** the game-over screen's run stats show `0% AVG SPD` on a run
  with no hits, which is existing behaviour for every mode.

### Environment

Left with `challenges` **active = true** and one live session planned against FOUR KEYS
on the local database — both are fixtures of this verification, not intended state. The
feature ships `active = false`; flip it back before the next run of the app matters.

## Build notes — phase two

### The capability split went as specced, and the count is the proof

Eleven renames, five left alone, and `grep` says exactly five `.scored` readers survive
outside `modes/types.ts`: the live readout (`index.tsx`), the pause score and RESTART RUN
(`paused-overlay.tsx`), the factor stat (`run-stats.ts`) and the poor-run streak
(`career.ts`). The five that had to change meaning changed by not being touched.

One slip worth recording, caught by an assertion rather than by review: the first pass at
the renames asserted three occurrences of `if (!traitsOf(mode).scored) return` in
`use-board.ts` and found four — line 332's longer line _contains_ the shorter one as a
prefix. The script refused to write. Doing the longer match first fixed it.

### What differs from the spec

- **`formatCountdown` added to `lib/duration.ts`**, with tests. The spec named no
  formatter and `formatGameTime` is the wrong one by design — it refuses a colon because
  a run's _length_ beside HITS would read as a time of day. A countdown is the one thing
  in the app that genuinely is a clock.
- **`SessionStandings` is its own component**, beyond the file list. It fetches, so it
  cannot live behind the `sessionId !== null` branch inside the game-over screen without
  putting a hook behind a condition.
- **`loadSessionBoard` returns rows, not a `PeriodBoard`.** `PeriodBoard` lives in
  `hooks/use-board.ts` and **nothing in `lib/` imports from `hooks/`** — zero occurrences
  before this. The assembly moved to `hooks/use-session-card.ts`, where it belongs.
- **`ServerError` is now exported from `lib/refusal.ts`.** `submitSessionScore` was
  returning the error's sentence, which loses the code, details and hint that make a
  refusal worth logging. The type was already structural for exactly this reason.
- **A second migration, `…_challenges_to_tester.sql`.** The spec said the floor moves to
  tester as part of this phase; it is its own file rather than an edit to phase one's,
  which has already been applied.

### Decisions at forks

- **`from: 'session'`, not `'challenge'`, on `run_started`.** `'challenge'` already exists
  in that union and means the **dare** the game-over screen offers — the same run one rung
  harder. Reusing it would have merged two funnels that mean opposite things. The union
  gained a value and a comment saying which is which.
- **`runSession` lives in `index.tsx`, not on the machine**, as specced — and is cleared
  per-door rather than on START, so RESTART RUN keeps the session while PLAY GAME and the
  challenge lab clear it.
- **The teaser's CTA is a dead card wearing the countdown**, not a disabled
  `PrimaryButton`. A greyed primary button reads as something that failed; a card saying
  OPENS IN 14:21:06 reads as the answer to the question the dialog was opened with.
- **`sessionBoardOf` is not exported** — knip caught it, and `useSessionBoard` is the only
  caller there should be.

### Review focus, as built

1. **The eleven renames** — done from the spec's table, verified by the count above.
2. **`defineChallenge` forces `board` after `patchRules`** — `noBoard()` wraps the merge
   result. Two tests pin it, including one whose spec explicitly asks for `board: true`
   and is overruled while the rest of its patch survives.
3. **The countdown owns its interval**, in `challenge-countdown.tsx`, and stops when it
   arrives rather than counting into the past.
4. **`lifetimeOf`'s third argument is defaulted**, and the stillness test asserts both the
   two-argument and the explicitly-empty forms return byte-identical results.
5. **A closed session refuses rather than failing** — `submitSessionScore` separates
   `isNetworkFailure` from everything else, and `score-submission.ts` skips the error
   report for an expected closure while still counting the attempt.

### Not exercised in the app

Nothing here has been driven. The card, the teaser, the modal, the session board on game
over, the How to Play chapter and the whole write path are code-complete and unverified.
`pnpm check` exits 0 and `pnpm db:test` passes all three files, which covers the pure
arithmetic and the entire server side — the window and its grace, the no-downgrade, the
ranking and tie-break, the cancel guard and the cascade — but not one pixel.

Two things `verify` should be told before it starts. The feature is `active = false`, so
**the card draws for nobody until that switch is flipped on the admin screen** — the stack
is seeded but the master switch gates it. And `FOUR_KEYS` is the only challenge in the
catalog, so a session has to be planned against it to see anything at all.

## Verification log — phase two

_(verify fills this in)_

## Review — phases one and two

Both phases reviewed together: they are one branch, and the capability split in phase two
re-points lines phase one wrote.

### Review focus, confirmed one by one

Ten items across the two specs. None of them was real — here is the evidence for each,
because "checked, fine" ten times is a skipped step rather than a pass.

**Phase two**

1. **The eleven renames.** Exactly five `.scored` readers remain outside `modes/types.ts`,
   and they are the five the spec's table names: `index.tsx:1759`, `paused-overlay.tsx:147`
   and `:218`, `run-stats.ts:55`, `career.ts:218`. The count is the check, since `tsc`
   cannot tell two booleans apart.
2. **`defineChallenge` forcing `board` after the merge.** `define.ts:89` reads
   `noBoard(patchRules(...))` — the force wraps the result, not the base. Pinned by a test
   whose spec asks for `board: true` and is overruled while the rest of its patch survives,
   and by a sweep over the whole catalog.
3. **The countdown's interval.** The only `setInterval` in the feature is
   `challenge-countdown.tsx:37`; `menu-overlay.tsx`, the card and the modal have none. It
   clears on unmount and `now >= until` returns before arming, so a closed session stops
   rather than counting into the past.
4. **`lifetimeOf`'s third argument.** Defaulted at `player-profile.ts:235`, and all four
   callers pass `profile.sessions` explicitly — so the stillness holds by construction for
   a server that sends nothing, and the figure is right for one that does.
5. **A closed session refusing rather than failing.** `session-board.ts:110` splits
   `isNetworkFailure` out before returning `refused`, and `score-submission.ts:52` skips
   the error report for an expected closure while still counting the attempt. A scratch
   test puts all five sentences these RPCs raise through `isNetworkFailure` and gets false
   for every one.

**Phase one**

6. **The grant copy carrying both directions.** `…_challenge_lab_rename.sql:50` selects
   `uf.granted` through rather than filtering or defaulting it. Verified for real during
   `verify` by resetting to before the migration, planting one grant and one revocation,
   and running it.
7. **`features.sql`'s ordered array.** Updated to `array['challengeLab', 'czech']`;
   `pnpm db:test` passes.
8. **The tab body's early returns.** They moved whole into `admin-access.tsx`; BACK from a
   person lands on the people list, confirmed in the browser.
9. **`datetime-local`'s zoneless string.** `date-time-field.web.tsx:36` refuses anything
   not matching `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}`, so a date-only value — which `new Date`
   would read as UTC — never reaches the lib.
10. **Knip's blind spot on the web variant.** One `DateTimeFieldComponent` type in
    `types/date-time-field.ts`, imported by both halves, so `tsc` is the guard. This one
    bit during the review itself — see below.

### The house pass

- **Domain language.** `session` and `session board` both have their row in `CLAUDE.md`,
  and the **capability** row now describes `board` beside `scored`. Nothing shortens a
  session board to "board" in code or comment.
- **Mode branching.** Nothing in this work reads a mode's name. Every
  `mode === '…'` in the tree is pre-existing (`multiplayer-game.tsx`, `achievements.ts`,
  `game-over-title.ts`), and the one `key === 'challenges'` added to
  `how-to-play-overlay.tsx` indexes a **guide section**, beside the `arcade` and
  `multiplayer` lines already there.
- **Strings.** `pnpm i18n:verify` green; the thirteen new ones were read on screen in
  Czech during `verify` — VÝZVY, ZAČÁTEK, KONEC, NAPLÁNOVAT TERMÍN, and the empty line.
- **How to Play.** A challenges chapter exists, gated on the feature, and deliberately
  promises nothing about the dial — its only use of "Nine" is the game's name.
- **Design.** `text-red-500` for a refusal is the house idiom (nineteen uses across eight
  files, most of them pre-existing). The card takes the challenge's own `gradientOf(...)[0]`
  and the chapter `GAME_SCALE[3]`, so neither invents a colour.
- **Tests.** Every pure lib added has a colocated test — `challenge-session` (28 its),
  `duration` (20), `leaderboard-period`, `player-profile`. The two that do not are
  `session-board.ts` and `admin/sessions.ts`, both pure I/O, which matches the existing
  `lib/admin/{features,roles,people}.ts`.
- **Comments.** Why-heavy throughout; no comment restates its line.

### Simplified

Three pieces of scaffolding with no caller, all introduced by this work and all removed:

- **`useSessionBoard` returned a `refresh` nobody called.** Both readers want the
  standings once; the `useCallback` and the second state path went with it.
- **`useSessionCard` returned a `ready` flag nobody read.** There is no card until the
  answer arrives and no space held open for one, so nothing had anything to wait for.
- **`SessionCardState` was a wrapper around one field** once `ready` left. The hook
  returns the card bare.

### Considered and left

- **`#ef4444` in `date-time-field.web.tsx`.** Moving it to `constants/colors.ts` — which
  exists for exactly this, "the same hex copied into a dozen components" — made `knip`
  fail: the export's only consumer is a `.web.tsx` file, and `knip.json` ignores those.
  That is review focus 10 biting in a direction the spec did not predict. Reverted, with
  the comment now naming the Tailwind class it mirrors and why it cannot reach it.
- **Three `state === 'live'` ternaries** in the card and the modal. The code guide bans
  ternary _chains_ selecting from a known set; `SessionCard` has two states and a value
  map carrying JSX would read worse than the ternaries. If a third state ever arrives,
  these three sites are where it has to be remembered.
- **`SessionSent` duplicating `Sent`.** Both are `'published' | 'offline' | 'refused'`.
  Sharing one would make `score-submission` and `session-board` import each other, which
  is a worse trade than three repeated string literals.

### `/code-review high` — twelve findings, six of them real

The automated pass took ten minutes over twenty-five paths and found six defects worth
reopening the build for. Three I confirmed myself before relaying them; the rest are
recorded with the evidence the review gave.

**Reopening the build — phase two:**

- **F1 · `endRunEarly` throws a session score away.** `app/(tabs)/index.tsx:1122` still
  reads `if (!isOneOf(mode, SCORED_MODES)) return`, which a challenge never satisfies. I
  widened the game-over effect for sessions and missed its sibling. **Confirmed.** END RUN
  is the only non-game-over exit from a challenge run, and it loses the score silently —
  not even queued locally. Task 12 reopens.
- **F3 · the wrong rung is written to `session_scores`.** All three submit sites pass
  `state.context.difficulty` — the rung the intro last held — rather than
  `rules.difficulty`. **Confirmed with a scratch test:** on FOUR KEYS a player sitting on
  Easy plays at Hard and posts `easy`, so the fortune weights those points 0.5 instead of
  1 (and 2 for a player on Extreme). That is a 2–4× error in FORTUNE, against a spec that
  says "at the challenge's pinned difficulty weight". It is also `verify`'s finding 20 —
  the `EASY` badge on the game-over screen — traced to where it does damage. Tasks 9
  and 12 reopen; `challenge-modal.tsx:56` and `session-standings.tsx` should read the
  same resolved rung so two screens stop disagreeing about one run.
- **F4 · `sessionTotals` has no producer.** `shapeProfile` reads `raw.sessionTotals ?? []`
  but **no migration adds that key to `player_profile`**. **Confirmed:** `grep -rn
sessionTotals supabase/` returns nothing. The whole `SessionTotals` path in `lifetimeOf`
  is dead against a real server, so acceptance criterion 15 cannot pass as shipped. This
  one is mine twice over — I wrote the client half and never the server half, and then
  verified the criterion with a pure-function test that could never have caught it. Task 8
  reopens and needs a migration.
- **F2 · `runSession` survives a mode change.** The spec says it clears "when the mode
  changes or the player reaches the intro"; the build only clears it in `onPlay` and the
  challenge lab. The game-over dare and the step-up overlay both send `SET_MODE` with the
  session intact, so the next run — a different mode, possibly a different rung — posts
  into the challenge's standings. Task 12 reopens.
- **F5 · the intro is left focused on a pill that no longer exists.** Dropping the
  challenge from `modeItems` leaves `gameMode` as the challenge id after a session run,
  and `ModeSelector`'s `findIndex` cannot locate it. Reported as HIGH. **Not reproduced**
  in my browser session — after HOME out of a challenge run the intro showed ACCURACY
  focused with its board — so this needs a decisive check rather than a fix on faith.
- **F6 · `edit_challenge_session` can re-point a session that has scores.** Cancel was
  hardened in phase two; edit was not. An admin fixing a typo can move a played session
  onto another challenge, and rows with no mode of their own silently become another
  contest's standings. Task 4 reopens.

**Noted, not fixed:**

- **F7** `useSessionBoard` has no dropped-flag, so a late read can overwrite a newer
  board. Real but narrow; worth folding into the F3 work since it touches the same hook.
- **F8** only `'has closed'` is treated as an expected refusal, so a clock-skewed device
  starting a session the server thinks is not yet open reports a false error. Matching on
  a message is also brittle — a `SQLSTATE` would be stable.
- **F9** the web date field hard-codes `fontSize: 11` / `fontWeight: 700` while its
  comment claims the font is read from the same place as the rest of the form. The repo
  rule is that no screen picks a size by hand; ESLint cannot see it because it is a DOM
  style object. Should take its numbers from `constants/typography.ts`.
- **F10** `runRules(modeId, 'hard')` in the modal is only right for a challenge that pins
  a rung. Same root as F3.
- **F12** the `challenges` comment in `constants/features.ts` still says nothing reads the
  key. Two things do now.

**Kept against the review — a spec decision:**

- **F11** both hub doors share `admin.section`. The spec says so in as many words: "the
  breakdown is by screen, and a second id per pair would split one affordance in the
  funnel for no question anybody is asking." The review's counter — that FEATURES vs
  CHALLENGES is a question somebody might ask — is fair, and if it is ever asked the fix
  is two ids. Left as specified rather than overruled in a review.

### Worth their own work item

- **The hearts row is hardcoded to three slots** (`index.tsx`, `[0, 1, 2]`). A two-life
  mode draws an empty third, and because `HeartIcon` is keyed by index, entering a
  two-life challenge from a three-life mode plays the _losing_ animation on a heart the
  player never had. Pre-existing; surfaced by this work because phase two is the first
  time a player makes that transition in one press. `verify`'s finding 19.
- **Two sessions on one working tree.** This work was reverted three times mid-cycle, the
  last taking `menu-overlay.tsx` back to HEAD. More to the point, `app/(tabs)/index.tsx`
  now carries both this feature and another session's arcade and tutorial work, and
  depends on its uncommitted files — so this branch cannot be committed in isolation. See
  the hand-off note.

## Build notes — phase two, round two

The six defects `review` reopened are fixed, plus the four it had filed as noted-not-fixed.
Tasks 4, 8, 9 and 12 were the ones named; 12 took most of it.

### The six

- **F4 · `sessionTotals` had no producer** (task 8). New migration
  `…_profile_session_totals.sql`. The one thing worth recording about it: my first attempt
  retyped `player_profile` from a partial read and silently rewrote half of it — the
  nickname guard, the `best_score > 0` filter on bests, and the gap-and-islands CTEs that
  compute reign stretches all came out wrong. A diff against the original caught it. The
  migration now **splices one key into the function copied verbatim**, and the diff
  against `…_winnings_accepted.sql` is exactly eleven added lines. Proved end to end in
  psql: a player with no sessions reads `[]`, a player with a 1500 run at Hard reads
  `hard / 1500`, and every other key of the profile still answers.
- **F3 · the wrong rung** (tasks 9, 12). All three submit sites pass `rules.difficulty`
  instead of `state.context.difficulty`. `submitScore`'s parameter now carries a comment
  saying which one it wants and what it costs to get it wrong.
- **F1 · `endRunEarly` threw the score away** (task 12). The guard was widened, which
  broke a narrowing `countRun` was relying on — so the fix is two parts: `onBoard` is
  named once, the session run passes the early return, and `countRun` stays behind
  `onBoard` because `player_totals` is keyed by mode × difficulty and takes a `ScoredMode`
  to say so. A challenge must never write there.
- **F2 · `runSession` surviving a mode change** (task 12). Cleared at the dare, at the
  step-up's START and its OTHER MODE — and then, rather than chasing the five `MENU` sends,
  backstopped in one effect that fires on reaching the intro.
- **F6 · `edit_challenge_session` could re-point a played session** (task 4). New
  migration, same shape as the cancel guard, with a test that pins all three cases: an
  unplayed session is still re-pointable, a played one is refused, and the **span** of a
  played one still moves — which is the ordinary reason to open that form.
- **F5 · the intro left on a mode with no pill.** The review rated this HIGH and I could
  not reproduce it; it is real, and the reason I missed it is that every attempt went
  through a reload, which rehydrates `mode` from storage. Confirmed at the source:
  `MENU` does not touch `mode`, `initialFocus` is `mode`, and `ModeSelector`'s
  `findIndex` returns −1 so the highlight simply stops moving. The damage the review
  named is worse than the highlight: PLAY GAME reads the machine's mode and would deal
  another challenge run belonging to no session. Fixed in the same intro effect — if the
  machine is not on one of its own modes, it goes back to the one the card interrupted,
  or to `MODE_ORDER[0]`. `isMode` is the registry's own word for the question, so no mode
  is named in a screen.

### The four small ones

- **F7** `useSessionBoard` drops a stale read, the way `useSessionCard` already did.
- **F8** the expected-refusal filter matches **`P0001`** — the SQLSTATE every `raise
exception` in our own functions carries — instead of the sentence `'has closed'`. That
  fixes both halves: a clock-skewed device hitting _not yet opened_ was being logged as a
  server bug, and the match no longer breaks when the copy is reworded.
- **F12** the `challenges` comment in `constants/features.ts` said nothing reads the key.
  Two things do.
- **F9** the web field's hand-picked `fontSize: 11` / `fontWeight: 700` — **attempted and
  reverted.** Exporting them from `constants/typography.ts` made `knip` fail, because the
  only consumer is a `.web.tsx` file and `knip.json` ignores those. That is the second
  time this blind spot has forced a revert in this cycle; the colour hex was the first.
  The literals stay, with a comment naming the role they mirror and why they cannot
  import it. See the work item below.

### Kept against the review

**F11**, the shared `admin.section` id on both hub doors, is what the spec decided and why.
Left as specified.

### Worth its own work item

- **`knip` cannot see `**/*.web.tsx`,** so nothing may be exported for a web variant's
  sole use, and no web-only regression is visible to `pnpm check` at all. It blocked two
  correct changes in this cycle. The likely fix is to make the web variants _entries_
  rather than ignored, so knip follows their imports.
- **The hearts row is hardcoded to three slots** — `verify`'s finding 19, unchanged.
- **The other session's worktree is nested inside this repo** at
  `.claude/worktrees/road-bandits/`, and `vitest`'s `**/*.test.ts` glob, `prettier` and
  `knip` all now sweep it. `pnpm check` fails on ten of its tests. `vitest.config.ts` and
  `knip.json` need `.claude/**` excluded; excluding it locally, this work's own suite is
  107 files and 1711 tests green.
