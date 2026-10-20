# The same nine, every run

Slug: muscle-memory
Stage: build
Next: /verify muscle-memory
Track: full
Branch: feat/muscle-memory
Started: 2026-10-19

## Problem

Every run of a challenge deals different targets. There is nothing a player can learn by
heart, nothing to get _better at_ in the sense of getting faster at a thing already known
— only the general skill of dialling, met against a fresh roll each time. A challenge is
on the app for a day, which is exactly long enough to learn something small and exactly
too short to learn something general.

And a session board can only ever rank by score. `session_scores` holds `best_score` and
`hits`, the read orders on the first of them, and the places settle on that order. So a
challenge whose point is _how fast you got through it_ has nothing to be won by: the
contest would be decided by the one figure the challenge is not about.

Two halves, and they stay two halves through the whole of this document. The first is one
challenge. The second is the mechanism the next five will want.

## Appetite

**A week.** Two new rules fields, a new shot, a column on a shipped table, the RPC that
writes it and the read that orders by it, a fourth column in the row component every board
in the app shares, and a new section in the `challenge` skill. New domain words and a
schema change are each a week's trigger on their own.

## Shape

### What the player meets

An admin plans a session of HABIT on the CHALLENGES screen. **Nothing new on that
form** — it is an ordinary booking. The row gets a uuid like every session row, and that
uuid _is_ the seed: the nine targets are derived from it. A second session of the same
challenge is a different nine, which is the right answer rather than a compromise — a
rerun is a new contest, and the first one's standings go on meaning what they meant.

The window opens and the card appears on the intro like any other. The player presses it
and the dialog opens: the description, the STRIKE box saying what builds the multiplier
here, and the standings — which now carry a **TIME** column and are ordered by it.

START. The first target appears; then one more every 500ms until nine stand on the board.
**None of them carries a ring.** Nothing expires, nothing costs a life, and the hearts come
off the top bar: there is one clock in this run and it is the stopwatch.

The player dials. A hit is scored the standard accuracy way. A target taken in the fewest
possible moves builds the strike, and the beam is drawn **from the last target taken to the
one just taken** — a line through the board in the order the player went, which is the
route being learnt made visible. The first hit of a run has no previous target and fires
from the sum row, as every other shot does.

The ninth target falls and the run ends on the spot. The game-over screen shows the score,
the run stats with the time among them, and a claim from this challenge's own pool.

The time is submitted beside the score. The session board ranks by the time, and the places
— gold, silver, bronze — settle on the time when the window shuts. The score still counts
towards fortune, exactly as every challenge's does.

Next run: the same nine, in the same order. The job is to get faster at a thing now known.

### The two mechanisms

Both are **rules**, not branches on a name. Nothing outside `modes/` learns the word
`muscle-memory`.

**How a run's targets arrive.** Today the spawner rolls `Math.random()` per target, inside
a cadence the rules set. It needs a second answer: _a fixed sequence of N, derived from a
seed the run was started with_. The seed is the session id, which `onStart(modeId,
sessionId)` already carries from the dialog into the run — so no column anywhere. The same
field is what ends the run: a sequence that is spent and a board that is clear is a
finished run, where today only three lost lives end one.

**What a session board ranks by.** Today: `best_score desc, updated_at asc`, in SQL, with
the rank computed there. It needs to be able to rank by the clock instead — a second figure
on the row, a read that orders by whichever the challenge asked for, and a places rule that
follows the same figure. Two values in the union, `score` and `time`, rather than an
open-ended expression: a board that can be ranked by anything is a board nobody can reason
about, and the two the app has words for are the two it should offer.

### Areas

- **`modes/`** — `RunRules` gains the two fields above; `ShotKind` gains the chain beam;
  `modes/challenges/catalog.ts` gains the entry. The streak is `optimal`, inherited rather
  than invented.
- **`hooks/use-target-spawner.ts`** — deals from the seeded sequence where the rules say so,
  and stops when it is spent. It already deals a submode's `script` the same way, which is
  the shape to follow.
- **`machines/game.ts`** — a run that ends on a finished sequence; targets that carry no
  ring and so can never expire.
- **The game screen and the shot layer** — the target-to-target beam, which needs the last
  hit's point remembered rather than looked up; the hearts hidden where no life can be
  spent.
