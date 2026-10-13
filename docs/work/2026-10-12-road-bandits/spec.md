# Bandits on the road

Slug: road-bandits
Stage: build
Next: /verify road-bandits
Track: full
Branch: feat/road-bandits
Started: 2026-10-12

## Problem

A way in arcade is a decision and then a formality. Once the sum is dialled the walk
always arrives, so everything that can go wrong in the mode happens at a crossroad — the
clock running out, a walled village — and the road between two places is the one part of
the map that is never anything but travel. Satiety made walking cost something; it did
not make any particular road worth fearing, and a fan of four numbers is still four
numbers with nothing to choose between them but the number.

## Appetite

**A week.** Its own encounter, with its own view, its own beats and its own state on the
map — the siege is the nearest thing the app has and it is a week's worth of machinery.
It names a domain word, it spends hearts, it feeds the hero, and the How to Play has to
explain it. Arcade is behind the `arcade` feature already, so this lands without being
shown to anyone it is not ready for.

## Shape

An **ambush** is a fight on a way rather than at a place. The men are **bandits**, and a
way that has them is **held** — held until the day it is cleared, and remembered by the
map in between.

The player stands at a crossroad and dials one of the numbers hanging at the ends of its
ways. The hero sets off along the way they chose, and part of the way along it — not at
the crossroad, not at the village, out on the open road — it stops. The camera closes the
way it closes on a wall. The hero is in the middle of the canvas with the road running
away under it in both directions, and between five and ten bandits are standing round it
on all sides, each one carrying a number and each one walking in.

They do not arrive in turn the way a siege's warriors leave a gate: they are all there
from the first frame, at their own distances and their own paces, so the nearest one is
the clock and the player can see exactly which one that is. Dialling a bandit's number
cuts it down, with the same stone-and-dust the siege already answers a press with. Each
number is two or three presses, the band a siege draws from — a crossroad asks for one
number and an ambush asks for ten.

One bandit reaching the hero ends it. That costs a heart and the hero is dragged back to
the crossroad it came from, by the retreat the clock already uses. Nothing else is taken:
a heart is the price, and the way's own bite is the walk it did not finish.

Cutting the last one down clears the road. The way pays once — food, a heart, or nothing,
rolled from the way's own seed so a road always pays what that road pays — and then the
rest of the walk runs and the hero lands at its village the way it always would.

And the map remembers. A bandit cut down stays down, so a road fled and walked again is
the same ambush thinner by however many the player got through last time: a hard road can
be worn down over two visits, and the second run at it is a shorter fight. A road cleared
is clear for the rest of the run.

The first time a road is held, nothing says so — that is what an ambush is. From the
moment the player has met them it is drawn as held, so walking it a second time is a
decision about a toll rather than the same trap twice. That is the one place this bends
the mode's own rule that the fan says everything before it is dialled, and it bends it
exactly once per road.

Areas it touches:

- **A new pure module beside the siege** (`machines/ambush.ts`, `constants/ambush.ts`) —
  how many bandits a depth is worth, their numbers, their bearings and paces, what a press
  does to them, which one arrives next, and the reward roll. Pure, seeded, tested, no
  clock, exactly as `machines/siege.ts` is.
- **The map** (`machines/arcade.ts`) — whether a way is held, rolled when the fan is
  grown beside `fortified`; and the bandits still standing on it, written back as they
  fall. The map is already mutated mid-run in one place — `fortified` is cleared when a
  village is taken — and this follows that precedent rather than inventing a second.
- **The run** (`hooks/use-arcade-run.ts`) — the beats of an ambush on `ArcadePhase`, the
  one timer it needs, the heart, the retreat, the reward, and the walk that resumes.
- **The screen** (`components/game/arcade-game.tsx`, plus an ambush field and a bandit
  mark) — the close, the hero centred, the bandits on their bearings with their numbers
  over them, and the way drawn as held on the fan.
