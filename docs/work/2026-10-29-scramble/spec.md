# Scramble

Slug: scramble
Stage: shipped
Next: — (AC 14 still wants a device check: fast drag through the hitting key, then lift)
Track: full
Skipped: shape
Branch: feat/scramble
Started: 2026-10-29

## Problem

Every hit leaves the dial where the player put it, so the next route always starts from
a position they just built and already know. No challenge asks a player to **read a dial
they did not set**: to start every target from scratch, against keys that moved without
them. The engine can't build one. After a hit `applyGrid` returns the grid it was handed,
and nothing on `RunRules` or `DialSpec` says it could be anything else. So a catalog
entry asking for this would typecheck, then play as an ordinary Accuracy Hard.

Decided by the author through `/challenge` (shape skipped, straight to spec):

- Base **Accuracy**, pinned to **Hard**. Streak `optimal` (the challenge default) and a
  life spent on a hit under Hard's 0.2 bar. The bar has to be **written**:
  `CHALLENGE_DEFAULTS` turns `wastefulCostsLife` off for every challenge (found in build). Shot `sniper`
  (Accuracy's, and the right one for an `optimal` chain).
- **The one thing:** every hit **scrambles** the dial. **Every** key takes a new random
  digit, never the one it had.
- **Never a free hit:** a scramble whose sum equals a standing target's number is drawn
  again.

## Contract

### Domain words

**Used:** **challenge**, **dial**, **grid** (one position of the dial, never "board"),
**run**, **rules**, **hit**, **par**, **streak**, **drift** (a target's number now is
`driftedValue`, and that is the number a scramble must avoid).

**Introduced: scramble.** _After every hit, every key on the dial jumps to a new random
digit that is never the one it showed, and the sum lands on no standing target. It is
the dial's own behaviour, so it lives on the dial:_ `DialSpec.scramble` (boolean,
`false` on every dial but SCRAMBLE's) and `scrambleGrid` in `lib/scramble.ts`.
`docs/domain.md` gets a row and `CLAUDE.md`'s table gets its one-liner.

**Collisions:**

- `machines/siege.ts` and `machines/satiety.ts` use "scrambled" in comments for a
  wasteful, off-par answer. That is prose, not an identifier, and arcade only. The row in
  `domain.md` says a scramble is the dial moving, never a bad route.
- An arcade **tower** "takes a new number every hit". That is a target changing, where
  this is the keys changing. The domain row names the difference.

decided by advisor (inline): the field lives on `DialSpec` beside `orientation`. That is
the precedent for "how this dial behaves", and it reaches the machine, the scoring and the
dial component through `rules.dial` with no new plumbing. A `RunRules` group of its own
would be a seventh group for one boolean.

### Files

| Path                                                                 | C/M | Responsibility                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/scramble.ts`                                                    | C   | `scrambleGrid(dial, grid, avoid, rng)`: pure. Every key gets a digit ≠ its own; the sum is not in `avoid`. Terminates.                                                                                                              |
| `lib/scramble.test.ts`                                               | C   | Its properties over many seeds.                                                                                                                                                                                                     |
| `docs/work/2026-10-29-scramble/plan.md`                              | C   | The tasks.                                                                                                                                                                                                                          |
| `modes/dial.ts`                                                      | M   | `scramble: boolean` on `DialSpec`, `scramble = false` on `defineDial`.                                                                                                                                                              |
| `modes/dial.test.ts`                                                 | M   | Default is false; `NINE_DIAL.scramble === false`.                                                                                                                                                                                   |
| `machines/game.ts`                                                   | M   | In `applyGrid`, on `anyHit && rules.dial.scramble`: scramble the grid after scoring. Survivors take the scrambled grid as `refGrid` and their `par` from it. The returned `grid` is the scrambled one. Seeded, so no event changes. |
| `machines/game.test.ts` (or the engine test that covers `applyGrid`) | M   | The machine behaviours in AC 3–6.                                                                                                                                                                                                   |
| `components/game/dial-button.tsx`                                    | M   | When the key's `value` changes because of a scramble, the digit flips (the swipe's out-and-back, up if it rose, down if it fell).                                                                                                   |
| `components/game/dial.tsx`                                           | M   | Tells each key a scramble happened: a `scrambleSeq` taken from `hitBatch.seq` when `dial.scramble`.                                                                                                                                 |
| `modes/challenges/catalog.ts`                                        | M   | `SCRAMBLE` appended **last** to `CHALLENGES`.                                                                                                                                                                                       |
| `locales/{en,cs}/messages.po`                                        | M   | Label and description, Czech.                                                                                                                                                                                                       |
| `docs/domain.md`, `CLAUDE.md`                                        | M   | The **scramble** row and one-liner.                                                                                                                                                                                                 |

Randomness: the machine reads none (`machines/game.ts:270`). The scramble is seeded with
`seeded(idSeed(\`scramble:${runId}:${hits}\`))`from`lib/rng.ts`, where `hits`is the
count after this hit. It is the same answer every time for the same run and hit, so a
restored run and a test both see it. No`PRESS`/`SET_CELL`/`TICK` event gains a field.

### Data and types

- `DialSpec` gains `scramble: boolean`. `defineDial({ …, scramble?: boolean })`, default
  `false`. Every existing dial is unchanged, so every existing mode is too.
- `scrambleGrid(dial: DialSpec, grid: Grid, avoid: readonly number[], rng: Rng): Grid`.
  `avoid` is the shown numbers (`driftedValue` at `now`) of the targets still standing
  after this hit. Each key draws uniformly from the `dial.digits − 1` digits that are not
  its own. If the sum is in `avoid`, it draws again, up to a fixed cap. If the cap runs
  out, a deterministic fallback still meets both rules: keep stepping one key at a time
  to another digit that is not its own until the sum is clear. A dial with `digits < 2`
  can't scramble; `scrambleGrid` returns the grid unchanged, and the test pins that.
- Context, events and the saved run are unchanged. The grid is already saved, and
  `runId` and `hits` already come back with a restored run.
- No schema and no migration.

### Gates

| Gate            | Answer                                                                                                                                                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | `msg\`SCRAMBLE\``(label) and`msg\`Every hit scrambles the dial.\`` (description). Czech: label **ZAMÍCHÁNO**, description **Každý zásah zamíchá číselník.** (`číselník`is the catalog's word for the dial). Claims are plain`TitleWords`, as every catalog entry's are, so they are not extracted. |
| **How to Play** | **None.** The challenges chapter is deliberately vague (per the `challenge` skill). Accuracy, Hard, streaks and lives are all unchanged.                                                                                                                                                           |
| **Flag**        | **None.** A challenge reaches players only through a booked session (DRIFT's precedent).                                                                                                                                                                                                           |
| **Buttons**     | **None.** Nothing new to press.                                                                                                                                                                                                                                                                    |

### The entry

```ts
SCRAMBLE: base ACCURACY, fixedDifficulty 'hard', shot 'sniper', no hue (generated),
rules: { fixedDifficulty: 'hard',
         dial: defineDial({ id: 'scramble', rows: 3, cols: 3, scramble: true }),
         lives: { wastefulCostsLife: true } }
claims: board  [['ALL','NEW'], ['FAST','EYES'], ['READ','IT']]
        medal  [['NEAR','READ'], ['KEEN','EYES']]
        strong [['GOOD','READ'], ['CALM','KEYS']]
        cold   [['DIAL','LOST'], ['NO','HOLD']]
```

The dial id is `scramble`, not `nine`, so a run put away on it is never restored onto a
dial that holds still. Mark: nine dots, from the dial. Hue: generated from index 8.

## Acceptance criteria

1. `runRules(challengeId('scramble'), 'hard')` resolves to: `dial.scramble === true`,
   3×3 with weights 1–9, `scoring.streak === 'optimal'`, weights `0.85 / 0.15`,
   `lives.count === 3`, `lives.wasteful === 0.2`, `capabilities.board === false`.
2. Every other mode and challenge resolves to `dial.scramble === false`, and its rules are
   otherwise unchanged (the existing `rules.test.ts` and `challenges.test.ts` still pass
   untouched).
3. On a SCRAMBLE run, a press that hits a target leaves `context.grid` with **every** key
   different from the grid that made the hit.
4. After that hit, the sum of `context.grid` equals the shown number of **no** target
   still standing. Holds for every one of at least 1 000 seeded scrambles in
   `lib/scramble.test.ts`, with 1–4 values to avoid.
5. After that hit, each surviving target's `refGrid` is the scrambled grid and its `par`
   is `computePar` from the scrambled grid. Hitting it next on that par builds the
   `optimal` streak.
6. The hit itself is scored, streaked and life-checked against the grid the player
   dialled, before the scramble. A par hit still builds the streak; a hit under 0.2 still
   costs a heart.
7. A press that hits nothing leaves the grid exactly as pressed: no scramble.
8. The same run id and hit count always give the same scrambled grid, and a SCRAMBLE run
   put away and restored mid-run comes back on the grid it was put away on.
9. On device, every key's digit visibly flips to its new value on each hit. A swipe the
   player is still making after the hit lands on the scrambled value; nothing throws.
10. SCRAMBLE is last in `CHALLENGES`, and every earlier challenge keeps its hue
    (`palette.test.ts` green).
11. `pnpm check` is green, `pnpm i18n:verify` included, with the label and the
    description in Czech.
12. On the challenge card, the name breaks only where a soft hyphen says, in both
    locales: never mid-word on its own (added by verify).
13. A key that was pressed onto the hit never lands back on the digit it showed before
    that press. Every key still differs from its dialled digit (added by review).
14. A press still in flight when a scramble lands is sent, never dropped, and once the
    gesture ends the dial answers every key from what it shows. Moves later in a drag
    that a scramble interrupted are ignored (added by review).

## Tests

- `lib/scramble.test.ts` (new): every key changes; the sum avoids `avoid` over ≥1 000
  seeds; deterministic for a fixed rng; the fallback path (an rng that keeps hitting
  `avoid`) still terminates and meets both rules; on four-keys and four-by-four dials
  too; `digits < 2` returns the grid unchanged.
- `modes/dial.test.ts`: `scramble` defaults to false.
- Machine test: AC 3, 5, 6, 7 on a SCRAMBLE run, plus a non-scramble mode keeping its
  grid on a hit.
- `modes/challenges/challenges.test.ts`: AC 1 resolved once.

## Review focus

1. **The seed.** `hits` must be the count after this hit, read from the value
   `applyGrid` computes, not `context.hits`. Otherwise two hits in a row could share a
   seed and repeat a grid. (task 3)
2. **Order inside `applyGrid`.** Streak facts (`allOptimal`, `allWhole`), the bar check
   and the points must all read the dialled `newGrid`. Only the returned `grid` and the
   survivors' `refGrid`/`par` read the scrambled one. One misplaced variable silently
   scores the wrong grid. (task 3)
3. **`avoid` is shown numbers, not `value`.** Use `driftedValue` at `now`, so the rule
   still holds if drift is ever combined with scramble. (task 3)
4. **The dial's in-flight commands.** `dial-button`'s `owed` delta can land after the
   scramble and step a key that has just jumped. That is acceptable (the move is relative).
   Check that the flip animation for the scramble and an owed flip don't fight over
   `numTranslateY` and leave a digit invisible. (task 4)
5. **Append, never insert.** Inserting into `CHALLENGES` recolours every later
   challenge. (task 5)
