# Satiety in arcade — Plan

Spec: docs/work/2026-10-07-arcade-satiety/spec.md

## Tasks

- [x] 1. `machines/satiety.ts` — the numbers, `biteFor`, `spent`, `starving`
- [x] 2. `machines/satiety.test.ts` — par, waste, bounds, clamping, a par of nought
- [x] 3. `hooks/use-arcade-run.ts` — `satiety`, `legGrid`, `legPresses` on `Run`; reset on every arrival — via an `arrival(grid)` helper beside `beat`, so none of the six arrivals can forget
- [x] 4. `hooks/use-arcade-run.ts` — the bite on an answer, `RETREAT_BITE` on the clock running out, one bite per strike
- [x] 5. `hooks/use-arcade-run.ts` — `FULL` on `taken`, beside the heart that is already given back
- [x] 6. `hooks/use-arcade-run.ts` — `starvingAt`, its own timer, the heart every five seconds, into `overrun`; held across pause, blur and `resume`
- [x] 7. `components/game/satiety-bar.tsx` — the fraction, the amber, the red, the pulse
- [x] 8. `components/game/arcade-game.tsx` — the bar into the hearts' row; animate the drop over the walk
- [x] 9. `dev/arcade-dev-state.ts` + `dev/arcade-section.tsx` — `satiety` published, `setSatiety` floored like `setHearts`
- [x] 10. `components/overlays/how-to-play-overlay.tsx` — a satiety paragraph and four bullets, the hearts sentence corrected, two siege bullets amended
- [x] 11. `CLAUDE.md` — the **satiety** row; `pnpm i18n:extract` and the Czech

## Build notes

### Asked for mid-build, outside the satiety spec

Five changes requested in the same session and built here rather than as their own work
items. None is covered by the twelve acceptance criteria, so `verify` should read this
list rather than treating them as drift — and any of them could be lifted into an item of
its own if it wants a spec.

- **The satiety bar is a short gauge**, `w-16` under the pause button, not a full-width
  rule. See below.
- **The arcade dawn card is set in `mapLabel`**, the map's own serif, with the caps
  tracking and weight brought down to suit a serif. The card is the title page of the
  sheet the map is about to draw itself on, so it now reads as the first mark on it.
- **The dev sidebar can make the warriors harmless** — `invincible` on the run,
  WARRIORS · HARMLESS in the section. It spares the heart only: the man still arrives and
  is still cleared, because a guard that skipped the step would leave him standing on the
  hero forever. `__DEV__` only, and it does not touch hunger.
- **The arrow is an arrow.** It was a line with a chevron. It now has a filled barbed
  head, two feathers swept back off the shaft, and a nock notch at the tail — the end that
  says which way it was loosed from.
- **Warriors are soldiers.** `components/game/siege-soldier.tsx` is new and is the one
  drawing of a man: head, legs mid-stride, a sword arm with a fist and a crossguard, and
  the round shield — unchanged in size — that carries his number. Both the man crossing
  the ground and the copy of him that falls under the arrow draw it, which they had to:
  they were two bare discs written out twice, and a man who changed shape as the arrow
  reached him would read as two men. The geometry is parametric off the shield's radius,
  so it is cheap to retune if it reads wrong on a device.
- **ARCADE is on the intro for everyone**, wearing SOON, with PLAY GAME dead under it and
  `components/overlays/arcade-teaser.tsx` in the slot Trainee's tips use. A launch still
  does not _land_ on it without the flag — opening every time on a dead pill would make
  the teaser the screen rather than a thing on it.

**RETREAT was removed mid-build, on request.** The `RETREAT · −1` button on the walls
and the `flee` action behind it are gone, along with the `arcade.retreat` ButtonId and
the How to Play bullet that explained chip-and-run. A siege is now commit-or-die: the
only ways out are flattening the towers or losing the hearts. The warriors bullet says
so, since nothing on the screen does any more. Outside the satiety spec's criteria —
recorded here so `verify` reads it as a decision rather than drift.

**The bar is short and right-aligned**, not stretched across the row. It first shipped
as `flex-1` between the hearts and the right edge, which read as a loading bar rather
than a gauge. It now sits in a `w-16` column under the pause button, so the right-hand
edge of the screen is one column: MENU above, how fed the hero is below.

**Where the bite is charged.** At the answer, not on arrival — `applyMove` is the one
place that holds both the par and the presses, and charging at arrival would have meant
repeating it down four timer branches. The player still reads it as the journey: the bar
animates to its new reading over `WALK_MS`, so it drains as the hero walks.

**`eat` arms on the falling edge only.** A bite taken by a hero who is already starving
leaves the running five seconds alone. Resetting it would have made every step on an
empty belly buy another five seconds, which is backwards.

**The starve tick does not stamp a beat.** Every beat timer here is measured from
`beatAt`, so bumping it on a lost heart would have handed the player the crossroad's
clock all over again — a heart lost would buy time rather than cost it. Only the tick
that _ends_ the run stamps one, because `overrun` genuinely is a new beat. This is the
one thing in the build most likely to be re-introduced by a later edit.

**Hunger has its own ref.** `timer` is the beat's and is cleared and re-armed as the run
moves between beats; `hunger` ticks across beats and so cannot share it. The two effects
never touch each other's ref.

**`deepenBy` charges nothing**, deliberately: it dials nothing, so there is no answer to
price. Noted here because it is exactly the kind of silence a later reader would read as
an oversight. `setSatiety` is _not_ floored the way `setHearts` is — an empty bar is not
an ending, and it goes through the same `eat` every bite goes through, so the tool cannot
reach a state the mode cannot.

**Backgrounding mid-flight.** `usePauseOnBlur` is armed only while `DIALABLE`, which the
hook already documents as deliberate for walks and rockets. One starve bite can therefore
land while the app is away. If it takes the last heart, `overrun` fires into a screen
nobody is watching and the run is on its card when they come back — the same thing the
siege's own overrun already does. Left as it is; flagged for `verify` to confirm it is
acceptable rather than assumed.

**One English string was wrong and was fixed before translation.** A How to Play line
read "the tidy route feeds you as well as it scores you" — arcade scores depth and
nothing else. It now reads "the tidy route is the one that keeps you fed".

**Not mine, and present in the tree.** The working tree already carried uncommitted work
on siege ramparts (`machines/siege.ts`, `constants/siege.ts`, `siege-field.tsx`,
`siege-rampart.tsx`) and on account restore. Two pre-existing `tsc` errors in
`components/game/siege-field.tsx` and one in `components/game/arcade-game.tsx:830` come
from that work, not from this. `ship` will need to split the commits.

## Verification log

_(verify fills this in)_