- **Schema** — `session_scores` gains the time; `submit_session_score` takes it; the board
  read orders by the figure it is told; the no-downgrade rule follows that figure too.
- **The board** — `ScoreColumns`, `ScoreRow` and `TabPanel` learn a fourth column and which
  figure each row prints.
- **Copy** — the label, the description, the TIME header, the claims, all into Czech.

Not a flag. The `challenges` feature already gates every surface this touches.

### What is already settled

Decided at shaping and not open questions for `spec`: the dial is `NINE_DIAL` — the one
thing this challenge is about is the sequence, not the keys; the mark is nine dots, drawn
from that dial; the colour is the generated hue for its place in the catalog, no `hue:`
field; the base is `ACCURACY`, since the scoring is standard accuracy; the board shows
**both** SCORE and TIME and ranks by TIME.

## In

- The two rules fields, and the new `ShotKind`.
- The migration: the time on `session_scores`, the RPC argument, the ranking-aware read,
  and a no-downgrade rule that follows the ranking figure.
- The fourth column on the session board.
- The HABIT catalog entry, Czech included.
- A section in the `challenge` skill on **modulations** — how to tell a challenge that is a
  new set of values from one that needs a new mechanism, and what abstracting one costs.

## Out

- **A seed column on `challenge_sessions`.** The row's uuid is the seed. Adding one would
  be a second source of truth for a fact the row already carries.
- **Any change to `scores`, `daily_scores`, medals, reigns, the podium or the recap.** A
  session board is its own table and the whole point of it is that none of those know about
  challenges.
- **Per-player target lists.** Everyone in a session gets the same nine. That is the
  contest.
- **Ranking by anything but score or time.** Two values, not an expression.
- **Showing the nine before the run starts**, and any replay or practice of a closed
  session's nine. Both are good ideas and neither is this week.
- **Renaming anything.** `best_score` stays `best_score` even where the board no longer
  ranks by it.

## Rabbit holes

1. **`prevent_score_downgrade` is shared.** `scores`, `daily_scores` and `session_scores`
   all hang the same trigger function, and it reads `new.best_score < old.best_score`. A
   player who ran _faster but scored less_ would have their better time silently refused.
   **Way round:** a session-scores-only replacement that reads the ranking figure; leave
   the shared function untouched, because editing it is how all three tables get a bug at
   once.

2. **Rank comes out of SQL, and the server has never heard of a mode.** Something has to
   tell the read which figure to order by. **Way round:** the caller passes it, since the
   caller is the only thing holding the rules — the same arrangement `difficulty` already
   has on `session_scores`, which is stored because the server cannot work it out either.
   Cost: two clients could ask for two orderings of one board. Acceptable for a read.

3. **A fourth column at 280pt, in a shared row.** The dialog's board is
   `min(width - 96, 280)`, and `ScoreRow` draws every board in the app. **This is the one
   that could blow the appetite** — if the column cannot be made to fit without a
   conditional that every other board pays for, the fallback is TIME _replacing_ SCORE on a
   time-ranked board, which is a smaller change and a worse answer.

4. **The beam's `from` point.** A shot's geometry is fixed the instant it is fired, and by
   then the previous target has already left the board. Its point has to be remembered
   across hits rather than looked up, and the first hit of a run has no previous point at
   all. **Way round:** fall back to the sum row for the first; keep the remembered point on
   the screen that already measures the board.

5. **Determinism is a promise to a live window.** If the uuid-to-nine derivation ever
   changes — a different hash, a different walk, a reordering — every open session's targets
   change under the players already learning them, and the standings behind them stop
   meaning anything. **Way round:** pin it with a test carrying a literal uuid and the
   literal nine it must produce, and say in the comment that the test is the contract.

6. **A run that cannot end.** Nothing expires, so a player who walks away leaves a run
   open. The write has a ten-minute grace and the time would simply rank last. Probably
   fine; named here so it is a decision rather than a discovery.

7. **Reachability.** The nine are drawn from `0 … maxSum` on the standard dial, which has a
   weight of 1 and so reaches every number in the range. Nothing to do — recorded because
   the catalog's own test checks it for every challenge and will check it for this one.

---

## Contract

### Domain words

