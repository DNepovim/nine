# Achievements — Design

Date: 2026-09-17

## Goal

Give the player a third kind of reward: one that is **permanent, earned once, and
measured against their own history** rather than against other players.

## The gap

Nine rewards the player in exactly two ways today, and both are the same shape.

A **record** is a score crossing a bar — announced mid-run on the best-scores
bar by `useAnnouncements`, celebrated, and then gone. A **medal** is a podium
standing on a board (`useMyMedals`, `MedalLine`), which a rival can take back
tomorrow.

Both are score-shaped, both are transient, and both only speak to Accuracy and
Speed. Nothing in the app notices that a player has landed their thousandth hit,
played seven days running, or posted a score on every board. Worse, a new player
has nothing to aim at at all: every reward the app offers is gated behind a score
good enough to reach a leaderboard, which is exactly the score they do not have
yet.

An achievement is the missing third kind. It is never lost, so it cannot be
contested; it is measured against the player alone, so it works offline and works
for a player nobody has ever heard of.

## Domain language

**achievement** — permanent, earned once, never lost. Distinct from a **medal**
(a board standing, losable) and a **record** (a score crossing). Achievements are
_earned_ or _unlocked_, never _won_.

## The data the app does not have

`Stats` (`machines/game.ts`) holds best score and hits per mode × difficulty and
nothing else. It is deliberately versioned on _scoring mechanics_ — `STATS_KEY`
went to `v4` because a best set under the old rules is not comparable to one set
under the new ones — which means it is wiped whenever scoring changes.

Career totals must survive that. A thousand lifetime hits is a thousand lifetime
hits whatever the points were worth at the time. So this is a **separate store**,
`lib/career.ts` under `nine.career.v1`, not a widening of `Stats`:

```ts
type Career = {
  runs
  hits
  points
  strikes
  bestStreak
  bestCleanHits
  personalBests
  longestRunMs
  boardsPlayed
  lastDay
  dayStreak
  bestDayStreak
  multiplayerRuns
  multiplayerWins
  heldSince: Record<string, string>
}
```

`foldRun(career, run)` is a pure reducer over one finished run. `hooks/use-career.ts`
mirrors `use-persisted-stats.ts` exactly, **including its `mayPersist` guard** — a
read that failed knows nothing about the player's history, and writing on the
strength of it replaces that history with defaults (the bug fixed in `4cfc656`).
Career totals are strictly more painful to lose than one best score.

One machine change: `Context.streak` resets on every break, so the run's _longest_
streak is not recoverable. Add `maxStreak`, reset in `freshGame`, `Math.max`ed
wherever `streak` climbs.

## Timing: why the step function, again

Achievements unlock _during_ a run; `foldRun` folds the run into the career _at_
game over. Measuring a live run against a total that already contains it is the
same bug class `lib/announcement-run.ts` exists to prevent — every announcement
bug the app has had was a question of _when_ a value was read.

So `lib/achievement-run.ts` copies that shape. Freeze the career as the run
begins, measure the frozen copy plus the run so far, never fire an id twice, and
run one final pass **after** `foldRun` for the things only a finished run knows
(run counts, day streaks, run length).

### UNSCATHED and the impossible achievement

"Finish a run without losing a life" cannot be earned. A run _ends_ because the
lives ran out — that is the terminating condition in every mode that has lives,
and Trainee, which has none, never reaches game over at all.

So the clean stretch is a property of a run in progress, never of a finished one.
`AchievementPhase.cleanHits` counts hits landed while `lives` is still full and
freezes the moment the first one goes. The achievement is "reach 25 hits before
losing a life", which is reachable and still means what it was meant to mean.

### The HELD family and `heldSince`

Six achievements, one per board, earned by holding that board's all-time record
for seven straight days. The app keeps no history of the boards, so "for seven
days" is not answerable from anything that exists.

`Career.heldSince` is the smallest thing that makes it answerable: a map from
`'mode:difficulty'` to the moment we _first observed_ rank 1 there, set when
`useMyMedals` reports it and cleared the instant it does not. Losing the board
and retaking it starts the clock over, which is the honest reading of "held".

## Colour

Achievements need a scale nothing else owns, and every hue was spoken for: modes
run blue → violet → pink → red → amber, `GOLD_SCALE` marks a board record you
_currently hold_, `#0D9488` teal means multiplayer, `GRAYSCALE` means a record
just left you.

Green is the one hue the app never uses, and it is also the one that reads
"unlocked" without being taught. That is precisely the distinction from gold:
**gold is held, green is kept**.

```ts
ACHIEVEMENT_SCALE = ['#8DE86B', '#3FBF5F', '#C6F5A6', '#1E9448']
ACHIEVEMENT_INK = { light: '#217A3D', dark: '#7FE08A' }
```

