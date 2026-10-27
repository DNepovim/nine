# No slip

Slug: no-slip
Stage: shipped
Next: —
Track: full
Branch: feat/no-slip
Started: 2026-10-26

## Problem

There is no challenge that asks for a perfect route and means it. Accuracy rewards the
exact route but forgives a loose one, and Easy never takes a heart for one at all. And
the engine can't build the strict version: the accuracy bar that costs a life belongs
to the difficulty (Easy has none), and a session board can only be ranked by score or
by time. So a catalog entry asking for this would typecheck, then play as ordinary
Accuracy Easy with one heart and rank by score.

## Appetite

**A day or two.** That buys one rules field (defaulted so every existing mode is
untouched), a third value of **measure** carried through one migration and the
components that already switch on `'time'`, the catalog entry with its Czech, and the
CLAUDE.md row. No new screen and no new animation. If it runs over, the HITS column
gets plainer and the shape stays the same.

decided by advisor: the size of the 'time' measure work for HABIT (several commits) is
the precedent; GLIMPSE was an evening because it had no schema change.

## Shape

### What the player meets

1. An admin books a session of NO SLIP on the CHALLENGES screen, the same as any other
   booking. Measure stamped on the row: `hits`.
2. The intro card shows NO SLIP: "One slip and it's over." Its leader is named by the
   most hits.
3. The player starts. It is Accuracy on Easy (a 31.9 s ring, the nine dial, targets
   arriving as they do), with **one heart** and no streak, so no shot is drawn.
4. Every hit on the exact route scores as an Accuracy hit would. A target left to
   expire falls and costs nothing.
5. The first hit off the exact route (accuracy factor below 1) takes the only heart,
   and the run ends there.
6. On the game-over screen the session board ranks rows by **hits**, highest first,
   ties broken by the higher score. The hits column takes the score colour; the score
   steps back, smaller and dimmed beside it, the way HABIT shows its time.
7. The claim above it is about slipping: the session standing (`board`, `medal`) or
   `cold`.
8. The summary, the profile's place rows and the best-scores strip all read the same
   measure, so all of them show hits.

### Areas

- **Rules** (`modes/`): `LivesRules` gains a mode-owned accuracy bar, defaulting to the
  difficulty's `wastefulThreshold`, so every existing mode resolves exactly as it does
  today. `Measure` gains a third literal: `'score' | 'time' | 'hits'`, bounded, not an
  expression. `measureOf` is unchanged in shape.
- **Engine** (`machines/game.ts`): nothing new. It already reads `rules.lives.wasteful`,
  so a bar of 1 does the job. Confirm the run ends on the costed life with
  `expiryCosts: false`.
- **Schema** (one migration): widen `challenge_sessions_measure`; add a `hits` arm to
  the ordering in `prevent_session_downgrade`, `session_board` and the card's leader
  (latest bodies in `20261023020000_session_time_kept.sql`). Places, podium, summaries
  and the last winner read `session_board`, so they follow.
- **Device** (`lib/local-scores.ts`): the keep-the-better-run rule gains the same arm.
- **Screens**: every place that switches on `measure === 'time'` learns `'hits'`. That
  means score-row, score-columns, summary-place, summary-card, profile-place-row,
  best-scores-line, run-headline, challenge-card, and `app/(tabs)/index.tsx`.
- **Catalog**: NO SLIP appended. Code `NSL`, base `ACCURACY`, `fixedDifficulty: 'easy'`,
  `scoring: { streak: 'none', measure: 'hits' }`, `shot: null`,
  `lives: { count: 1, wastefulCostsLife: true, expiryCostsLife: false }` plus the bar of
  1. Claims for `board`, `medal` and `cold` only.
- **Copy**: label, code and description into Czech; the claims too.
- **CLAUDE.md**: the **measure** row gains hits.

decided by advisor: own code `NSL`, HABIT's precedent (a profile row reading ACC files
it under a board it is not). No feature flag: a challenge reaches players only through
a session booking.

## In

- The mode-owned accuracy bar, defaulted to the difficulty's.
- `measure: 'hits'`, end to end: rules, migration, device, screens.
- The NO SLIP entry, its claims and its Czech.
- The CLAUDE.md measure row.

## Out

- **A streak or a shot.** The user asked for none. The run is too short and too
  binary for a multiplier to mean anything.
