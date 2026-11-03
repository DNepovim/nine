# The session queue — Plan

Spec: docs/work/2026-11-03-session-queue/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261103000000_session_queue.sql` — slot, repack, plan/edit/move, re-pack in cancel/extend/close, auto-plan; db tests rewritten + queue assertions; `pnpm db:test`
- [x] 2. `lib/challenge-session.ts` — `queueOrder`, `pastCountByMode` + tests; `lib/admin/sessions.ts` — new signatures, `moveSession`
- [x] 3. Extended the existing `AdminSelect` (icon, detail, placeholder, nullable value, scrolling list) rather than a new component — it already existed; ids are its own `admin.select`/`admin.select_option`; only `admin.session_move_up/down` are new
- [x] 4. `admin-session.tsx` — dates read-only, `AdminSelect` with mark/colours/count, REMOVE FROM QUEUE
- [x] 5. `admin-sessions.tsx` — queue order, up/down (`QueueMoves` in `admin-session-cells.tsx`, beside the other cells)
- [x] 6. Deleted `date-time-field.tsx`, `.web.tsx`, `types/date-time-field.ts` and the `@react-native-community/datetimepicker` dependency; domain docs, inventory row, Czech

## Build notes

- **`AdminSelect` already existed** (the role picker uses it). Extended it — `icon`,
  `detail`, `placeholder`, a nullable `value`, a scrolling list — instead of writing a
  second one; the challenge field uses its own `admin.select` ids, so
  `admin.session_challenge` and `admin.session_when` left `constants/buttons.ts`.
- **Slot anchor amended in the spec**: `greatest(closes_at, opens_at + 24h)` instead of
  `closes_at`, or CLOSE EARLY would have pulled the queue a day forward. AC7's example
  corrected to Wednesday (open Mon, close Tue, rest, open Wed).
- **No clash check on plan/extend** any more: one re-packed queue can't overlap itself.
  `challenge_session_clashes` is kept, since its own tests still cover it.
- **Native dependency removed**: `@react-native-community/datetimepicker` had no caller
  left. Its removal reaches devices only with the next native build, which is harmless.
- **Dev fixtures**: two more queued sessions (four-by-four, no-slip) and a re-pack, so
  the queue has a first, a middle and a last row. Ran twice, clean.
- **`supabase/tests/features.sql` fails** (`a revoked override should take away a public
feature`) with or without this work's test changes. It contradicts
  `…_public_beats_override.sql`, so it was already failing and is not this item's. Every
  session test file passes.
- **Shared checkout**: the BINARY challenge edits in `catalog.ts`, `palette.ts`,
  `challenge-mark.tsx`, `dial-button.tsx`, `modes/types.ts` and their `.po` entries belong
  to another session. They are not this item's and must stay out of its commit.
- Self-check: AC1–9 should hold from the code; AC10's `pnpm db:test` is red only on the
  features.sql failure above.

### Build notes, round 2 (from review)

- R1: `repack_challenge_queue(p_now, p_floor)`. Null means the queue's current first row,
  `-infinity` means no floor. `plan` passes the start from before its placeholder (or
  `-infinity` when the queue is empty) and `cancel` of a queued row passes the slot it
  frees. The first draft took `least()` with the queue, which made a new session's own
  placeholder the floor, and the empty-queue test caught it.
- R2: `lock_challenge_queue()` in all six writes. R3: the message now reads
  "…it is still in the queue".
- R4: `move` reads the list itself and keeps `moving` until the rows land. R5: busy
  arrows ignore the press instead of being `disabled`.
- R6: `readOnly = locked || expired` gates SAVE and the field. An unplayed past row can
  still be deleted.
- R7: `# SESSION / # SESSIONS` (Czech stays TERMÍN). R8: `ChallengeTitle` gained a
  `className` prop, which the dropdown uses.

## Verification log

**Round 2 (after review R1–R8): 10/10 PASS, plus R4, R6 and R7 driven.** Suite green (0
lint errors outside the stale worktree, Prettier, types, knip, 2112 tests, 949 messages).
All session SQL files pass, including the two new floor scenarios (extend then close
early; delete an opened row). Driven again: moves, append (`habit@11-11` after
`no-slip@11-09`), no pickers on the form, dropdown reads `1 SESSION`/`0 SESSIONS` and no
RUNS anywhere. A row forced live under the open list refused its step, and "that session
is no longer in the queue" was still on screen after 3 s (shot `2-refused`). A past row
showed no SAVE and a disabled field (shot `5-past-form`; that row had been played, and the
unplayed-past case is the same `readOnly` flag, covered by code rather than driven). R5
(busy arrow tap) was not driven, because headless can't land a tap inside the
in-flight window; it rests on the code.

Round 1:

**Verdict: 10/10 PASS.** Suite green apart from two failures that aren't this work, noted below.
App: Expo web on :8081, headless Chromium (Playwright), 390×844, local stack with fixtures,
signed in as a DEV_ admin.

- `pnpm check`: lint, Prettier, types, knip and 2112 tests are clean. The only lint
  errors come from `.claude/worktrees/road-bandits/` (ignored by git, so CI never sees
  it). Its copy of `date-time-field.tsx` used to resolve the removed picker's types from
  this checkout's `node_modules`. With that folder excluded, lint has 0 errors.
