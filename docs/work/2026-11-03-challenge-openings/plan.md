# Challenge openings and schemes — Plan

Spec: docs/work/2026-11-03-challenge-openings/spec.md

## Tasks

- [x] 1. Rename `Submode.opening` → `setup` (`modes/types.ts`, `modes/definitions/tutorial.ts`, `machines/game.ts`, `machines/coach.ts`, tests); suite green
- [x] 2. `modes/` — `OpeningKind`, `SchemeKind`, `opening`/`scheme` on mode and `ChallengeSpec`, `RunRules.opens`, `openingOf`/`schemeOf`; BLACKOUT names both; tests
- [x] 3. `machines/game.ts` — `ready` state and `BEGIN`; START and both RESTARTs deal into it when `opens`; `machines/game.test.ts`
- [x] 4. `constants/colors.ts` `SCHEMES` + `hooks/use-scheme.tsx` (`SchemeProvider`, `useScheme`); completeness test
- [x] 5. Hex users on the game screen — only the sum row's ramp (`score-digit.tsx`) needed a scheme ink; every other hex is an accent or sits on a light disc and reads on both (decided in build)
- [x] 6. `app/(tabs)/index.tsx` — `isReady`, `SchemeProvider` at the game root, status bar, `BEGIN`, take selection; `opening_skip` button id
- [x] 7. `components/game/dial*.tsx` — scheme key inks, rim on dark keys, blackout gated on the switch
- [x] 8. `components/game/opening-layer.tsx` + `openings/lights-out.tsx` — the scene, full and short takes, skip, haptic
- [x] 9. `docs/domain.md` + `CLAUDE.md` rows; `pnpm check`

## Build notes

- **RESTORE lands in `paused`, not `playing`.** Criterion 2 and the data section said
  `playing`; the machine has always restored into a pause. What matters is that it never
  lands in `ready`. Spec amended.
- **`day` re-binds no tokens.** Its token map is empty, so it inherits `global.css`
  rather than copying it. The completeness test checks `dark` against the tokens it reads
  out of `global.css` itself.
- **Task 5 was smaller than the shape thought.** Of the fifteen files with hard-coded
  colours, only the sum row's ramp (`score-digit.tsx`) was drawn in the text ink. The
  rest are accents or sit on the light target discs, and read on both schemes.
  `SurfaceWash` also needed the scheme (a hex gradient under everything), so the
  scheme's inks gained `wash`.