- **Expiry costing a life.** The user decided against it; only a slip ends the run.
- **A different scoring blend.** The challenge default (0.85 / 0.15) stands.
- **Making `'strong'` reachable without strikes.** `earnedChallenge(hits, strikes)`
  can't be met with streak `none`, so the claims name `board`, `medal` and `cold`.
  `played` falls through to the app's pool.
- **Rewriting the existing 'time' columns.** 'hits' is added beside them, not merged
  into a generic "ranked figure" component, unless spec finds that simpler.
- **The How to Play challenges chapter.** It is deliberately vague, so it needs
  nothing.

## Rabbit holes

- **The downgrade trigger.** `prevent_session_downgrade` already compares hits on a
  race. The 'hits' arm must not catch score-measured rows: it has to read the
  session's measure, which the trigger does not do today (it infers a race from
  `time_ms`). Join through `challenge_sessions` by `session_id`, or this changes
  how every score session keeps rows.
- **The mid-run record post.** A challenge's first point fires the mid-run post (see
  the time-kept migration). For a hits session, that post carries few hits and a low
  score, and the hits-desc rule naturally keeps the finish. Spec should confirm `hits`
  is sent on every post.
- **The rung's bar on Easy is null.** The new field has to mean "this bar, whatever the
  rung" for NO SLIP, and "the rung's" for everyone else. Get the default wrong and
  Accuracy Hard stops costing hearts. `rules.test.ts` and the challenge tests already
  pin both sides.
- **Several wasteful hits in one batch.** `machines/game.ts` costs one life per batch at
  the first wasteful index. With one heart that is already right; just don't change it.

## Contract

### Domain words

**Used:** **challenge**, **session**, **session board** (never shortened to "board"),
**measure**, **headline**, **run**, **dial**, **rules**, **place**, **summary**,
**claim**. A hit off the exact route is a **wasteful hit** in code
(`wastefulCostsLife`, `lives.wasteful`), and stays that. The player-facing word is
_slip_, and it lives only in NO SLIP's own copy.

**Introduced:** none. `'hits'` is a third value of an existing word:

- **measure** gains _hits_: a session board ordered by how many targets a run took,
  ties broken by the higher score. CLAUDE.md's **measure** row is rewritten to name
  all three: "the score everywhere but a race, where it is the time, and a survival
  run, where it is the hits".

**Collisions:** `hits` is already a column on `session_scores`, a field on every run
and a key in `lib/compare.ts`. The measure value means "ordered by that column". Keep
it as one word, `'hits'`, so a reader never has to map `'survival'` back to a column.
The rules field below is `lives.bar`, not `threshold`: `wastefulThreshold` stays the
**difficulty**'s word, and the mode's override must not read as a second copy of it.

### Files

**Created**

| Path                                                          | Responsibility                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261026000000_session_hits_measure.sql` | Widen the check; add the `hits` arm to every session ordering; return `hits` wherever a session figure is returned. |

**Modified**

| Path                                                                                 | Change                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `modes/types.ts`                                                                     | `Measure` becomes `'score' \| 'time' \| 'hits'`. `LivesRules` gains `bar?: number`.                                    |
| `modes/rules.ts`                                                                     | `livesOf`: `wasteful` = `lives.bar ?? rung's wastefulThreshold` when `wastefulCostsLife`, else null.                   |
| `modes/challenges/catalog.ts`                                                        | `NO_SLIP` appended to `CHALLENGES`.                                                                                    |
| `lib/local-scores.ts`                                                                | `beats` takes the slot's measure; the `hits` arm is hits, then score.                                                  |
| `lib/session-board.ts`                                                               | `SessionCard.leader.hits`, `PreviousWinner.hits`, read from the new columns.                                           |
| `lib/session-summaries.ts`, `lib/session-summary.ts`                                 | `hits` on each place and on `mine`.                                                                                    |
| `lib/player-profile.ts`                                                              | `MEASURES` gains `'hits'`; `SessionPlace.hits`.                                                                        |
| `lib/leaderboard-rows.ts`                                                            | `DisplayRow.hits`, from the row.                                                                                       |
| `components/overlays/score-columns.tsx`                                              | A HITS column, as TIME is drawn.                                                                                       |
| `components/overlays/score-row.tsx`                                                  | On `hits`: the score dims into `SCORE_COLUMN`, and hits take the ranked column.                                        |
| `components/overlays/run-headline.tsx`                                               | On `hits`: the headline value is the hit count, with the score under it.                                               |
| `components/overlays/challenge-card.tsx`                                             | `leaderFigure` on `hits`: the leader's hits.                                                                           |
| `components/overlays/summary-card.tsx`, `summary-place.tsx`, `profile-place-row.tsx` | The figure on `hits`: the hit count.                                                                                   |
| `components/game/best-scores-line.tsx`                                               | Cells on `hits` are hit counts; `nearKey` compares the run's hits.                                                     |
| `app/(tabs)/index.tsx`                                                               | `sessionBestsOf` reads hits on `hits`. The top-bar readout on `hits` is the run's hit count, not the average accuracy. |
| `CLAUDE.md`                                                                          | The **measure** row.                                                                                                   |
| `locales/*.po`                                                                       | Extracted, with Czech.                                                                                                 |

