# Challenge rating — Plan

Spec: docs/work/2026-10-29-challenge-rating/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261029000000_session_ratings.sql` + `supabase/tests/session_ratings.sql` — table, RLS, `rate_session`, `ratings` feature row; validate locally
- [x] 2. `lib/session-rating.ts` + test — `Rating`, `isRating`; the write `rateSession` went to `lib/session-ratings.ts`, since importing Supabase breaks the vitest env (the session-summary/-summaries split)
- [x] 3. _(reopened by verify #3, fixed: the chosen key is the ink pair at full strength with `ON_STRONG_INK` on it)_ `components/overlays/code-keyboard.tsx` — `id`, `onKey`, `lit`; adapt `game-code-input.tsx`
- [x] 4. `hooks/use-session-summaries.ts`, `hooks/use-popup-deck.ts` — `told` / `take`
- [x] 5. `hooks/use-session-rating.ts`, `components/overlays/rating-overlay.tsx`, `constants/buttons.ts`, `constants/features.ts`
- [x] 6. `app/(tabs)/index.tsx` — mount after the popup; install and replay wait on it
- [x] 7. Copy: `pnpm i18n:extract`, Czech; `docs/domain.md` + `CLAUDE.md` gain **rating**

## Build notes

- **The write is in `lib/session-ratings.ts`**, not `lib/session-rating.ts`. Importing
  Supabase fails vitest's env check, so the pure `Rating`/`isRating` stay in
  `session-rating.ts` and the RPC call sits beside them. This is the same split as
  `session-summary.ts` and `session-summaries.ts`.
- **The rating hook is composed inside `usePopupDeck`** and returned as `rating`, not
  called from `index.tsx`. The deck already holds `features` and the summary hook. The
  hook returns `{ asking, send, done }`: SEND writes and then plays the card's exit, and
  `done` (the summary hook's `take`) runs on `onDismiss` however the card left.
- **`ChallengeName` moved to `components/overlays/challenge-name.tsx`** so the dialog
  can name the session the way the summary does, instead of a copy.
- **The email ask also waits on the rating.** `mayAskForEmail`'s `newsVisible` now gets
  `launchPopupUp` (popup or rating). The spec named only install and replay, but the
  email ask sits in the same queue, and leaving it out would stack two dialogs.
- **The lit key** first used the keypad's pressed tint (`80`/`70` alpha), and verify
  #3 failed it as too faint on a pale pair. The chosen key is now the ink pair at full
  strength with `ON_STRONG_INK`, the strong-button ink; a key under the finger is still
  the tint.
- **Dev data: none needed.** No screen reads `session_ratings`. The four closed
  sessions in `dev-fixtures.sql` already give a summary to be told.
- **`pnpm db:test` stops at `features.sql:175`** ("a revoked override should take away
  a public feature"). Neither this work nor the other changes in the tree touch that
  file; it contradicts `…_public_beats_override.sql`. `session_scores.sql` and
  `session_ratings.sql` pass when run directly after the reset.
- **The tree also holds another session's changes**: `admin-session(s).tsx`,
  `lib/challenge-session*`, `supabase/tests/challenge_sessions.sql` and
  `…_plan_next_noon.sql`. They are not part of this item and must not be staged with it.

## Verification log

**Verdict (pass 2): 12 PASS, 0 FAIL, 0 SKIPPED. On to review.**

Pass 2 re-ran `pnpm check` (green: 0 lint errors, 2,076 tests) and the whole browser
walk on a freshly started Metro. Pass 1's server ran with `CI=1`, which disables file
watching, so the first re-run was served the old keypad.

- **#3 now PASS.** On FOUR KEYS the chosen key is the teal pair at full strength with
  light ink, which is unmistakable against the tinted keys. SEND stays greyed until a
  key is pressed, and a forced press writes 0 rows.
- **#1, 2, 4–8, 11: same results as pass 1**, no page errors.
- **The sideways shift in the screenshots is not this work.** An `overflow-x: hidden`
  root (390/480 px) is scrolled 90 px by Playwright's scroll-into-view on click. The
  same 480 px overflow is on a plain intro with no dialog open, from the mode strip and
  the paged leaderboards (`overflow.js` in the scratchpad).
- **Looked past the criteria:** on a first launch, the summary marker is set and
  nothing is told, so nothing is rated. Czech strings are in the catalog and
  `i18n:verify` is green. The tutorial and other modes are unaffected, since the dialog
  only opens from the intro after a summary.

### Pass 1

**Verdict (pass 1): 11 PASS, 1 FAIL (#3), 0 SKIPPED. Back to build: task 3 (the lit
key) reopens.**

Suite: `pnpm check` green (lint warnings only, all older raw text sizes), with 2,076
tests. The app was driven on the web build at 390×844 with headless Chrome via
Playwright, against the local stack (`ratings` and `challenges` private, dev profile
`admin`). The script is in the session scratchpad (`verify-rating.js`).

| #   | Criterion                                 | Result | Evidence                                                                                                                                                                                        |
| --- | ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Opens after the summary popup, no overlap | PASS   | Closed the popup and checked 80 ms later: summary and rating were not both visible. The rating rose about 600 ms later                                                                          |
| 2   | Name, title, keypad, captions, edge       | PASS   | Screenshot: FOUR KEYS in its pair, HOW WAS THIS ONE?, 1–9, both captions, teal edge                                                                                                             |
| 3   | SEND disabled until a key; key lights     | FAIL   | SEND greyed, and a forced press wrote 0 rows. But the lit key barely differs on FOUR KEYS: at `80`/`70` alpha on a pale ink pair, 4 reads as a slightly darker grey. The choice is easy to miss |
| 4   | SEND writes one row; NOT NOW writes none  | PASS   | 7 then 4 then SEND gave the row `(four-keys, 4)`. NOT NOW on four-by-four gave 0 rows                                                                                                           |
| 5   | Not again, this launch or next            | PASS   | Not back on the same launch. After a reload, neither the summary nor the rating appeared                                                                                                        |
| 6   | News-only popup opens no rating           | PASS   | 17-page news popup closed, no rating                                                                                                                                                            |
| 7   | Without `ratings`, nothing                | PASS   | `ratings` set hidden, summary popup closed, no rating                                                                                                                                           |
| 8   | Install / replay ask wait for it          | PASS   | Replay ask absent during the popup and during the rating, and present after NOT NOW. The install prompt is `none` in headless Chrome, so the shared `launchPopupUp` gate covers it              |
| 9   | `rate_session` guards                     | PASS   | `supabase/tests/session_ratings.sql`, run directly after a reset                                                                                                                                |
| 10  | Join-room keypad unchanged                | PASS   | Code read: the four-digit cap moved to `game-code-input.tsx` with `join_room.key`. Not driven, because multiplayer join needs a room                                                            |
| 11  | Offline SEND closes quietly               | PASS   | `rate_session` route aborted: dialog closed, intro up, the earlier row (4) untouched, no page errors                                                                                            |
| 12  | `pnpm check` + pgTAP                      | PASS   | `pnpm check` green. `pnpm db:test` stops at `features.sql:175`, older than this work (see Build notes). `session_scores` and `session_ratings` pass                                             |

To check on the next pass: the rating screenshots are shifted about 90 px left. The
summary screenshot is not, so this is probably Playwright scrolling the popup's
horizontal pager into view, and the document keeps that `scrollLeft` after it
unmounts. Confirm by reading `scrollLeft` before the shot.

## Review

`/code-review high`, scoped to this item's files (the tree also holds another session's
work), plus the house pass.

**Fixed (the criteria re-walked in the browser afterwards, all PASS, no page errors):**

- A second summary dismissed while a rating waits no longer overwrites `told`. The first
  summary closed keeps the question (`setTold(current => current ?? summary)`).
- `told` is dropped when the player changes (`userId` effect), and when it is set while
  `ratings` isn't held, such as in a role preview, so ending the preview can't put up a
  stale rating.
- SEND is guarded by a `sent` ref, so a double tap during the exit can't write twice.
- `rate_session` refuses a session that hasn't closed yet. The pgTAP file covers it.
- `rateSession` catches a transport that throws, so fire-and-forget can't become an
  unhandled rejection.

**Kept as built (comment corrected):**

- The keys use `challengeInk(edge[0])`, the near-black every challenge shares, so
  resting keys look the same across challenges and the hue shows on the chosen key.
  Verify #3 approved this look; the comment no longer says the keys wear the pair.
- A forced dev-sidebar summary also sets `told`. The shape accepted this as how the
  dialog is tested, and the comment now says so.

**Review focus:** all five confirmed in the code (handoff only in `dismiss`, mount on
`!whatsNew.visible`, `launchPopupUp` on all three asks, the cap in `game-code-input`,
no policies plus revoke from anon).

**House pass:** domain rows present, no mode branching, Czech reads correctly, How to
Play untouched, `TYPE` roles in the new dialog.

**Left, worth an item of its own:**

- `CodeKeyboard`'s raw `text-[24px]` (and `game-code-input.tsx`'s raw size and
  tracking). This is a type sweep CLAUDE.md reserves for the user.
- `supabase/tests/features.sql:175` fails on `main`. It contradicts
  `…_public_beats_override.sql`, and `pnpm db:test` stops there.
- The intro's root is 480 px of content in a 390 px `overflow-x: hidden` box (the mode
  strip and the paged leaderboards). Programmatic scrolling can shift the whole screen
  sideways.
- A place to read ratings: an average per challenge on the admin planner.

**Note:** the other session's commit `b28f225` swept this item's **rating** rows in
`CLAUDE.md` and `docs/domain.md` onto `main`.
