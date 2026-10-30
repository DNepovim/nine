# Challenge runs in the analytics

Slug: challenge-analytics
Stage: review
Next: /ship challenge-analytics
Track: full
Branch: feat/challenge-analytics
Started: 2026-10-29

## Problem

On a day a challenge is on, the analytics screen reads as if nobody played: RUNS, PLAYED,
MINUTES, HITS, the daily bars and the board breakdown count only Accuracy and Speed runs,
because a challenge run never writes a receipt. The only trace of a challenge is the
sessions block — one best row per player, and nothing at all for a run that scored 0.

## Appetite

A day. decided by advisor: the user asked for it outright ("include challenges to
analytics (runs, time, etc)"); one migration, one RPC, one client path, no player-visible
change.

## Shape

The player sees nothing new. A challenge run posts where a board run posts today — on a
record mid-run if any, at game over, and on END RUN — and each post now also leaves a
**receipt**: the same `run_receipts` row a board run leaves, keyed by the run's id,
carrying the challenge's mode id, the difficulty, score, hits and elapsed time, plus the
**session** it was played in. Repeat posts merge by max, the final one settles it —
exactly `record_run`'s receipt semantics.

What it must _not_ do is what `record_run` does next: move `player_totals`, which is
keyed by board and feeds fortune. So a challenge run goes through a sibling RPC that
writes the receipt and stops — never through `record_run`.

On the admin side nearly nothing changes: `admin_stats_rows` and every `admin_stats`
block already read `run_receipts`, so the tiles, the players list, the bars and the
breakdown pick challenge runs up by construction. The breakdown row for a challenge
already renders (challenge ids are `ModeId`s — `isModeId`/`labelOf`). The comments that
say challenges are absent "by construction" (20261015010000) are restated.

Areas:

- **Schema** — `run_receipts` gains a nullable `session_id`; a new RPC records a session
  run's receipt (session must exist; live-device check as `record_run`); no `player_totals`.
- **Run submission** (`lib/run-submission.ts`, `lib/run-totals.ts`) — the device queue
  carries an optional session id and routes the send by it; `PendingRun.mode` widens
  from `ScoredMode` for session runs only.
- **The run screen** (`app/(tabs)/index.tsx`) — the three `countRun` guards admit
  `runSession !== null` as well as board modes.
- **Analytics screen** — copy only, if any figure's note claims "board runs"; the
  sessions block stays as it is.

Mode business or engine's? Neither branches on a name: the guard is "is this run in a
session", which `runSession` already says. No feature flag — admin-only figures.

## In / Out / Rabbit holes

**In**

- Every challenge run from the moment this ships counted in RUNS, PLAYED, MINUTES, HITS,
  the players behind those tiles, the daily bars and the breakdown — 0-score runs and
  END RUN included.
- Admins still left out, as for board runs.

**Out**

- Backfilling past challenge runs — they were never recorded; the figures start on ship day.
- Trainee and Arcade runs — same gap, different question; not this item.
- Runs per session in the sessions block (it stays players + best). A follow-up once
  receipts carry `session_id`, which this item makes cheap.
- Anything on a player's profile or career — challenge runs stay out of `player_totals`.
- A filter on the analytics screen to split boards from challenges.

**Rabbit holes**

- **Touching fortune.** Reusing `record_run` (or loosening its mode check) would credit
  `player_totals`. Way around: a separate RPC that never writes there.
- **The session window.** `submit_session_score` refuses after close + 10 minutes. A
  receipt is about a run being played, not standing — don't refuse it on the window, or
  an offline run that lands late vanishes from the counts. Require only that the session
  exists.
- **The device queue.** `queueRun`/`dropRuns` key by run id and `ScoredMode` types run
  through them; widening the type must not let a session run be sent to `record_run`.
- **Restating `admin_stats`.** Postgres replaces a body whole; if the comments need
  changing, restate from 20261023000000 verbatim and change only the comments.
- **Migrations aren't applied by CI** — the RPC must be pushed before the build that
  calls it ships, or every challenge run logs a refusal.

## Contract

### Domain words

- **Uses:** **run**, **challenge**, **session**, **session board**, **board**, **fortune**,
  **mode**, **difficulty**. A challenge run belongs to a **session**; it never touches a
  **board** or the **fortune**.
- **Introduces:** none. "Receipt" stays a code word (`run_receipts`), as it is today.
- **Collisions:** the analytics block headed RUNS BY BOARD will now hold challenge rows,
  which are not boards. Its heading becomes **RUNS BY MODE** — decided by advisor: the
  domain word that covers both; the JSON key `boards` and `StatsBoard` keep their names
  (code words, no player sees them). Room `admin` vs role `admin`: the admin exclusion
  here is the **role**, as it already is.

### Files

| Path                                                          |          | Responsibility                                                                                                            |
| ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261029020000_session_run_receipts.sql` | created  | `run_receipts.session_id`; `record_session_run`; comment restatement of `admin_stats`                                     |
| `supabase/tests/session_run_receipts.sql`                     | created  | DB assertions for the RPC and its reach into `admin_stats`                                                                |
| `lib/run-totals.ts`                                           | modified | `PendingRun` carries the run's session; an old stored entry reads as a board run                                          |
| `lib/run-totals.test.ts`                                      | modified | covers the above                                                                                                          |
| `lib/run-submission.ts`                                       | modified | `sendRun` routes a session run to `record_session_run`, a board run to `record_run`; `countRun` accepts either            |
| `app/(tabs)/index.tsx`                                        | modified | the three `countRun` sites (`onBoardRecord`, game-over effect, `endRunEarly`) also count a run with `runSession !== null` |
| `components/overlays/admin-stats.tsx`                         | modified | heading RUNS BY MODE                                                                                                      |
| `locales/en/messages.po`, `locales/cs/messages.po`            | modified | the heading                                                                                                               |

### Data and types

**`PendingRun`** becomes a union discriminated by `sessionId` — the type, not a runtime
check, is what keeps a challenge run away from `record_run`:

```ts
type PendingRun = Common &
  ({ sessionId: null; mode: ScoredMode } | { sessionId: string; mode: ModeId })
```

Stored under the same `RUN_TOTALS_KEY` — no new key. An entry written by an older build
has no `sessionId`; `readRunTotals` reads it as `null` (every such entry was a board run,
since nothing else was queued).

**Schema** — `20261029020000_session_run_receipts.sql`:

- `run_receipts.session_id uuid null references challenge_sessions(id) on delete set null`.
  Existing rows: null, i.e. board runs — true of all of them.
- `record_session_run(p_run_id uuid, p_session_id uuid, p_difficulty text, p_score int,
p_hits int, p_elapsed_ms bigint, p_final boolean)` — `security definer`, granted to
  `authenticated`. Refuses: no caller; `private.session_is_live()` false; unknown
  session; difficulty not easy/hard/extreme; the same negative/range bounds as
  `record_run` for score, hits, elapsed. The receipt's `mode` is the session's
  `mode_id`, read from `challenge_sessions` — never sent by the client. Same receipt
  semantics as `record_run`: foreign owner or settled → no-op; a different session on
  an existing receipt → raise; figures merge by `greatest`; `settled = p_final`.
  `acc_sum`/`spd_sum` stay 0. **Does not** check the session window, and **never writes
  `player_totals`** or `session_scores`.
- `admin_stats` / `admin_stats_rows`: no logic change — they already count every
  receipt. If the comment in 20261015010000 that says challenges are absent "by
  construction" is restated, it is in this migration's header, not by re-creating the
  function.
- **Order:** the push must land before the build. Against the old schema the RPC is
  missing, every challenge-run send is refused, `reportRefusal` logs it and the entry
  is dropped — runs lost from the counts, nothing worse. Board runs are unaffected
  either way.

### Gates

| Gate        | Answer                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Copy / i18n | One string: `RUNS BY MODE` (replaces `RUNS BY BOARD`), Czech `HRY PODLE MÓDU` (the catalog says MÓD). |
| How to Play | None — no gameplay touched.                                                                           |
| Flag        | None — the figures are admin-only already (`admin` feature).                                          |
| Buttons     | None.                                                                                                 |

## Acceptance criteria

1. After a challenge run (session open, non-admin player) ends at game over,
   `run_receipts` holds one row with that run's id, `mode` = the session's `mode_id`,
   `session_id` = the session, its hits and elapsed time, `settled = true`.
2. A challenge run left through END RUN, and one that scored 0, each leave a settled receipt too.
3. A challenge run that posts mid-run and again at game over leaves **one** receipt, with
   the larger figures.
4. `player_totals` and `session_scores` are byte-for-byte what they would have been
   without this change — `record_session_run` writes neither.
5. `record_session_run` refuses an unknown session, a bad difficulty and out-of-range
   figures; it **accepts** a run on a session closed more than ten minutes ago.
6. Posting to a settled receipt, or to another player's run id, changes nothing; posting
   the same run id under a different session raises.
7. For a window containing that run, `admin_stats` counts it in `runs.runs`,
   `runs.players`, `runs.hits`, `runs.minutes`, the day's `series` bar and a `boards` row
   with the challenge's mode id; `admin_stats_people` lists the player with it. An
   admin's challenge run is counted in none of these.
8. Board runs still go through `record_run` and move `player_totals` exactly as before.
9. A run queue written by the previous build (entries without `sessionId`) drains to
   `record_run` unchanged.
10. The analytics screen heads the breakdown **RUNS BY MODE**, Czech included, and a
    challenge row there shows the challenge's name.
11. `pnpm check` and `pnpm db:test` are green.

## Tests

- `lib/run-totals.test.ts` — `readRunTotals` reads a stored entry without `sessionId`
  as `sessionId: null`; `queueRun`/`dropRuns` keep a session run's `sessionId` through
  a replace.
- `supabase/tests/session_run_receipts.sql` — criteria 1 (receipt shape), 3 (merge),
  4 (`player_totals`/`session_scores` untouched), 5, 6, 7 (`admin_stats` counts it; an
  admin's does not).

## Review focus

- **The type is the guard** (task 2): no path in `sendRun` may hand a `sessionId`-bearing
  run to `record_run`; check the narrowing, not a comment.
- **`countedRunRef` across both kinds** (task 3): `endRunEarly` and the game-over effect
  share it; the session branch must set it too, or END RUN followed by game over posts twice
  (harmless server-side, but a second refusal path if the receipt is settled).
- **`difficulty` vs `rules.difficulty`** (task 3): a challenge may pin its difficulty;
  the receipt must carry the one the run was played on, the same value
  `submitSessionScore` sends.
- **Session lost on restore** (task 3): a run put back from storage has `runSession`
  null and is a challenge mode — it must post nowhere rather than reach `record_run`.
- **`mode` from the server** (task 1): the RPC must ignore any client idea of the mode —
  a receipt whose mode disagrees with its session would split one challenge across two
  rows of the breakdown.