The screen edits follow the `'time'` precedent file by file. A screen that branches
three ways turns its ternary into a value map keyed by `Measure` (`code-guide`'s
value-map rule). It does not become a nested ternary.

### Data and types

```ts
export type Measure = 'score' | 'time' | 'hits'

export type LivesRules = {
  count: number
  wastefulCostsLife: boolean
  expiryCostsLife: boolean
  // The accuracy a hit has to reach to keep its life, where the mode names its own
  // rather than taking the rung's. Absent = the rung's `wastefulThreshold`.
  bar?: number
}
```

`RunRules['lives'].wasteful` keeps its shape. NO SLIP resolves to
`{ count: 1, wasteful: 1, expiryCosts: false }`. The engine already costs the life at
`accFactor < bar`, and `accuracyFactor` returns exactly 1 only at par.

**Migration `20261026000000_session_hits_measure.sql`:**

- `challenge_sessions_measure` is dropped and re-added as
  `check (measure in ('score', 'time', 'hits'))`.
- `prevent_session_downgrade()` reads the row's session measure
  (`select measure from challenge_sessions where id = new.session_id`). On `hits` it
  keeps the higher `hits`, then the higher `best_score`. On `time` and `score` the
  behaviour is unchanged.
- `session_board`: one arm added ahead of the score arm:
  `case when b.measure = 'hits' then s.hits end desc`. A hits session then falls
  through to `best_score desc` (the tie-break), then `updated_at asc`. Return table
  unchanged.
- `open_sessions_with_leaders`: the same arm in the leader's order. Gains a
  `leader_hits int` column, so it is dropped and recreated with its grants.
- `my_session_summaries`: `hits` added beside `timeMs` in each place's jsonb and in
  `mine`. The signature is unchanged.
- `player_session_places`, `previous_session_winner`: gain a `hits int` column, so
  each is dropped, recreated and re-granted.
- `my_session_places`: the near-miss arm gains
  `when measure = 'hits' then edge_hits - my_hits <= 1`, which needs `my_hits` and
  `edge_hits` in its aggregate.
- Replaced bodies are copied from their latest migration
  (`grep -l 'function <name>' supabase/migrations | tail -1`). They are not
  re-derived.

**Shipped rows:** every session already booked is `score` or `time` and reads exactly
as before. No row changes.

**Old builds:** the new columns are additive, so an old build ignores them. An old
build shown a `hits` session draws it as a score session: the leader is right, the
figure is the score. **The migration must be pushed before the build ships**, because
the new build asks for columns the old schema lacks. **Book NO SLIP only after the
build is out.** Both go in the ship notes.

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | `NO SLIP` (label), `NSL` (code), "One slip and it's over." (description), and the `HITS` column header (reuses the catalog's existing `HITS` → `ZÁSAHY` if the extractor matches; else new). Czech for every one. |
| **How to Play** | None. The challenges chapter is deliberately generic, and NO SLIP is a value under it. No permanent mode's rules move: `bar` is absent everywhere else.                                                           |
| **Flag**        | None (decided by advisor in shape). A session booking is the gate.                                                                                                                                                |
| **Buttons**     | None. Nothing new is pressable.                                                                                                                                                                                   |

**Claims:** `board`: SURE HAND · NO SLIP · CLEAN LINE. `medal`: NEAR CLEAN · ONE SLIP.
`cold`: EARLY SLIP · TOO SOON (a claim is two words, `TitleWords`). Only these three tiers: `strong` needs strikes, which
`streak: 'none'` never makes. `played` falls through to the app's pool. Claim words are
drawn as a wordmark and are **not translated**, as no challenge's are (decided by
advisor: HABIT and GLIMPSE precedent). The code `NSL` gets a Czech code of its own.

