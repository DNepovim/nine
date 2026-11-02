# Freeze

Slug: freeze
Stage: build
Next: /verify freeze
Track: full
Branch: feat/freeze
Started: 2026-11-02
Skipped: shape

## Problem

Every run draws the dial sum live under the board: press a key and the number moves, so
a player can feel their way to a target by watching it. There is no challenge yet about
**adding up the dial yourself**. And the engine can't make one. Nothing in `RunRules`
says what the sum row draws, so a catalog entry asking for it would typecheck and play
as ordinary Accuracy Hard.

## Shape

Shape was skipped at the author's call, in `/challenge`. The size is clear: drawing only,
the same shape as **glimpse**. One rule with a default that leaves every mode as it is, one
hold on the sum row, a domain word, then the catalog entry as the last task.

### What the player meets

FREEZE, booked like any challenge. It is Accuracy Hard in every visible respect: the nine
dial, a 16.5 s ring, arrivals closing in, three hearts. The one difference is the **sum row
under the board: it holds still.** It shows the sum the dial stood at after the last hit
(at the start of a run, the opening grid's sum). The keys move and show their digits as
always, and a hit lands the moment the real sum meets a target, as always. Only the number
in the sum row waits. When a hit lands it jumps to the new sum, with the ordinary digit
flip, and holds again.

### Decisions already taken (from `/challenge`)

| Part            | Decision                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| The freeze      | **Held at the last hit**, not blanked between hits                                                                                             |
| Key readout     | The Options toggle that prints value × weight on each key (`showSum`) is **left to the player**, not forced off                                |
| Streak / shot   | `optimal` / `sniper`, the challenge default and Accuracy's shot, both inherited                                                                |
| Everything else | Base `ACCURACY`, `fixedDifficulty: 'hard'`, the nine keys, challenge-default weights and lives                                                 |
| Colour, mark    | Generated hue for catalog index 9; nine dots                                                                                                   |
| Claims (draft)  | board `STILL SUM` · `HELD COLD` · `ICE CLEAR`; medal `NEAR THAW` · `HALF FROZE`; strong `COOL HEAD` · `GOOD ICE`; cold `FROZE UP` · `THIN ICE` |

### Out

- **Forcing the key readout off.** The author's call, above. A player with `showSum` on
  reads value × weight per key and adds nine products. Accepted.
- **Blanking the row**, or any new animation. The ordinary `ScoreDigit` flip carries the
  jump.
- **Multiplayer, Arcade, How to Play.** Challenges don't run in the first two, and the
  challenges chapter of the guide is deliberately vague about any one challenge.
- **FREEZE with scramble.** Not combined in this catalog entry. The rule is still defined
  for that case (see Data), so a later challenge can combine them.

## Contract

### Domain words

**Uses**: **challenge**, **rules** (`RunRules`), **dial** (`DialSpec`), **grid**, **run**,
**session**, **session board**, **scramble** (only to say how they compose), **claim**.
The number under the board is the **sum row** (the code's "score above dial",
`SUM_ROW_HEIGHT`). The **real sum** is `sumOf(dial, grid)`. The **held sum** is what the
row shows.

**Introduces:**

- **freeze**: the sum row holding the sum the dial stood at after the last hit (or at the
  run's start), and moving only when a hit lands. Drawing only: hits, par, the spawner's
  `reach` and the scoring all read the real sum. On the dial, as `DialSpec.freeze`, false on
  every dial but FREEZE's. **`docs/domain.md` gains a row and `CLAUDE.md`'s table its
  one-liner**, after **scramble**.

**Collisions:**

- **`frozen`** on `PieCountdown`/`TargetCard` means a card whose clock is stopped for a
  pause, and the glimpse "freezes with the ring" in the same sense. That is a different
  thing: a paused clock, not a held sum. The new identifier is `freeze` on the dial and
  `useHeldSum`, never `frozen`, and the domain row says "not a paused card".
- **FREEZE** the challenge vs **freeze** the rule: the same word on purpose, like
  SCRAMBLE and **scramble**.

### Placement

`DialSpec.freeze`, beside `scramble` and `orientation`. Not `capabilities`, whose fields
are read through `traitsOf` by screens outside a run. Not `spawn`, which is about how
targets arrive. The sum row is the dial's readout, and `rules.dial` already reaches the one
place that draws it with nothing new to carry. `defineDial` takes `freeze = false`.

FREEZE's dial is `defineDial({ id: 'freeze', rows: 3, cols: 3, freeze: true })`, with its
own id like SCRAMBLE's, so two dials with different behaviour never share a name.

### Files

| Path                                  |          | Responsibility                                                                                |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `hooks/use-held-sum.ts`               | created  | `useHeldSum(sum, { freeze, key })`: the real sum, or the one captured when `key` last changed |
| `modes/dial.ts`                       | modified | `freeze: boolean` on `DialSpec`, `freeze = false` on `defineDial`                             |
| `app/(tabs)/index.tsx`                | modified | the sum row, and only the sum row, draws the held sum and its direction                       |
| `modes/challenges/catalog.ts`         | modified | `FREEZE` appended to `CHALLENGES`, never inserted                                             |
| `modes/dial.test.ts`                  | modified | `freeze` defaults to false; `NINE_DIAL.freeze` is false                                       |
| `modes/challenges/challenges.test.ts` | modified | FREEZE resolves as below, is last, and is the only freezing dial                              |
| `locales/*.po`                        | modified | label, code, description, with Czech                                                          |
| `docs/domain.md`, `CLAUDE.md`         | modified | the **freeze** row                                                                            |

### Data and types

- `DialSpec.freeze: boolean`. No storage, no machine, no schema change. No new context
  field or event.
- **What the row draws.** In `index.tsx`, `sum = sumOf(dial, grid)` stays exactly as it is
  and keeps feeding `useTargetSpawner`'s `currentSum`. A second value,
  `shownSum = useHeldSum(sum, { freeze: dial.freeze, key: \`${state.context.runId}:${hitBatch.seq}\` })`,
feeds the sum row's digits, its `valueProgress`and`useScoreDirection`. Nothing else
  reads it.
- **When it moves.** `useHeldSum` returns `sum` while `freeze` is false. With it true, it
  returns the `sum` of the render where `key` last changed, and the sum of its first render
  on mount.
  - **A hit**: `hitBatch.seq` climbs in the same snapshot the grid settles in, so the held
    sum is the grid the hit left, scrambled or not.
  - **A run's start** (`START`, `RESTART`): a new `runId`, so the held sum is the opening
    grid's.
  - **A restore** from storage: `RESTORE` hands the run a new `runId`, so the held sum is the
    restored grid's sum, which may be mid-route. Accepted: the saved run keeps no grid from
    the last hit, and storing one would be a storage change for a single reveal on a cold
    start. Recorded so `review` doesn't rediscover it.
  - **A press with no hit, or a drift tick**: nothing moves.
- **The jump.** The direction is worked out from the held sum, so the digits flip up or
  down the way the held number moved, not the way the last press did. `valueProgress`
  reads the held sum, so the row's tint holds still too (otherwise the colour would give
  away the real sum's band).
- **Unchanged and unread**: the strike shot (it reads the row's position, not its digits),
  `HitSync`, `SumHush`, the dial's own per-key readout.
- **The catalog entry**: `slug: 'freeze'`, `code: msg\`FRZ\``, `base: ACCURACY`,
`rules: { fixedDifficulty: 'hard', dial: defineDial({ id: 'freeze', rows: 3, cols: 3, freeze: true }) }`,
plus label, description and claims. No `shot`, no `scoring`, no `lives`, no `hue`.
`from`/`until` a one-day window in the past (2026-11-01).

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Label `FREEZE`, Czech `MRÁZ` (both fit the dialog row without a soft hyphen). Code `FRZ`, Czech `MRZ`. Description `The sum only moves when you hit.`, Czech `Součet se pohne, jen když trefíš.` Claims are raw `TitleWords`, as listed above. `pnpm i18n:extract`, then `pnpm i18n:verify`. |
| **How to Play** | **None.** One challenge's rule, and the challenges chapter stays vague on purpose.                                                                                                                                                                                                           |
| **Flag**        | **None.** A challenge reaches a player only through a booked session.                                                                                                                                                                                                                        |
| **Buttons**     | **None.** Nothing new is pressable.                                                                                                                                                                                                                                                          |

## Acceptance criteria

1. `NINE_DIAL.freeze` is `false`, and `runRules(mode, 'hard').dial.freeze` is `false` for
   every registered mode but FREEZE.
2. `runRules(challengeId('freeze'), 'easy')` resolves to: `difficulty: 'hard'`,
   `usesDifficulty: false`, `dial.id: 'freeze'`, `dial.freeze: true`, `dial.scramble: false`,
   `dial.weights` equal to `NINE_DIAL.weights`, `clock.base: 16500`,
   `scoring.streak: 'optimal'`, `scoring.weights: { acc: 0.85, spd: 0.15 }`,
   `lives.count: 3`, `lives.wasteful: null`, `capabilities.board: false`.
3. FREEZE's shot is `'sniper'`, its claims are the ones listed above, and it is the **last**
   entry of `CHALLENGES`. The ids before it keep their order.
4. In a FREEZE run, pressing keys without landing a hit leaves the sum row's number and tint
   exactly where they were, while the keys show their new digits.
5. When the dialled sum meets a target, the hit lands as on any run, and the sum row flips to
   the new sum, up or down by how the held number moved, then holds again.
6. A new run (PLAY AGAIN, or RESTART from pause) opens with the row showing the opening grid's
   sum, not the last run's.
7. A FREEZE run restored from storage opens with the row showing the restored grid's sum.
8. Accuracy, Speed, the tutorial and SCRAMBLE draw the sum row live, exactly as before.
9. A strike in a FREEZE run fires its sniper beam from the sum row as on Accuracy.
10. `pnpm check` is green, `pnpm i18n:verify` included, with `MRÁZ`, `MRZ` and the Czech
    description in `locales/cs`.
11. `docs/domain.md` and CLAUDE.md's table each have a **freeze** row naming `DialSpec.freeze`
    and saying it is not a paused card's `frozen`.

## Tests

- **`modes/dial.test.ts`**: `defineDial` without `freeze` gives false; with it, true;
  `NINE_DIAL.freeze` is false (criterion 1).
- **`modes/challenges/challenges.test.ts`**: a `freeze` describe, like `scramble`'s: the
  resolved figures (2), the shot and claims (3), and "the only dial in the catalog that
  freezes" (1). The pinned `CHALLENGES` order gains `freeze` at the end.
- **No hook test.** `useHeldSum` is a few lines of React state with no pure core worth
  splitting out; criteria 4–9 are walked in the running app by `verify`.

## Review focus

- **The spawner still reads the real sum** (task 3). Only the sum row's three readers may
  switch to `shownSum`. `currentSum: sum` and anything else using `sum` must not.
- **Direction from the held sum** (task 3). `useScoreDirection(sum)` fed the real sum would
  flip the digits the way the last press went, not the way the held number moved, and leak
  which way the dial went.
- **The key catches every start** (task 2). If `runId` does not change on some path that
  resets the grid (START from the intro, RESTART, RESTORE, a tutorial), the row shows the
  last run's sum. Check each path sets a new `runId`.
- **No render loop and no lag of one hit** (task 2). The capture has to happen in the render
  where `key` changes, not an effect after it, or the row shows the previous hit's sum for a
  frame and then jumps twice.
- **Append, never insert** (task 4). FREEZE goes at the end of the `.map` list, or every
  challenge after it is recoloured.
