# Game Modes — Design (Spec 1)

## Context

`nine` currently has a single game loop with one scoring model and a five-entry
`DIFFICULTIES` table (`trainee`, `easy`, `medium`, `hard`, `extreme`). `trainee`
is really a *flavor* (no life loss, long timer) sitting in the same list as a
*difficulty curve* (shorter timers). Scoring is fixed: `computeHitPoints =
1000 × (⅔·accuracy + ⅓·speed)`, with a flat ×2 bonus when a hit clears the board.
The loop, scoring, and persistence all live around `machines/game.ts`,
`machines/scoring.ts`, and the per-difficulty `stats: Record<Difficulty,
{score, hits}>`.

The game feels thin with only these options. This spec introduces **game modes**
as a first-class axis, orthogonal to difficulty.

## Goals & scope

**Spec 1 (this document):** a mode framework plus three modes — **Trainee**,
**Accuracy**, **Speed** — each playable at four difficulties.

**Out of scope (own specs later):** **Arcade** (levels, bonuses, sidequests) is a
much larger subsystem; Trainee's detailed *learning aids* are deferred to a
follow-up spec. Trainee ships in Spec 1 as the framework mode (endless, no life
loss, long timer) without special aids yet. Additional future modes are listed
in the appendix.

The current balanced game ("Classic") is **removed** — it is not one of the new
modes.

## Two axes

Two orthogonal descriptors, both read from machine context:

- **Mode** owns *character*: scoring weights, base timeout, life rule, and the
  streak-multiplier trigger.
- **Difficulty** owns *pressure*: it scales the timeout and controls how many
  targets are on screen and how fast they spawn.

**Effective per-target timeout** = `round(mode.baseTimeout × difficulty.timeoutScale)`.

### Modes

| Mode       | baseTimeout | weights (acc / spd) | lives | streak trigger |
| ---------- | ----------- | ------------------- | ----- | -------------- |
| `trainee`  | 22000 ms    | 0.667 / 0.333       | ∞     | none           |
| `accuracy` | 22000 ms    | 0.85 / 0.15         | 3     | `optimal`      |
| `speed`    | 8000 ms     | 0.15 / 0.85         | 3     | `clear`        |

`MODE_ORDER = ['trainee', 'accuracy', 'speed']`. Default mode: `accuracy`.

- **Trainee** — endless practice. No life loss (`lives: ∞`), no streak mechanic;
  retains the current flat ×2 clear-board bonus so it plays like today's game.
  Learning aids are a later spec.
- **Accuracy** — long, forgiving timers; score is dominated by solving in the
  fewest steps. Streak trigger = `optimal` (see below).
- **Speed** — short timers; score is dominated by hitting fast. Streak trigger =
  `clear`.

### Difficulties

`DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme']` (the old `trainee`
entry is gone — it is a mode now). Default difficulty: `medium`.

| Difficulty | timeoutScale | max concurrent targets | spawn interval |
| ---------- | ------------ | ---------------------- | -------------- |
| `easy`     | 1.30×        | 1                      | 6000 ms        |
| `medium`   | 1.00×        | 2                      | 5000 ms        |
| `hard`     | 0.75×        | 3                      | 3500 ms        |
| `extreme`  | 0.55×        | 4                      | 2500 ms        |

Worked timeouts (baseTimeout × scale): Speed/extreme ≈ 4.4s, Speed/easy ≈ 10.4s;
Accuracy/extreme ≈ 12.1s, Accuracy/easy ≈ 28.6s.

All numbers above are **tunable** — this is the shape, not final balance.

## Scoring

`computeHitPoints` keeps its accuracy/speed factors and the `par` DP unchanged;
the only change is that the **blend weights become a parameter** fed from the
active mode instead of the hardcoded ⅔ / ⅓:

```
points = base × (weights.acc × accuracyFactor + weights.spd × speedFactor)
```

### Streak multiplier

A doubling multiplier applied to the points a press adds, driven by
`mode.streakTrigger`:

- **Trigger definitions**
  - `optimal` (Accuracy): the press resolves its target in exactly `par` steps
    (`userSteps === par`).
  - `clear` (Speed): the press clears the board (hits the last target on screen).
  - `none` (Trainee): no streak; keep the legacy flat ×2 clear bonus.
- **Growth & cap:** consecutive triggers double the multiplier and hold at ×8:
  `multiplier = min(8, 2 ** streakCount)` → ×2, ×4, ×8, ×8, …
  (`streakCount` counts consecutive triggering presses, incremented before use.)