- **Framing** (`lib/arcade-layout.ts`) — a frame of its own beside `siegeFrame`. Where
  the hero stops along the way is the stand-off machinery that already exists, which is
  what makes stopping partway cheap.
- **Copy** — the How to Play arcade chapter, which today promises the fan says everything
  and that a siege is the only thing that spends hearts; plus whatever the encounter says
  on screen. Extracted and translated.
- **Domain language** — `ambush`, `bandit` and `held` into the CLAUDE.md table. Both
  words are free across the codebase today; `held` is the one to watch, because a player
  _holds_ a board and a creep is `'held'` — the spec names it or renames it.

Not a mode's business, and so nothing in `modes/` is touched: arcade runs on its own
engine, the way the siege and satiety do. No new feature key either — arcade is already
behind one, and a second key would gate a thing inside a thing nobody has yet.

## In

- The roll that holds a way, and the map state that remembers which bandits are left.
- The encounter: its own view and beats, the hero centred, bandits closing from all round,
  one number each, cut down by the dial.
- One bandit reaching the hero: a heart, and the retreat to the crossroad behind.
- Clearing it: the reward roll paid once, then the rest of the walk.
- A held way drawn as held, from the second time it is seen.
- How to Play, the domain table, the Czech.

## Out

- **Bandits anywhere but on a road.** Not at a crossroad, not in a village, not in a
  siege. They are what a road has that a place does not.
- **Bandits doing anything but walking at you.** No archers, no one breaking into a run,
  nothing stolen, nothing taken but the heart.
- **Any way out of a fight once it is sprung.** No fleeing on purpose, no paying them off,
  no turning back. The dial is the only answer.
- **A third tally on the cards.** Strikes and villages taken are counted; bandits cut down
  is not, this time.
- **Anything in the score.** An ambush pays food, a heart or nothing — never depth, never
  fortune.
- **Multiplayer.** Arcade is alone, and stays alone.

## Rabbit holes

- **Ten numbers live at once.** A siege keeps three warriors on the ground for a reason:
  the dial answers one number at a time, and ten at once is a different reading problem
  from anything the app has shipped. The way round is that they are spread round a full
  circle rather than fanned down one slope, so each number sits in its own place and the
  nearest is obvious. If it still reads as noise, **the count comes down before the
  appetite does** — five to ten is a shape, not a promise.
- **Interrupting a walk.** A walk is one timed beat with the canvas drifting the same
  distance in the same time, and nothing in the run splits a beat today — a pause shifts
  stamps, it does not cut one in half. The way round is the siege's own stand-off: the
  hero already stops partway along a way and holds there for a whole fight, and an ambush
  is that at a different point on the way out. Clearing it runs the rest as a second,
  shorter walk. If the two legs cannot be made to read as one journey, this is the part
  that eats the week.
- **A second camera move.** The close and the open are tuned, and a third framing that
  has to land mid-walk and hand back to a walk is the likeliest thing to look wrong. The
  way round is to reuse the siege's `CLOSE_MS` / `OPEN_MS` and its zoom exactly, and give
  the ambush only its own _frame_ — hero centred — rather than its own motion.
- **The reward that is not one.** A heart rolled for a hero already carrying three is
  nothing at all, which would read as the game forgetting to pay. The roll has to resolve
  against the hero's state, not just the seed.
- **Two deaths in the same second.** A hero fleeing an ambush at one heart while starving
  can lose its last heart twice over. The ambush's loss must go through the same door
  `overrun` already is, rather than ending the run its own way.
- **`held`.** A player holds a board, and a way's creep is already `'held'`. A third
  meaning in the same codebase is how the next reader loses an afternoon.

## Contract

### Domain words

**Used as `CLAUDE.md` defines them:** run, dial, grid, rules, way, crossroad, fan,
village, walled village, siege, hero, satiety, bite, depth, strike, retreat.

**Introduced**, each a new row in the `CLAUDE.md` table:

