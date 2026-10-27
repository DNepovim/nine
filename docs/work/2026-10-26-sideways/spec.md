# Sideways

Slug: sideways
Stage: shipped
Next: —
Track: full
Branch: feat/sideways
Started: 2026-10-26

## Problem

Every challenge so far changes what the dial is (its size, its weights) or what a run
asks of it. None changes how it sits in the hand. A player who has learnt the nine dial
by feel — the ×9 key under the thumb, swipe up for more — has nothing that makes that
feel wrong for a day. The engine can't build it: nothing in `RunRules` or `DialSpec`
says how a dial is drawn or which way a swipe reads. So a catalog entry asking for a
sideways dial would typecheck, then play as an ordinary Accuracy Hard on an upright dial.

## Appetite

**A day or two.** That buys:

- one field on `DialSpec`, defaulted so every existing dial is unchanged
- one map from screen move to dial move, applied where the pan already settles a gesture
- one transform per key
- the catalog entry with its Czech, the claims, and the CLAUDE.md row

No schema, no new screen. If it runs over, the keys' drawing gets plainer (the digit turned,
the flip animation left as it is) and the shape stays the same.

decided by advisor: NO SLIP (one rules field and one choke point) is the size precedent.

## Shape

### What the player meets

1. An admin books a session of SIDEWAYS, the same as any other booking.
2. The intro card shows SIDEWAYS, with nine dots (the dial is still three by three).
3. The player starts. It is Accuracy Hard (a 16.5 s ring, three hearts, the `optimal`
   streak, a sniper shot), but the dial lies on its side, turned a quarter
   counter-clockwise, as if the phone were held landscape. Every digit is drawn lying on
   its side.
4. The weights turned with it. The ×9 key is top-right, the ×1 key is bottom-left:

   ```
   3  6  9
   2  4  6
   1  2  3
   ```

5. The swipes turned with it, in the dial's own frame:
   - swiping **left** on screen raises a key (+1)
   - swiping **right** lowers it (−1)
   - swiping **up** sends it to 9
   - swiping **down** sends it to 0
   - a tap still raises it

   The digit's flip animation leaves the way the swipe went.

6. Drags across several keys work as they do upright, each key read through the same
   turn.
7. Scoring, par and routes are unchanged. Par counts presses, not directions, and the
   weights are the dial's own.
8. Game over and the session board are as for any challenge. The claims are about the
   dial lying on its side.

### Areas

- **Dial spec** (`modes/dial.ts`): `orientation: 'upright' | 'sideways'`, bounded,
  `'upright'` by default in `defineDial`.
- **The pan** (`components/game/dial.tsx`): map the screen-direction move to the dial's
  move at the one point a gesture is applied (`commit`). The side a key was left by and
  how far the finger went (`exitMove`, `liftMove`, `travelled`) stay in screen space,
  where they are measured.
- **The key** (`components/game/dial-button.tsx`): its content turned −90° on a sideways
  dial. The flip is already keyed by the dial-frame move, so inside the turned content it
  reads right on screen without anything else changing.
- **Catalog**: SIDEWAYS appended. Its label is SIDE­WAYS with a soft hyphen: eight
  letters, where GLIMPSE needed one at seven. Base `ACCURACY`, `fixedDifficulty: 'hard'`,
  dial `defineDial({ id: 'sideways', rows: 3, cols: 3, weights: [3,6,9, 2,4,6, 1,2,3],
orientation: 'sideways' })`, challenge defaults otherwise. Claims cover the `board`,
  `medal`, `strong` and `cold` tiers; it has a streak, so `strong` is reachable.
- **Copy**: label, description, Czech.
- **CLAUDE.md**: a row for **orientation**.

decided by advisor: no feature flag. A challenge only reaches a player through a booked
session.

## In

- `DialSpec.orientation`, defaulted upright.
- The move map in the pan, and the turned key content.
- The SIDEWAYS entry, claims, Czech, CLAUDE.md row.

## Out

decided by advisor: all five agreed.