- **Applied to:** the total points a press adds (`addedScore × multiplier`).
- **Reset (multiplier back to ×1, `streakCount → 0`):**
  - **Accuracy:** any non-optimal hit resets; a target expiring resets; a life
    loss resets.
  - **Speed:** a target expiring (or life loss) resets. Ordinary non-clearing
    hits are **neutral** — they neither advance nor reset the streak.

**Edge case — multi-target press:** if one press matches multiple targets
(possible when two share a sum value), it counts as a single trigger evaluated
against the resolved sum; for `optimal` it qualifies only if every matched target
was reached at `par`. Collisions are rare; this rule keeps behavior defined.

The current per-hit UI (`HitInfo` / floating "+points") gains the applied
`multiplier` so the HUD can show a ×2/×4/×8 badge.

## Data model & persistence

Bests are tracked **per mode × difficulty**:

```
stats: Record<Mode, Record<Difficulty, { score: number; hits: number }>>
```

- Storage key bumps to `nine.stats.v3`. The previous `nine.stats.v2` (keyed by
  the old difficulty list, under the old scoring model) is **not migrated** —
  scoring changed, so old bests are not comparable and retire. Fresh bests.
- Selected mode persists under a new key `nine.mode.v1`; difficulty continues
  under `nine.difficulty.v1`. Both the last mode and difficulty are restored on
  launch.
- **Trainee** is endless (score grows with time, not skill), so its best is a
  local convenience only and is **excluded from any future global leaderboard**.
  Accuracy and Speed bests are leaderboard-eligible.

## Machine changes (`machines/game.ts`)

- **Config source:** add a `MODES` table + `Mode` / streak-trigger types
  (proposed new file `machines/modes.ts`, imported by `game.ts`), and reshape
  `DIFFICULTIES` to `{ timeoutScale, maxTargets, spawnInterval }`. Add an
  `effectiveTimeout(mode, difficulty)` helper.
- **Context:** add `mode: Mode` (default `accuracy`) and `streak: number`
  (default 0). `stats` becomes the nested `Record<Mode, …>` shape. Default
  `difficulty` → `medium`.
- **Events:** add `{ type: 'SET_MODE'; mode: Mode }` (handled in `menu` and
  `gameOver`, like `SET_DIFFICULTY`).
- **`applyGrid`:** read weights from `MODES[mode]`; compute the press's trigger,
  update `streak`, derive `multiplier = min(8, 2 ** streak)`, and multiply
  `addedScore`. For `mode.streakTrigger === 'none'`, keep the existing flat ×2
  clear bonus. Update per-mode×difficulty best in `stats`.
- **`TARGET_EXPIRED`:** life loss is now gated on the **mode** (`lives: ∞` ⇒ no
  loss, replacing the old `DIFFICULTIES[...].loseLives`); on expiry reset
  `streak → 0`.
- **`freshGame`:** set `lives` from the mode (3, or ∞ for trainee), `streak → 0`.
  `mode` and `stats` are preserved across games (like `difficulty`).

## Loop / hook changes

- **Timeout:** replace `DIFFICULTIES[difficulty].duration` with
  `effectiveTimeout(mode, difficulty)` wherever duration is used (countdown ring
  + `computeHitPoints`).
- **`use-target-spawner`:** spawn interval from `difficulty.spawnInterval`; the
  `ADD_TARGET` concurrency cap from `difficulty.maxTargets` (was fixed `< 5`).
- **Persistence hooks:** `use-persisted-stats` reads/writes the nested shape
  under `v3`; add mode persistence (extend `use-persisted-difficulty` into a
  `use-persisted-mode-difficulty`, or a sibling `use-persisted-mode`).

## UI / selection flow

- **Intro / game-over overlay:** add a **mode selector row above** the difficulty
  pills — one entry per `MODE_ORDER` (icon + label), the selected mode described
  by a one-liner. Difficulty pills stay (now four). The BEST card shows
  `stats[mode][difficulty]` and its label reflects both axes
  (e.g. `BEST · ACCURACY · HARD`).
- **HUD:** show the active streak multiplier (×2/×4/×8) near the score when > ×1,
  reusing the floating-points bonus styling.
- **Trainee HUD:** hearts hidden (or shown as ∞) since lives are infinite.
- Selecting a mode/difficulty persists it; both restore on next launch.

## Top bar (in-game)

Row 1 becomes a three-column layout: **left** = the active mode label in
UPPERCASE tinted with the mode's accent color, with the difficulty beneath it in
lowercase dim text; **center** = `NINE` (muted); **right** = the dots menu button.
Row 2 is unchanged — hearts on the left (hidden in Trainee), digital score +
streak badge on the right.