- **ambush** — a fight on a way rather than at a place: five to ten bandits standing on
  a road, sprung partway along a walk. `Ambush` in `machines/ambush.ts`, `ambush` on the
  run, the phase of the same name. Distinct from a **siege**, which is a fight at a
  place, entered on arrival, and announced by the village it belongs to; an ambush
  belongs to the road and is announced by nothing the first time.
- **bandit** — one of the men on an ambushed way: a number, a bearing and a pace.
  `Bandit` in `machines/ambush.ts`. Distinct from a **warrior**, who leaves a gate in
  ones and twos while a siege runs; bandits are all on the ground from the first frame,
  never reinforced, and belong to the road rather than to a village.
- **spoil** — what clearing an ambush pays, once: food, a heart, or nothing. `Spoil` and
  `spoilOf` in `machines/ambush.ts`. Not a **record**, a **medal** or an **achievement**
  — those three are things a player keeps or holds; a spoil never leaves the run and is
  never shown on a card. ("Spoils" appears twice in prose comments meaning _ruins_;
  nothing owns the identifier.)

**Words deliberately not used, and why:**

- **held.** A way with bandits on it is **ambushed**, never "held". A player already
  _holds_ a board (`heldBoards`, MEDALS HELD), a way's creep is already `'held'`, and
  the run already carries `heldMs`. A fourth meaning is how the next reader loses an
  afternoon.
- **rout.** The beat the hero is driven back on is **`driven`**, not `routed`:
  `lib/compare.ts` already has `type Band = 'rout' | 'clear' | 'close'` for how
  decisively one run beat another.

**The state lives on the crossroad, not on the way.** The map is a tree, so a crossroad
has exactly one way in, and `ambushed` on a crossroad means _the way into here has
bandits on it_ — the same shape `fortified` already uses, read through the same kind of
accessor (`ambushedAt(id)` beside `walledAt(id)`).

### Files

| Path                                                | New?     | Responsibility                                                                                                                                           |
| --------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `machines/ambush.ts`                                | created  | The whole fight as pure rules: who stands where, what a press cuts, who arrives next, what clearing pays. No pixels, no React, no clock.                 |
| `machines/ambush.test.ts`                           | created  | Colocated test for every function above.                                                                                                                 |
| `constants/ambush.ts`                               | created  | Counts, paces, bearings, the spring point, the framing, the spoil weights, the chance a way is ambushed. One table the machine and the screen both read. |
| `components/game/ambush-field.tsx`                  | created  | The encounter: the hero at the middle of the canvas, the bandits round it, the numbers over them. The analogue of `siege-field.tsx`.                     |
| `components/game/bandit-mark.tsx`                   | created  | One bandit drawn and walked in on its bearing, with its number above it. The analogue of `siege-warrior.tsx`.                                            |
| `components/game/ambush-mark.tsx`                   | created  | The mark on a road the hero has already met bandits on: two crossed strokes at the point the ambush springs, in the map's own ink.                       |
| `machines/arcade.ts`                                | modified | `ambushed` and `cutDown` on `Crossroad`; the roll in `openCrossroad`, on an rng stream of its own.                                                       |
| `machines/arcade.test.ts`                           | modified | The roll: at most one a fan, never with walls, never two in a row, idempotent.                                                                           |
| `hooks/use-arcade-run.ts`                           | modified | `ambush` on `Run`, the four new beats, the fight's timer, the heart, the spoil, the write-back to the map, the pause shift, the dev action.              |
| `lib/arcade-layout.ts`                              | modified | `ambushFrame` beside `siegeFrame`: the lift that puts the hero at the middle of the canvas, and the radius the bandits stand at.                         |
| `lib/arcade-layout.test.ts`                         | modified | `ambushFrame` over several canvases and way lengths.                                                                                                     |
| `components/game/arcade-game.tsx`                   | modified | The four phases in the four tables, the field mounted, the frame chosen, the mark placed on a known ambush.                                              |
| `dev/arcade-dev-state.ts`, `dev/arcade-section.tsx` | modified | `AMBUSH NOW`, beside `SIEGE NOW`.                                                                                                                        |
| `components/overlays/how-to-play-overlay.tsx`       | modified | The arcade chapter — see the copy gate.                                                                                                                  |
| `CLAUDE.md`                                         | modified | Three rows: ambush, bandit, spoil.                                                                                                                       |
| `locales/en/messages.po`, `locales/cs/messages.po`  | modified | Extracted and translated.                                                                                                                                |

