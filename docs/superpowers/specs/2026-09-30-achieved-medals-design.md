# Achieved medals — Design

Date: 2026-09-30

## Goal

Every podium place a player has ever stood on, listed at the bottom of their profile:
what the medal was, on which board and window, the score that won it, the day it was
won — and then the part no screen in the app can answer today, how long they kept it
and how it went. Tapping a row opens the full stats of the run behind it.

A medal in this app is a standing, and a standing is a fact about right now. The
medal line under the title says what you hold; `lostMedals` says one sentence about
what you lost, on the launch that noticed, and then it is gone. Nothing anywhere
remembers that you held Extreme Accuracy gold for nine days last March, or that
NIKA took it off you on a Tuesday. This is that memory.

## Domain language

**holding** — one unbroken stretch of standing on one podium place of one board in
one window: Speed Hard silver on the week board, from Tuesday until Friday. It has a
start, a rank it never changes, and an end. New word, and it needs to be: a **medal**
is a standing right now (`lib/medals.ts`), a **record** is a score crossing a bar
mid-run, an **achievement** is permanent and nobody else's business. A holding is
none of those — it is a medal with a beginning and an end written down.

**achieved medal** — what the player sees: one holding, drawn as a row. The screen
word; `holding` is the code and table word.

**taken / improved / expired** — the three ways a holding ends, and the only three.
A rival passed you; you moved up a place yourself; or the window closed under you and
nobody took anything. The third is the distinction `SAME_WINDOW` in
`lib/lost-medals.ts` already draws, and for the same reason: a gold that is gone
because the board was wiped at midnight was not taken by anybody, and saying it was
blames a rival for the calendar.

**medal run** — the run whose score a holding stands on, with the numbers `RunStats`
draws. Not "the run that won the medal": a holding can open without a run of the
player's own being played at all, and it still stands on one of their earlier runs.

## What the server cannot answer today

`board_reigns` is this feature for rank one of the all-time board, and only that:
one place of fifty-four. There are six boards × three windows × three podium places,
and the other fifty-three have no history at all.

Worse, nothing stores a run. `docs/scores.md` is the whole write path — `daily_scores`
holds `best_score` and `hits` for the best run of a day, and `player_totals` holds
six counters. Strikes, top chain, best accuracy, best speed, how long the run took:
computed in the machine, shown once on the game over screen, never sent anywhere. The
`player_totals` migration says it in as many words — *"No per-run rows"* — and this
design breaks that rule on purpose, bounded to runs that reach a podium.

| Wanted                    | Source today                                    |
| ------------------------- | ----------------------------------------------- |
| Which medal, board, score | derivable from `daily_scores` / `scores`        |
| The day it was won        | `updated_at` on the score that won it           |
| How long it was held      | **nothing** — only rank 1 EVER, in `board_reigns` |
| Who took it               | **nothing**                                     |
| The run's stats           | **nothing** — never left the device             |

## Data model

### `medal_runs` — the stats of a run that reached a podium

```sql
create table medal_runs (
  run_id      uuid primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  mode        text not null check (mode in ('accuracy', 'speed')),
  difficulty  text not null check (difficulty in ('easy', 'hard', 'extreme')),
  score       int  not null,
  hits        int  not null,
  strikes     int  not null,
  max_streak  int  not null,
  -- Sums over the run's hits, the same shape `record_run` already takes them in, so
  -- the detail modal divides them exactly as the game over screen does. Storing the
  -- averages instead would be a second way of computing one number.
  acc_sum     double precision not null,
  spd_sum     double precision not null,
  -- The best any single hit of the run managed, already a fraction — what sits beside
  -- the average on the game over screen, where the gap between the two is the thing
  -- worth reading.
  best_acc    double precision not null,
  best_spd    double precision not null,
  elapsed_ms  bigint not null,
  -- The moment the run ended, not the moment it was sent. A run played on a flight
  -- keeps the evening it was played, the rule `score-submission.ts` already follows.
  ended_at    timestamptz not null
);

-- How a holding finds its run: by the score it stands on. See "Linking a holding to
-- its run" below for why this is a join and not a foreign key.
create index medal_runs_standing_idx
  on medal_runs (user_id, mode, difficulty, score, ended_at);
```

