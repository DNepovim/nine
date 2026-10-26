# No slip — Plan

Spec: docs/work/2026-10-26-no-slip/spec.md

## Tasks

- [x] 1. `modes/types.ts` — `Measure` gains `'hits'`; `LivesRules.bar?`
- [x] 2. `modes/rules.ts` — `livesOf` reads `bar`; `modes/rules.test.ts`, `machines/game.test.ts` cover it
- [x] 3. `supabase/migrations/20261026000000_session_hits_measure.sql` — check, trigger, five functions, near-miss; `supabase db reset` locally — applied with `migration up`; hits assertions added to `supabase/tests/session_scores.sql`
- [x] 4. `lib/` — `local-scores` `beats`, `session-board`, `session-summaries`/`session-summary`, `player-profile`, `leaderboard-rows` carry `hits`; tests
- [x] 5. Screens — score-columns, score-row, run-headline, challenge-card, summary-card, summary-place, profile-place-row, best-scores-line, `app/(tabs)/index.tsx` (incl. top-bar hits readout); grep every `measure` comparison — plus `lib/session-figure.ts` (one formatter for the three place surfaces), `lib/run-stats.ts` drops the stat a measure leads with (HITS on a hits run, as TIME on a race), and the strip chases hits on a hits session
- [x] 6. `modes/challenges/catalog.ts` — `NO_SLIP` appended; challenge test — done before 4, whose tests need it registered; cold claim TOO SOON (claims are two words)
- [x] 7. `pnpm i18n:extract` + Czech; CLAUDE.md measure row; `pnpm check` — Czech: BEZ CHYBY / BCH / "Jedno zaváhání a je konec."; HITS header reuses the catalog's ZÁSAHY; `pnpm check` left to verify

## Build notes

- **Order.** The catalog entry (task 6) landed before task 4, because the `lib` and
  machine tests resolve `challengeId('no-slip')`.
- **`cold` claim.** SLIPPED became TOO SOON: a claim is `TitleWords`, two words. Spec
  amended.
- **Beyond the listed files, same contract:**
  - `lib/session-figure.ts` (+ test): one formatter for the summary podium, the
    summary's own line and the profile's place rows. It replaces three two-way ternaries
    that a third measure would have nested. Side effect: the profile row's score is now
    digit-grouped like the summary's (`String` → `groupDigits`). Visible only on
    five-figure scores. Flag at review if unwanted.
  - `lib/run-stats.ts` (+ new test file): the game-over stats drop the stat the measure
    leads with. That is TIME on a race (as before) and now HITS on a hits run, which the
    headline already shows.
  - `components/game/best-scores-line.tsx`: the near-record nudge chases the run's hits
    on a hits session (new `hits` prop) and nothing on a race (as before).
  - `RANKED_COLUMN` in `score-columns.tsx`: a value map of the ranked column per
    measure. Hits share TIME's width; no new width class.
- **Migration** applied locally with `supabase migration up`, not a reset. A
  `measured by hits` block was added to `supabase/tests/session_scores.sql` (AC 5, 6) and
  passes on its own. Run in one `begin…rollback`, the full file trips an _older_ block
  that relies on `now()` moving between statements. That is an artefact of the wrapper,
  not the change. `pnpm db:test` (which resets) is verify's to run.
- **Dev fixtures:** a closed NO SLIP session 12–13 days back, measure `hits`. SPEEDY and
  ACE_9 tie on 17 hits and are told apart by score; NOVA has the biggest score and places
  third on 12. It fills the profile's place rows and the hits column. Ran twice clean.
  The notice reads `4 closed`.
- **Not done here:** no live NO SLIP session in the fixtures. Verify books one from the
  admin planner (or a SQL insert) to drive the in-run readout and the game-over board.

### Self-check against the criteria

1–4, 7: covered by unit tests, all green. 5–6: SQL assertions pass locally. 8–11: written
to the contract, not yet seen on screen; that is verify's job. 12: `pnpm i18n:verify` and
`tsc` are clean; the full `pnpm check` and `pnpm db:test` are verify's.

### Reopened for criterion 13 (2026-10-26)

