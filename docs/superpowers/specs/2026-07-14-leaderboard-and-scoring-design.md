# NINE — Scoring model + Leaderboard backend

**Date:** 2026-07-14
**Status:** Approved design, ready for implementation planning

## Context

`nine` is an Expo (React Native + web PWA) game. The dial is a 3×3 grid of digits 0–9; the
weighted sum `Σ value·(row+1)·(col+1)` must match falling "target" numbers before their
per-difficulty countdown expires. Today the only metric is a single hit count (`gameScore`),
persisted device-locally in AsyncStorage; there is no backend.

Two goals, sequenced:

1. **Richer scoring (client-only, ships first).** Replace the single number with two — **Hits**
   (raw matches, today's number) and **Score** (a composite rewarding speed and step-accuracy).
2. **Global leaderboard backend.** A cross-platform (web + native) Supabase backend storing best
   scores and ranking players globally, with anonymous identity and prepared for a future
   friends leaderboard and multiplayer.

Confirmed decisions during brainstorming:

- Leaderboard = **global only** for v1, **per difficulty** for Easy/Medium/Hard/Extreme
  (Trainee is endless practice → no board).
- Ranked by **Score**, with **Hits** shown alongside.
- Identity = **anonymous-first** (server-issued), account linking optional/later.
- Anti-cheat = **minimal** (authenticated writes + RLS; client score trusted).
- Accuracy curve = **gentler difference-based** (below).

---

## Phase 1 — Scoring model (client only)

Ships independently of the backend and should be built first.

### Two counters per game

- **Hits** — `+1` for every matched target (identical to today's `gameScore`).
- **Score** — accumulates per-hit points blending **accuracy (⅔)** and **speed (⅓)**.

### Tracked per target

For each active target we track, relative to its **reference moment**:

- **reference grid** — the dial snapshot at the reference moment.
- **userSteps** — count of button changes (a `PRESS` ±1, or a `SET_CELL` →0/→9) since the reference.
- **par** — minimum steps from the reference grid to the target (computed below), fixed at reference time.

**Reference moment** of a target = the later of _(the target spawned, the last time any target was hit)_.
Hitting any target **resets the reference grid + userSteps of every still-active target** to "now".

### `par` — optimal steps (exact, cheap)

Because each step changes exactly one button and the final sum depends only on final button
values, minimum steps **decompose per button**, so `par` is a small DP rather than a search.

**Per-button cost table** `cost(a, f)` — fewest steps to move one button from `a` to `f` using
{`+1`, `−1` (both wrapping 0↔9), `→0`, `→9`}:

```
cost(a, f) = 0                                  if a == f
           = min( min(|f−a|, 10−|f−a|),         // ±1 either direction, with wrap
                  1 + f,                         // →0 then step up to f
                  1 + (9 − f) )                  // →9 then step down to f
```

From a fresh all-zero dial the per-value cost is `[0,1,2,3,4,5,4,3,2,1]` for `f = 0..9`
(e.g. `→9` is 1 step; reaching 8 is "→9 then −1" = 2).

**DP for par.** Weights `wᵢ = (row+1)(col+1)` = `[1,2,3, 2,4,6, 3,6,9]`. With reference values `aᵢ`:

```
par = min over fᵢ∈0..9 of  Σ cost(aᵢ, fᵢ)   subject to   Σ wᵢ·fᵢ = target
```

Compute via DP across the 9 buttons over the weighted-sum axis `0..324`
(`dp[i][s]` = min steps using first `i` buttons to reach partial sum `s`). ≈ 9·325·10 ops — exact, instant.
If `target` is unreachable in the DP (shouldn't happen for 0..324) treat `par` as unavailable and
fall back to `effectivePar = 1`.

### Per-hit points

```
effectivePar   = max(par, 1)                                        // a hit always costs ≥ 1 press
excess         = max(0, userSteps − effectivePar)
accuracyFactor = max(0, 1 − excess / (effectivePar + 2))            // gentler curve; 1 = optimal
speedFactor    = clamp(timeLeft / duration, 0, 1)                   // 1 = instant, 0 = buzzer
hitPoints      = round( BASE · (2/3 · accuracyFactor + 1/3 · speedFactor) )   // BASE = 1000 (tunable)
Score += clearBonus ? 2 · hitPoints : hitPoints
Hits  += 1
```

- `duration` = the target's countdown by difficulty (easy 20s / medium 15s / hard 10s / extreme 7s).
- `timeLeft` = seconds remaining on that target when hit.
- `BASE` is a single tuning constant.

**Worked example** — fresh dial, `target = 12`, medium (`duration = 15`):

- `par = 2` (e.g. bottom-right w9 →1 [cost 1] + a w3 button →1 [cost 1]; no single button reaches 12 at cost 1).
- Clean: `userSteps=2`, `timeLeft=9` → `accuracy = 1 − 0/4 = 1.0`, `speed = 0.6` →
  `hitPoints = 1000·(0.667·1 + 0.333·0.6) = 867`.
- Sloppy: `userSteps=5`, `timeLeft=3` → `accuracy = 1 − 3/4 = 0.25`, `speed = 0.2` →
  `hitPoints = 1000·(0.667·0.25 + 0.333·0.2) = 233`.

### Clear-the-board bonus + immediate respawn

When a hit removes the **last active target** (0 remain after the match):

1. **Immediate respawn** — spawn the next target right away instead of waiting for the 5s tick, and
   restart the 5s spawn cadence from that moment (no near-instant double spawn).
2. **Double points** — `clearBonus = true` for that hit → `Score += 2 · hitPoints`. `Hits` still `+1`.

If one press matches multiple same-valued targets and empties the board, the doubling applies to the
points earned by that clearing press.

### Persistence (local)

New versioned key **`nine.stats.v2`**:

```
{ easy: { score, hits }, medium: { score, hits }, hard: { score, hits }, extreme: { score, hits }, trainee: { score, hits } }
```

`score` = best composite Score for that difficulty; `hits` = Hits from that same best-Score run.
After a game, update a difficulty's entry only when the new **Score** beats the stored `score`.
Migration: if `nine.bestScores.v1` exists, seed each `hits` from it (best-effort) so nothing is lost.
(Trainee is tracked locally but never uploaded — see Phase 2.)

### UI changes

- In-game header: show **Score** prominently and **Hits** secondary (both live).
- Game Over: show final Score and Hits, and the per-difficulty best (by Score).
- Menu "BEST" card: show best Score (and its Hits) for the selected difficulty.

#### Score feedback animation (required)

- On each hit, a floating **`+{hitPoints}`** element spawns just **below the Score readout** in the
  top bar and animates **upward + fades** toward the Score. When it arrives it disappears and the
  **Score counter increments** by that amount — so the Score visibly ticks up as each float merges.
- **Color = the target's countdown color at the hit moment.** With `progress = timeLeft / duration`,
  the float color is `interpolateColor(progress, [0, 1], [APP_RED, APP_BLUE])` — a fast hit floats up
  blue, a last-second hit floats up red (matching the pie). This is a `Text` color, so `interpolateColor`
  applies directly (unlike the SVG stroke case).
- Floats are independent per hit; several can be in flight at once and the Score absorbs them in sequence.
- Implementation note: the displayed Score lags the machine's Score by the float duration (~300–450ms);
  keep the machine value authoritative and animate the displayed number up to it.

#### Clear-bonus flourish (×2)

When a hit clears the board, its float shows the **doubled** value and is emphasized:

- Larger/bolder number with a gold **"×2"** badge and a **scale-pop** as it launches; it keeps the
  time-based color of the hit.
- **Success haptic on native** (`expo-haptics`, already a dependency); no-op on web.
- Kept subtle and on-brand (no screen shake/flash).

### Edge cases

- Target already satisfied at spawn (`par = 0`) → `effectivePar = 1`; a 1-step hit scores full accuracy.
- `userSteps < effectivePar` can't happen in practice (a hit needs ≥1 press); `excess` is clamped ≥ 0.
- Pause: timers already stop; `userSteps`/reference are unaffected by pausing.

### Phase 1 verification

- Unit-test `cost(a,f)` against hand-computed values, and `par` via the DP against small worked cases
  (incl. `target = 0`, `target = 324`, already-satisfied).
- Machine tests: reference reset on hit; `userSteps` counting across PRESS/SET_CELL; clear bonus doubles
  only when board empties; immediate respawn fires and resets cadence.
- Manual: verify Score reacts to speed and to wasted steps as in the worked example; Game Over + best-by-Score.

---

## Phase 2 — Leaderboard backend (Supabase)

Built after Phase 1. Cross-platform via `@supabase/supabase-js` (same code web + native).

### Identity

- First launch → `supabase.auth.signInAnonymously()`; Supabase mints a `uuid` user + JWT, persisted
  (AsyncStorage session storage). Stable, server-verified, zero-signup identity.
- Later (out of scope): `linkIdentity` with Apple / Google to sync across devices — additive, no data migration.
- All writes carry the JWT; RLS ensures a player writes only their own rows.

### Data model

- **`profiles`**: `id uuid PK (= auth.users.id)`, `nickname citext unique`, `friend_code text unique`
  (short, generated now for future "add by code"), `created_at`.
- **`scores`**: PK `(user_id, difficulty)`, `best_score int`, `hits int`, `updated_at timestamptz`;
  `difficulty` ∈ {easy, medium, hard, extreme}. Upsert overwrites only when `best_score` improves.
- **RLS**: public `select` on both (boards are public reads); `insert`/`update` allowed only where
  `auth.uid() = user_id` (scores) / `= id` (profiles). Nickname + friend_code uniqueness via unique indexes.

### Ranking (global now, friends-ready)

- SQL function `leaderboard(p_difficulty text, p_limit int, p_user_ids uuid[] default null)`:
  ranks with `rank() over (order by best_score desc, updated_at asc)`, joins `profiles.nickname`,
  and — when `p_user_ids` is non-null — filters to that set. Global passes `null`; a future friends
  board passes the friend id set. Same table, same query.
- A "my rank" query returns the current user's rank + surrounding rows.

### Nickname flow

- Plays offline exactly as today. The first time a Score would publish (or when opening the board),
  prompt for a nickname — validated for length/allowed chars, **server-unique** (friendly "taken"),
  light profanity denylist (client + server). Editable in Settings. No nickname → boards are view-only,
  the player's score is not published.

### Submission (offline-first)

- Local `nine.stats.v2` remains the source of truth for the player's own numbers.
- When online + authenticated + nickname set, upsert `{ best_score, hits }` for the difficulty after a
  game (or when local best improves). Offline → queue and submit next launch. Best-effort; a failure
  never blocks gameplay. Trainee is never uploaded.

### Anti-cheat / limits (minimal)

- Authenticated writes + RLS + a light submit throttle (e.g. reject updates faster than a small
  interval, or rely on Supabase rate limits). Client Score trusted; determined cheating accepted for now.

### Config

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key is public by design; RLS protects data).

### Future (non-binding)

- `friendships` table (edges between profile ids) + friend-filtered `leaderboard()` call.
- Supabase Realtime (Presence / Broadcast / Postgres changes) as the base for turn-based or light
  real-time multiplayer; authoritative real-time would add a dedicated server later.

### Phase 2 verification

- Anonymous session persists across launches; RLS blocks writing another user's row (manual + SQL check).
- Nickname uniqueness + validation paths (taken, invalid, profanity).
- `leaderboard()` returns correct ranks/ties; "my rank" pins correctly when outside top-N.
- Offline submit queues and flushes; failures never crash or block play.

---

## Sequencing

1. **Phase 1** (scoring model) — its own implementation plan, shippable alone.
2. **Phase 2** (Supabase leaderboard) — its own plan, depends on Phase 1's Score/Hits + `nine.stats.v2`.

## Out of scope (for now)

Friends leaderboards, account linking (Apple/Google), multiplayer, achievements, Trainee board.
