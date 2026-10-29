# Drift — Plan

Spec: docs/work/2026-10-27-drift/spec.md

## Tasks

- [x] 1. `lib/target-drift.ts` (+ test) — `driftedValue`, `driftRange`
- [x] 2. `modes/` — `spawn.drift` (types, base null, resolved); `fresh` + `allFresh` in `modes/streak.ts`; rules test
- [x] 3. `machines/game.ts` — `Target.drift`, `ADD_TARGET.drift`, hit match on `driftedValue`, `allFresh` in `streakFactsOf`; machine tests
- [x] 4. `hooks/use-target-spawner.ts` + `app/(tabs)/index.tsx` — direction, `driftRange`, exclusions at now
- [x] 5. `use-displayed-targets.ts`, `target-card.tsx`, `pie-countdown.tsx` — stepping number + ▲/▼, frozen with the ring
- [x] 6. `lib/saved-run.ts` (+ test) — `drift` round-trip
- [x] 7. `lib/strike-rule.ts` line; `modes/challenges/catalog.ts` DRIFT; challenge test
- [x] 8. `pnpm i18n:extract` + Czech; CLAUDE.md drift row

## Build notes

- **Order:** the catalog entry (task 7) came before tasks 4–5, because the machine tests
  need a drifting mode registered. The strike line came with task 2, since the
  `StreakTrigger` union made it a type error.
- **`isFresh`:** added beside `driftedValue` in `lib/target-drift.ts` (tested). It is false
  wherever `spawn.drift` is null, per review focus, so `fresh` can never build on a mode
  without drift.
- **A hit still reports the arrival value** (`HitInfo.value = t.value`), not the drifted
  one. The board finds a hit's card by that number: the hit exit
  (`use-displayed-targets.ts`) and the burst's aim (`index.tsx`, `aimRef`). A drifted value
  there leaves a hit card without its exit and the shot aimed at nothing. The card still
  shows the number it was hit at, because its own steps stop with its ring.
- **The spawner keeps clear of standing targets' arrival values as well as their values
  now**, so two cards never share the number the board knows them by.
- **The spawner takes the standing targets** (`standing`) rather than their numbers: a
  drifting number is only true at a moment.
- **The range helper is `rangeFor`**, a module-level function with early returns, plus a
  `coin()` for the direction. This avoids two nested ternaries (code-guide).
- **The pie's steps** are counted off its own ring, through `useAnimatedReaction` →
  `scheduleOnRN(setMoved)`. So the number stops when the ring stops (pause, hit), and a
  card put back mid-clock starts at its target's steps.
- **The arrow** is `GLYPH.sm`, in the pie's ink, on the side the number moves towards.
- **Czech:** UNÁŠENÍ is seven letters. Verify checks the dialog in Czech, and adds a soft
  hyphen to the msgstr if it overflows.
- **No dev fixtures:** a session is booked like any other.
- **Self-check:**
  - AC 1–7 and 10 are covered by tests: rules, `target-drift`, the machine, saved run.
  - AC 8: the restore part is tested; the pause part is by construction (spawnedAt and
    the ring both stop).
  - AC 9 and 11 are on-screen, for verify.

### Reopened by verify (AC 9), first trip back

- [x] 5b. The ▲/▼ moved just outside the disc, `bottom-full` (above) for a rising number
      and `top-full` (below) for a falling one. At two digits the number fills the disc top
      to bottom, so no place inside it clears the digits.

### Reopened by review (2026-10-29), the item's second trip backwards

- [x] 9. The card's number is `driftedValue(target, now, step)`, kept current by a timer
      that wakes at each step boundary and stops while the card is frozen or leaving. It is
      not counted off the ring.
  - The pie takes the number it is given, so its band tint follows the drifted number.
    It loses the `useAnimatedReaction`, so cards that don't drift run no per-frame
    worklet.
  - `use-displayed-targets` refreshes `spawnedAt` from the machine as it does
    `duration`, so a card resumes on the shifted clock.
  - Covers review findings 1–4 and 9.
