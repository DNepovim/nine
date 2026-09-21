# Player profile — Design

Date: 2026-09-21

## Goal

Tapping a nickname anywhere in the app opens that player's profile: their champion
mark, their lifetime numbers, the medals they hold right now, and the all-time
records they have ever held.

A board today says what a player scored once. It says nothing about who they are —
whether that score was their thousandth run or their third, whether they are an
Accuracy player who has never touched Speed, whether they held Extreme for a month
last spring. The profile is where a name stops being a row and becomes a player.

## Domain language

**profile** — the modal itself. Opened by a name, keyed by a `user_id`, readable for
any player including yourself.

**reign** — one unbroken stretch of holding an all-time board's rank one. It has a
start, and an end once someone takes it. Distinct from a **medal** (a standing right
now, on any of the three periods) and from a **record** (a score crossing a bar
mid-run). A player raising their own record does not start a new reign — they were
never not holding it.

**totals** — the per-board counters behind every lifetime number the profile shows.

## The data the app does not have

The server stores two things about a run, and only for the best run of a day:
`daily_scores(best_score, hits, day)`, with `scores` a trigger rollup of it. That is
the whole write path — see `docs/scores.md`.

So of everything the profile wants, the server can answer:

| Wanted                   | Source today                                    |
| ------------------------ | ----------------------------------------------- |
| Crown / owl / eagle      | `championMark()` over the two Extreme boards    |
| Nickname                 | `profiles.nickname`                             |
| Medals held now          | `my_medals(p_user_id, …)` — already takes an id |
| Best per board, and when | `scores.best_score`, `scores.updated_at`        |

and cannot answer, for any player including the one holding the phone:

- **Lifetime hits.** `scores.hits` is the hit count of that one best run.
- **Average accuracy and speed.** Computed in the machine as `accSum`/`spdSum`
  (`machines/game.ts:126`), kept only for the best run per board, only in
  AsyncStorage, never submitted.
- **Total score, run counts.** `lib/career.ts` counts `runs` and `points` locally
  for the achievements to read, on one device, with no per-board breakdown.
- **Reigns.** `career.heldSince` is local, own-device, and holds only the current
  holding. Its own comment says it: "the app keeps no history of the boards."

Two new tables close that gap. Neither stores a per-run row: the totals are
counters, and the reigns are a handful of rows per board per year.

## Data model

### `player_totals` — counters, one row per player × board

```sql
create table player_totals (
  user_id    uuid not null references profiles (id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  runs       int    not null default 0,
  hits       int    not null default 0,
  score_sum  bigint not null default 0,
  -- Sum over every hit of its accuracy / speed factor. Stored as a sum so a run is
  -- added without reading anything back, and divided by `hits` to be shown.
  acc_sum    double precision not null default 0,
  spd_sum    double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, difficulty)
);
```

`bigint` on `score_sum` because it is the one column with no ceiling — everything
else is bounded by runs.

**Averages are `round(100 × acc_sum / hits)`**, the identical formula the run-stats
line uses (`app/(tabs)/index.tsx:441`). Reusing it is the point: a profile and a game
over screen that computed the same number two ways would eventually disagree about
it. Average speed can exceed 100 — `speedReward` pays a bonus above `FAST_BAND` — and
that is already true of the number shown at game over, so the profile does not clamp
what the rest of the app does not.

Accuracy modes show the accuracy average and Speed modes the speed average, as
asked. Both columns are written for both modes anyway: they cost nothing, and the
mode weights are a display decision that may change.

Lifetime totals are the sum of the six rows, computed on read. A seventh row holding
the same fact is a seventh chance to disagree with it.

### `board_reigns` — who held an all-time board, and when

```sql
create table board_reigns (
  id         bigserial primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  -- What they hold it with. Raised in place while the reign continues, so it is the
  -- best they ever held it with rather than what they took it with.
  score      int not null,
  took_at    timestamptz not null,
  -- Null while they still hold it.
  lost_at    timestamptz
);

create index board_reigns_user_idx on board_reigns (user_id, took_at desc);
create unique index board_reigns_one_open_idx
  on board_reigns (mode, difficulty) where lost_at is null;
```

The partial unique index is the invariant stated as a constraint: a board has at most
one open reign. A bug that opened a second would otherwise be invisible until a
profile showed two players holding the same board.

Only the three difficulties × two modes of the **all-time** board get reigns. TODAY
and THIS WEEK change hands daily and reset on a clock — a list of them would be noise,
and "ever records" is what was asked for.

**Maintained by a trigger, never by a client.** `track_board_reign` fires after a
write to `scores`, which is where the all-time board lives:

```
leader := the top row of this board  -- best_score desc, updated_at asc, nickname not null
open   := the open reign for this board, if any

if open.user_id = leader.user_id then
  update open set score = greatest(open.score, leader.best_score)
else
  update open set lost_at = new.updated_at   -- when there is one
  insert a new open reign for leader, took_at = new.updated_at
```