- `pnpm db:test`: every session file passes. `features.sql:175` fails with this item's
  test changes stashed too, so it was already failing (see Build notes).

| #   | Criterion                                               | Result | Evidence                                                                                                 |
| --- | ------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| 1   | No STARTS/ENDS pickers; existing shows read-only rows   | PASS   | new form: 0 STARTS rows; live form: read-only STARTS/ENDS (shots 3, 7)                                   |
| 2   | SAVE appends two noons after the last, 24 h             | PASS   | drove PLAN → NO SLIP → SAVE: queue gained `no-slip@11-11 12:00` after `@11-09`; SQL `the queue OK`       |
| 3   | Live, then queue earliest first, then past              | PASS   | list shot 1: LIVE 3 Nov, then 5/7/9 Nov; `queueOrder` test                                               |
| 4   | MOVE UP/DOWN, none past the ends, dates stay on cadence | PASS   | shot 1: first row down only, last up only; first-down swapped four-keys and four-by-four on 05/07; SQL   |
| 5   | REMOVE FROM QUEUE closes the gap                        | PASS   | drove it on the 7th's row: no-slip 09→07, 11→09; SQL                                                     |
| 6   | Extend pushes the queue; close early never pulls it     | PASS   | SQL `extend guards OK`, `the queue OK` (close early leaves slot0)                                        |
| 7   | Auto-plan books on the first slot                       | PASS   | SQL `next session booked on its own OK` (Mon–Tue session → Wed; stale → next noon)                       |
| 8   | Dropdown: mark, own colours, closed-session count       | PASS   | shot 4: every catalog challenge with its mark, gradient name, `1 RUN`/`0 RUNS`; chosen in field (shot 5) |
| 9   | A played session's challenge field won't open           | PASS   | live FOUR KEYS (3 scores): field dimmed and disabled (shot 7)                                            |
| 10  | `db:test` + `check` green, Czech included               | PASS   | as above; `i18n:verify` 949 messages; five new Czech strings                                             |

Shots in the session scratchpad (`shots/1-list.png` … `9-after-remove.png`). The intro card
reads the same columns it did before, and the Czech labels are in the catalog.

## Review

`/code-review high` over this item's files only (the shared checkout also holds another
session's BINARY work). Review focus 1–5 hold: every queue write calls the re-pack, the
re-pack only touches `opens_at > now` and move refuses an opened row (tested), one arity
per function in `pg_proc`, `AdminSelect` extended, counts from loaded rows. The house pass
fixed two stale "newest first" comments and the arrows' tap height (40px).

Reopened for build (a backwards pass, the first):

- [x] R1. **Re-pack must never pull the queue forward on its own** (#2, #3). Closing early
      after an extension, or cancelling an opened unplayed row, moves the anchor back and
      the queue with it, which breaks AC6. Fix: the re-pack floors slot0 at the current
      first queued row; only `cancel` of a _queued_ row passes its own slot as the floor so
      the gap closes. Tests for both scenarios.
- [x] R2. **Serialise queue writes** (#4). Take a transaction advisory lock at the top of
      plan, move, cancel, extend, close early and the auto-plan.
- [x] R3. **Extend's not-yet-open message** (#9): drop "change its end instead".
- [x] R4. **Move: keep the error, keep the guard until reloaded** (#1, #10). `move` reads
      the list itself and clears `moving` after the rows land, so a refusal stays visible.
- [x] R5. **Busy arrows swallow the tap** (#5): guard in `onPress` instead of `disabled`,
      so the row underneath doesn't open.
- [x] R6. **A past session is read-only** (#6, as Shape item 5 says): no SAVE, field off.
- [x] R7. **"# SESSION / # SESSIONS", not RUNS** (#7). Domain: a run is a game.
- [x] R8. **Use `ChallengeTitle`** in the dropdown (#8), with a `className` prop.

Left alone: `anon` can call the queue RPCs and gets refused by `require_admin`, which is the
same arrangement every admin RPC has.

Later, its own item: `supabase/tests/features.sql:175` is already red; `.claude/worktrees/`
is linted by `pnpm lint`.

### Review, round 2

`/code-review high` over the R1–R8 diff found 10. Fixed in review, all small: the re-pack, the lock and the
auto-plan are revoked from `anon` and `authenticated` by name (#1; not reachable locally,
but production's default privileges may differ); the server refuses re-pointing a closed
session (#2, with a test); one shared `load` that keeps the rows on a failed read and a
refused step's error (#5, #8); an unknown challenge shows its id rather than the
placeholder (#6); the arrows' column is 60px (#7); the auto-plan inserts a placeholder and
re-packs instead of a second copy of the slot rule (#9); two stale header comments (#10).
Re-checked: session SQL files green, types, lint, tests, and the drive re-run with the
same results.

Left: #3 a played session's measure can still be rewritten if the catalog changes it. The
old `edit` had the same gap, so it isn't this work's. #4 MOVE UP under a row that has just
opened does nothing, but the reload shows that row LIVE with its arrow gone, which explains
itself.

Later, its own items: #3 above; `features.sql:175` already red; `pnpm lint` reads
`.claude/worktrees/`.

Shipped: `1e37c54` on main, 2026-11-03. Migration not pushed, not deployed.