**Used as `CLAUDE.md` already defines them.** A **run** is one game from start to game
over — the thing being timed here is a run, and it is never a session or a round. A
**session** is one planned appearance of this challenge, and the thing the nine are
derived from. A **session board** is its standings. A **target** is a number to be
dialled; the **grid** is a dial position; the **dial** is the keys. A **medal** in the
losable sense is not what a place on a session board is — see the session-board row,
which already records that split.

**Introduced by this work.** Both gain a row in `CLAUDE.md`'s table.

- **drill** — the fixed list of targets a **session** deals: the same values, in the same
  order, in the same places, for every player and every run of that session. Derived from
  the session's own id, so a rerun of the same challenge is a different drill and the
  first airing's standings go on meaning what they meant. A drill is nine **targets** and
  nine **places**; it is not a **lesson**, which is a script of boards with a line of
  teaching over each, and not a **submode**, which is a mode with rules taken off.
  `spawn.drill` on the rules, `lib/drill.ts`, `drillOf`.

- **measure** — the figure a **session board** is ordered by and its places settled on:
  the **score** by default, the **time** where the challenge is a race. One word per
  session, written onto the row when it is booked. Distinct from the **headline**, which
  is which of the two _factors_ a run reports — acc or spd — and from a **factor**
  itself. A board (the mode × difficulty kind) has no measure and never will: it is
  always its score. `scoring.measure`, `challenge_sessions.measure`.

**Collisions.** `measure` appears in prose comments across `lib/` as the ordinary verb
and noun; it is not an identifier anywhere, so the word is free. `drill` appears nowhere
in the app. Neither is near `admin` (the room host vs the role), `Challenge` (the dare vs
the mode) or `session` (challenge vs auth vs the run that is never called one).

### Files

Created:

| Path                                                     | Responsibility                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `lib/drill.ts`                                           | `drillOf(seed, dial, count)` — the seeded values and places. Pure, no React. |
| `lib/drill.test.ts`                                      | Determinism against a literal uuid, and the lattice's guarantees.            |
| `supabase/migrations/20261019000000_session_measure.sql` | The measure, the time, the three RPCs, the session keep-better trigger.      |

Modified:

| Path                                                                                             | What changes                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `modes/types.ts`                                                                                 | `SpawnRules.drill`; `ScoringRules.measure`; `ShotKind` gains `'chain'`.                                                                    |
| `modes/rules.ts`                                                                                 | The two defaults in `BASE_TARGET_RULES`, and their lines in `patchRules`/`resolveRules`.                                                   |
| `modes/registry.ts`                                                                              | `measureOf(id)`, beside `headlineOf`.                                                                                                      |
| `modes/index.ts`                                                                                 | Export `measureOf` and the two new types.                                                                                                  |
| `modes/challenges/catalog.ts`                                                                    | The MUSCLE MEMORY entry, appended.                                                                                                         |
| `hooks/use-target-spawner.ts`                                                                    | Deals from the drill by **dealt** count; stops when spent.                                                                                 |
| `machines/game.ts`                                                                               | A run ends when the drill is spent and the board is clear.                                                                                 |
| `app/(tabs)/index.tsx`                                                                           | Drill places instead of `findPosition`; the drill's card size; `clocked` read off the rules; the remembered point a chain beam fires from. |
| `components/game/target-card.tsx`, `pie-countdown.tsx`                                           | Take the card size as a prop, defaulting to `PIE_SIZE`.                                                                                    |
| `hooks/use-strike-shots.ts`, `lib/strike-shot.ts`, `components/game/strike-shot.tsx`             | The chain beam.                                                                                                                            |
| `lib/admin/sessions.ts`, `components/overlays/admin-session.tsx`                                 | Write the measure when a session is booked.                                                                                                |
| `lib/session-board.ts`                                                                           | Carry `timeMs` in and out; pass nothing — the row knows its measure.                                                                       |
| `lib/score-submission.ts`, `lib/local-scores.ts`                                                 | Carry the time; keep the better row by the slot's measure.                                                                                 |
| `lib/leaderboard.ts`                                                                             | `LeaderboardRow.time_ms`.                                                                                                                  |
| `components/overlays/score-columns.tsx`, `score-row.tsx`, `tab-panel.tsx`, `challenge-modal.tsx` | The TIME column.                                                                                                                           |
| `CLAUDE.md`                                                                                      | Rows for **drill** and **measure**.                                                                                                        |
| `.claude/skills/challenge/SKILL.md`                                                              | The **modulations** section.                                                                                                               |

