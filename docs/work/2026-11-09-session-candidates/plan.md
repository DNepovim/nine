# Session candidates — Plan

Spec: docs/work/2026-11-09-session-candidates/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261109000000_session_candidates.sql` — column, vote table, RPCs, merge, pending trim, drops; apply locally
- [x] 2. `supabase/tests/session_candidates.sql`; rewrite `challenge_state.sql` and `next_vote.sql` onto the new RPCs
- [x] 3. `lib/session-voting.ts` + test (time left reuses `formatCountdown`, so no new duration helper)
- [x] 4. `lib/admin/sessions.ts` (candidates), `lib/admin/session-detail.ts`, `lib/session-ratings.ts`, `hooks/use-next-vote.ts`
- [x] 5. Player vote: `next-vote*.tsx`, `rating-overlay.tsx`, `challenge-card.tsx`, `menu-overlay.tsx` keyed by candidate
- [x] 6. Gallery and challenge page read candidates; `challenge-state-dialog` names removed and trimmed
- [x] 7. `admin-candidates-dialog.tsx`, `admin-session-votes.tsx`; `admin-sessions.tsx` list rows and pills, no steps
- [x] 8. `admin-session.tsx` shell, `admin-session-live.tsx`, `admin-session-planned.tsx`; delete `admin-pair`, `admin-plan-pair`, `session-pairs`, `QueueMoves`
- [x] 9. Dev fixtures (a voting session with votes and voters); `docs/domain.md`, `CLAUDE.md`; `pnpm i18n:extract` + Czech; `pnpm check`

## Build notes

- **Voting in progress follows the server:** the _first_ planned session, when it has two
  candidates (the shape said "the first that has two"). Amended in the spec; a later two-candidate
  session is not voted on until it is next.
- **No new duration helper:** time left is the existing `formatCountdown`; `voteSlices` was not
  needed (the pie is built inline from `votesFor`). Both dropped from the spec.
- **`votesFor` (new, tested)** counts the voters a detail already loaded, so the figure beside a
  name and the voters list cannot disagree. The planner's list takes counts from
  `next_vote_options` (public) rather than listing voters for every row.
- **Live detail keeps CLOSE EARLY** (the shape only removed EXTEND) and a past unplayed session
  keeps CANCEL SESSION. `extendSession` and `AdminExtendDialog`/`AdminNumberField`/`AdminWhenRow`
  are deleted (nothing calls them); `extend_challenge_session` stays in the database.
- **The edit dialog allows a single to stay a single** (only an already-single session may be
  saved with one candidate); a new session needs both.
- **The merge ran locally** against the dev queue (4 planned → 2 with candidates, first date
  kept). It is a one-time step in the migration; `session_candidates.sql` covers everything
  after it, and the production queue should be read before the push.
- **Dev fixtures:** the next session now has two candidates (FOUR KEYS vs HABIT) with three votes
  (HABIT leads), one other two-candidate session and one single, so the planner shows a voting
  row, a plain two-candidate row and a single. `pnpm dev:fixtures` ran twice, clean.
- **SQL tests:** `session_candidates.sql` new; `challenge_state.sql` rewritten; `next_vote.sql`
  deleted (its cases moved); `challenge_sessions.sql` and `session_scores.sql` updated for the
  new edit rule and the missing move RPC. They ran in rolled-back transactions on the local
  stack. `session_scores.sql` still fails on a pinned 2026-11 date that predates this work, and
  `features.sql`, `session_ratings.sql`, `session_run_receipts.sql` fail on the local stack's own
  data (admin roles, fixtures); a clean `pnpm db:test` (which resets the stack) was not run.
- **Not seen in the app:** nothing has been driven; the planner's countdowns are the list's
  snapshot, not a ticker.

**Honest pass over the criteria:** 1 (merge) by the local run, 2–8 and 11 built to the shape and
untested in the app, 9–10 by the SQL test, 12 (the player's vote reading the new RPC) is wired but
not driven, 13 green apart from the pre-existing SQL-test failures above.

## Verification log

**Verdict: 14 of 14 PASS, 0 FAIL, 0 SKIPPED.** The migration and SQL by test and a rolled-back
simulation; everything an admin or player sees driven in the web build against the local stack
(one browser session). Found and fixed in verify: a single-candidate session printed "0 VOTES";
the planner's vote count sat against the second name. Local data was put back with
`pnpm dev:fixtures`.

| #   | Criterion                                                                                               | Result | Evidence                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The planned queue merges two-by-two, re-packed, nothing opened touched                                  | PASS   | the migration ran on the dev queue (4 → 2 two-candidate sessions); a rolled-back run on 5 singles + 1 opened gave 2 doubles + 1 single at 11/13/15 and left the opened one alone                                                                                                                       |
| 2   | PLAN SESSION: a dialog, one session, both required, same refused                                        | PASS   | dialog opened empty with SAVE disabled; DRIFT + REELS saved as one session on 21 NOV (DB: one row, `alt_mode_id` set); `session_candidates.sql` covers the refusals                                                                                                                                    |
| 3   | List rows: live figures; planned names; votes + clock on the voting session only                        | PASS   | live row "2 480 · 3 players · 5:39:26 left"; 11 NOV "HABIT 2 VOTES / FOUR KEYS 1 VOTE, opens in 47:05:28"; 13/15/17/19 NOV names only                                                                                                                                                                  |
| 4   | No reordering; compact coloured LIVE/PLANNED/PAST pills                                                 | PASS   | no steps anywhere; three coloured glyph-and-count pills in one line                                                                                                                                                                                                                                    |
| 5   | Live detail: date title, challenge, other smaller, votes, standings, total + per-player runs, no EXTEND | PASS   | "9 NOV 10:56 / FOUR KEYS 2 VOTES / STORM 1 VOTE", standings, "RUNS · 26 runs" and a row per player; footer CLOSE EARLY + BACK only                                                                                                                                                                     |
| 6   | Planned voting detail: date, names + votes, pie, voters; no selects; EDIT CHALLENGE                     | PASS   | screenshot: pie, voters with their picks, EDIT CHALLENGE / REMOVE FROM QUEUE / BACK                                                                                                                                                                                                                    |
| 7   | Planned, not voting: same without votes/pie/voters                                                      | PASS   | 13 NOV: date, "HABIT" and "FOUR BY FOUR", nothing else                                                                                                                                                                                                                                                 |
| 8   | EDIT CHALLENGE pre-filled; asks first while voting naming the votes lost; KEEP changes nothing          | PASS   | pre-filled HABIT / FOUR KEYS, SAVE disabled; changed to SIDEWAYS → "1 vote … will be discarded"; KEEP returned to the form; CHANGE kept HABIT's 2 votes and dropped the other (DB checked)                                                                                                             |
| 9   | A vote is for a candidate; leader and measure follow; tie keeps booking; non-player refused             | PASS   | `session_candidates.sql`; in the app a vote for FOUR KEYS made it 2–2 and HABIT stayed leading (DB)                                                                                                                                                                                                    |
| 10  | An opened session refuses votes and edits                                                               | PASS   | `session_candidates.sql` (edit "has opened"; vote not up for a vote)                                                                                                                                                                                                                                   |
| 11  | Pending trims or removes; the dialog names both counts; running kept                                    | PASS   | `session_candidates.sql` (trim keeps date + other, single removed, running hidden); STORM page: dialog "2 sessions keep their dates and their other candidates, and their votes for this one are dropped", no removal line                                                                             |
| 12  | Player vote offers the two candidates; non-voter sees results + note                                    | PASS   | non-player: results dialog with pie, both counts and the note; after playing, the rating dialog's vote step offered HABIT and FOUR KEYS, tap recorded the vote                                                                                                                                         |
| 13  | A one-candidate session shows no votes                                                                  | PASS   | live detail of the single session (before the fixture gave it a second) printed "0 VOTES" — fixed — and after reload shows none                                                                                                                                                                        |
| 14  | `pnpm check` green, Czech included; SQL tests pass                                                      | PASS   | lint, Prettier, `tsc`, Knip, 2269 tests, `i18n:verify` (996 messages); `session_candidates`, `challenge_state`, `challenge_sessions` SQL ok. `session_scores.sql` (pinned 2026-11 date), `features`, `session_ratings`, `session_run_receipts` fail on the local stack's own data, as before this work |

## Review

`/code-review` at high (schema touched, a live queue migration) returned ten findings; with the
spec's review focus and the house pass, this is what became of them.

**Fixed (suite green, `session_candidates.sql` / `challenge_state.sql` / `challenge_sessions.sql` green).**

- **A tie depended on history.** The header promised "the booked order" but a tie kept
  whichever candidate had led last. A new `first_mode_id` records the candidate booked first
  and breaks a tie; plan, edit, the merge and the pending trim maintain it, and the test
  asserts a tie after a lead change goes to the first-booked.
- **The two vote tiles traded places** when a vote flipped the lead (the options came leader-first
  and the tiles are drawn by index). They are offered in a fixed order (by challenge) now; the
  leader is still visible in the planner and the results.
- **The "this will discard N votes" confirmation could be skipped** while the voters read was
  loading or had failed, and used votes read when the screen opened. The votes are read again as
  EDIT CHALLENGE opens, with the button held until they are in.
- **A second candidate without a valid measure** failed as an opaque check violation (and an
  invalid string could be stored). Plan and edit now raise a named error, and the check
  constraint covers `alt_measure`.
- **The pending dialog's title** said "take it off the queue" even when nothing was removed and
  sessions were only trimmed. Neutral title: "Hold this challenge back?".
- **RUNS on an old session** read "No runs yet." under a full standings table, because receipts
  are deleted after 30 days. The block is hidden for a session closed longer ago than that.
- `needsSecond` leaned on `undefined !== null`; it now says "only a real single may stay single".
- The gallery's vote demo gave the two candidates different session ids; they share one now.
- `docs/domain.md`'s **extending** row still described EXTEND on the planner; it now says the
  screen no longer offers it and only the database function stays.
- The planner's name cell was a ternary chain over the three statuses; it is a value map now.

**Review focus, one by one.**

1. _The merge migration_ — one transaction (a failed local run rolled the whole file back); votes
   are dropped with the old table before any session row is deleted, so no FK is touched; an odd
   queue ends on a single and a challenge twice in a row stays a single; nothing opened is selected.
   Rolled-back simulation on 5 singles + 1 opened: 2 doubles + 1 single, opened untouched. **Not
   run against production's real queue** — the push is the user's.
2. _`mode_id` flips while planned_ — readers treat it as the leading candidate (teaser, card),
   and the gallery's "planned" and the challenge page's dates count either column
   (`sessionsOf`); a challenge that is only ever the runner-up still reads as planned
   (verified on STORM).
3. _Edit while voting_ — edit and vote both take `lock_challenge_queue()`, a replaced candidate's
   votes are deleted and the leader is settled; the dialog's count is now fresh (above).
4. _Measure follows the leader_ — `settle_next_vote` and the pending trim swap `measure` and
   `alt_measure` with the modes; the test asserts it after a flip and after a tie.
5. _Removed RPCs' leftovers_ — `QueueMoves`, `planPair`, `movePair`, `pairsOf`, `AdminPair`,
   `extendSession`, the extend dialog, `AdminNumberField`, `AdminWhenRow` are all gone; Knip clean.

**Left, deliberately.**

- **`votingSession` sorts by `opensAt` only** where the server also uses `created_at`. After a
  re-pack two planned rows never share an `opens_at`, so the two can only disagree for an instant
  between a merge and its re-pack; adding `createdAt` to `AdminSession` is not worth it.
- **Old devices cannot vote until they update** (`vote_next` changed shape) — accepted in the
  shape; a refused vote is visible and honest.
- **`move_challenge_session`/`plan_challenge_pair`/`move_challenge_pair` are dropped**, so an admin
  on an old build gets an error from those buttons; same reasoning.
- **A `session_scores`-style pinned-date failure** in `session_scores.sql` and the local-state
  failures in `features`, `session_ratings`, `session_run_receipts` remain (not this work's); a
  clean `pnpm db:test` was not run.

**Next.** One migration to push first (`20261109000000_session_candidates.sql`), and **read
production's planned queue before pushing** — it merges and re-times it. No How to Play change.
The changes made after `verify` (tie rule, tile order, edit read, receipts note, dialog title) were
re-checked by the SQL tests, `tsc` and the unit suite, not re-driven in the app.

Shipped: `0082b7c` on `main`. The migration `20261109000000_session_candidates.sql` is **not** pushed (the user chose to skip); it merges the planned queue, so read production's queue first, push it, then deploy.