## Acceptance criteria

decided by advisor: all twelve accepted; AC 10 because the live slot carries the ranked figure, as HABIT's stopwatch does; the five-function migration is within the appetite.

1. `runRules(challengeId('no-slip'), 'hard')` resolves to: difficulty pinned to
   `easy`, `lives` `{ count: 1, wasteful: 1, expiryCosts: false }`, `scoring.streak`
   `'none'`, `scoring.measure` `'hits'`, weights `{ acc: 0.85, spd: 0.15 }`, dial
   `NINE_DIAL`, and no shot.
2. Every other mode resolves its `lives.wasteful` exactly as before: Accuracy Easy
   `null`, Accuracy Hard `0.2`, every existing challenge `null`. The existing rules
   and challenge tests pass unchanged.
3. In a NO SLIP run, every hit at par keeps the heart. The first hit above par ends
   the run on game over, and that hit counts too: the slip still took its target
   (amended in review, decided by advisor; AC 4 already pinned it). A target left to expire
   costs nothing and the run continues.
4. A game-machine test pins point 3: a run at `bar: 1`, `count: 1`, with a par hit,
   then an over-par hit, reaches `gameOver`, with `hits` = 2.
5. After the migration, `session_board` on a `hits` session ranks a row with more hits
   above one with fewer, whatever their scores, and breaks equal hits by the higher
   score. On `score` and `time` sessions the order is identical to before.
6. `prevent_session_downgrade` on a `hits` session keeps a 7-hit row over an incoming
   5-hit row with a higher score, and takes an incoming 7-hit row with a higher score.
   A `score` session still keeps by score alone.
7. `lib/local-scores.ts` `beats` agrees with point 6 on a hits slot, and is unchanged
   on score and time slots (the existing tests pass).
8. On the game-over screen of a NO SLIP run, the headline is the hit count with the
   score under it. The session board's header reads `# NICK SCORE HITS`, with the
   score dimmed and hits in the score colour, as HABIT draws SCORE and TIME.
9. The intro's NO SLIP card names the leader with their hit count. The summary, the
   profile's place rows and the best-scores strip all show hit counts for a NO SLIP
   session.
10. During a NO SLIP run the top bar shows the run's hit count where Accuracy shows
    the average accuracy.
11. The claims over a NO SLIP game-over come from NO SLIP's own pools for `board`,
    `medal` and `cold`.
12. `pnpm check` is green, `pnpm i18n:verify` included, with Czech for every new
    string. The migration applies cleanly with `supabase db reset` locally.
13. _(added in verify)_ A NO SLIP run builds no multiplier: no hit is worth more than its own blend,
    a board-clearing hit included, and the run's STRIKES reads 0.

## Tests

- `modes/rules.test.ts`: `bar` overrides the rung's threshold; absent keeps the
  rung's, on all three rungs (AC 2).
- `modes/challenges/challenges.test.ts`: NO SLIP resolves as AC 1. The catalog-wide
  tests (reachability, palette, append-only) cover it automatically.
- `machines/game.test.ts`: a one-life, bar-1 run ends on the first over-par hit, and
  expiry costs nothing (AC 3–4).
- `lib/local-scores.test.ts`: the hits arm of `beats` (AC 7).
- `lib/player-profile.test.ts`: a place row with measure `hits` is kept, not dropped.
- SQL (AC 5, 6) is checked locally against `supabase db reset` with seeded rows. This
  is a verify step, not a committed test, as the measure migration was.

## Review focus

- **Task 2 (`livesOf`):** `bar` applies only when `wastefulCostsLife` is true. Reading
  it unconditionally would let a stray `bar` cost lives on a mode that said it
  doesn't.
- **Task 3 (migration):** each recreated function keeps its `security definer`,
  `search_path` and grants. A `drop function` that loses `grant execute … to
authenticated` fails silently for players. The trigger's new lookup must not run
  for the non-session `scores` table.
- **Task 3 (migration):** bodies are copied from their **latest** definition. Copying
  `session_board` from `20261019…` instead of `20261023…` would undo the time-kept
  fix.
- **Task 5 (screens):** every `measure === 'time'` / `!== 'time'` site was written for
  two values. `!== 'time'` now silently includes `hits`. Grep all of them, not only
  the listed files.
- **Task 4 (`beats`):** the slot's measure comes from `measureOf(mode)`, not from
  whether `timeMs` is present. Otherwise a hits slot falls into the score rule.