`run_id` as the primary key is what makes the write exactly-once, the same job it does
in `run_receipts` — a response lost on the way back to a device that then retries must
not write the run twice.

### `medal_holdings` — one stretch of standing on one podium place

```sql
create table medal_holdings (
  id          bigserial primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  mode        text not null check (mode in ('accuracy', 'speed')),
  difficulty  text not null check (difficulty in ('easy', 'hard', 'extreme')),
  period      text not null check (period in ('today', 'week', 'ever')),
  rank        smallint not null check (rank between 1 and 3),
  -- What they stand there with, raised in place while the holding continues — the
  -- same rule `board_reigns.score` follows. A better run that does not change the
  -- rank does not start a new holding; the player never stopped standing there.
  score       int not null,
  -- Which window this standing belongs to, as its first day: the day itself for
  -- `today`, the Monday for `week`, null for `ever`. It is what makes yesterday's
  -- gold and today's two different slots rather than one.
  window_day  date,
  took_at     timestamptz not null,
  -- Null while it is still theirs — or while the window it stood in has closed, which
  -- is not written down at all. See "Expiry is arithmetic, not a job".
  lost_at     timestamptz,
  lost_reason text check (lost_reason in ('taken', 'improved')),
  -- Who stands there now. Null unless the reason is `taken`.
  taker_id    uuid references profiles (id) on delete set null,
  -- What was left of the standing: a different metal, or nothing at all. The same
  -- `now` that `MedalLoss` in lib/lost-medals.ts already carries, so a row can read
  -- "taken by NIKA — kept 🥈" rather than only naming what went.
  now_rank    smallint check (now_rank between 1 and 3)
);

create index medal_holdings_user_idx on medal_holdings (user_id, took_at desc);

-- The invariant stated as a constraint, `board_reigns_one_open_idx` generalised to
-- all fifty-four slots: one player stands on one place of one window at a time. A bug
-- that opened a second would otherwise stay invisible until a profile showed two
-- players holding the same silver.
--
-- `nulls not distinct` so the `ever` rows, whose window_day is null, are covered by it
-- too. Postgres 15+; Supabase is well past that.
create unique index medal_holdings_one_open_idx
  on medal_holdings (mode, difficulty, period, window_day, rank)
  nulls not distinct
  where lost_at is null;
```

### Linking a holding to its run

There is no `run_id` on a holding, and there deliberately is not.

The two writes are independent: the client submits the score through `submitScore`
and records the run through a separate RPC, in no guaranteed order, either of them
possibly days late off the offline queue. A foreign key set at reconcile time would
have to be set before the run it points at exists.

More to the point, a holding that a rival's move opened was never won by a run at
all — and it still stands on one. Your silver is your same old score; what changed is
who is above it.

So the link is the score itself: the run is the earliest `medal_runs` row with the
same `(user_id, mode, difficulty, score)`. Earliest because ties go to the earlier
run, the rule every board in the app sorts by. Resolved on read, so it works whichever
write lands first and whether or not a run of the player's own opened the holding.

A holding with no matching run shows a dash where the stats go. That is honest: it
means the standing predates this feature, or was opened by a rival's move on a score
whose run was never recorded.

### Grants and RLS

A holding is public — it is a board standing, and every board standing already is.
Nothing here is client-writable: runs go through `record_medal_run`, holdings through
their trigger, and neither through a table grant.

```sql
grant select on public.medal_runs     to anon, authenticated;
grant select on public.medal_holdings to anon, authenticated;
```

## Keeping the holdings current

### `reconcile_board_medals(p_mode, p_difficulty, p_at)`

Recomputed from the board rather than inferred from the write, the same rule
`reconcile_board_reign` follows and for the same reason: whoever stands on the board
now is who stands on it now, and a function that reads that cannot drift from it.

For each of the three windows, take the top three exactly as `my_medals` does — best
day per player inside the window, `best_score > 0`, nickname not null, ties to the
earlier `updated_at`. Then, for each of the three places:

The open holding for a place is the one with no `lost_at` **in the current window** —
`window_day` matching the day or Monday just computed, or null for `ever`. A today row
left open from yesterday is a different slot and is never a candidate, which is what
lets expiry go unwritten.

- **Same player, same place.** Raise `score` in place if their score went up, and
  leave `took_at` alone. They never stopped standing there.
- **Different player, or nobody.** Close the open holding, then open the new one.

The reason a closed holding carries is decided by where its player ended up on that
same board and window, which the podium just computed already says:

| Where they are now | `lost_reason` | `taker_id`    | `now_rank` |
| ------------------ | ------------- | ------------- | ---------- |
| A better place     | `improved`    | null          | the better rank |
| A worse place      | `taken`       | the new occupant | the worse rank |
| Off the podium     | `taken`       | the new occupant | null       |

Which is the whole of "how did he lose it", and it falls out of a slot diff without a
special case. A and B, gold and silver, B improves past A: the rank-one slot closes
A's gold as `taken` by B with `now_rank` 2 and opens B's gold, while the rank-two slot
closes B's silver as `improved` with `now_rank` 1 and opens A's silver. Two rows open,
two close, and every one of the four says something true.

`p_at` is `new.updated_at` and never `now()` — the moment the run ended, so a record
that waited out a flight keeps the position it was earned in. `greatest(p_at, took_at)`
on the close, because a backdated score must not end a holding before it began.

### Triggers

The same two places `board_reigns` hooks, for the same two reasons:

- `after insert or update on daily_scores` — the write path for every score. On
  `daily_scores` rather than `scores`, because the today and week boards read the
  daily rows and a day that beats nothing all-time never reaches `scores` at all.
- `after update of nickname on profiles` when it goes from null to non-null — a
  player with scores and no nickname is on no board, and naming themselves puts them
  on all of them without a score being written.

### Windows, and the seam in them

The boards are bounded by the Prague clock, which the client computes and passes to
`my_medals` and `player_profile`. A trigger has no client, so `reconcile_board_medals`
computes the same bounds itself with `(now() at time zone 'Europe/Prague')::date` —
exact, and agreeing with what the client sends.

Known and pre-existing: `daily_scores.day` defaults to `current_date`, which is UTC,
so for up to two hours a day a score is filed under a day the app would call a
different one. This design neither fixes that nor makes it worse — it reads the
windows the same way every existing read does. Worth its own change; out of scope here.

## Expiry is arithmetic, not a job

A today holding ends when the day does; a week holding when the week does. Both
instants are fully determined the moment the holding opens, by `period` and
`window_day`. So neither is written down.

`lost_at` and `lost_reason` are stored only for `taken` and `improved` — the two ends
that are events someone has to notice. Expiry is derived on read:

```
window_end = window_day + 1 day   (today)      at Prague midnight
           = window_day + 7 days  (week)       at Prague midnight
           = null                 (ever)
effective lost_at = least(lost_at, window_end)
```

and the reason is whichever of the two is the earlier. A gold a rival took at 14:00
closes at 14:00; one nobody touched reads as expired at midnight.

A sweep that wrote expiry down would copy a fact the row already implies into a
second column for it to disagree with, and would need to run against fifty-four slots
on a schedule to keep a derived value current. The partial unique index does not need
it either: yesterday's still-open today row carries a different `window_day`, so it is
a different slot and can never collide with today's.

## Retention

The one job this feature does need, because it reclaims disk rather than copying
arithmetic. Same shape as `cleanup_run_receipts`, same schedule slot, no client grant.

The today window is the cost driver: eighteen places re-filled every single day
whether or not anyone contests them, and at scale that is roughly seventy per cent of
the rows. It is also the window whose past matters least — `HISTORY_DAYS = 7` in
`medal-history.ts` is the app already conceding that.

