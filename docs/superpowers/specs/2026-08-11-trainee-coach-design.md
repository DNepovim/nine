# Trainee Coach — Design

Date: 2026-08-11

## Goal

Trainee shows a learner what happened — hits, the last hit's accuracy and speed,
confetti and a word when a hit was clean. What it never says is _why_ a hit went
badly, and that is the one thing a practice mode owes its player.

A run of 40% hits tells them they are wasting moves. It does not tell them they
are tapping a key eight times where one swipe would do, or that they opened the
route on the ×1 key with 40 of sum still to cover.

Give Trainee a coach: watch what the player does, and say something useful while
there is still a target on the clock.

It coaches; it does not solve. Nothing it says ever names the key to press or the
value to set — the player keeps doing the thinking, which is the whole point of
practising.

## The signal

`computePar(grid, target)` (`machines/scoring.ts:23`) is an exact DP returning the
minimum number of steps from any grid to any target. Today it is called twice: when
a target spawns, and when a hit resets the reference for the survivors.

Calling it once more — after every press — turns it into a live distance, and the
delta across a press is the whole analysis. A press that fails to shorten the route
is exactly the press that costs accuracy.

A press **helped** when it got the player closer to _any_ live target:

```ts
improved = targets.some((t) => parAfter(t) < parBefore(t))
```

`any`, not the minimum of the board. Trainee keeps whatever difficulty was last
selected — its menu slot has no difficulty selector, and `ADD_TARGET` reads the
raw difficulty — so up to four targets can be in the air, and there is no way to
know which one the player is routing toward. Taking the minimum would flag a press
that legitimately advanced the second-nearest target. `any` complains only when a
press got them no closer to anything on the board, which cannot be a false
accusation.

Measured cost: 0.029 ms per `computePar` call, so 0.115 ms for a four-target board.
Ten times that under Hermes on a slow phone is still a millisecond, and it happens
on a press rather than on a frame.

## The four verdicts

| Verdict   | Rule                                                          | Fires     |
| --------- | ------------------------------------------------------------- | --------- |
| `lost`    | 3 consecutive presses that helped nothing                     | mid-route |
| `tapping` | 4+ presses in a row on one key, same direction                | mid-route |
| `coarse`  | opening press of a route on a ×1/×2 key with ≥ 12 of gap left | mid-route |
| `debrief` | a hit whose accuracy was not perfect                          | on hit    |

### lost

A single unhelpful press is a fumble, and the player knows. Three in a row means
they have lost the route, and that is the teachable moment. Speaking on every
unhelpful press would have the line talking continuously through a beginner's
first targets, and a line that always talks stops being read.

It fires **once** per counter cycle rather than on every press past the third. The
counter resets on a press that helped, on a hit, and on a target expiring.

### tapping and coarse

Both restate advice the game already gives in `constants/tips.ts` — swipe to 0 or 9
instead of tapping through, and set the coarse keys before fine-tuning. A tip read
in the menu is abstract; the same sentence arriving on the fourth consecutive tap
is not.

They fire the moment they are detected, mid-route, rather than waiting for the hit.
"Swipe instead of tapping" means something while the player is tapping and nothing
two targets later.

A tap run is consecutive `PRESS` events on one index carrying the same delta. Any
other key breaks it, and so does a swipe — a swipe is a `SET_CELL`, not a `PRESS`.
That is what makes the habit detectable at all: the run only ever grows while the
player is doing the thing being named.

`coarse` looks at the opening press of a route — the first press after that target's
reference reset, meaning its spawn or the last hit, which is exactly when the
machine recomputes `par` — and compares the pressed key's weight against the gap. A
×1 press with 40 still to cover is 40 presses of work where a ×9 covers most of it
in one. No extra DP is needed for this: the gap and the weight are both to hand.

The gap is measured to the target with the smallest `|value − sum|`, not to the one
with the smallest par. This is the only place the coach picks a single target out of
the board, and it picks by raw distance because that is what decides whether a
coarse key is the right opener — par answers a different question.

Each habit then goes quiet for 8 resolved targets. Trainee has infinite lives, so
a run ends only when the player leaves — a hundred targets is possible. Once per
run would leave a long run uncoached after the first minute; once per occurrence
would nag. A cool-down measured in targets is the shape that fits an endless mode.

### debrief

The stat row already shows `ACCURACY 40%`. What it cannot say is what 40% was made
of. "12 steps — 4 would do" says it in four words.

This needs the exact figures, so `HitInfo` gains `steps` and `par`. Both already
exist as locals in `applyGrid` — `userSteps` and `t.par` — so this is two fields on
a type and two more entries in an object literal, not new computation.

Past 99 steps the line falls back to fixed words rather than overflowing the width.
That is not a realistic hit, but the cap is one branch and the alternative is text
running off a 256px board.

## Who gets the line

`HitPraiseLine` is one line of reserved height under the stat row, and it stays one
line. Four things now want it, so priority decides, highest first:

1. **Clean-hit praise** — it arrives with a confetti shower, and the coach must not
   talk over a celebration
2. **Habit** — the most actionable lesson, so it outranks the debrief on a hit that
   was not clean
3. **Debrief**
4. **lost**

The ladder is resolved in two places, split by what each half knows. The reducer
owns the three mid-route verdicts and returns at most one, preferring a habit to
`lost` when a press triggers both — that keeps the interesting arbitration pure and
tested. The hook layers the debrief between them, since the hit's figures arrive on
`hitBatch` rather than from a press.

Praise then wins over all of it, and that part is free: praise and coaching are
already exclusive on a hit, because `cleanHitReason` returns non-null exactly when
the shower runs. So at the call site the whole rule is one operator —
`celebration.message ?? coachLine` — which matters because `GameScreen` is at its
cognitive-complexity ceiling and every branch there is expensive.