- [x] 10. `isFresh` is false for a target whose own `drift` is 0, with a test (finding 6).
- [x] 11. One shared `targetDuration(rules, hits, playerClockMs)` in `modes/rules.ts`, read
      by `ADD_TARGET` and the spawner (finding 5).
- [x] 12. The ▲/▼ goes back inside the disc as a small glyph at its very top or bottom
      edge, clear of the digits and inside the card's box, so placement never has to know
      about it (finding 7).

Tasks 9–12 done:

- `hooks/use-drifted-value.ts` keeps a card on `driftedValue`, woken at each step
  boundary and held while frozen or leaving.
- The pie draws the number it is given (tint included) and runs no worklet for drift.
- `use-displayed-targets` refreshes `spawnedAt`.
- `isFresh` asks the target's own direction (+ test).
- `targetDuration` is shared by `ADD_TARGET` and the spawner; the machine no longer
  imports `rampedTimeout`.
- The arrow is `GLYPH['2xs']` at `top-[2%]`/`bottom-[2%]`, inside the disc.

## Review

First pass, 2026-10-29. `/code-review high` returned 10 findings; it was resumed after a
usage-limit stop.

**Review focus:** all five confirmed.

- "Now" versus "arrival" readers are sorted.
- Card and machine agree at the boundary on screen.
- The spawner's ring is `ADD_TARGET`'s.
- `isFresh` is false without a step.
- The saved run defaults the direction.

**Reopens build (tasks 9–12):** findings 1–7 and 9.

**Left, with reasons:**

- **`reach` is ignored on a drifting target (8):** no mode sets both, and intersecting the
  two ranges is a rule nobody has asked for yet.
- **AVG ACC still recorded on a speed-only mode (10):** Speed records it the same way. A
  speed headline already leads the stats.

### Second pass (2026-10-29, after tasks 9–12)

`/code-review high` (8 findings) and `simplify` (two reviewers).

**Fixed in review:**

- **A stopped card no longer re-reads the clock** (`useDriftedValue` updates only while
  running). A hit card was moving on to the next step as it left.
- **`rangeFor` moved to `lib/target-value.ts` (+ test)** with its dead null check gone.
  The spawner builds one `drifting` value (null on still runs, which skip all the drift
  work), and `taken` adds a drifted number only for a target that drifts.
- **One `Drift` / `Heading` type** (`lib/target-drift.ts`) in place of about ten
  hand-written unions. "Still" is spelled `0` everywhere: the pie takes `drift: Drift`
  and the card passes `target.drift`.
- **`msToNextStep` (+ test)** beside `driftedValue`, so all the step arithmetic is in one
  tested file.
- **`applyGrid`** splits hit from standing in one pass, reading each target's number once
  per press.
- `pnpm check` green (2,065 tests). Re-checked on screen: the arrows are inside the disc
  (239 ▲, 285 ▼), the card steps 66 → 62 once a second, and a press while it read 62 took
  it.

**Left, with reasons:**

- **The card turns a frame after the machine (finding 2):** inherent to drawing; the
  ring has it too.
- **Accuracy figures on a speed-only mode (4):** as Speed.
- **Latent for drift combined with rules DRIFT doesn't use (5, 6, 8):** a player-set
  clock rescaling `spawnedAt`, a ramping clock read a render late, and smaller cards with
  a fixed arrow.
- **The display copy's mirrored fields:** per field on purpose (a press rewrites
  `userSteps` on every target), and named in its comment.
- **A number drifting onto the sum already dialled isn't taken until a press (3).** That
  is AC 6, settled with the advisor. The code reviewer argues it fights the challenge's
  premise, and it shapes how DRIFT plays, so it goes to the user as a choice after ship
  rather than being changed here.

**Worth its own item later:** a time-driven hit check (`TICK`) if the user wants a number
drifting onto the sum to count; drift age on its own anchor, for a future player-set
clock.