Three details that are not incidental:

- **`new.updated_at`, never `now()`.** That column is the moment the run ended, not
  the moment it was sent — the rule `score-submission.ts` already follows so a record
  that waited out a flight keeps the position it was earned in. A reign that started
  when the score landed on the server would date a champion's reign to their next
  reconnection.
- **Ties go to whoever got there first** (`best_score desc, updated_at asc`), the
  tiebreak every board in the app uses. A tie must not take a board off the player
  who already held it.
- **A player without a nickname is not on the board**, so they cannot hold it either
  — the same filter `leaderboard`, `my_medals` and `past_winners` all apply.

That last rule leaves one gap a trigger on `scores` alone cannot see: a player with a
high score but no nickname who sets one later joins the board without any `scores`
write happening. So a second trigger on `profiles`, firing when `nickname` goes from
null to non-null, re-evaluates that player's six boards through the same function.

**Backfill, in the migration:** the current leader of each of the six all-time boards
gets an open reign with `took_at = scores.updated_at`. It costs one statement and
means the feature is not blank on day one for exactly the players most likely to be
tapped.

### Grants and RLS

Both tables: public read (a profile is public; every number in it is either already
on a board or an aggregate of runs that were), and **no client writes at all**.
`player_totals` is written only through the `record_run` RPC, `board_reigns` only by
its trigger. Both functions are `security definer`, mirroring `my_medals` and
`leaderboard`.

## Writing a run

### Why not the existing submit

`submitScore` is called several times per run: on every board record as it happens
(`app/(tabs)/index.tsx:466` — deliberately, so rivals hear about a record at once),
again at game over, and again from `endRunEarly`. It is an upsert of a best, so
repeating it is harmless. A counter incremented in the same place would report five
runs for one.

The counters therefore get their own call, made once, where a run actually ends.

### `record_run`

```sql
create function record_run(
  p_run_id     uuid,
  p_mode       text,
  p_difficulty text,
  p_score      int,
  p_hits       int,
  p_acc_sum    double precision,
  p_spd_sum    double precision
) returns void
```

`p_run_id` is generated on the device when the run ends and makes the call
**exactly-once**. The function inserts it into

```sql
create table run_receipts (
  run_id  uuid primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  at      timestamptz not null default now()
);
```

`on conflict do nothing`, and increments the counters only when that insert took a
row. Without it, a response lost on the way back to a device that then retries would
add the same run twice, and a counter has no way to notice or repair that later —
unlike `daily_scores`, where a repeated write is the same best score again.

This is not per-run history through the back door: the table holds a uuid and a
timestamp, nothing about the run, and is pruned past 30 days by a `pg_cron` job of its
own, alongside the one `cleanup_finished_rooms` schedules. A replay older than that is
not a retry; it is a bug.

The function also rejects values no real run can produce: any negative argument, a
factor sum outside `[0, p_hits × 2]` (each per-hit factor is bounded by 1 plus the
speed bonus), and the two sanity ceilings `p_hits ≤ 5000` and `p_score ≤ 1000000`,
both an order of magnitude above any real run. A broken or hostile client cannot be
stopped from lying about one run, but it can be stopped from writing a number that
makes every average on that board meaningless forever.

### Counted runs

Accuracy and Speed only, the six boards everything else is keyed by. Trainee is
unscored practice with no board and no difficulty; multiplayer submits nothing to the
server today. Both stay out, and the profile says nothing about them.

A run with no hits, or no score, is still a run: `runs + 1`, `hits + 0`. "How many
runs have you played" is not "how many went well".

### Offline

`lib/run-totals.ts` holds a queue under `nine.run-totals.v1` — one entry per finished
run: `{ runId, mode, difficulty, score, hits, accSum, spdSum, endedAt }`. The run is
enqueued first and sent second, so a run survives a crash between the two; entries are
dropped only on a confirmed success, and a refusal that is not a network failure is
logged and dropped exactly as `score-submission.ts` treats one.

Flushed on the trigger the pending scores already use (`useScoreSubmission`, on ready
and on reconnect), and pruned at 200 entries / 30 days the way `pruneLocalScores`
bounds its store. Losing runs silently would make a count wrong in a way nobody could
notice, and a queue without a bound is a queue that grows forever on a device that
never signs in.

Called from the two places a run ends — the game over effect and `endRunEarly` —
behind a ref keyed on the run, so a re-render cannot enqueue it twice.

## Reading a profile

One RPC, `player_profile(p_user_id, p_today, p_week_since)`, returning json:

```ts
type PlayerProfile = {
  nickname: string
  totals: { mode; difficulty; runs; hits; scoreSum; accSum; spdSum }[]
  bests: { mode; difficulty; bestScore; hits; achievedAt }[]
  medals: { mode; difficulty; period; rank; bestScore }[]
  reigns: { mode; difficulty; score; tookAt; lostAt: string | null }[]
}
```

