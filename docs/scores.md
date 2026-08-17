# Scores

How a score is recorded, published, read back and announced. This is the contract; the
code implements it, and a change to one should be a change to both.

## The two local stores

| Store                         | Holds                                                                                            | Lives in                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Scores** — `nine.scores.v1` | Every run the device remembers, one per board × day, each `pending` \| `published` \| `rejected` | AsyncStorage, `lib/local-scores.ts`        |
| **Stats** — `nine.stats.v4`   | The all-time best per board, with no date on it                                                  | AsyncStorage, mirrored in the game machine |

And the server: `daily_scores` (one row per player × board × day) and `scores` (the
all-time best, one row per player × board), read through the `leaderboard`, `my_rank`
and `my_medals` RPCs.

Only `daily_scores` is written. `scores` is a rollup of it, maintained by the
`daily_scores_roll_up` trigger — the all-time best is the best day a player ever had, so
it was never a second fact, and writing both from the client was two chances to fail at
one of them.

The scores store is what makes "what did I score today?" answerable offline — stats has
no date on it, so before the store existed the only way to ask was to ask the board, and
the board does not know. **The publish queue is not a separate thing:** it is the entries
whose status is `pending`. They were once two stores holding the same runs under the same
key with the same keep-max rule, which meant every run was written twice.

`pruneLocalScores` bounds it: everything from the last 14 days, plus the single best
entry per board of all time. That last part is what still has something to say to the
all-time board long after its day has passed. Without a prune, a player who played daily
without ever setting a nickname accumulated an entry per board per day forever, and the
first flush then sent them one at a time.

**Retiring a key** invalidates what it held. `constants/storage.ts` carries `RETIRED_KEYS`
and `lib/retired-storage.ts` clears them once on boot. `nine.stats.v3` and
`nine.pending-scores.v1` are on that list: the scoring mechanics changed, so a best set
under the old rules is not comparable to one set under the new ones — and retiring the
queue is what stops an old-mechanics score republishing itself onto the boards on the next
reconnection. Note this does **not** touch the server, which still holds every historical
score.

## Source of truth

| Question                         | Authority                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Who leads a board, in any period | **The server.** Never a local value.                                                                                                                                     |
| What _I_ scored, in any period   | **`max(server, scores store)`.** The server row is authoritative once it exists; the device covers what has not reached it — offline, no nickname, or a write in flight. |
| My all-time personal best        | **The device** (stats). The `YOU` cell of the in-game strip and the "personal best" game over title. **Nothing else** — see below.                                       |
| What day it is                   | **`lib/leaderboard-period.ts`.** Europe/Prague for every player, one definition, used both for stamping a score and for bounding a board.                                |

A local score is a **claim**, never a board row. It shows as the player's own row with a
`NOT PUBLISHED` / `NOT SYNCED` mark, and it never appears under another nickname or
displaces another player.

The rule that follows from this, and the one worth remembering: **a period's numbers are
only ever compared within that period.** An all-time best is not a today score. Folding
one into the TODAY tab is what made the intro board disagree with every other screen.

**Stats never reaches a board.** It is an all-time number with no date and no matching
entry in the scores store, so it can never publish — putting it on a board would mark a
score as waiting to sync that nothing will ever send, permanently so after an identity
reset. It also climbs _during_ a run, which put the score in progress on the all-time
board. The scores store keeps its own best per board of all time, and that one is a real
record with a real day behind it.

## The board store

`hooks/use-board.ts` is the only place any of this is fetched. It is held once, in
`app/(tabs)/index.tsx`, and handed to the rest of the tree through `BoardProvider`. The
intro, the pause screen, the game over screen and the strip above the dial all read it,
so there is no second copy to drift.

Per period it exposes:

- `rows`, `myRank`, `loading`, `error` — what the server said.
- `record` — the score at the top, or `null` when the board is empty **or** unreadable.
  An unknown record cannot be beaten, so the two share a value on purpose.
- `empty` — `true` only when the request came back and brought nothing. A board we
  failed to read is never empty.
- `myBest` — the player's best here, server and scores store together, whatever the
  status. It answers "what is my best".
- `unpublished` — only what is still `pending` and still ahead of the server, or `null`
  when they agree. It answers "what is not on the board yet", and this, and only this,
  earns the unpublished mark on a row. A `rejected` score counts towards `myBest` and not
  towards this: it happened, but saying it is on its way would be a promise the app
  cannot keep.

These are derived on every render, not patched into fetched state, so a run reaches the
boards the instant it is recorded and there is nothing to invalidate. The whole `Board`
is memoised, because the game screen it is built in re-renders on every hit.

### One live connection

`lib/board-live.ts` owns a single Realtime subscription for the whole app. It covers
**every** board rather than the one being played, it is opened on first use and never
torn down, and everything that shows a score reads from it — the leaderboards, the strip
above the dial, the medal line on the intro.