### Amended by the user (2026-10-29): a drift onto the sum is a hit

- [x] 13. `machines/game.ts`: a `TICK { now }` event. In play it hits any target whose
      drifted value equals the dialled sum, through `applyGrid` with no press counted, and
      ends the run where a press would.
- [x] 14. `hooks/use-drift-ticks.ts`: sends `TICK` at the next step boundary of any
      drifting target while playing, and nothing on runs with no drift. Wired in
      `app/(tabs)/index.tsx`.
- [x] 15. Machine tests: a tick hit; no tick hit when nothing matches; the press count
      untouched; a tick hit is not fresh.

### Third trip back (2026-10-29), approved by the user: four defects in the drift-onto-sum hit

- [x] 16. **A hit reports the number it took the target at** (`HitInfo.shown`). The display
      copy carries it as `takenAt`, and a leaving card shows it. A card taken by a `TICK`
      could otherwise leave a step behind, because its own timer stopped first.
- [x] 17. **`useDriftedValue` reads only when its own clock moves.** Starting to run again
      reads nothing. This ends the one-frame flash on resume, when the card's copy of
      `spawnedAt` had not yet caught up with RESUME's shift.
- [x] 18. **`driftPath` (+ test):** the spawner keeps a drifting target's whole path clear
      of the sum standing on the dial, so a parked dial collects no free hits.
- [x] 19. **A tick takes only a target with clock left.** This is in `applyGrid` for
      `press` 0 and in `driftLanded`. A machine test uses a falling 29 that reads 12 at 17 s,
      after its 16.5 s ring.
- Lint: the hit lookup moved to a module-level `departure` (no-nested-functions).
- `pnpm check` green, 2,071 tests. On screen:
  - a falling card read the dialled 46 and was taken without a press
  - 308 ▲ held through a pause, then stepped to 309

**Left from that review, with reasons:**

- **A tick hit breaks the `fresh` chain:** the user's rule, "any later hit breaks it".
- **No grace window at a step boundary:** inherent to drawing a number.
- **Accuracy figures on a speed-only mode:** as Speed.
- **`TICK` repeats `PRESS`'s guard shape:** cosmetic.
- **`reach` dropped on a drifting run:** no mode sets both.

**Worth its own item later:** match a hit to its card by target id rather than arrival
number. That would retire `HitInfo.value` as a key, the spawner's arrival-value
exclusion and the explaining comments.

Shipped: `4dab5fc` on main, **not deployed** (user: not now). The drift domain row sits uncommitted in `CLAUDE.md` and `docs/domain.md`, for the user to commit.

## Verification log