- [x] 8. `'none'` builds, breaks and doubles nothing. Trainee's board-clear doubling gets
      its own trigger, `'doubled'`, which is the base rules' default, so Trainee and the
      tutorial play exactly as before (decided by advisor: option 1, name `'doubled'`). It
      touched `modes/streak.ts` (the member and its two rows), the branch in `machines/game.ts`
      (now keyed on `doubled`), `modes/rules.ts` (the default), the `rules.test.ts`
      expectation, the stale `lib/step-up.ts` comment, a line in `lib/strike-rule.ts` for
      `doubled` (with Czech, so a challenge that ever names it explains its ×2), and the
      trigger table in the challenge skill.
      Tests: `game.test.ts` › NO SLIP doubles nothing on a board-clearing hit, and a new
      "Trainee's doubled rule" pair pins the old behaviour.
- STRIKES stays in the run stats and now reads 0 on NO SLIP (decided by advisor: out of
  scope, for review).

### Reopened by review (2026-10-26), the item's second trip backwards

- [x] 9. One "is this run better than that row" comparator per **measure** in `lib/`:
      score; time (timed beats untimed, then hits, then faster); hits (hits, then score).
      Used by both `beats` (`lib/local-scores.ts`) and `sessionMedal` (`lib/board-medals.ts`),
      so the game-over medal and the claim tier (`sessionRank`, `app/(tabs)/index.tsx:2550`)
      agree with the standings. Fixes hits and HABIT's time together; the SQL copies stay
      (decided by advisor). Tests: the comparator, plus `sessionMedal` on a hits board and a
      race.
- [x] 10. `components/overlays/tab-panel.tsx`: the player's own cut row below the top
      five passes `hits` (and `timeMs` where it is known), so a NO SLIP player ranked sixth or
      lower does not read 0 hits.

  Done:
  - `lib/session-order.ts` holds `runBeats(measure, run, held)` (+ test). `beats` and
    `sessionMedal` both ask it.
  - `sessionMedal` takes the run's figures and the measure.
  - `claimedTime(context)` in `machines/game.ts` (+ test) is the one answer to "does this
    run claim a time". The write and the medal both read it, through `runFigures` in
    `index.tsx` and `claimedTimeMs` on the game-over overlay.
  - `drillSpent` is no longer exported.
  - The local-scores race tests now run as HABIT. A time on any other mode no longer
    selects the race rule; it never could arise.

## Review

First pass, 2026-10-26. `/code-review high` returned 10 findings, triaged with the advisor.

**Reopens build (tasks 9 and 10 above):**

- F1 `sessionMedal` ranks a session run by score, so on a hits session, and on a race
  (where it predates this work), the medal and the claim can disagree with the standings.
- F2 the cut row prints 0 hits.

**Fixed in review:**

- F3: the slipping hit counts. Kept, since AC 4 already pinned it and every run ends on
  exactly one slip. The wording was wrong and is corrected: AC 3, the catalog comment and
  the `run-headline` comment. The CLAUDE.md row already read "how many targets the run took".
- F5: the profile's place row prints scores ungrouped again; `sessionFigure` is used only
  for time and hits.
- `score-row`'s private `RANKED_FIGURE` is replaced by `sessionFigure`.
- `score-columns` gains a `RANKED_LABEL` map, so one conditional replaces the two
  copy-pasted header blocks.
- `components/game/digit-strip.tsx` is shared by the two top-bar readouts.
- Stale comments: the `doubled` row's pointer (`applyGrid`, not `hitBatch`), the
  wasteful-hit comment in `game.ts` (a mode may name its own bar), and the challenge
  skill's "most forgiving of the five".
- CLAUDE.md's measure row: Prettier had split the table on the `|` inside
  `'score' | 'time' | 'hits'`. The pipes are escaped, and only that one row differs from main.

**Left deliberately:**

- F4: the trigger's hits arm replaces the row on equal hits and score (moving
  `updated_at`), which mirrors the score arm. It is the house pattern.
- `LEADER_FIGURE` on the card stays its own map. `sessionFigure` would digit-group the
  card's score, a visible change nobody asked for.
- The STRIKES stat on a mode that can't strike (reads 0).

**Review focus:** confirmed.

- `bar` is read only under `wastefulCostsLife`: `rules.ts` `livesOf`, tested.
- Grants and `security definer` survive: checked in verify.
- Bodies were copied from their latest definitions: each one traced to its file.
- No two-way `measure` check is left: the four `=== 'time'` sites are time-only.
- `beats` reads `measureOf`.