### Data and types

```ts
// modes/types.ts — SpawnRules
// How many targets a run deals from its session's own drill, or null to roll each one.
drill: number | null

// modes/types.ts — ScoringRules
// What this mode's session board is ordered by. 'score' everywhere but a race.
measure: 'score' | 'time'

// modes/types.ts
export type ShotKind = 'sniper' | 'burst' | 'quartet' | 'chain'

// lib/drill.ts — two pure halves, because the values are a fact about the session and
// the places are a fact about the session *and* the canvas it is drawn on.
export const drillValues = (seed: string, dial: DialSpec, count: number): number[]

// The size a card takes so `count` of them fit this canvas, and where each one stands.
export const drillPlaces = (
  seed: string,
  count: number,
  width: number,
  height: number,
): { size: number; places: readonly Position[] }
```

**The places.** All nine stand on the board at once, and they are **scattered, not
gridded**: a seeded dart-throw — pick a spot, keep it if it clears everything already
down, otherwise roll again. Irregular by construction, and it cannot overlap, which is
the pair of things a lattice could not give at once. Deterministic because the rolls come
from the seed rather than from `Math.random()`, which is what `findPosition` uses today.

The clearance test is an **axis-aligned overlap test**, not a distance between centres.
Two squares whose top-left corners are a width apart diagonally overlap by a quarter of
their area, which is what put one card across another on the first build of this.

**The cards differ in size**, each between about three-quarters and all of the largest.
A fixed nine is learnt as a picture, and a picture made of one repeated circle is nine
positions to remember instead. Largest placed first — a big card thrown last has nowhere
to land. When the throws run out, the **gap** gives way first and then the **size**, a
step at a time, before a plain grid is the last resort.

**And in colour.** One pale tint per card, walked either side of the challenge's own hue
— nine different cards that still read as one challenge. A colour is read before a number
is, which is what makes a fixed board a shape rather than nine circles to read in turn.
The band tint every other mode wears says which hundred a target is in; on a drill the
player already knows. `challengeTints` in `modes/challenges/palette.ts`, riding the
`backgroundColor` prop `PieCountdown` already has.

**The cards shrink to fit.** Nine 80pt cards do not fit a phone canvas, so the size is
derived from the canvas rather than fixed: the largest `size ≤ PIE_SIZE` at which nine
darts land with their separation held, floored at `DRILL_MIN_SIZE` so a three-digit
target stays readable. Below the floor the separation relaxes before the size does — a
slightly tighter scatter beats a number nobody can read. **`PIE_SIZE` itself does not
move**: it stays the 80 every other mode draws, and the size becomes a value a run
carries, defaulting to it. That is the shared-style rule in `CLAUDE.md`, and this is the
one place it applies in this work.

**Same device, same places.** The scatter is computed for the canvas it was measured on,
so two runs of a session on one phone are identical — which is the thing the player
actually experiences. A different display gets the same nine values in the same order and
a scatter of its own; the drill is the contest, the pixels are not.

**Rules defaults.** `drill: null` and `measure: 'score'` in `BASE_TARGET_RULES`, so every
existing mode answers as it does today and `RulesPatch` picks them up for free.

**The catalog entry.** `base: ACCURACY`; `fixedDifficulty: 'hard'`; `spawn: { drill: 9,
maxTargets: 9, cap: 500 }`; `clock: { countsDown: false }`; `lives: { count:
Number.POSITIVE_INFINITY, expiryCostsLife: false }`; `scoring: { streak: 'optimal',
measure: 'time', weights: { acc: 1, spd: 0 } }`; `shot: 'chain'`.

Three of those need saying. **`countsDown: false` already exists** — the tutorial uses it
— and it does two jobs at once: no ring is armed, and `clockLeft` scores every hit as
though no time had passed. **Which is why the blend is 1 / 0**: leaving the challenge
default of 0.5 / 0.5 would make half of every hit's points a constant 50. "Standard
accuracy scoring" means the accuracy factor, and here it means it alone. **Infinite lives
already draw no hearts** — the top bar renders `lives.count` of them and skips the row
entirely at infinity. So "no ring, no hearts, nothing expires" costs no new code.