**Fourth pass (2026-10-29, after the user's AC 6 amendment): 12 of 12 PASS.** `pnpm check`
green (2,068 tests).

- **AC 6 (amended):** dialled 67 ahead of a 63 ▲ card. It read 64, 65 and 66, then 67 at
  23.9 s, and was gone by 24.4 s with no press. The session row records 1 hit (70
  points).
- Machine tests cover the rest:
  - a `TICK` landing a target on the sum takes it, with no strike (it had moved)
  - a tick landing on nothing leaves the run untouched
  - a tick counts no press, and resets the other targets' references as a hit does
- The session is closed and the fixtures are restored.

**Third pass (2026-10-29, after review's tasks 9–12): 12 of 12 PASS.** `pnpm check` green
(2,062 tests). The Expo web server was restarted for it.

- **Card and machine agree:** dialled 103 ahead of a 99 ▲ card. The moment the card read
  103, a press away and back took it (HITS 1).
- **AC 6 still holds:** dialled 136 ahead of a 140 ▼ card. It read 137, then 136 for a
  second, then 135 and on, with no hit (HITS 0).
- **AC 8 still holds:** 230 ▼ at MENU, still 230 after CONTINUE, then 229.
- **AC 9:** the ▲/▼ sits inside the disc at its very edge, clear of the digits (131 ▼,
  301 ▲). The 301 card is tinted for the 300s, so the band follows the drifted number.
- The session is closed and the fixtures are restored.

**Second pass (2026-10-27): 12 of 12 PASS.** `pnpm check` green.

- **AC 9:** the board with two drifting cards (188 ▲, 145 ▼) shows ▲ above the rising card
  and ▼ below the falling one, clear of both numbers.
- **AC 11, in Czech:** the card reads UNÁŠENÍ, and the description and strike line are
  Czech. At 375 px the dialog broke the name **UNÁŠEN / Í**, as GLIMPSE did.
  - **Fixed in verify** as the anticipated one-character copy fix (the build notes named
    it): a soft hyphen in the Czech msgstr, `UNÁ­ŠENÍ`. It now draws **UNÁ / ŠENÍ**.
  - That is the only change verify made.
- The browser is back in English, the local session is closed, and the fixtures are
  restored.

### First pass

**Verdict (2026-10-27): 11 of 12 PASS, 1 FAIL (9), 0 SKIPPED.** Hand back to `/build drift`
for task 5.

Suite: `pnpm check` green (910 messages, 2,061 tests).

App: Expo web on :8081 in headless Chromium (Playwright) at 390×844, with a DRIFT session
`5e55911a-…0009` booked in the **local** DB. The driver read each card's number and its
▲/▼ from the page and dialled par routes.

| #   | Criterion                                                           | Result   | Evidence                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DRIFT resolves                                                      | PASS     | `challenges.test.ts` › DRIFT                                                                                                                                                                                                                                                        |
| 2   | No other mode drifts                                                | PASS     | `rules.test.ts` › the drift; catalog check; existing tests unchanged                                                                                                                                                                                                                |
| 3   | `driftedValue`                                                      | PASS     | `target-drift.test.ts`                                                                                                                                                                                                                                                              |
| 4   | `driftRange` 0…307 / 17…324, never off the dial                     | PASS     | `target-drift.test.ts`                                                                                                                                                                                                                                                              |
| 5   | A press hits the drifted value, not the stale one                   | PASS     | machine tests; on screen, a 262 ▼ card was taken by the press that made 260 as the card read 260                                                                                                                                                                                    |
| 6   | Drifting onto the sum is not a hit                                  | PASS     | sum dialled to 13 ahead of a 9 ▲ card: it read 12, then 13 (one second on the sum), then 14…20. HITS 0                                                                                                                                                                              |
| 7   | `fresh` builds and breaks                                           | PASS     | machine tests; on screen, 1 strike among 2 hits                                                                                                                                                                                                                                     |
| 8   | Pause stops the drift; a restore resumes it                         | PASS     | 113 ▲ at MENU, still 113 after CONTINUE three seconds later, then 114; restore round-trip in `saved-run.test.ts`                                                                                                                                                                    |
| 9   | Card draws the value and a ▲/▼; steps once a second; stops on pause | **FAIL** | Stepping (20 → 22 in two seconds) and the pause hold work, but **the ▲ overlaps the digits**: on "22" it sits between the two 2s, at the top. `pie-countdown.tsx` places it `top-[12%]`, inside the large two-digit figure. The arrow has to clear the number at every digit count. |
| 10  | Speed-only scoring; AVG SPD                                         | PASS     | machine test (one press vs nine, same score); pause and game-over stats read AVG SPD                                                                                                                                                                                                |
| 11  | Dialog name and strike line; claims                                 | PASS     | dialog: DRIFT, "Every number drifts. Catch it before it moves.", strike "Take every target before its number has moved."; game over **QUICK DRAW** (rank 1). Czech dialog not driven; see below                                                                                     |
| 12  | `pnpm check` green, Czech                                           | PASS     | see Suite                                                                                                                                                                                                                                                                           |

**Reopens for build:** task 5. Place the ▲/▼ so it never overlaps the number, at one,
two and three digits.

**Not checked:** the Czech dialog's UNÁŠENÍ width, as the advisor asked. Check it on the
next pass.