**How to Play:** still true. The challenges chapter is generic, and Trainee's rule is
renamed, not changed.

**Worth its own item later:**

- The keep-better and ranking rule is written in SQL three times. One SQL helper
  (`session_better(measure, …)`) would make a fourth measure one edit there, as task 9
  does for TypeScript.
- `features.sql:175` fails on main: the test asserts the rule `20261023010000` reversed.
- Whether a mode with no streak should show STRIKES at all.

### Second pass (2026-10-26, after tasks 9–10)

`/code-review high` (10 findings) and `simplify` (four reviewers) over the whole diff.

**Fixed in review:**

- **A measure this build doesn't know** is narrowed at the wire by `measureFrom` (in
  `modes/types.ts`, beside `MEASURES`, + test) in the card and summary loaders. Every
  measure-keyed table would otherwise crash on one; the profile reader already filtered.
- **The near-record nudge** runs on score sessions only. On a hits session 5% of a
  two-digit count is under one hit, so it could never fire. The strip's `hits` prop is gone.
- **`run-stats`** leaves out the led stat through an explicit `LED_BY` map, rather than
  reading a stat key as a measure.
- **`runMedal` and `sessionMedal`** share one `placeAmong(rows, score)` rule. Each caller says
  which rows stand above the run.
- **The catalog order test** pins the whole list, NO SLIP included, plus NO SLIP's colour at
  index 4. It had been weakened to the first four.
- **`claimedTime(context, rules)`** answers only for a race (null on every other measure) and
  absorbs `drillSpent`. It reuses the screen's resolved rules rather than resolving them
  again each render. The finished-race case is now tested.
- **The session medal** is worked out once in `index.tsx` (`runSessionMedalsOf`, at game over
  only) and passed down as `sessionMedals`. The title's rank reads the same array, the
  `claimedTimeMs` prop is gone, and the overlay no longer resolves `measureOf`.
- **`sessionBestsOf`** builds one object; `RANKED_OF` reads `SessionFigures`.
- **`RANKED_COLUMN`** carries the width and the label together; `RANKED_LABEL` is gone.
- **`DigitStrip`** owns its row; both callers drop their wrappers.
- **One figures type**: `lib/session-figure.ts` uses `SessionFigures`.
- **`measureFrom`** uses `isOneOf`.
- **The trigger** looks up the measure only when neither row has a time, so a race's write
  never pays for it. The migration was re-applied locally and every `session_scores.sql`
  block still passes.
- Two stray comment lines.

Then the suite again: `pnpm check` green, 2,033 tests. One more NO SLIP run on screen against a
fresh local session: 2 hits on 113 → 🥇, the claim **NO SLIP** (`board`), STRIKES 0, and the
row on the board.

**Left, with reasons:**

- **A press passing another target's sum off its route is a slip.** That is the user's rule
  read literally: a hit not on the exact route ends the run. Accuracy Hard's 0.2 bar hides
  it. Raised in the ship notes.
- **Patience is rewarded.** Expiry costs nothing (the user chose that), so a run can wait out
  every hard target. Raised in the ship notes.
- **An exact tie** (equal hits and score) tells the later run it took the same place, while
  the server ranks it behind on `updated_at`. Boards have always done the same.
- **The photo finish** is "within one hit", as the spec set.
- **Taking the doubling out of `StreakTrigger`** (a `scoring.clearMultiplier`), and
  **`lives.wasteful: null | 'rung' | number`**: each is a deeper reshaping the advisor did
  not ask for. Both go on the follow-up list.
- **`player_factors` per row** in the leader and previous-winner queries: a pattern this
  migration copied, not one it introduced.
- **`DigitStrip` in arcade and multiplayer**: outside this diff.

**Worth its own item later (added):**

- One `MeasureSpec` per measure (figure, format, column, led stat, comparator) in place of the
  per-surface tables.
- Board-clear doubling as its own scoring field, not a streak trigger.
- The lives bar as one tri-state field.
- Cheaper SQL leader and previous-winner reads.

## Verification log