```sql
create or replace function cleanup_medal_history() returns void ... as $$
  -- Day boards, past ninety days. Week and ever are kept for good: those are the
  -- claims a career is made of, and there are few enough of them to keep.
  delete from medal_holdings
  where period = 'today' and took_at < now() - interval '90 days';

  -- And a ceiling per player, oldest first, so one player cannot fill the disk. Two
  -- hundred is far past what SHOW MORE will ever page to.
  --
  -- Day rows only, which is the whole point of the cap: a player with two hundred
  -- golds from two hundred evenings must not have their all-time silver deleted for
  -- being the two-hundred-and-first row. Week and ever are never pruned by count.
  delete from medal_holdings h using (
    select id, row_number() over (partition by user_id order by took_at desc) as n
    from medal_holdings where period = 'today'
  ) ranked
  where h.id = ranked.id and ranked.n > 200;

  -- Then the runs nothing stands on any more.
  delete from medal_runs r
  where r.ended_at < now() - interval '90 days'
    and not exists (
      select 1 from medal_holdings h
      where h.user_id = r.user_id and h.mode = r.mode
        and h.difficulty = r.difficulty and h.score = r.score
    );
$$;
```

Holdings first, orphaned runs second — a run is only garbage once nothing stands on
it. Estimated steady state with this in place: tens of megabytes even at thousands of
daily players, against the free tier's 500 MB ceiling.

`daily_scores` remains unbounded and untouched here. It is the larger number and it
already exists; flagged, not fixed.

## Writing a run

### `record_medal_run`

```sql
record_medal_run(
  p_run_id uuid, p_mode text, p_difficulty text,
  p_score int, p_hits int, p_strikes int, p_max_streak int,
  p_acc_sum double precision, p_spd_sum double precision,
  p_best_acc double precision, p_best_spd double precision,
  p_elapsed_ms bigint, p_ended_at timestamptz
) returns void
```

`security definer`, `auth.uid()` for the user, and the same validation bounds
`record_run` already enforces, for the same reason: a broken or hostile client cannot
be stopped from lying about one run, but it can be stopped from writing a number that
makes a screen meaningless. Negatives rejected; `hits > 5000`, `score > 1000000`,
`elapsed_ms > 86400000` rejected; each factor sum bounded by twice the hit count;
`best_acc` and `best_spd` bounded by 2. `p_ended_at` clamped into
`[now() - 30 days, now() + 1 hour]`, since a run stamped by the device's own clock is
the one number here the server has no other source for.

`insert … on conflict (run_id) do nothing`: a replay is a retry whose response was
lost, and the honest answer to it is to do nothing and report success.

Not folded into `record_run`. That one writes counters keyed on a receipt and is
called for every run; this one writes a row that only a podium run earns, and pairing
them would either count non-medal runs' stats or stop counting non-medal runs at all.

### Which runs are recorded

The ones that reach a podium on any window at game over. `app/(tabs)/index.tsx`
already computes exactly this and latches it as `runPodium`, from
`currentBoardMedals(board, score, userId)` — the same function the game-over badges
draw from, so a run whose medal is on screen is a run that gets recorded.

### Offline

Mirrors `lib/run-totals.ts` and `lib/run-submission.ts` exactly — a new
`lib/medal-runs.ts` and `lib/medal-run-submission.ts`, remembered on the device
first and sent second, so a run survives a crash between the two and a device with no
account yet keeps it until there is one. Same bounds: 200 runs, 30 days, newest first
past the count. Same single-drain flag, same flush on reconnection, same rule that an
offline send keeps the entry and a refusal drops it.

The holding it earns is opened by the score's own write, not this one, so a late run
attaches its stats to a holding that has been on the board for days. Which is right:
the run's stats and the standing are two different facts about the same evening.

## Reading

### `player_medals(p_user_id uuid, p_limit int, p_offset int) returns json`

```
{ total: 47, rows: [ {
    mode, difficulty, period, rank, score, tookAt,
    lostAt,                       -- effective: least(stored, window end)
    lostReason,                   -- 'taken' | 'improved' | 'expired' | null
    taker: { userId, nickname } | null,
    nowRank,
    stats: { hits, strikes, maxStreak, accSum, spdSum,
             bestAcc, bestSpd, elapsedMs } | null
  } ] }
```

Newest first by `took_at`. `total` is what SHOW MORE counts against — without it the
button cannot know it is on the last page. `p_limit` clamped to 50 server-side.