It tells each listener _which_ board moved, so each decides whether it cares. `useBoard`
refetches only for the active board. `useMyMedals` refetches for any board the player
actually stands on — the ones the last `my_medals` response named, plus any the device
holds a score on, which covers a first-ever score on a new board; a medal is a standing
across all six, so watching only the board being played would miss a rival taking a gold
elsewhere, while watching _every_ board fired the whole request for every score anyone
posted anywhere. `null` means the move cannot be attributed and everything is stale.

Two things announce `null` rather than a board:

- **a re-subscription**, which closes a gap we cannot see into. Realtime replays nothing,
  so anything may have happened while the socket was down;
- **returning to the foreground**, for the same reason — a sleeping phone hears nothing.

Bursts are coalesced before refetching (300 ms for a board, 800 ms for the medal line):
one submitted score still arrives as two events, the row written to `daily_scores` and
the rollup the trigger writes to `scores` behind it.

Realtime is a nudge, never data. The payload is used only to name the board; the refetch
it triggers is what says what that board holds.

### Invalidation

The store refetches on: mount, board change, `userId` change, any live event touching
that board, the end of a run, and the next Prague midnight.

A **successful** fetch always replaces the rows, empty result included — that is what
lets a board clear when the day rolls over. Stale rows are kept only when the fetch
**errored**: the player cannot tell a board that failed to load from one that emptied,
so blanking it would be the worse lie.

## Announcements and medals

**All of the deciding is pure**, in `lib/announcement-run.ts`. `stepRun(phase, input)`
owns when to freeze the targets, what a score has crossed and what is worth publishing;
`useAnnouncements` only turns those answers into a bar, a timer and a submission. Every
bug this bar has ever had was a question of _when_ a value was read rather than of what
the comparison said, and timing written as effects is timing nobody can test. Its four
rules, in order:

- not in a run → back to idle, ready for the next one;
- not ready → freeze nothing. Freezing the nulls a loading board reports is what made a
  run begun on a cold start go the whole way in silence;
- ready, not started → freeze now, then measure the score **already reached**, so a late
  arrival catches up instead of missing what it missed;
- started → ignore the incoming targets entirely, so a rival raising the bar mid-run does
  not quietly raise the one being chased.

Targets are therefore frozen once per run, and only once the board store reports
`loaded`. For each period:

- the bar to beat is `max(board record, my own best there)` — `barFor`;
- the period is open to be claimed only when the board is empty **and** the player has
  nothing of their own there — `isOpenable`.

Both live in `lib/announcements.ts`. The player's own best has to count on both counts:
the board lists nobody without a nickname and lags every write by a round trip, so a
player routinely holds a score the board has never heard of.

Then the two claims, which are not the same claim:

- **The announcement** — "you took the day" — is frozen for the run. It was true when it
  was said, and a rival raising the bar afterwards does not retract it.
- **The medal** on the game over screen — "you hold the day" — is checked against the
  boards as they stand when the run ends (`heldPeriods`). A rival who went past you
  mid-run takes the medal with them.

## Sync

- Every run is recorded to the scores store as it is submitted, whatever the network did
  — remembering is not conditional on publishing, and the next run has to know about this
  one either way. A run that beats nothing the store already holds is not recorded, and
  is therefore not published either: the better score is already there or already on its
  way.
- A score is publishable once there is a `userId` **and** a `nickname`. Until then it
  stays `pending`, which is what puts it in the queue and marks it on the board.
- `flushPendingScores` drains `pendingOf(store)` when a nickname first appears and on
  every reconnection: mutex-guarded, serial, marking each success `published`. The
  server's no-downgrade trigger makes every write idempotent, so a retry can never lower
  a score.
- **A refusal is not a disconnection.** `isNetworkFailure` tells them apart. Offline
  leaves the entry `pending` and uncounted — the connection coming back is exactly what
  makes it worth trying again. Any other refusal counts against the entry, and after
  `MAX_PUBLISH_ATTEMPTS` it becomes `rejected`: it stops being retried, and stops
  claiming on the board to be waiting to sync. Without this an entry the server would
  never accept sat in the queue forever, and its `NOT SYNCED` mark never cleared.
- Retries run every 30 s **only while offline**, plus on `AppState → active`. Online and
  still failing means the server refused, not that the line is down, so retrying on a
  timer would only repeat the refusal.
- `updated_at` is the moment the run ended, not the moment it synced — the board breaks
  ties by it, so a record flushed after a flight keeps the place it was earned in.

## Known warts

- `my_rank` returns the **all-time** hit count even for a today or week query
  (`supabase/migrations/20260722000000_init.sql`). Needs a migration.
- A rank below the top five is a lower bound: only five rows are fetched, so a local
  score that beats the server's stored best cannot be placed exactly.
- Clearing app storage means a new anonymous user id and an orphaned board history.
- The server still holds every score set under the older scoring mechanics; only the
  device was invalidated. Until the boards are reset those numbers sit at the top of
  TODAY, THIS WEEK and EVER alongside scores that are not comparable to them.
- `lib/board-live.ts` subscribes to `postgres_changes` with no filter. Fine at this size;
  the scaling path is a trigger calling `realtime.broadcast_changes()` instead.