Like gold, the scale is a background palette and cannot carry text on the app's
surfaces, so the ink pair is separate — same reason and same shape as `GOLD_INK`.
The bar runs `[1] → [0]` under `#12210F` ink (≈7.8:1 on the darker stop, ≈11:1 on
the lighter); particles take all four.

The trap is the painted game-over screens. `GOLD_SCREEN_TOKENS` and
`MODE_SCREEN_TOKENS` re-bind every token for that subtree, and a colour computed
in JS cannot see them — the problem `GOLD_DIM_INK` already exists to solve for the
HOME icon. On a painted screen the achievement chips drop the green and take the
ordinary primary ink plus `ON_GOLD_LABEL_SHADOW`.

## The announcement

One new `AnnouncementId`, not forty. The achievement's title is the variable part,
and `messageFor` already substitutes `{name}` for exactly this reason — the title
goes in upper-cased, so it is the only thing shouting in the bar, the way a
rival's nickname is.

Pool: `['Unlocked: {name}', '{name} unlocked', 'Achievement: {name}']`.

`MAX_MESSAGE_LENGTH` is 40 and test-enforced; `"Unlocked: "` costs 10, so **titles
are capped at 22 characters**, asserted in `lib/achievements.test.ts` so the
catalogue cannot grow a line the bar will clip.

### Priority and the queue

Today a rival announcement is _dropped_ when one of your own holds the bar. That
is right for news — by the time yours clears, theirs is old. It is wrong for an
achievement, which happens once in a player's life and must not be silently
swallowed.

So the ladder is: your own record preempts an achievement, an achievement preempts
a rival, and unshown achievements **queue** and drain on the dismissal timer. The
queue is capped at 3 per run — they are all listed on the game-over screen anyway,
and a player who unlocked six does not want twenty-five seconds of bar.

Rejected: **a dedicated achievement toast**. It has room for a description and
never contends for the bar, but it is a second announcement system with its own
entrance, its own timing and its own place in the z-order, and every rule above
would have to be written twice. The bar already solves "something happened, hold
it for five seconds, then give the scores back".

## Where they show

**Intro** — a progress strip directly under `MedalLine`: ten segments, a count,
a chevron into the full screen. Unlike `MedalLine` it is **never silent**. At 0/48
it is the feature's front door and has to advertise itself.

**The achievements screen** — a fifth `MenuOverlayName`, a `<Screen overlay>` like
How to Play, grouped and scrolled. Earned rows carry the emblem and the green;
locked rows are dimmed with a progress bar where there is something to count;
secret rows read `???` until earned.

**Game over** — the achievements _this run_ earned, as chips between `RunStats`
and `HighScores`: under the run's own numbers, above the board, which is the right
rank for "what this run earned you, permanently". Latched on the game-over edge
beside `runMedals` and `runScreen`, for the same reason — the dying sequence flies
the title up while this screen is already mounted, and a value moving underneath
would change what the player is reading mid-flight.

## Sync

Local is the source of truth for everything on screen: the strip and the list must
work offline, and an unlock must never wait on a round trip. Supabase is the backup
that survives a reinstall or a second device.

```sql
create table achievements (
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
```

No `update`, no `delete` grant: an achievement is permanent, so re-earning is an
upsert that ignores duplicates — which is also what makes an offline replay safe.
Reconciliation is a **union** keeping the earlier `earned_at`; since nothing is
ever revoked there is no conflict rule to get wrong.

Ids are `text`, not an enum, so adding an achievement is a client release with no
migration.

## The catalogue

48 entries in nine groups: first steps (6), Accuracy scores (6), Speed scores (6),
mastery (6), endurance (8), boards (5), held boards (6), with friends (3), secret (2).

Three shaping rules:

- **Scores split by mode.** Accuracy and Speed ask for opposite things, so they get
  separate ladders in separate voices — STEADY HAND → SURGEON → PERFECTIONIST
  against FAST START → AFTERBURNER → TERMINAL VELOCITY. A shared "score 1 000"
  would flatten the one distinction the modes exist to draw. Trainee gets none: it
  keeps no board, and its reward is already the coach.
- **No emblem the app already owns.** 🦉 and 🦅 are the game-over screen's Extreme
  all-time birds; 👑 is the crown, so the one achievement wearing it is the one
  that _is_ the crown (both Extreme all-time boards at once).
- **Nothing that rewards luck.** Target values are spawned, so "hit a target worth
  300" measures the spawner, not the player.

`ACHIEVEMENTS` is `as const satisfies Record<AchievementId, AchievementDef>`, and
`RULES` / `PROGRESS` are the same over the same union — so adding an id without
deciding what it means, what it looks like and how it is earned is a compile error,
exactly as `announcement-effect.tsx` and `announcement-style.ts` already work.
