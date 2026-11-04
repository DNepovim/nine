# Session announcements

Slug: session-announcements
Stage: review
Next: /ship session-announcements
Track: full
Branch: feat/session-announcements
Started: 2026-11-03

## Problem

A challenge run plays in total silence. Challenges force `board: false`
(`noBoard` in `modes/challenges/define.ts`), so the announcement bar has no targets.
A player who passes their own best on the session board, takes first place on it, or
loses first place to someone else mid-run gets no word of it until game over, or never.
And the session board doesn't move under a live run: it is read once, then again on pause.

## Appetite

A day or two (decided by the user). Three new lines on the bar, compared by the
session's **measure**, plus one migration. If it grows, it shrinks; the appetite holds.

## Shape

- **Player starts a challenge run.** The bar freezes the run's targets from the
  **session board** (`useSessionBoard`): the player's own row there, and the leader's row.
  These are `SessionFigures`, not bare scores.
- **A hit lands.** The run's figures (`runFigures`: score, hits, timeMs) are checked
  with `runBeats(measure, …)` from `lib/session-order.ts`, the same rule the standings
  and the medal use:
  - past the player's own row → **beat your best** (a session-scoped one, not `record`);
  - past the leader's row, when the leader is someone else → **took first place**. That
    outranks the line above, the way `ever` outranks `record`. Like a board record, it
    posts the session score mid-run (`submitSessionScore`), so rivals' bars hear now.
  - an empty session board is opened by the first scoring run, the same shape as
    `todayFirst`. Whether that is a fourth line or folded into "took first" is spec's call.
- **Another player posts.** `session_scores` joins the realtime publication. The one
  live channel (`lib/board-live.ts`) watches it too and the session board re-reads. A
  diff of the leader before and after (the `rivalChange` pattern, by measure) says
  **someone took your first place** when the leader was the player. It names the rival
  and plays the implosion, like `*Lost`. A leader change when the player was not first
  says nothing (see Out).
- **On a time session, only the steal fires.** A race gets its time only on
  finishing, and finishing ends the run, so own lines can never land mid-run there. The
  game-over medal already places the run by its clock (decided by the user).
- **Hits sessions** work like score: hits only climb within a run.

Areas:

- **The announcement lib** (`lib/announcements.ts`, `lib/announcement-run.ts`): new
  ids, their message pools, a session-shaped target and a `runBeats`-based crossing.
- **The hooks** (`use-announcements`, a session sibling of `use-rival-records`): fed
  from the session board when `runSession !== null`, from the board otherwise.
- **The game screen** (`app/(tabs)/index.tsx`): the wiring, plus the mid-run session publish.
- **Effects and style** (`announcement-effect.tsx`, `lib/announcement-style.ts`): an
  entry per new id. The value maps already make that a compile error to forget.
- **Realtime** (`lib/board-live.ts`, `lib/board-events.ts`): one more table, and
  attributing a row to a session.