- **Anything Trainee-only:** the tutorial's thumb mime and the dial-axes multiplier labels.
- **Key hints:** challenges have `keyHints` off.
- **Route hints:** coached modes only.
- **The arcade dial:** arcade runs on its own engine, and every dial there stays upright.
- **The DialMark on the card:** it stays nine dots, as GLIMPSE's does.
- **Turning the whole screen:** the targets, the sum, the top bar and the strip stay
  upright. Only the dial lies down.
- **Clockwise or a half turn:** the union is two values, not an angle.

## Rabbit holes

- **Something else reading screen directions.** Before spec settles the Out list, check
  that nothing outside the pan reads a gesture's screen direction as a dial move. Scoring
  counts presses, but the coach, the lesson and the dial-axes may not. Anything a
  challenge run reaches belongs In.
- **The squash and the halo.** The key's press squash follows the thumb, and its halo is
  drawn around the key, both in screen space. Transforming the whole key, rather than its
  content, would turn them too. Turn only the digit's box.
- **Web.** A transformed `Text` inside an animated view has to render right on web as
  well as native. GLIMPSE's edge needed a web fix (`771dc00`), so check web early.
- **The challenge dialog's name.** SIDE / WAYS at phone widths, with the soft hyphen.
  Verify at 375 px.
- **How to Play.** The challenges chapter is deliberately generic and names no dial, so
  it needs nothing. Spec confirms this.

## Contract

### Domain words

**Used:** **challenge**, **session**, **dial** (the keys, never "board"), **grid**,
**rules**, **claim**, **run**. A gesture's direction is a **move** (`DialMove`).

**Introduced:**

- **orientation**: which way up a **dial** is drawn and read, `'upright'` or
  `'sideways'` (a quarter turn counter-clockwise, as if the phone were held landscape).
  The keys, their digits and the swipes on them all turn together; the weights are the
  dial's own and are given already turned. `DialSpec.orientation`,
  `DialOrientation` in `modes/dial.ts`. CLAUDE.md's table gains a row.

**Collisions:**

- **Not the turn.** CLAUDE.md already gives "turn" to the arcade sheet (which way up it is
  read), which is why this is "orientation". The row says so.
- **Not tilt.** That is the arcade map's perspective.
- **Not the device's own rotation.** The app is pinned portrait, and nothing here asks
  the device anything.

### Files

**Created**

None. The map lives beside the moves it maps.

**Modified**

| Path                                  | Change                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `modes/dial.ts`                       | `DialOrientation = 'upright' \| 'sideways'`; `DialSpec.orientation`; `defineDial` takes it, defaulting to `'upright'`.                         |
| `lib/dial-gesture.ts`                 | `ORIENTED` map of `DialOrientation` → (screen `DialMove` → dial `DialMove`) and a worklet `orientMove(orientation, move)`.                     |
| `lib/dial-gesture.test.ts`            | Covers `orientMove`.                                                                                                                           |
| `components/game/dial.tsx`            | `commit` orients the screen move before `allowedMove`. `exitMove`, `liftMove` and `travelled` are untouched and still measure in screen space. |
| `components/game/dial-button.tsx`     | Takes `orientation`. On `'sideways'`, the digit sits in a box turned −90°; the squash, the halo, the badges and the fills stay as they are.    |
| `modes/challenges/catalog.ts`         | `SIDEWAYS` appended.                                                                                                                           |
| `modes/challenges/challenges.test.ts` | SIDEWAYS's rules and its index; the order pin gains `'sideways'`.                                                                              |
| `modes/dial.test.ts`                  | `defineDial`'s default orientation; NINE_DIAL is upright.                                                                                      |
| `CLAUDE.md`                           | The **orientation** row.                                                                                                                       |
| `locales/*.po`                        | Label, code and description, with Czech.                                                                                                       |

### Data and types

```ts
export type DialOrientation = 'upright' | 'sideways'

export type DialSpec = {
  // …as today…
  orientation: DialOrientation
}

// Screen move → the dial's own move. Bounded, total over both.
const ORIENTED = {
  upright: { up: 'up', down: 'down', left: 'left', right: 'right', tap: 'tap' },
  sideways: { left: 'up', right: 'down', up: 'right', down: 'left', tap: 'tap' },
} as const satisfies Record<DialOrientation, Record<DialMove, DialMove>>
```

Sideways, the dial's own up (+1) points to screen-left, its right (ceiling) to screen-up,
its down (−1) to screen-right and its left (floor) to screen-down. A tap is a tap.

