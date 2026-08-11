# Trainee Mode — Design

Date: 2026-08-11

## Goal

Trainee is the practice mode, and it currently wears the competitive mode's
clothes: it keeps a personal best, celebrates beating it, hides the per-hit
feedback a learner needs, and shows a score on the pause screen that means
nothing without a board to compare against.

Six changes, all confined to Trainee.

## The first-hit confetti

Diagnosed before anything was changed.

Not a coding defect. `bestByScore` (`machines/game.ts:139`) folds every hit into
`stats[mode][difficulty]`, keeping the highest score ever reached — Trainee
included. `useAnnouncements` snapshots that best when a run starts and fires the
`record` celebration when the live score passes it.

Because practice runs are short and often abandoned, the stored Trainee best is
low. The first hit of a later run clears it, and the confetti fires. Accuracy and
Speed hide the same mechanism because real runs set a high bar.

**Fix: Trainee stops tracking a best.** The fold skips Trainee, so
`stats.trainee.*` stays at zero.

That alone is not enough. Players already have a Trainee best on disk, and it
would keep firing.

So `HYDRATE_STATS` drops the persisted Trainee entry rather than merging it,
keeping the machine's zero. Handling it at the load boundary rather than at the
read site means every consumer sees the same thing — no caller has to remember a
special case — and it avoids bumping the storage key, which would take Accuracy
and Speed history down with it. The stale value stays on disk, harmless, and is
overwritten the next time stats are persisted.

Nothing else reads Trainee's best: it has no board, and the menu's high-scores
panel is Accuracy and Speed only.

## Per-hit celebration

Trainee celebrates the hit rather than the run. A hit qualifies when it lands at

- **100% accuracy** — `accFactor === 1`, meaning exactly optimal steps, or
- **60% or more speed** — `spdFactor >= 0.6`, the fraction of the clock left.

Either is enough. The predicate lives in `machines/scoring.ts` beside
`accuracyFactor` and `speedFactor`, with Vitest cases, because it is the one
piece of this that is pure logic and worth pinning down.

Half the pieces of a record celebration: `Confetti` gains a `density` prop —
`full` for the existing 80, `half` for 40 — rather than a raw count, so the
call site says what it means and the numbers stay in one place.

The shower is keyed on `hitBatch.seq`, so each qualifying hit replays it from the
start rather than reusing a shower already in flight.

### Saying what it was for

Confetti alone leaves a learner guessing which half of the hit earned it, which
is the one thing the mode exists to teach. A line under the stat row says what
they did: "No wasted moves", "Most of the clock left", "Shortest route, fast
too".

It names no figure. The stat row directly above already shows that hit's accuracy
and speed, so repeating them would spend the width saying twice what is on screen
already. What a number cannot say is what it means, and that is the line's whole
job.

Short on purpose, capped at 24 characters by a test — it is read at a glance
mid-run, with a target on the clock.

`cleanHitReason` returns which of the two the batch earned, or both — a batch can
manage both across two hits without either hit managing both, and that still
deserves the both-line. `lib/hit-praise.ts` holds a pool per reason and picks
from it with a roll passed in, the same shape as `messageFor` for announcements,
so the choice stays pure and the randomness lives at the call site. The roll
happens once when the celebration starts, so a re-render cannot reword the praise
mid-read.

The line reserves its height whether or not there is anything to say, so praise
arriving and leaving never nudges the board. It rises into place and fades away
flat, and holds its last words through the fade rather than vanishing at the
moment the celebration ends.

The hook returns `{ seq, message }` rather than a nullable object. The caller
reads both fields, and an optional shape would have pushed two more branches into
a screen already at its cognitive-complexity ceiling.

## Stat row under NINE

Hits, then the last hit's accuracy and speed as percentages. Trainee only.

Read from `hitBatch.hits`, whose entries already carry `accFactor` and
`spdFactor`. The **last** hit rather than an average of the batch: a batch holds
every target cleared by one press, and a learner wants to know about the press
they just made.

Dashes before the first hit, since there is no hit to describe — a dash rather
than 0%, which would read as a bad hit instead of no hit.

`TraineeStats` takes the batch rather than two pre-picked numbers. That is a
deliberate exception to the code guide's prefer-primitives rule: choosing the hit
and handling its absence is the component's own business, and doing it at the
call site pushed three more branches into a screen already at its complexity
ceiling.

## Menu button

Trainee has no best-scores strip, so everything below it sits about 25px higher —
but the menu button is absolutely positioned and stayed put, leaving it low
relative to the NINE row it is meant to sit level with.

`BestScoresLine` exports its total height (14px row + 4px gap + 1px rule + 6px
margin), and the button's `top` becomes a value map over the mode with Trainee's
entry that much smaller. Deriving it beats hard-coding a second number: the
comment already at the button says to bump it if the strip's height changes, and
this makes that automatic. A map rather than a ternary because that is the
codebase's idiom for picking a value per mode — and because `GameScreen` is
already at its cognitive-complexity ceiling.

## Only the digit animates

Trainee's dial keys stack three things: the weight hint (`×2`), the value, and
the key's maximum (`9 × weight`). All three sat inside the one `Animated.View`
carrying the change animation, so every press swung the whole stack — including
two hints that are fixed facts about the key and have no business moving.

The animation moves onto the digit's own `Animated.Text`. No mode check is
needed: outside Trainee that wrapper holds nothing but the digit, so the result
there is pixel-identical.

## Paused screen

No score readout in Trainee — a score with no board to measure it against is
noise. `ModeTips` takes its place, the same rotating panel the menu shows in the
Trainee tab, so a pause becomes a chance to learn something.

## Files

```
machines/scoring.ts          + test   the qualifying-hit predicate
machines/game.ts                      skip the fold, drop the hydrated Trainee best
components/game/trainee-stat.tsx      one labelled figure
components/game/confetti.tsx          density prop
components/game/best-scores-line.tsx  export the strip height
components/game/trainee-stats.tsx     the stat row
hooks/use-hit-celebration.ts          which hit fires a shower, and for how long
components/overlays/paused-overlay.tsx  tips instead of a score
app/(tabs)/index.tsx                  wiring
```

## Testing

`machines/scoring.test.ts` gains the predicate: an optimal hit qualifies, a fast
hit qualifies, one that is neither does not, one that is both qualifies once, and
the 60% boundary is inclusive.

The rest is presentation and wiring, which the code guide leaves untested.

By eye: play Trainee and confirm no confetti on the first hit, confetti on a
clean hit at roughly half the density of a record shower, the stat row filling in
after the first press, the menu button level with NINE, and tips on the pause
screen.

## Decisions worth naming

- 60% is inclusive.
- 100% accuracy means exactly optimal steps, not a rounded 99.5%.
- The row reports the last hit, not a running average.
- Trainee keeps writing nothing to stats rather than having its stats wiped, so
  Accuracy and Speed history is untouched.

## How to Play

Nothing here changes controls, targets, timers, difficulty, scoring, streaks or
lives. What changes is what Trainee _shows_ and _celebrates_. The guide's Modes
section describes Trainee as the mode with no timer and no lives, which is still
true, so it stays as it is.