**Schema** — `20261019000000_session_measure.sql`:

- `challenge_sessions.measure text not null default 'score'`, with a
  `check (measure in ('score','time'))`. Written by the planner from the challenge's own
  rules at booking time. On the **row** rather than passed into each read, which is what
  lets `open_sessions_with_leaders` name the _fastest_ player on a race rather than the
  highest-scoring one — it has no argument to take and returns every open session at
  once. The server still knows nothing about modes: it is told, exactly as it is told
  `difficulty` on a session score.
- `session_scores.time_ms int` — nullable. **Already-shipped rows read null**, which is
  correct: they are score-measured runs and have no time.
- `submit_session_score` gains `p_time_ms int default null`. A new parameter is a new
  signature, so the five-argument function is **dropped and recreated with six**; the
  default means **every shipped client goes on calling it with five** and keeps working.
- `session_board` gains `time_ms` to its return table and orders by the session's own
  measure, `nulls last` so a timeless row sinks on a race. Its return type changes, so it
  is dropped and recreated rather than replaced.
- `open_sessions_with_leaders` picks its leader by the session's measure, and returns
  `leader_time`.
- **The keep-better rule.** `session_scores_no_downgrade` is dropped and replaced by a
  session-only `prevent_session_downgrade()`: _if both rows carry a time, the lower time
  wins; otherwise the higher score wins._ One rule, no knowledge of modes, degrading
  exactly right. **`prevent_score_downgrade` is not touched** — `scores` and
  `daily_scores` hang the same function and editing it is how all three tables get a bug
  at once.

**The push goes first.** The client reads `time_ms` off `session_board` and writes the
measure when planning a session; neither works against the old schema. Migration before
deploy.

**No storage key moves.** `LocalScore` gains an optional `timeMs`, absent on every entry
already in `nine.scores.v1` — which reads as "a score-measured run", exactly what they
were. The same judgement `sessionId` was added under.

### Copy, and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | `HABIT` (label, Czech `NÁVYK`), its three-letter code `HBT` / `NVK`, its one-line description, the `TIME` column header, and the claims — `KNEW IT` / `PURE DRILL` / `EVERY ONE` (board), `HALF KNOWN` / `CLOSE DRILL` (medal), `GOOD HANDS` / `SURE DRILL` (strong), `COLD HANDS` / `NOT KNOWN` (cold). Claim words are drawn as a wordmark and are not translated, as no challenge's are. Everything else through Lingui with Czech. |
| **How to Play** | **No change.** The guide's challenges chapter is deliberately vague — "the keys, the clock, the scoring, how many lives you get — any of it may be different, and the card says what before you start" — and this challenge is exactly that promise being kept. The scoring and streak sections describe the permanent modes and stay true.                                                                                            |
| **Flag**        | **None.** The `challenges` feature already gates the card, the dialog and the read.                                                                                                                                                                                                                                                                                                                                                    |
| **Buttons**     | **None.** The only pressable is the dialog's START, which is `challenge.start` already.                                                                                                                                                                                                                                                                                                                                                |

## Acceptance criteria

1. Planning a session of HABIT on the admin CHALLENGES screen stores
   `measure = 'time'` on the row; planning a session of FOUR BY FOUR stores `'score'`.
2. `drillOf` with a literal uuid returns the same nine values and the same nine places on
   every call, and `lib/drill.test.ts` asserts those literals — so a change to the
   derivation fails the suite rather than moving the targets under a live session.
3. Every value in a drill is distinct, is in `0 … dial.maxSum`, and is never 0. The nine
   cards **do not overlap** on any canvas the app runs at, the scatter is irregular
   rather than gridded, every card is inside the canvas, and every size is at most
   `PIE_SIZE` and at least `DRILL_MIN_SIZE`.
4. Starting a run of HABIT deals the first drill target at once and one more every
   500ms until all nine stand on the board together, in drill order, none of them
   overlapping another.
5. No target in a HABIT run draws a ring or can expire, and the top bar shows no
   hearts.