Nothing in `modes/` is touched. Arcade runs on its own engine, as the siege and satiety
do, so there is no rule and no capability in this.

### Data and types

On `Crossroad` (`machines/arcade.ts`), both rolled or seeded at growth and both written
back during the run, exactly as `fortified` already is:

```ts
// Whether the way *into* here has bandits standing on it. The map is a tree, so one way
// in — this names the road without a second key for it. Cleared when the road is.
ambushed: boolean
// Which of that road's bandits are already down, from an earlier meeting. Empty until
// the hero has been driven back off it once.
cutDown: readonly string[]
```

In `machines/ambush.ts`:

```ts
export type Bandit = {
  id: string
  value: number
  // Where it stands, as a bearing in radians off the way ahead and a share of the ground
  // it has to cross. The second is also its head start: nearer is sooner.
  bearing: number
  from: number
  spawnedAt: number
  walkMs: number
}

// What a press cut, kept only as long as it takes to draw it — the man is out of the
// list the instant it lands. The analogue of the siege's `Blow`.
export type Cut = { id: number; bearing: number; at: number; value: number }

export type Ambush = {
  // The crossroad the ambushed way leads to, which is what names the road and what the
  // randomness is keyed on.
  at: string
  depth: number
  seed: number
  bandits: readonly Bandit[]
  // Every bandit of this road that is down — the ones from earlier meetings and the ones
  // from this one. Written back to the crossroad when the fight ends either way.
  fallen: readonly string[]
  cut: Cut | null
}

export type Spoil = 'food' | 'heart' | 'nothing'
```

Functions, mirroring `machines/siege.ts` beat for beat: `banditCount(depth)`,
`newAmbush(at, depth, seed, grid, now, cutDown)`, `sprung(ambush, now)` (stamps every
bandit when the camera has finished closing, for the reason `opened` exists),
`liveValues(ambush)`, `land(ambush, prevSum, nextSum, now)` →
`{ ambush, bandit, cleared }`, `nextEvent(ambush)`, `advance(ambush, now)` →
`{ ambush, lost }`, `shift(ambush, byMs)`, `spoilOf(at, seed)` and
`paidAs(spoil, hearts)`.

Two differences from a siege, both deliberate:

- **Nobody is reinforced.** There is no `nextAt` and no spawn: the band is whole from the
  first frame, so `nextEvent` is the soonest arrival and nothing else. With no bandits
  left there is no next event at all, and `nextEvent` must say so — see review focus.
- **A bandit does not re-letter.** A tower takes several hits and a new number with each;
  a bandit takes one. The numbers are still drawn from one pool against the grid the hero
  holds, with `exclude: liveValues`, so no two live numbers are ever the same.

On `Run` (`hooks/use-arcade-run.ts`): `ambush: Ambush | null`, beside `siege`.

`ArcadePhase` gains four, and every value map keyed on it is exhaustive today and must
stay so — `BEAT_MS` in the hook, and `CAMERA_IN`, `DRIFT_MS`, `TRAVEL` and `CREEP` in
`arcade-game.tsx`:

| Phase       | What it is                                                                                  | Beat                                            |
| ----------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `springing` | The camera coming down on the road, the hero stopped partway along it.                      | `CLOSE_MS`, then `ambush`                       |
| `ambush`    | The fight. Dialable. One timer, armed to the soonest arrival and re-armed on every cut.     | no beat of its own                              |
| `cleared`   | The last bandit down: the camera opens, the spoil is paid, the hero walks the rest of it.   | `CLEARED_MS`, then `bloom` at the far crossroad |
| `driven`    | A bandit reached the hero: dragged back down the way it had started, to the same crossroad. | `RETREAT_MS`, then `bloom` where it stood       |

`DIALABLE` gains `'ambush'`. `CREEP` is `null` for all four — an ambush has no crossroad
clock, for the same reason a siege has none.

`TRAVEL` gains `cleared: { from: null, to: 1, … }`, which is the `taken` shape: the hero
walks on from wherever the fight was fought from. `driven` is `{ from: null, to: 0, … }`
in the same frame.

Two figures pinned here rather than left to the build, both agreed with the user at this
stage: `SPOIL_BITE_BACK = 0.3` — a third of the bar against a village's whole one, so an
ambush is the bandits' stores and a siege is still the only full meal — and
`AMBUSH_ALONG = 0.45`, which is where along the way the fight is sprung.

No schema, no migration, no storage key. Nothing in this leaves the device or the run.

### Copy, and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | **Amended during build.** No words on the fight itself: the spoil is read where a siege's is — a heart appearing in the top row, or the satiety bar jumping — and a siege pays both of those and announces neither. A banner over an ambush would be the one fight in the mode that explains itself. So the copy is four strings in the How to Play and nothing on the screen: two new bullets in the arcade chapter (what an ambush is and what it costs; the mark on a road already met), and two existing strings rewritten because they stopped being true — `how-to-play-overlay.tsx` “a siege is … the only way to get one back” and “A walled village is the only food on the map”. All through Lingui, all Czech. |
| **How to Play** | **Yes** — this touches lives and a new way to lose. The arcade chapter: a bullet after the one at `:598` for what an ambush is and what it costs, and the two corrections above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Flag**        | **None.** Arcade is already behind the `arcade` feature and bandits are part of arcade; a second key would gate a thing inside a thing nobody has yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Buttons**     | **None.** The dial is the only thing pressed during an ambush, and the dev sidebar's `AMBUSH NOW` is a `GalleryButton`, which is not a `TrackedPressable` and takes no `ButtonId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Acceptance criteria

1. A fan grown at a crossroad marks **at most one** of its ways as ambushed, and never:
   a way whose village is walled, a way out of a crossroad that was itself reached by an
   ambushed way, or any way at depth 0. Growing the same crossroad twice gives the same
   answer, and a fan grown by a seed that predates this work is unchanged in every other
   respect — the roll is on an rng stream of its own.
2. Dialling the number on an ambushed way starts an ordinary walk that stops partway: the
   hero holds at `AMBUSH_ALONG` along the way, the camera closes over `CLOSE_MS`, and the
   run is in `ambush` with between five and ten bandits by depth, each carrying a number
   no other live bandit carries.
3. Every bandit is on the ground from the first frame of the fight, each on its own
   bearing round the hero, and the one that arrives soonest is the one drawn nearest.
   None is ever reinforced.
4. Dialling a bandit's number cuts it down and it stays down for that fight. While the
   fight is on, no way at the crossroad behind can be dialled, however the sum reads.
5. A bandit reaching the hero costs **exactly one heart**, and the hero is dragged back
   down the way it had started to the crossroad it set off from — the same crossroad,
   with the same fan and fresh clocks. No second heart, no second bite, no depth lost.
   With `invincible` on, the bandit still arrives and is still cleared off the ground, and
   the heart is spared — the siege's own arrangement.
6. Walking that way again meets the road thinned: the bandits cut down last time are gone,
   the rest are back on the same bearings at the same distances, and their numbers are
   drawn fresh against the grid the hero now holds.
7. Cutting the last bandit down clears the road for the rest of the run: `ambushed` is
   false from then on, the hero walks the remainder of the way, and lands at the village
   with its fan grown against the grid the fight left behind.