A habit or debrief arriving on a clean hit is discarded rather than queued. A
celebration is not the moment to correct someone, and holding a correction to
deliver it three seconds late would attach it to the wrong press.

Coach messages hold for 3 s against praise's 4 s. Praise is tied to the shower's
length; a mid-route hint wants to clear before the player's next press makes it
stale.

`HitPraiseLine` itself does not change. It already takes `string | null`, already
holds its last words through the fade, and already reserves its height whether or
not there is anything to say. The line simply has more to say.

## Structure

The split follows what the mode already does: a pure module holding the rules, a
pure word-pool, and a thin hook owning the timer.

**`machines/coach.ts`** — a pure reducer. `coachReducer(state, facts)` takes the
counters and what one press did, and returns the next counters plus a verdict or
null. Every threshold and every rule lives here, so all the interesting behaviour
is testable without React. It sits in `machines/` beside `scoring.ts` rather than in
`lib/` because it reasons about grids, targets and par — the game's own vocabulary.

**`lib/coach-lines.ts`** — verdict to words. Pool per verdict, roll passed in, the
same shape as `praiseFor` and `messageFor`, so the choice stays pure and the
randomness lives at the call site.

**`hooks/use-trainee-coach.ts`** — holds the reducer's state in a ref, feeds it
presses, owns the dwell timer, returns `string | null`. Gated on
`inRun && mode === 'trainee'`, the same condition as `useHitCelebration`.

**`machines/game.ts`** — `HitInfo` gains `steps` and `par`; `buildPressGrid` and
`buildSetGrid` gain `export`.

Exporting the two builders is what keeps the analysis synchronous. The screen calls
`notePress(index, delta)` beside its existing `send`, at which point the snapshot
still holds the pre-press grid; the hook applies the press itself to get the grid
after. The alternative — waiting for the next snapshot and diffing — would put the
analysis in an effect chasing a render, and would have to disentangle the case where
the press was a hit and the machine already reset every survivor's par. Reusing the
machine's own two-line wrap arithmetic avoids both, and avoids a third copy of it.

The hook reads the debrief off `hitBatch` rather than from `notePress`, since the
hit's figures are the machine's to report.

```
machines/coach.ts            + test   the reducer and every threshold
machines/game.ts                      HitInfo gains steps/par; export the grid builders
lib/coach-lines.ts           + test   verdict → words
hooks/use-trainee-coach.ts            press feed, dwell timer, current line
app/(tabs)/index.tsx                  notePress at the dial, `praise ?? coach`
components/overlays/how-to-play-overlay.tsx  one fact on the Trainee card
```

No new dependency and no new storage key. The only component touched is the guide,
and only for a line of copy — `HitPraiseLine` and `TraineeStats` are left alone.

## Thresholds

Named constants in `machines/coach.ts`:

| Constant                 | Value | What it decides                            |
| ------------------------ | ----- | ------------------------------------------ |
| `LOST_PRESSES`           | 3     | unhelpful presses before `lost` fires      |
| `TAP_RUN`                | 4     | same-key presses before `tapping`          |
| `COARSE_GAP`             | 12    | gap that makes a fine key the wrong opener |
| `FINE_WEIGHT`            | 2     | which keys count as fine                   |
| `HABIT_COOLDOWN_TARGETS` | 8     | resolved targets before a habit repeats    |
| `COACH_MS`               | 3000  | how long a coach line holds                |

`COARSE_GAP` is the one genuine heuristic here and the most likely to want tuning
by feel. 12 is the point past which a ×9 or ×6 press is unambiguously the better
opener; below it, a fine key can be the right call and the coach would be wrong.

## Testing

`machines/coach.test.ts` — the reducer, which is where every rule lives:

- three unhelpful presses fire `lost`; two do not
- `lost` fires once, not again on the fourth unhelpful press
- a helping press, a hit, and an expiry each reset the counter
- a press that helps only the second-nearest target is not flagged
- four same-direction presses on one key fire `tapping`; a swipe breaks the run
- a fine-key opener fires `coarse` at gap 12 and not at gap 11
- `coarse` measures the gap to the nearest target by value, not by par
- the cool-down blocks a repeat of the same habit inside 8 resolved targets
- a press that triggers both a habit and `lost` returns the habit

`lib/coach-lines.test.ts`:

- every line is ≤ 24 characters, the cap the praise lines already keep
- every verdict has a non-empty pool
- the debrief renders its figures, and falls back to fixed words past 99 steps

The hook and the wiring are presentation, which the code guide leaves untested.

By eye: play Trainee and confirm the line stays quiet through a competent route,
names the tap habit on the fourth tap of a walk to 9, says what a wasteful hit cost,
and never speaks over a confetti shower.

## Decisions worth naming

- It coaches, never solves. No hint names a key or a value.
- "Helped" means closer to any target, deliberately forgiving over a crowded board.
- Habits speak mid-route; only the debrief waits for the hit.
- A correction arriving on a clean hit is dropped, not queued.
- Trainee only, and only while playing.
- No memory between runs — counters reset with the run. A habit worth naming shows
  up within a couple of targets, so persistence would buy little for a storage key
  and a hydrate path.
- No toggle. Trainee exists to teach; a player who does not want teaching has two
  other modes.

## How to Play

Controls, targets, timers, difficulty, scoring, streaks and lives are all unchanged.
What changes is what Trainee _says_, which is player-visible enough to belong in the
guide: the Trainee `ModeCard` gains a third fact — that a line under the stat row
tells you when a move was wasted and what a hit cost.

The TIPS & TRICKS list is untouched. The coach restates two of those tips at the
moment they apply, which is the point; the wording stays in `constants/tips.ts` as
the single source and the coach's short lines are its own.
