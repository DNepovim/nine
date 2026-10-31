# Challenge runs in the analytics — Plan

Spec: docs/work/2026-10-29-challenge-analytics/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261029020000_session_run_receipts.sql` — `session_id` column, `record_session_run`; `supabase/tests/session_run_receipts.sql`; `pnpm db:test` — renumbered to 20261029020000 (010000 was taken by plan_next_noon)
- [x] 2. `lib/run-totals.ts` + test — `PendingRun` union on `sessionId`, old entries read as board runs; `lib/run-submission.ts` routes by it — session variant carries no `mode` (server reads it off the session); `fromStored` exported for the test
- [x] 3. `app/(tabs)/index.tsx` — the three `countRun` sites count session runs too — via `runKindOf` in lib/run-totals.ts (tested); receipts carry `rules.difficulty`
- [x] 4. `components/overlays/admin-stats.tsx` — RUNS BY MODE; `pnpm i18n:extract` + Czech — Czech HRY PODLE MÓDU (catalog says MÓD for mode)

## Verification log

**Verdict:** 11/11 PASS (11 with the pre-existing `features.sql` failure named). In-app leg driven on web against the local stack.

| #   | Criterion                                          | Result | Evidence                                                                                                                                                                       |
| --- | -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Game-over challenge run leaves a settled receipt   | PASS   | in app: FOUR KEYS run left to run out of lives → receipt `challenge/four-keys`, session set, hard, elapsed 15262, settled; `player_totals` 0 rows                              |
| 2   | END RUN and 0-score runs leave receipts            | PASS   | in app: END RUN at 0 hits/0 score → settled receipt with the session                                                                                                           |
| 3   | Mid-run + final post → one receipt, larger figures | PASS   | SQL test + authenticated psql run (hits 3→5, elapsed 15000→31000)                                                                                                              |
| 4   | `player_totals`, `session_scores` untouched        | PASS   | SQL test counts; authenticated run: totals gained only the board run's row, `session_scores` 0                                                                                 |
| 5   | Refusals; accepts a session closed >10 min         | PASS   | `session_run_receipts.sql`                                                                                                                                                     |
| 6   | Settled / foreign no-op; other session raises      | PASS   | `session_run_receipts.sql`                                                                                                                                                     |
| 7   | `admin_stats` + people count it; admin's not       | PASS   | `session_run_receipts.sql` (runs, series, boards row = 3, people hits/elapsed exact)                                                                                           |
| 8   | Board runs unchanged through `record_run`          | PASS   | authenticated `record_run` → `player_totals` row, receipt `session_id` null                                                                                                    |
| 9   | Old queue drains to `record_run`                   | PASS   | `fromStored` test: entry without `sessionId` → `sessionId: null`, board mode kept                                                                                              |
| 10  | RUNS BY MODE heading, Czech, challenge row named   | PASS   | on screen: RUNS BY MODE, row `FOUR KEYS · HARD 1 · 1`, RUNS 1 / HITS 9 / MINUTES 2 from a non-admin receipt; admin's own two left out. Czech by catalog (`i18n:verify`)        |
| 11  | `pnpm check`, `pnpm db:test` green                 | PASS*  | check green (126 files / 2098 tests). db:test: every file but `features.sql` passes; `features.sql:175` fails identically on a reset **without** this migration — pre-existing |

Also: `anon` has no execute on `record_session_run`; client payload keys = function params.
HTTP to the local API is unreachable from the sandbox, so the RPC was exercised in psql under `set role authenticated` with a real `auth.sessions` row.

## Build notes

- Migration renumbered to `20261029020000` — `20261029010000` is `plan_next_noon`'s.
- The session variant of `PendingRun` carries **no `mode`** (spec sketched `mode: ModeId`):
  the RPC reads the mode off the session, so a client-side mode would be a field nothing
  reads. `RunPost` is the posted shape; `fromStored` (exported, tested) reads old entries.
- One helper decides the kind for all three call sites: `runKindOf` in `lib/run-totals.ts`
  (tested), returning null for Trainee and for a challenge run that lost its session.
- Receipts carry `rules.difficulty` — the same value `submitScore` sends; equal to the
  picked difficulty for every board mode.
- Dev data: none needed — a receipt is written by playing; no screen reads `session_id`.
- **Pre-existing, not this item:** `supabase/tests/features.sql:175` ("a revoked override
  should take away a public feature") fails on a reset **without** this migration too, so
  `pnpm db:test` stops before reaching the files after it. `session_run_receipts.sql`
  passes run on its own against a reset stack.

Criteria, self-read: 1–9 believed met by the RPC + `runKindOf` + call sites (1–7 asserted
in SQL; 8–9 by type and `fromStored` test); 10 met in source and catalog; 11 — `pnpm
check` not yet run (verify's), `pnpm db:test` blocked by the features.sql failure above.
Local-only setup for the in-app leg: a live `challenge/four-keys` session booked; `challenges` set `private` + an override for the dev profile (put back to `hidden` after); one non-admin receipt inserted so the admin viewer had a counted row. Admin screens render shifted left inside the dev frame (hub too) — not this change.

## Review

`/code-review high` over this item's hunks (10 findings) + the five review-focus items +
the house pass. Review focus: all five hold — narrowing in `sendRun`, shared
`countedRunRef`, `rules.difficulty`, `runKindOf` null on a lost session (tested), mode
read off the session (asserted).

**Fixed here** (typecheck + touched tests + `session_run_receipts.sql` green):

- Challenge bars under RUNS BY MODE were all the shared near-black at easy —
  `meterInkOf` in `modes/palette.ts` gives a challenge its `scoreInkOf` hue; tested in
  `modes/challenges/palette.test.ts` (never near-black, distinct per challenge).
- `record_session_run` now refuses a difficulty changing mid-run, as `record_run` does; SQL test added.
- `runKindOf` test covers a scored mode with a session (board wins).
- Comments: admin-stats header says modes, not boards; migration says an unknown
  challenge id is printed dim.

**Left, deliberately:**

- Deploy order — the migration must be pushed before the build ships, or challenge
  receipts are refused and dropped. Already in the spec; `ship`/`deploy` must push first.
- Any existing session accepted, no window — the spec's choice; a signed-in client can
  inflate counts by looping run ids, the same exposure `record_run` already has.
- `at` is arrival time, not play time — true of board receipts today too.
- `SCORED_MODES` rather than `traitsOf(mode).board` — matches every other gate in the
  run screen and `record_run`'s server list; changing one of them alone would split them.
- Three hand-built `countRun` payloads in the run screen — pre-existing shape.

**Worth its own item later:** receipts stamped with play time rather than arrival;
runs-per-session in the sessions block (receipts now carry `session_id`); one board
predicate (`traitsOf`) shared by the run screen and the server.

Shipped in `65fff5d` on `main` — committed by a concurrent session sharing the index, under its message "docs(work): mark lab-ratings shipped"; left as is by choice, no history rewrite. Migration `20261029020000` pushed to production before it. Not deployed.