8. Clearing pays once, from the road's own seed: food (`SPOIL_BITE_BACK` of the bar), a
   heart (never a fourth), or nothing. A heart rolled for a hero already carrying three
   pays food instead, and the same road always offers the same roll.
9. The last heart going to a bandit ends the run through `overrun`, exactly as a siege's
   does, and the fight's presses are never billed to the next leg out of the crossroad.
10. Pausing during an ambush freezes it: nothing arrives while the run is paused, and
    every bandit is the same distance from the hero when it resumes.
11. A way the hero has met bandits on is drawn with the ambush mark on the fan from then
    on — and a way it has not met them on is drawn like any other way.
12. `pnpm check` is green, Czech included, and the How to Play's arcade chapter no longer
    claims that a siege is the only thing that spends hearts or the only food on the map.

## Tests

- **`machines/ambush.test.ts`** (new) — the count by depth and its two ends; bearings
  spread round the circle and never two on one; numbers distinct across live bandits and
  reachable on the grid handed in; the nearest bandit is the soonest arrival; `land` cuts
  one and only one and reports `cleared` only on the last; `advance` reports the arrival
  and takes the man off the ground; `nextEvent` on an empty band; `shift` moves every
  stamp by exactly the same amount; `newAmbush` with `cutDown` returns the band minus
  those ids and nothing else; `spoilOf` is the same for one road twice and differs across
  roads; `paidAs('heart', 3)` is `'food'`.
- **`machines/arcade.test.ts`** (extended) — the roll's three guards and its idempotence,
  over many seeds; and that a map grown without the roll is otherwise identical.
- **`lib/arcade-layout.test.ts`** (extended) — `ambushFrame` puts the hero at the middle
  of the canvas whatever the way's reach, and leaves a ground radius that fits inside the
  canvas at the siege zoom.

No UI tests: the field and the marks are drawings, and the repo tests the hand rather than
the render.

## Review focus

1. **The fight's timer, armed to a dead man.** The hook's timer effect re-arms on
   `run.seq`, and a press that cuts a bandit has to bump the beat or the timer stays armed
   to an arrival that can no longer happen. The siege survives this by accident — its
   `advance` falls through to the gate's clock and bumps the beat on the way past. An
   ambush has no gate, so `nextEvent` on an empty or cut-down band must not hand back
   `Infinity` and arm a timer forever. Task 3 owns it.
2. **`openCrossroad` is idempotent, and the roll must be inside that guard.** It hands
   back a crossroad that already has ways untouched, which is what makes the map a place
   rather than a roll. A roll written above that early return would give a retreating hero
   a different road from the one it fled. Task 1 owns it.
3. **Two frames for one hero.** The hero is drawn off `progress` along the way's spline in
   the crossroad-behind's frame; the bandits are placed in the field's own frame. If the
   two disagree by a point, every bandit walks at a patch of ground nobody is standing on
   — the trap `siege-field.tsx` already solved with `stand`. Task 5 owns it.
4. **The presses of a fight, billed to the next leg.** A siege resets the leg with
   `arrival(grid)` on the way in _and_ on the way out, because a fight is dozens of
   presses and the leg out of the village would otherwise be the dearest on the map. Both
   ambush exits need the same, and `driven` needs it too — it lands on a crossroad whose
   fan was grown against an older grid. Task 4 owns it.
5. **The write-back that loses a man.** `fallen` is folded into the crossroad's `cutDown`
   when the fight ends, and there are two ends. Clearing must leave no stale `cutDown`
   behind on a road that is no longer ambushed. Task 4 owns it.
6. **The food that undercuts the siege.** Satiety was designed around a walled village
   being the only food on the map, and this puts food on a road. `SPOIL_BITE_BACK` is a
   third of a bar against a village's whole one, and the How to Play has to stop saying
   "only food" — if an ambush starts reading as a cheaper siege, the figure comes down.
   Task 4 owns it.