Nothing is stored, so nothing needs a new key. A saved run checks its dial by `id`, and
`'sideways'` is its own id.

**Schema:** none.

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Label `SIDE­WAYS` (soft hyphen between E and W), code `SDW`, description "The dial has fallen on its side." Czech: label `NA BOK`, code `BOK`, "Číselník spadl na bok." Claims are wordmarks and not translated, as no challenge's are. |
| **How to Play** | None. The challenges chapter is generic and names no dial; no permanent mode's rules or controls move.                                                                                                                                  |
| **Flag**        | None (decided by advisor in shape).                                                                                                                                                                                                     |
| **Buttons**     | None.                                                                                                                                                                                                                                   |

**Claims:**

| Tier     | Lines                           |
| -------- | ------------------------------- |
| `board`  | LAID LOW · SIDE WON · TURN KEPT |
| `medal`  | HALF TURN · NEAR LEVEL          |
| `strong` | GOOD TURN · SURE SIDE           |
| `cold`   | TIPPED OVER · ALL ASKEW         |

## Acceptance criteria

1. `runRules(challengeId('sideways'), 'easy')` resolves to:
   - difficulty `hard`
   - dial weights `[3,6,9, 2,4,6, 1,2,3]`, orientation `'sideways'`, `maxSum` 324
   - streak `'optimal'`, weights `{ acc: 0.85, spd: 0.15 }`, lives `{ count: 3, … }`
   - `spawn` and `clock` equal to Accuracy Hard's
2. Every other dial is upright: `NINE_DIAL`, FOUR KEYS', FOUR BY FOUR's, every arcade and
   multiplayer dial. The existing dial and challenge tests pass unchanged.
3. `orientMove('upright', m)` is `m` for every move. `orientMove('sideways', ·)` maps
   left → up, right → down, up → right, down → left, and tap → tap.
4. On SIDEWAYS, each key's digit is drawn lying on its side, its top towards screen-left.
   On every other mode it is drawn upright.
5. On SIDEWAYS, swiping a key left raises it by one, swiping right lowers it by one,
   swiping up sets it to 9, swiping down sets it to 0, and a tap raises it by one. The
   digit flies out in the direction of the swipe.
6. On SIDEWAYS, a drag across a row or column moves every key it properly crosses, each
   by the turned move. On Accuracy, the same gestures act exactly as before.
7. A SIDEWAYS hit is scored as on Accuracy Hard: par counts presses, so a target reached
   in par presses with sideways swipes is exact.
8. The intro card shows SIDEWAYS with nine dots. The challenge dialog draws the name as
   SIDE over WAYS, whole, at 375, 390 and 430 px.
9. A game over on SIDEWAYS draws its claims from SIDEWAYS's pools.
10. On web, the turned digits render turned, and stay centred in their keys.
11. `pnpm check` is green, Czech included.

## Tests

- `lib/dial-gesture.test.ts`: `orientMove` for both orientations and every move (AC 3).
- `modes/dial.test.ts`: `defineDial` defaults to upright; NINE_DIAL is upright (AC 2).
- `modes/challenges/challenges.test.ts`: SIDEWAYS resolves as AC 1, is appended, and
  every other challenge's dial is upright.

## Review focus

- **Task 3 (`commit`):** orient the move before `allowedMove`, so the tutorial's control
  table (which only ever runs upright) still sees the move it expects. Then check the
  `travelled` / `crossReach` test still uses the **screen** move: oriented, a crossing
  would be measured along the wrong axis.
- **Task 4 (key):** turn only the digit's box. Turning the key's outer view would turn
  the squash (which follows the thumb in screen space), the corner badges and the shadow
  offset.
- **Task 4 (key):** a −90° box inside a square key needs no size change; the box should
  not take its own width from the text, or the digit leaves its centre on web.
- **Worklet:** `orientMove` and `ORIENTED` are read on the UI thread, so the map must be a
  worklet-safe constant and `orientMove` must say `'worklet'`, like its neighbours.
- **Task 5 (catalog):** append SIDEWAYS at the end. FOUR KEYS and FOUR BY FOUR call
  `defineDial` without an orientation and must stay upright.