Example left cluster: `ACCURACY` (indigo) over `medium` (dim, lowercase).

## Run stats (accuracy & speed averages)

Alongside `hits`, the machine accumulates per-hit accuracy and speed factors so
the pause / game-over screens show run averages:

- Context adds `accSum` and `spdSum` (running sums of `accuracyFactor` and
  `speedFactor` over the run's hits), reset each game.
- Averages = `hits > 0 ? round(100 × sum / hits) : 0`, shown as `ACC {n}%` and
  `SPD {n}%` beside the existing `{hits} HITS` on the pause and game-over overlays.
- `machines/scoring.ts` exports `accuracyFactor` and `speedFactor` for the sums.

## Color system

A five-stop blue→red spectrum sampled from the countdown pie's transition
(`APP_BLUE → APP_RED`):

`SPECTRUM = ['#4C7EFF', '#7273D2', '#9969A5', '#BF5E78', '#E5534B']`

- **Mode accent** (mode pill + top-bar mode label): trainee `#4C7EFF`, accuracy
  `#7273D2`, speed `#E5534B`, arcade `#9969A5` (dimmed while locked).
- **Difficulty accent** (difficulty pill): easy `#4C7EFF`, medium `#7273D2`, hard
  `#BF5E78`, extreme `#E5534B` — cool→hot, echoing the countdown (harder = redder).

These are dynamic per-item colors, applied as inline `color`/`backgroundColor`
(not token classes). Modes and difficulties intentionally share the one spectrum.

## Mode descriptions & Arcade placeholder

Each mode has a one-line description shown under the mode switcher on the
intro / game-over screen (reflecting the selected item):

- trainee — "Learn the ropes — no lives, no rush."
- accuracy — "Fewest moves win. Precision over speed."
- speed — "Race the clock. Fast hits build big combos."
- arcade — "Levels, bonuses, sidequests."

**Arcade** appears in the mode switcher as a **disabled** chip with a `SOON` tag.
It is **not** a `Mode` in the machine — it's a UI-only display entry (accent
dimmed); selecting it is a no-op, though its teaser description still shows.

## Files touched

- `machines/modes.ts` *(new)* — `Mode`, `MODES`, `MODE_ORDER`, streak-trigger
  type, `effectiveTimeout`.
- `machines/game.ts` — context (`mode`, `streak`, nested `stats`), `SET_MODE`,
  `applyGrid` streak/weights, `TARGET_EXPIRED`/`freshGame` mode-based lives.
- `machines/scoring.ts` — `computeHitPoints` takes `weights`.
- `constants/storage.ts` — `STATS_KEY` → v3, add `MODE_KEY`.
- `hooks/use-persisted-stats.ts` — nested shape, drop v2 migration.
- `hooks/use-persisted-*.ts` — persist mode alongside difficulty.
- `hooks/use-target-spawner.ts` — spawn interval + max targets from difficulty.
- `components/overlays/menu-overlay.tsx` — mode selector row, per-mode×difficulty
  BEST card.
- `app/(tabs)/index.tsx` — thread mode + effective timeout, streak HUD badge,
  trainee hearts handling.

## Verification

1. `pnpm check` green (machine/context/event types updated).
2. Each mode playable at each difficulty; timeouts and concurrency match the
   tables.
3. **Accuracy:** consecutive par hits build ×2→×4→×8 (capped); any non-par hit or
   expiry drops to ×1.
4. **Speed:** consecutive board-clears build ×2→×4→×8 (capped); expiry resets;
   ordinary non-clearing hits don't change the multiplier.
5. **Trainee:** endless, no life lost on expiry; legacy ×2 clear bonus intact.
6. Bests are stored and shown per mode × difficulty; changing mode swaps the BEST
   card; both mode and difficulty persist across a reload.

## Appendix — future modes (not in Spec 1)

Captured so the framework leaves room; each is its own future spec.

- **Daily Challenge** — one fixed daily seed, identical target sequence for
  everyone, one attempt/day, global leaderboard. Strong social/replay hook;
  pairs with the planned backend. *(Recommended next.)*
- **Blitz** — fixed 60s, no lives, maximize score. Small, leaderboard-friendly.
  *(Recommended next.)*
- **Survival** — one life, no difficulty pick, continuously ramping timeout.
- **Puzzle** — untimed, curated/generated boards solved in ≤ par steps.
- **Arcade** — levels, bonuses, sidequests. Its own large spec.

## Open / tunable parameters

Base timeouts, blend weights, difficulty scales/concurrency/spawn intervals, the
×8 cap, and the default mode/difficulty are all tunable and expected to be
balanced during implementation and playtesting.