Separate from `player_profile` rather than another key in it, because it is paged and
that one is not: a profile is one read of a fixed size, and folding a cursor into it
would make every profile open carry a page of medals nobody has scrolled to yet.

## The modal

A new section at the bottom of `player-profile-overlay.tsx`, inside the existing
`ScrollView` and above the `COMPARE WITH ME` / `CLOSE` buttons — which stay outside
the scroll, where they already are, so a long medal list never pushes the way out off
the screen.

Heading `MEDALS ACHIEVED`, in the same `text-[9px] font-black tracking-[2px] text-dim`
the `RECORDS HELD, EVER` heading above it uses. Omitted entirely when the list is
empty, the same rule the reigns block follows: a heading over nothing reads as
something the player lost.

Two lines per row:

```
🥇 ACCURACY EXT  ALL   12 400   14 Mar
   held 9 days · taken by NIKA — kept 🥈
```

The first line is the medal, the board, the window code from `PERIOD_CODES`, the
score and the day — the mode in its own accent from `MODE_GRADIENT`, as
`BoardLabel` in `medals-overlay.tsx` already draws it. The second is the answer to
how long and how it went:

| End        | Second line                            |
| ---------- | -------------------------------------- |
| still held | `held 9 days · still holding`          |
| `taken`    | `held 9 days · taken by NIKA — kept 🥈` |
| `taken`, off the podium | `held 9 days · taken by NIKA` |
| `improved` | `held 2 days · you took 🥇`            |
| `expired`  | `held 6 h · the day ended`             |

A still-held row is the one thing on this list that is also current, and it is drawn
at full strength; everything else is drained to `GRAYSCALE`, the same way
`medals-overlay.tsx` tells a medal that is gone from one that is not. The taker's name
goes through `TakerName`, so it opens their profile like every other name in the app.

`SHOW MORE` under the list, appending the next page, hidden once `rows.length` reaches
`total`. Page size 10.

Tapping a row opens `MedalRunOverlay` over the profile — a `ModalCard` with the medal
and board at the top, then `RunStats` unmodified, so a medal's stats and a game over's
are drawn by one component and can never drift. A row whose run was never recorded
draws the board and the dates and says so, rather than a grid of zeroes.

## Testing

Vitest, on the pure functions, as the rest of `lib/` is:

- `lib/achieved-medals.ts` — window end for each period across a DST boundary;
  effective `lost_at` when a stored close and a window end race; the reason each
  combination resolves to; shaping and narrowing the RPC's json, with unknown modes,
  periods and ranks dropped rather than defaulted.
- Held-duration formatting, including a holding that ended in the same minute it began.
- Page accumulation: SHOW MORE appends without duplicating, and stops at `total`.

The reconcile itself is SQL and there is no pgTAP in this repo. It gets a scenario in
`supabase/seed.sql` covering the four-row case above — two players trading gold and
silver — verified against a local `supabase db reset`, which is how `board_reigns`
shipped.

## Out of scope

- **Backfilling history.** Holdings can be opened for everyone standing on a podium at
  migration time, dated from `updated_at`; medals already lost are gone and were never
  written down. Not done here — flagged, and a one-statement migration if wanted later,
  the way `board_reigns` seeded its open reigns.
- **The UTC/Prague day seam** in `daily_scores.day`. Pre-existing, worth its own change.
- **Pruning `daily_scores`.** The larger unbounded table, and older than this feature.
- **The How to Play guide.** Nothing here touches controls, targets, timers, modes,
  difficulty, scoring, streaks or lives — no gameplay changed, so the guide stays as
  it is. Checked per CLAUDE.md, deliberately not updated.

## Rollout

One migration for the tables, the reconcile, the triggers, the two RPCs and the
cleanup job. Client in one pass behind no flag: the list is empty for everyone on day
one and fills as medals are won, which is the honest state of it.

An older build talking to the new server writes no medal runs and is unaffected; a new
build talking to an older server gets a missing-function error from
`player_medals`, which the section reads as "no medals" and draws nothing — the same
shape `winnings?` and `achievements?` already use on `PlayerProfileResponse`.