**Third pass (2026-10-26, after review's tasks 9 and 10): 13 of 13 PASS, and the two review defects
are fixed on screen.** `pnpm check` green (2,030 tests; Knip clean after un-exporting `drillSpent`).

- **Task 9.** A new live NO SLIP session `5e55911a-…0003` was booked locally with ACE_9 (1,900 / 4)
  and SPEEDY (2,400 / 3), and the fixtures' live FOUR KEYS session was shut for the run. The driver
  now walks par routes with swipes as well as taps. 4 exact hits (20, 186, 228, 90 at pars 2, 4, 3,
  3), then a slip on 147 (17 presses against par 2). Game over: **🥇 with 5 hits on 422**, below both
  rows' scores, so the old score-ranked medal would have been bronze. The claim was **SURE HAND**
  (`board` tier). STRIKES 0.
- **Task 10.** Five rivals with 10–14 hits pushed the dev profile to sixth. The dialog's cut row reads
  `6 DEV_3A12E0 422 5`.
- **Summary, now drawn.** Once the first live session closed, the next launch told its summary:
  ACE_9 🥇 4, SPEEDY 🥈 3, DEV_3A12E0 🥉 3 (hit counts throughout), and +44 TO YOUR FORTUNE, a fifth
  of 221. This closes the one part of AC 9 that was only data before.

Fixtures restored afterwards. Session `…0003` stays live for about four hours, with its seven rows.

### Second pass

**Re-verify (2026-10-26, after the criterion 13 build): 13 of 13 PASS.** `pnpm check` green (903
messages, 2,022 tests). A second NO SLIP run against the rebuilt bundle: hits on 2 and 14 at par, then a
slip on 62 at 16 presses against par 1. Game over: **0 STRIKES**, headline 3 over 215. The row kept the
earlier 221 / 3 rather than this 215 / 3 (equal hits, lower score refused), which is AC 6 on screen. The
claim was NINE DOWN, from the app's `played` pool: this run took no place, since it did not improve the
player's row, and 215 is above Easy's `cold` bar. That fall-through is what the spec names. Trainee's
board-clear doubling is pinned by `game.test.ts` › Trainee's doubled rule (×2 and a strike, no streak); it
is invisible on screen, Trainee not being `scored`. The strip's YOUR BEST now reads 3, the player's own hits.

| #   | Criterion                                         | Result | Evidence                                                                              |
| --- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| 13  | A NO SLIP run builds no multiplier and no strikes | PASS   | on screen 0 STRIKES; `game.test.ts` › NO SLIP doubles nothing on a board-clearing hit |

### First pass

**Verdict (2026-10-26): 12 of 13 PASS, 1 FAIL (13, found in verify), 0 SKIPPED.** Criterion 13: `streak:
'none'` is not "no streak". Hand back to `/build no-slip`.

Suite: `pnpm check` green (lint 0 errors / 167 warnings, none from this change; Prettier; types; Knip after
un-exporting `TIME_COLUMN`, which is now read only through `RANKED_COLUMN`; 2,019 tests).
`pnpm db:test` reset the stack and stopped on `features.sql:175`. That failure predates this work: the test
(last touched in `7fe5dbd`) still asserts the rule `20261023010000_public_beats_override.sql` (`3b6d7d8`)
reversed, and neither file is touched here. `session_scores.sql` then ran on the fresh reset: all nine
blocks OK, `measured by hits` included. The recreated functions keep `security definer` and their
grants. Fixtures restored.

App: Expo web on :8081 (already running, reads the same local stack through `nine-kong-proxy`), headless
Chromium via Playwright at 390×844. A live NO SLIP session `5e55911a-…0002` is booked in the **local** DB
for three hours, with ACE_9 (1,900 / 4 hits) and SPEEDY (2,400 / 3 hits) on it. The run was played by a
driver that reads the grid and targets off the page and taps only routes whose tap count equals par.

| #   | Criterion                                                 | Result   | Evidence                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | NO SLIP resolves to Easy, one heart at bar 1, hits        | PASS     | `challenges.test.ts` › NO SLIP                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Every other mode's bar unchanged                          | PASS     | `rules.test.ts`, existing challenge tests unchanged and green                                                                                                                                                                                                                                                                                                                    |
| 3   | Exact hits keep the heart; first slip ends; expiry free   | PASS     | run: 6 and 12 taken at par, heart stays; 186 taken in 35 presses against par 4 → game over on 3 hits. 208 expired earlier with the heart kept                                                                                                                                                                                                                                    |
| 4   | Machine test pins 3                                       | PASS     | `game.test.ts` › NO SLIP                                                                                                                                                                                                                                                                                                                                                         |
| 5   | `session_board` orders hits, then score                   | PASS     | SQL block on a reset stack; on screen 4 hits/1,900 above 3/2,400, and 3/2,400 above 3/221                                                                                                                                                                                                                                                                                        |
| 6   | Keep-better trigger on hits                               | PASS     | SQL block on a reset stack                                                                                                                                                                                                                                                                                                                                                       |
| 7   | `beats` agrees on a hits slot                             | PASS     | `local-scores.test.ts`                                                                                                                                                                                                                                                                                                                                                           |
| 8   | Game over: hits headline, score under; SCORE · HITS       | PASS     | headline **3** in the ink, **221** dimmed under; rows score dimmed, hits green. _Note:_ the game-over session board draws no column header for any measure (HABIT's either); `# NICK SCORE HITS` is drawn in the challenge dialog, seen there                                                                                                                                    |
| 9   | Card, summary, profile, strip show hits                   | PASS     | card "ACE_9 leads with 4"; strip YOUR BEST 0 · SESSION 4 · LAST 17 (the fixture's closed NO SLIP winner); SPEEDY's profile `NO SLIP 14 OCT 17`, HABIT still 38.4″. Summary **not drawn**, since a fresh device's watermark owes nothing 12 days back; its data, read as the player, carries `hits` on all three places and on `mine`, printed by the unit-tested `sessionFigure` |
| 10  | Top bar shows the run's hits                              | PASS     | centre readout 0 → 2 after two hits                                                                                                                                                                                                                                                                                                                                              |
| 11  | Claims from NO SLIP's pools                               | PASS     | third place → `medal` → **ONE SLIP**                                                                                                                                                                                                                                                                                                                                             |
| 12  | `pnpm check` green, Czech, migration applies              | PASS     | see Suite; BEZ CHYBY / BCH / "Jedno zaváhání a je konec."                                                                                                                                                                                                                                                                                                                        |
| 13  | _(new)_ A NO SLIP run builds no multiplier and no strikes | **FAIL** | the game over read **1 STRIKES**. `machines/game.ts:596`: `trigger === 'none'` keeps Trainee's legacy rule, so a hit that empties the board is worth ×2 and counts a strike. The user asked for "no streaks", and the catalog comment says none are built                                                                                                                        |

**Reopens for build:** criterion 13. `'none'` is the base rules' default and is what Trainee runs on, so
changing what it means changes Trainee. The cheap shape is the one `ShotKind` set: a new member of
`StreakTrigger` that builds and breaks nothing and doubles nothing, plus its rows in the two predicate
tables and the `none` branch. Whether that is a new value or a rename of Trainee's legacy rule is
build's question for the advisor.

**Seen, not a criterion:**

- The STRIKES stat stays on the run stats of a mode that can't strike. Once 13 is fixed it will always
  read 0. Whether a mode with no streak shows it is a question for build or review.
- Czech isn't driven on screen. BEZ / CHYBY is two short words, narrower than GLIMPSE's seven-letter
  word that failed in its dialog.

Local state left for review: the live NO SLIP session `5e55911a-…0002` (closes about three hours from
now) and the dev profile's 221 / 3 row on it.

## After shipping — hearts (2026-10-26)

Requested by the user after `f444793`: NO SLIP starts with **three hearts**; a target that
runs out costs one, as on every mode that spends them; a slip takes **every heart left**.

- New lives rule `wastefulTakesAll` (`LivesRules`, resolved on `RunRules['lives']`, read
  only under `wastefulCostsLife` like `bar`). `applyGrid` costs `context.lives` instead
  of 1 when it is on. Every other mode resolves it `false`.
- Catalog: `count: 3`, `expiryCostsLife: true`, `wastefulTakesAll: true`.
- Tests: `rules.test.ts` (the rule's default and its guard), `challenges.test.ts` (NO
  SLIP's lives), `game.test.ts` (three hearts kept through exact hits, one lost to an
  expiry, all lost to a slip).
- This also closes review's "patience is rewarded" point: waiting out a target now costs a
  heart.
- GLIMPSE: asked to arrive at Accuracy Hard's pace. Its resolved rules already are (16.5 s
  ring, a third of it between arrivals, pinned Hard); nothing changed, pending what the
  user saw.