Period bounds go up with the call rather than being computed in SQL — the app draws
them on the Prague clock (`lib/leaderboard-period.ts`), and a second definition in the
database is a second thing to keep in step. Same reasoning `my_medals` and
`past_winners` are already built on, and the medal rows are that function's logic
reused rather than reimplemented.

One round trip rather than four, for the same reason `my_medals` exists: four
requests for one screen are four answers that can disagree, and this one is behind a
tap that should feel instant.

**Client:**

- `lib/player-profile.ts` — the fetch, the row types, and the pure shaping: averages,
  board ordering, lifetime sums, and the reign date range. Pure, so it is all testable
  without a server.
- `hooks/use-player-profile.ts` — fetch on open, `loading` / `error` / `profile`, with
  an in-memory cache keyed by user id so reopening a name inside a session is free.
  Not part of the board store: that store follows the board being looked at, and a
  profile follows a tap.

The champion mark is **not** in the response. `useChampions` already knows both
Extreme all-time leaders and is already live over the board connection; asking the
server a second time would let the modal disagree with the mark on the row that
opened it.

## The modal

`components/overlays/player-profile-overlay.tsx`, a `<Screen overlay>` in the idiom of
`achievements-overlay.tsx` — it is a screenful of stats, not a prompt.

Opened through a `PlayerProfileProvider` mounted at the root beside `BoardProvider`,
exposing `openProfile(userId)`. One instance, four call sites, no per-screen copies of
the open state to drift.

Top to bottom:

1. **The mark** — crown, owl or eagle, large. Nothing when they hold neither board;
   an empty slot would read as a missing image rather than as an absence.
2. **Nickname.**
3. **Lifetime** — runs · hits · total score, with a quiet `Counting since 21 Sep 2026`
   beneath. The counters start at zero for everyone, and a veteran's profile reading
   "3 runs" without that line is the app lying about them.
4. **Per board** — Accuracy easy / hard / extreme, then Speed. Per row: runs, best
   score, and the mode's average (accuracy for Accuracy, speed for Speed). A board
   never played shows a dash, not a zero.
5. **Medals held now** — reusing `board-medals.tsx`. Section omitted when there are
   none.
6. **Reigns** — board, score, and range: `12 Aug – 3 Sep`, or `since 12 Aug` while
   open, newest first. Dates through `lib/format-date.ts`, so they localise with
   everything else. Section omitted when there are none.

Colours, type and sizing come from the `design-guide` skill, consulted before the
component is written — the mark is gold on gold and that is exactly the case the guide
exists for.

**States.** Loading is a skeleton in the shape of the content, following
`skeleton-row.tsx`, not a spinner — the modal's height should not jump when the
response lands. A failed read says so and offers a retry; it never shows zeros, which
are indistinguishable from a real profile. A player who has never finished a counted
run shows their name, their mark and their medals, with the lifetime block replaced by
one line saying no runs are counted yet.

**Tapping your own name** opens the same modal with the same numbers. The profile is
public data about a player; that the player is you changes nothing about it.

## Surfaces

`ScoreEntry` gains `userId` and `ScoreRow` an `onPress`. Then:

- Leaderboard rows on the intro and the pause screen (`high-scores.tsx`), the player's
  own row below the cut included
- The game over board (`game-over-overlay.tsx`)
- The winners stripe (`recent-winners.tsx` — `past_winners` already returns `user_id`)
- Multiplayer player tiles and results (`player-tile.tsx`,
  `multiplayer-game-over.tsx`)

A row whose id is unknown — a local unpublished claim — is not tappable. There is no
profile behind it yet.

## Testing

Vitest over the pure parts, which is all of the client logic worth testing:

- `lib/player-profile.ts` — averages including the zero-hits case, lifetime sums over
  a partial set of boards, board ordering, reign range formatting for open and closed
  reigns, and mapping a response with missing sections.
- `lib/run-totals.ts` — enqueue, flush dropping only on success, a network failure
  keeping the entry, a refusal dropping it, and the prune bound.
- The once-per-run guard at the call sites, through the existing game machine tests.

The repo has no SQL harness, so the trigger, the RPC and the receipts dedupe are
verified by hand against local Supabase, with the cases written down in the plan:
taking a board, raising your own record, a tie, losing it, a nickname set after the
fact, and a replayed `run_id`.

## Out of scope

Trainee and multiplayer counters. Reigns on TODAY and THIS WEEK. Seeding totals from
historical `scores` rows — a best score is not a run count, and inventing one would be
worse than starting at zero. Hiding or editing a profile. Any change to how a score is
submitted or a board is read.

## Rollout

The migration is additive: two tables, one receipts table, two triggers, two
functions, no change to `scores`, `daily_scores` or any existing RPC. A client that
predates it never calls `record_run`; a client that postdates it against an
un-migrated database gets one failed RPC per run, queued and retried, which is the
offline path and is already safe.
