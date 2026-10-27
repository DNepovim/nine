# Sideways — Plan

Spec: docs/work/2026-10-26-sideways/spec.md

## Tasks

- [x] 1. `modes/dial.ts` — `DialOrientation`, `DialSpec.orientation`, `defineDial` default upright; `modes/dial.test.ts`
- [x] 2. `lib/dial-gesture.ts` — `ORIENTED` + worklet `orientMove`; `lib/dial-gesture.test.ts`
- [x] 3. `components/game/dial.tsx` — `commit` orients the move; pass `dial.orientation` to each key
- [x] 4. `components/game/dial-button.tsx` — the digit's box turned −90° on `'sideways'`
- [x] 5. `modes/challenges/catalog.ts` — `SIDEWAYS` appended; `challenges.test.ts`
- [x] 6. `pnpm i18n:extract` + Czech; CLAUDE.md orientation row

## Build notes

- **Task 3:** `commit` reads `dial.orientation` into a local before the worklet, so the
  UI thread holds a string rather than the spec. `exitMove`, `liftMove` and `travelled`
  are untouched and still measure the screen move.
- **Task 4:** the turn is a NativeWind class (`-rotate-90`) on a plain `View` around the
  digit, from a `DIGIT_TURN` map keyed by orientation (`className` over `style`, per
  code-guide). The squash, the halo, the fills and the badges are outside it.
  `orientation` is optional on `DialButton`, defaulting to upright; its one caller, the
  dial, always passes it.
- **Task 5:** the label carries the soft hyphen (checked in the bytes). Czech `NA BOK`
  is two short words and needs none.
- **No dev fixtures:** a session is booked like any other, and verify books one locally.
- **Self-check:**
  - AC 1–3 and 11 are covered by tests and the catalog check.
  - AC 7 follows from par counting presses.
  - AC 4–6, 8–10 are on-screen; verify drives them, web included.

## Review

`/code-review high` (9 findings; resumed after a usage-limit stop) and `simplify` (two
reviewers: reuse with simplification, efficiency with altitude).

**Review focus:** all five confirmed.

- The move is oriented before `allowedMove`, and crossings are measured on the screen move.
- Only the digit and the bounce turn.
- The digit stays centred.
- `orientMove` is a worklet over a module constant.
- SIDEWAYS is appended, and the only dial not upright.

**Fixed in review:**

- The pill's flip bounce ran on screen-y while the digit flew on screen-x. Both now come
  from one `FLIP_FRAME` per orientation; the bounce runs along x when sideways.
- The digit's turn lives in its own transform, with no wrapper view on every key.
  Upright keys carry no rotate and no dead `translateX`.
- The medal claim HALF TURN contradicted a quarter turn; it is now NEAR LEVEL · SIDE
  STEP.
- SIDEWAYS's window no longer copies NO SLIP's day.
- The `orientMove` test name and the `MOVE_DIRECTION` comment now say which frame
  each is in.
- A hoisted `orientation` local with a misleading comment is removed.
- `orientation` is required on `DialButton`: its one caller always passes it, and a
  silent upright default would hide a forgotten prop.
- A duplicate dial test is removed.
- Re-checked on screen after the animation changes: every gesture reads as before, and
  the digit and the pill leave together.

**Left, with reasons:**

- **Lesson and Trainee pieces still read the screen frame:** `DialAxes`/`dialFactors`,
  `RouteHint`'s arrows, `GestureHint`'s mime, the corner badges and the peak gradient.
  Latent: SIDEWAYS is Accuracy and shows none of them. Out of scope in shape.
- **The quarter turn is encoded three times:** the move map, the flip frame and the
  hand-written weights. Nothing ties them; a test pins each.

**How to Play:** needs nothing. No permanent mode's controls moved, and the challenges
chapter names no dial.

**Worth its own item later:**

- One orientation table in `modes/dial.ts` (moves, turn, bounce axis), with `defineDial`
  deriving turned weights.
- Rotating the dial's container once and mapping coordinates in `cellAt`/`exitMove`, so
  every screen-frame piece turns with it. That is the prerequisite for a sideways
  Trainee or a coached sideways challenge.

## Verification log

**Verdict (2026-10-26): 11 of 11 PASS, 0 FAIL, 0 SKIPPED.** Native (iOS/Android) was not driven:
the turned digit was checked on the web build only, which is the one spec's rabbit hole
named.

Suite: `pnpm check` green (906 messages, 2,040 tests) after Prettier reformatted
`dial-button.tsx`.

App: Expo web on :8081 in headless Chromium (Playwright), 390×844 unless noted. A SIDEWAYS
session `5e55911a-…0006` was booked in the **local** DB.

| #   | Criterion                                                       | Result | Evidence                                                                                                            |
| --- | --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 1   | SIDEWAYS resolves to Accuracy Hard on the turned dial           | PASS   | `challenges.test.ts` › SIDEWAYS                                                                                     |
| 2   | Every other dial is upright                                     | PASS   | `dial.test.ts`; catalog check that SIDEWAYS is the only turned dial; existing tests unchanged                       |
| 3   | `orientMove` maps                                               | PASS   | `dial-gesture.test.ts` › orientMove                                                                                 |
| 4   | Digits lie on their side, top to screen-left; upright elsewhere | PASS   | run screenshot: every key's digit turned; Accuracy keys upright                                                     |
| 5   | Swipes read turned; digit flies the way of the swipe            | PASS   | from 0: tap → 1, left → 2, right → 1; key 4 up → 9, down → 0; mid-swipe frame shows key 8's digit leaving leftwards |
| 6   | Drags turned on SIDEWAYS; Accuracy unchanged                    | PASS   | drag left across the bottom row: 0 0 1 → 1 1 2. Accuracy: up +1, left → 0, right → 9, down −1                       |
| 7   | Par routes made sideways score as exact                         | PASS   | 57 at par 2 and 305 at par 8, both walked with sideways swipes: 2 hits, 2 strikes, AVG ACC 100%                     |
| 8   | Card shows nine dots; dialog draws SIDE / WAYS                  | PASS   | card: SIDEWAYS and nine dots. Dialog SIDE over WAYS, whole, at 375, 390 and 430 px                                  |
| 9   | Claims from SIDEWAYS's pools                                    | PASS   | a run left to lose its hearts ended on **TIPPED OVER** (`cold`)                                                     |
| 10  | Web renders the turned digits, centred                          | PASS   | the screenshots are the web build: digits turned and centred in their keys                                          |
| 11  | `pnpm check` green, Czech                                       | PASS   | see Suite; NA BOK / BOK / "Číselník spadl na bok."                                                                  |

**Not criteria:**

- The trainee badges and the peak fill stay upright, as agreed in spec; neither appears on
  a challenge run.
- The local session is closed and the fixtures are restored.