- **Schema**: one migration that adds `session_scores` to `supabase_realtime`, with
  replica identity full. The user pushes it to prod (see memory: migrations aren't applied by CI).
- **Copy**: new lines follow the bar, plain English for now (the user's call at spec; see the gate below). Originally: extracted and translated into Czech. They have to fit
  `MAX_MESSAGE_LENGTH` (40) with a name in them.
- **Mode or engine?** Neither branches on a name. The bar asks `runSession` and
  `rules.scoring.measure`, both already on the screen.

## In / Out / Rabbit holes

**In**

- Beat your best on the session (score and hits measures).
- Took first place on the session (score and hits measures), posting mid-run.
- Someone took your first place (all three measures), named, live via Realtime.
- Message pools in English, as the bar's are, plus an effect and a style per id.

**Out**

- Own lines on time sessions, and any "ahead of pace" prediction.
- "{name} now leads" when the player was never first (the `*Raised` analogue).
  It's tempting, but it is noise on a busy session.
- Second/third-place lines (podium places mid-run).
- Anything on the game-over sequence or the summary.
- A feature flag. None was asked for, so this ships to whoever reaches a challenge.
- Board announcements on a challenge run: `board: false` stays as it is.

**Rabbit holes**

- **Time measure in `runBeats`.** An unfinished run has `timeMs: null` and never beats a
  timed one. That is why own lines are off on time sessions. Don't try to bend it.
- **Freezing too early.** The session board is `null` while its first read is in flight.
  The `ready` rule in `stepRun` has to wait for it, or the run goes silent the whole way.
  This is the bug the bar has had before.
- **Stale own row.** `myBest` on the session board lags the mid-run publish by a round
  trip. Reconcile it with the device's held session best (`beats` in
  `lib/local-scores.ts`), the way `personalBar` does, or the next run is told again.
- **Realtime attribution.** `boardOf` names a `BoardRef` (mode × difficulty). A session row
  needs its own branch, or the session board re-reads on every board write. Keep the
  listener narrow.
- **Rival throttle.** Reuse the 15 s window. A busy session must not hold the bar.
- **The migration** is a production write the user makes. Until it lands, the steal
  stays silent rather than failing, and the rest still works.

## Contract

### Domain words

**Used:** **session**, **session board** (never just "board"), **measure**, **run**,
**place**, **record** (a moment announced and then gone, which is what these lines are).
**challenge** here means the mode on the app, not `Challenge` in `lib/next-challenge.ts`.

**Introduced:** none as a domain term. Three announcement ids:

- `sessionBest`: the run passed the player's own row on this session board, by its
  measure. The session counterpart of `record`.
- `sessionFirst`: the run went ahead of everyone else on this session board, or opened an
  empty one. The session counterpart of `ever`/`todayFirst`, folded into one id: a
  session has one set of standings, so "took the lead" and "opened it" are the same claim.
  (Decided at spec, folding the shape's open question.)
- `sessionLost`: another player went ahead of the player while the player led the
  session. The `*Lost` suffix is deliberate. It joins the rival set, which is defined by
  that suffix, and keeps the meaning "it was yours". Contrast `sessionTaken`, where it
  never was.

`docs/domain.md` gains no row. The ids are listed in the `lib/announcements.ts` header
comment, the same as the other lines.

**Collisions:** `sessionLost` / `sessionTaken` / `sessionWon`. The last two are about a
session that has _closed_, told during another run. The new three are about the
session being played _now_. The comment block in `ANNOUNCEMENT_MESSAGES` says which is which.

### Files

| Path                                                                                           | C/M | Responsibility                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| `lib/session-announcements.ts`                                                                 | C   | Pure: `SessionTargets`, `crossedSession`, `sessionRivalChange`, the reconcile of own row vs. device-held best                 |
| `lib/session-announcements.test.ts`                                                            | C   | Its cases                                                                                                                     |
| `hooks/use-session-rival.ts`                                                                   | C   | `useRivalRecords`' sibling for the session board's leader; same throttle and reset rules                                      |
| `supabase/migrations/20261103020000_session_scores_realtime.sql`                               | C   | `session_scores` into `supabase_realtime`, `replica identity full`                                                            |
| `lib/announcements.ts`                                                                         | M   | Three ids, their pools, header comment                                                                                        |
| `lib/announcement-run.ts`                                                                      | M   | Phase freezes either board targets or session targets. Same four rules, one `stepRun`                                         |
| `hooks/use-announcements.ts`                                                                   | M   | Takes the session targets and run figures when the run is a session run                                                       |
| `lib/board-live.ts`                                                                            | M   | Third `.on` for `session_scores`, plus `subscribeSessions(listener: (sessionId: string \| null) => void)` on the same channel |
| `hooks/use-session-card.ts`                                                                    | M   | `useSessionBoard` refreshes on a `subscribeSessions` event for its own id (or null)                                           |
| `app/(tabs)/index.tsx`                                                                         | M   | Wiring: session targets in, board targets neutralised on a session run, `rival = sessionRival ?? boardRival`                  |
| `lib/announcement-style.ts`, `components/game/announcement-effect.tsx`, `lib/record-medals.ts` | M   | One entry each per new id                                                                                                     |
| `lib/announcements.test.ts`, `lib/announcement-run.test.ts`, `lib/announcement-style.test.ts`  | M   | Extended (rival count 6 → 7, etc.)                                                                                            |

### Data and types

```ts
// lib/session-announcements.ts — shapes only
type SessionLeader = SessionFigures & { userId: string; nickname: string | null }
type SessionTargets = {
  measure: Measure
  mine: SessionFigures | null // own row, reconciled with the device's held entry
  leader: SessionLeader | null // row 1 of the session board
  empty: boolean // known to hold no row (read came back, zero rows)
}
```

- **Own lines are measured by `runBeats(measure, run, held)`** and by nothing else. A
  second copy of the ordering is the bug `lib/session-order.ts` exists to prevent.
- **`measure === 'time'` → `crossedSession` returns `[]`** (decided by the user).
- **Opening needs a figure.** An empty session board opens on `score > 0` for `score` and
  `hits > 0` for `hits`.
- **Ranking:** `sessionFirst` before `sessionBest`, and both are marked fired on the hit
  that crosses them, as `evaluate` already does.
- **Publish:** `sessionFirst` counts as a board record for `publish`, so the existing
  `onBoardRecord` posts the run mid-run (it already passes `runSession`). `sessionBest`
  doesn't publish.
- **On a session run the board targets are neutral**: `record: 0`, periods `null`, empties
  `false`. The challenge mode's own leaderboard is empty and would otherwise announce
  `todayFirst`. `ready` = session board non-null && online.
- **Realtime:** `subscribeSessions` hears the row's `session_id` (narrowed to a string,
  else null). A reconnect or foreground calls every session listener with null, as boards do.
- **Schema:** one migration and no shipped rows change. `session_scores` listens on its
  **own channel**, because Realtime rejects a channel's bindings as a whole when one table
  is outside the publication: on a shared channel, no board event arrives either (measured
  locally in review). So the code runs against the old schema: no session events arrive,
  `sessionLost` stays silent, the boards stay live and the pause re-read still works. The
  push can follow the app. The user does it (production write).
- **Storage:** none new. The device-held best is read from the existing local-scores
  store by `sessionId`.

### Gates

| Gate            | Answer                                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Nine lines in three pools (below). Every announcement pool is a plain English string array today. None of the bar is in Lingui or Czech, so the new lines follow it. Moving the bar to Lingui is Out (decided by the user at spec). |
| **How to Play** | No. Announcements are not controls, targets, timers, scoring, streaks or lives.                                                                                                                                                     |
| **Flag**        | None.                                                                                                                                                                                                                               |
| **Buttons**     | None.                                                                                                                                                                                                                               |

Pools. Each fits 40 characters with a 10-character name:

- `sessionBest`: "Your best on this challenge", "A better you, on the challenge", "You beat your best"
- `sessionFirst`: "You lead the challenge", "Top of the challenge", "Nobody is ahead of you"
- `sessionLost`: "{name} took the lead from you", "{name} passed you", "Challenge: {name} leads now"

Style and effect: `sessionBest` uses `game` + confetti, like `record`. `sessionFirst` uses
`gold` + fireworks, because the lead is held now and can be lost before the window shuts.
That is what gold means. `sessionLost` uses `gray` + implosion, like `*Lost`. Medal period:
all three `null`.

## Acceptance criteria

1. `crossedSession` on a `score` session returns `['sessionFirst', 'sessionBest']` for a
   run past both the leader (someone else) and the player's own row, `['sessionBest']`
   when it's past only its own row, and `[]` on an equal figure.
2. On a `hits` session, a run with more hits but a lower score than the leader crosses
   `sessionFirst`. With equal hits, the score decides (`runBeats`).
3. On a `time` session, `crossedSession` returns `[]` for every input.
4. An empty session board (`empty: true`, no leader) gives `sessionFirst` once the run's
   measure figure is above zero, and nothing at zero. A failed read (`empty: false`, no
   leader) gives nothing.
5. When the player is already the leader, `crossedSession` never returns `sessionFirst`.
6. The own row is the better of the session board's row and the device's held entry, by
   `runBeats`. A device best above a stale board row is not announced as beaten.
7. `sessionRivalChange` returns `{ id: 'sessionLost', name }` when the leader changes
   from the player to someone else, and null when the player wasn't the leader, when
   the new leader is the player, or with no baseline.
8. In a challenge run, no board line (`record`, `today`, `week`, `ever`, `*First`,
   `*Raised`, `*Lost` other than `sessionLost`) is announced.
9. In a challenge run, crossing `sessionFirst` posts the session score before game over:
   the session board read from a second device shows the run mid-run.
10. With the migration applied locally, a second player passing the first while the first
    is mid-run puts "{NAME} …" on the first player's bar within a few seconds, in gray,
    with the implosion. At most once per 15 s.
11. An ordinary (non-challenge) run announces exactly as before. The existing
    `announcements`, `announcement-run` and `rival-records` tests pass unchanged except
    for counts that grew.
12. `pnpm check` is green.
13. With `session_scores` outside the publication, a `scores` write still reaches the
    boards' channel, and the session channel's failure stays on that channel.
14. A rival passing the player's **posted** row while the live run is still ahead of the
    rival announces nothing. If the rival later beats the live run, `sessionLost` fires
    then, once.
15. `sessionFirst` needs the player's own row not already past the leader: a device best
    above a stale leader isn't a new lead, and passing it is only `sessionBest`, and a session reading empty with a device best isn't
    opened again.
16. A session board whose read failed freezes nothing (`sessionTargetsFor` gives null); the
    next good read freezes and catches up on the score already reached.
17. A burst of `session_scores` events for the session causes one re-read per coalesce
    window, not one per event.
18. RESTART on a session run (no pass through idle) drops the frozen session targets and
    the fired list, so the new run can announce and post again. The abandoned run counts as the
    player's own row from that moment, so nothing below it reads as a new best. An
    ordinary run's restart behaves as before.

## Tests

- `lib/session-announcements.test.ts`: AC 1–7, one `describe` per measure, plus the
  reconcile.
- `lib/announcement-run.test.ts`: session targets freeze on the same rules. Nothing freezes
  while the session board is null. A late board catches up on the score already reached.
  `sessionFirst` publishes and `sessionBest` doesn't.
- `lib/announcements.test.ts`: the rival set is now 7 and every one has `{name}`. The new
  own pools have no `{name}`. The length check covers them automatically.
- `lib/announcement-style.test.ts`: `sessionLost` is grey like the other `*Lost` lines.

## Review focus

- **Task 4/6**: the board targets must be neutralised on a session run, not just left
  unready. Otherwise `record` (stats-based) or `todayFirst` fires off the challenge mode's
  empty leaderboard.
- **Task 3**: `sessionRivalChange` must compare leaders by `user_id` changing, not by
  figure. A leader improving their own time is not a steal.
- **Task 5**: `useSessionBoard` refreshing on every `session_scores` event of _other_
  sessions. The listener must filter by id (null passes).
- **Task 6**: `runFigures` is a fresh object every render. The step effect in
  `use-announcements` must key on its fields, not its identity.
- **Task 4**: the device-held session entry is keyed by `sessionId`. Reading it by mode ×
  difficulty would pick up the board slot.