- **`useOpening` hook** (`hooks/use-opening.ts`, not in the spec's file table): the
  take, the switch, the scheme and the status bar, moved out of `GameScreen` to keep it
  under the cognitive-complexity limit. `held` rather than `isReady`, because the
  screen already has an `isReady` from auth.
- **Copy is one string, not none:** the skip pressable needs an accessibility label.
  Spec's copy gate amended; Czech written.
- **The black flash at the click is drawn by the scene**, not by the screen. It covers
  the scheme swap, since tokens set through `VariableContextProvider` can't be animated.
- **Colours for the bulb** are `LIGHTS_OUT` in `constants/colors.ts`: a pale lamp-light,
  deliberately not `GOLD_SCALE`, which means a record held. Worth a look in review
  against the design guide.
- **Not driven yet:** criteria 4 and 11 (the scene on a device, and web) are for verify.
- No dev fixtures: nothing new is stored.

## Verification log

**Verdict (second pass, after task 10): PASS.** 14 of 15 criteria pass. Three checks
are SKIPPED: the haptic and the status bar (web shows neither; check on a phone) and the
opening from a session card (15).

Second pass: criteria 4 and 14 re-driven on web after task 10. BLACKOUT, NINE and MENU
read in the dark scheme's parchment. Day is untouched by construction (`run-top-bar`
skips the check on `day`). The suite's two new failures belong to the other session's
uncommitted session-ask work, not to this item: `lib/local-reset.test.ts` names their
new `nine.seen-session.v1` key, and `GameScreen`'s cognitive complexity went to 21 with
their `index.tsx` hunks (it passed at 20 with this item's alone, after `useOpening`).
When shipping, `index.tsx` and the `.po` files must carry only this item's hunks.

First pass:

Suite: green. `pnpm lint` reports 11 errors, all in
`.claude/worktrees/road-bandits/components/date-time-field.tsx`, another session's
worktree that lint sweeps. Lint on this checkout's own folders: 0 errors. One Prettier
fix in `score-digit.tsx`, taken here (formatting only).

Driven on web (`pnpm web`, Chrome at phone size), BLACKOUT started from the admin
Challenges lab.

| #   | Criterion                                                      | Result  | Evidence                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `opens` only for BLACKOUT, never under the tutorial            | PASS    | `challenges.test.ts` (blackout block, 6 tests)                                                                                                                                                                                                                                       |
| 2   | START/RESTART deal into `ready`; BEGIN starts clock            | PASS    | `game.test.ts` "a run that opens" (5 tests); RESTORE lands `paused` (amended)                                                                                                                                                                                                        |
| 3   | Other events ignored in `ready`; MENU leaves                   | PASS    | same tests                                                                                                                                                                                                                                                                           |
| 4   | Full take, then dark keys, then the run                        | FAIL    | Scene plays as specified (day screen with digits, lit bulb on flex, cord, then dark screen, rimmed black keys, no digits, sum row legible, targets arrive). **But the top bar's BLACKOUT label and NINE wordmark are near-black on the dark screen.** See 14. Haptic: SKIPPED (web). |
| 5   | RESTART from pause plays the short take                        | PASS    | Frames: black flash with dead bulb, then dark room with bulb fading, under 1 s                                                                                                                                                                                                       |
| 6   | A tap skips straight into the run                              | PASS    | Tap mid-scene: dark at once, first target dealt                                                                                                                                                                                                                                      |
| 7   | Pause/game over light, game screen dark under them             | PASS    | Pause screen in day colours over the dark run. Status bar icons: SKIPPED (web has no status bar)                                                                                                                                                                                     |
| 8   | HOME, then Accuracy is all day, no scene                       | PASS    | Intro in day colours; Accuracy run day, target at once, no bulb                                                                                                                                                                                                                      |
| 9   | Every other mode unchanged                                     | PASS    | Accuracy driven; the rest by `challenges.test.ts` ("only mode that opens", "every other mode … day")                                                                                                                                                                                 |
| 10  | `Submode.setup`; tutorial still opens on its setup             | PASS    | `modes/rules.test.ts`, `tutorial-lesson`, `tutorial-board` tests (108)                                                                                                                                                                                                               |
| 11  | Dark scheme renders on web, game screen only                   | PASS    | All of the above is web                                                                                                                                                                                                                                                              |
| 12  | Suite green; docs carry the three words                        | PASS    | Suite as above; `CLAUDE.md` and `docs/domain.md` have opening, scheme, ready                                                                                                                                                                                                         |
| 13  | _(added)_ A window shutting mid-scene ends the run after BEGIN | PASS    | `EXPIRE` is ignored in `ready` (test); the effect that sends it re-runs on `isPlaying` (`index.tsx:848`), so it fires once the run is in play                                                                                                                                        |
| 14  | _(added)_ Everything on the game screen reads on its scheme    | FAIL    | The top bar takes `accentFor(mode)` for the mode label and the wordmark (`app/(tabs)/index.tsx:473`, `:633`). For a challenge that is the challenge's own ink, which for BLACKOUT is black. On `dark` both nearly vanish.                                                            |
| 15  | _(added)_ The opening from a session card on the intro         | SKIPPED | No live BLACKOUT session locally. Started from the lab, the game screen sat offset to the left during the scene, as every admin screen does in this web frame; it was in place for RESTART from pause. Recheck on the real path.                                                     |

## Build — reopened by verify

- [x] 10. The top bar's mode label and wordmark read on the run's scheme (criterion 14): `readableOn` (`lib/contrast.ts`, tested) keeps a colour that clears 3:1 on the scheme's `ground` and falls back to its `ink`. Applied only off `day`, so every mode's look on day is exactly as before. The pause button takes the same colour as the title.

## Review

`/code-review high`, scoped to this item's files (the working tree also holds another
session's uncommitted session-ask work, which was out of scope). Ten findings.

**Review focus:** all five confirmed clean. Both RESTART paths go to `ready` (tested). A
held run is not `inRun` (`index.tsx:1079`). The scheme value is the module constant. The
dark-key gate is `opened = !held || switched`, decided in the render that lands in
`ready`. EXPIRE is caught after BEGIN (criterion 13).

**Fixed in review:**

- **A scene backgrounded mid-way started its run unwatched.** The scene's timer sent
  BEGIN while the app was away, and `usePauseOnBlur` only subscribes once the run is
  playing, after the change event had passed. It now pauses a run that starts while
  `AppState` is not active, so the player comes back to the pause screen. Generic: it
  covers any run that starts unwatched.
- **The feedback tab could be tapped over the scene**, starting the run under the
  dialog. `useOpening` now answers `inPlay` (held or playing), and the bookmark gate
  takes it in place of `isPlaying`.
- **The session cell on the best-scores line was black on dark**, the same defect as the
  top bar's. The check is lifted into `useLegible()` (`hooks/use-scheme.tsx`) and used
  by both.
- Cleanups: the duplicated comment above `useOpening`; `palette.ts` now uses
  `lib/contrast.ts` instead of its own copy of the WCAG maths; `LIGHTS_OUT` and
  `SCHEMES.day` reference `DIM_INK`, the dark card token, `SURFACE` and
  `SCORE_COLORS.high` instead of re-spelling them; the short take's click now lands
  after the tug's full `TUG_MS` (250 ms; the take is 850 ms).

**Verification of the review fixes:** typecheck and lint clean, 2137 tests pass. The one
failure is the other session's storage key (`lib/local-reset.test.ts`, `nine.seen-session.v1`).
Not driven: backgrounding mid-scene (needs a phone or a hidden tab with a live run) and
the session cell (needs a live BLACKOUT session; the lab deals none). Both are
straightforward by inspection; check them on device.

**Deliberately left:**

- **The four START/RESTART transitions stay explicit.** A shared `dealt()` helper does
  not type-check against xstate's transition config without `as` casts, which the code
  guide forbids. Their sameness is pinned by the test that drives every RESTART path.
- **The status bar during the resume beat and the death sequence** reads dark icons on
  the dark screen for under a second. It is native-only and cosmetic, and getting it
  right needs each overlay's own arrival state.
- **Two `SchemeProvider`s** (the wash and the game screen). Merging them would put the
  Trainee toast and the celebrations in between under the scheme. Harmless as is.

**Added at ship, asked for by the user:** the dead bulb stays hanging, grey, behind the
whole run instead of fading. An opening may now leave **remains** (`REMAINS` and
`OpeningRemains` in `opening-layer.tsx`; `LightsOutRemains` draws the same `Hanging`
layout the scene uses, so the hand-over is not a jump). Shown while the run plays, is
paused or is over, never on the intro. Seen on web on a restored BLACKOUT run.

**Shipped:** `f7accbe` on `main`, pushed; not deployed. Still to check on a phone
before a deploy: the haptic at the click, the status bar on the dark screen, and the
opening reached from a session card.

**Worth its own item later:**

- **Openings for the shipped challenges**, now that the mechanism exists (a mirror
  shimmer for MIRROR, a frost for FREEZE).
- **The `challenge` skill doesn't offer `opening` or `scheme`** among its decisions yet.
- **A design-guide pass** over the dark scheme's tokens and the bulb's lamp-light, which
  were chosen against contrast numbers rather than through the guide.