6. Hitting the ninth drill target ends the run on the spot: the state is `gameOver`, no
   tenth target is dealt, and the run does not end while any of the nine still stands.
7. Two runs of the same session on the same device show the same nine values, in the same
   order, in the same places, at the same sizes and in the same colours. `PIE_SIZE` is
   unchanged, and every other mode still draws its targets at 80.
8. A strike in HABIT draws its beam from the previously hit target's place to the
   one just hit; the first hit of a run fires from the sum row.
9. The challenge dialog's standings for a time-measured session show four columns — #,
   NICK, SCORE, TIME — ordered by TIME ascending, and the intro's card names the fastest
   player rather than the highest-scoring one.
10. On a time-measured session a second run that is **faster but scores less** replaces the
    held row, locally and on the server; on a score-measured session a run that scores
    less never does.
11. `runRules(challengeId('habit'), 'hard')` reports `spawn.drill === 9`,
    `spawn.maxTargets === 9`, `clock.countsDown === false`, `lives.count === Infinity`,
    `scoring.measure === 'time'`, `scoring.streak === 'optimal'`,
    `scoring.weights` of `{ acc: 1, spd: 0 }`, and `capabilities.board === false`.
12. The nine cards are drawn at **different sizes**, all fitting the canvas, and each on
    its **own colour** out of the challenge's own hue — the same colour for the same card
    on every run. A card's numeral is readable on its tint (4.5:1 against `PRIMARY_INK`).
13. A card taken on a drilled board **stays where it is**, marked as taken and held back
    to a third, and no card ever replaces it — the nine are a fixed picture and the taken
    ones are what says how far through it the player is.
14. During a run of a time-measured mode, the slot that holds the average accuracy on a
    scored run holds a **running stopwatch** instead, in the profile's own marks carried
    down to the millisecond — `1′02.340″`, `9.340″`. It freezes on pause and stops at
    game over on the figure the run posts.
15. `pnpm check` is green and `pnpm i18n:verify` passes, Czech included.

## Tests

| File                                  | Covers                                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/drill.test.ts` (new)             | Criteria 2 and 3 — the literal nine, distinctness, the range, the scatter's non-overlap, and the size chosen for a short canvas and a tall one.       |
| `modes/rules.test.ts`                 | `drill` defaults to null and `measure` to `'score'`; both merge through `patchRules`.                                                                 |
| `modes/challenges/challenges.test.ts` | Criterion 11; the catalog's existing reachability and no-board checks extended to the new entry.                                                      |
| `machines/game.test.ts`               | Criterion 6 — the run ends on a spent drill with a clear board, and not before.                                                                       |
| `lib/local-scores.test.ts`            | Criterion 10, client half — `recordRun` keeps the faster row on a time-measured slot and the higher one otherwise.                                    |
| `supabase/tests/session_scores.sql`   | Criterion 10, server half — `prevent_session_downgrade` both ways; `session_board` ordering under each measure; the five-argument call still working. |

No UI tests. The column, the beam and the hearts are criteria 5, 8 and 9, driven in the
app by `verify`.

## Review focus

1. **The spawner must index the drill by targets _dealt_, not by hits.** `nextTargetId`
   is the count; `hits` is not. Indexing by hits repeats a target the moment one is hit
   while another stands. — task 5.
2. **`ADD_TARGET` silently drops a deal when the board is full** (`targets.length <
maxTargets`). `maxTargets` is 9 here so it should never refuse — but a drilled run
   that advanced its index on a dropped deal would lose a target and could then never
   reach nine and never end, so the index must come from what was actually dealt. — tasks
   5, 6.
3. **`submit_session_score` must stay callable with five arguments.** Dropping the old
   signature without a default on the sixth stops every shipped client posting session
   scores the moment the migration lands. — task 9.
4. **Only the session trigger may change.** `prevent_score_downgrade` is hung on `scores`
   and `daily_scores` as well; the keep-better rule is a new function on `session_scores`
   alone. — task 9.
5. **`clocked={!tutorial}` becomes `clocked={rules.clock.countsDown}`.** The tutorial is
   the one mode that branch was written for and must still draw no ring — the submode
   already patches `countsDown: false`, so this should be a no-op there and is worth
   confirming rather than assuming. — task 7.
