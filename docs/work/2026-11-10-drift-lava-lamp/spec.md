# Lava lamp (DRIFT dressing)

Slug: drift-lava-lamp
Stage: build
Next: /verify drift-lava-lamp
Track: small
Branch: feat/drift-lava-lamp
Started: 2026-11-10

## Problem

DRIFT's one thing is a number that steps ±1 every second, and the screen shows it as a plain
disc whose digit quietly changes. Which way a target is heading — the thing the player has to
aim by — is only found by reading the digit twice. The rules are right (`DRIFT` in
`modes/challenges/catalog.ts`); what is missing is the dressing, the same shape as the rest of
the dressing queue (FOUR KEYS' drawing board, HABIT's dance floor).

## Appetite

A day or two. An opening, a scheme and a target form — no rule changes, so the board stays
comparable. If the morphing blobs cost more than that, the shape gets smaller (fewer lobes,
one morph per card), never the day.

## Shape

The theme is a lava lamp, picked from five costed directions.

- **Scheme `lava`.** Pink. The ground is a deep pink-to-magenta glass; ink and chrome follow
  the same family. One new `SCHEMES` entry in `constants/colors.ts`.
- **Target form `blobs`.** Each target is a lump of wax, not a disc.
  - **Colour is the number.** Its fill sits on a purple → pink scale by the number it shows
    _now_ (`driftedValue`): low is purple, high is pink. So a rising target warms toward pink
    and a falling one cools toward purple — the direction reads from colour before the digit.
  - **Shape morphs.** The outline is a closed curve of a handful of lobes whose radii
    breathe out of phase, so the wax stretches, pinches and swells like a lamp's. Each card
    has its own phase so nine blobs are never in step.
  - **Heading reads from motion.** A rising target drifts up inside its card and stretches
    toward the top (teardrop head up); a falling one sinks and stretches down. A target that
    has not drifted yet (its first second, the `fresh` window) sits round and still.
  - **On a step** the blob gives one soft pulse as the digit changes.
- **Opening `lavaLamp`.** Full take: the screen starts in day colours, the lamp warms — the
  glass fades to the pink scheme from the base up, a puddle of wax glows at the foot, and the
  first blob breaks off the base and rises as the first target arrives. The run waits in
  `ready` until BEGIN. Short take (a run dealt again): the glow only, quickly. Wax and glow
  stay behind the run as the **remains**, a slow lamp behind the dial.
- **Shot** stays `burst`; **dial buttons** stay at the default.

Areas: `constants/colors.ts` (scheme), `modes/types.ts` + `modes/challenges/catalog.ts`
(`opening`, `scheme`, `targetForm` on `DRIFT`), `components/game/target-forms.tsx` and one new
target card, `components/game/opening-layer.tsx` and one new `openings/` scene, a pure
`lib/` helper for the blob outline and the colour scale (unit-tested), the dev sidebar
(longest-number / variant check). A **mode's business**: all of it hangs off `DRIFT`'s
catalog entry; nothing in the engine names it.

## In

- Pink `lava` scheme, `blobs` target form, `lavaLamp` opening with its remains.
- Colour on a purple → pink scale by the drifted number.
- Morphing outline, heading read from motion, a pulse on each step.
- Unit tests for the outline curve and the colour scale.

## Out

- Any change to DRIFT's rules, scoring, streak, shot or range. The board stays comparable.
- Dial buttons dressed as lamp parts (default for now).
- An outro, and sound.
- A feature flag — none asked for.
- A touch interaction on the lamp (shake, tap the glass).

## Rabbit holes

- **Morphing on every card, 60 fps.** react-native-svg has no blur/threshold filter, so no
  true metaballs. Way round: a parametric closed curve, radii driven by one shared clock
  value per card and written to the path on the UI thread (`useAnimatedProps`). If nine
  cards stutter on a low-end phone, drop to fewer lobes before dropping the morph.
- **Legibility.** A digit on a wobbling pink-to-purple fill must hold contrast across the
  whole scale. Resolve against the `design-guide` contrast rules; if no one ink works at both
  ends, the digit gets a ground-coloured plate or flips ink at the midpoint.
- **A shape that hides the hit area.** The blob's morph must not move the touch target, and
  the reading of the number must stay at the card's centre (a nickname-sized box is not at
  stake here, but a ten-digit-wide one is not either).
- **The colour scale's range.** The drifted number can run past a card's arrival range; the
  scale clamps at the dial's reachable sums rather than wrapping.

## Tasks

- [x] 1. `lib/wax.ts`: the outline curve (points, phase, heading stretch) and the purple → pink
      scale by value — pure, tested (`lib/wax.test.ts`).
- [x] 2. `lava` / `lavaBar` schemes in `constants/colors.ts` (`LAVA`); `lava`, `lavaLamp`, `blobs`
      added to `SchemeKind`, `OpeningKind`, `TargetForm` and the registry's opening tables.
- [x] 3. The `blobs` target card (`blob-target.tsx`, `wax-blob.tsx`) and its entry in `TARGET_FORMS`.
- [x] 4. The `lavaLamp` opening scene (`openings/lava-lamp.tsx`), full and short takes, with
      its remains.
- [x] 5. `opening`, `scheme` and `targetForm` wired onto `DRIFT`; catalog and machine tests updated.
- [x] 6. No copy came in, so `i18n:verify` is clean without an extract; How to Play untouched, since
      no rule changed.

## Acceptance criteria

1. DRIFT plays under a pink scheme, and every other challenge and mode is unchanged.
2. Every target is a morphing blob; no two are in step.
3. A blob's colour moves toward pink as its number rises and toward purple as it falls,
   clamped at the ends of the scale.
4. A rising target creeps up the screen and stretches upward, a falling one creeps down and
   stretches downward, and a target inside its first second sits round and still.
5. The number, written on the wax with no disc behind it, is readable at both ends of the scale.
   5b. The wax shrinks as the ring runs down, and a target still expires, is hit and is lost as before.
6. The full opening ends in `ready`; BEGIN deals the first target. The short take is quick.
7. DRIFT's score, streak, hearts and boards behave exactly as before; its existing tests pass.
8. `pnpm check` is clean.

## Build notes

Differs from the shape, and why:

- **The scheme is the lamp's from the first frame**, like the ballroom's and the tilework's,
  rather than the day colours turning pink as the scene goes. The warming is the pool of light,
  the puddle and the lump, not a change of the screen. Nothing in the criteria needed the switch.
- **Revised after the first build, on the user's word:** a rising bubble creeps **up** the screen and
  a falling one **down**, slowly (`CREEP`, 4 px a second, from the moment its number first moves),
  the number moving with it. And there is **no disc**: a target is the wax with its number written
  on it (`bare` on `TargetCard` / `PieCountdown`), the numeral white (`LAVA.numeral`, 9.6:1 on the
  purple end, 4.2:1 on the pink end — fine for a numeral this large).
- **The challenge's colour is the top bar's** (`LAVA_PAIR` in `modes/challenges/palette.ts`: `LAVA.bar`
  aubergine and a lifted magenta, 7.0:1 on white), not the catalog index's lime (80°), which was the
  colour of nothing in the lamp.
- **With no ring drawn, the wax is the clock.** It keeps all its size on arrival and shrinks to 62 %
  as its ring runs down (`LEAST`); the ring still runs underneath and still expires the target.
  The bubble's drift and its size are both read off one `age` value, so they cannot disagree.
- **The opening's lump goes purple → pink as it climbs**, through `WaxBlob`'s `warmMs`.
- DRIFT now `opens`, so its machine tests send `BEGIN` after `START`.

Checked by me: `tsc` clean, `vitest` 2363 passing, eslint 0 errors, `knip` and `i18n:verify` clean.
Not checked, because it needs the app running: that nine breathing paths stay smooth on a real
device, that the digit reads at both ends of the scale, and the look of the opening — that is
`verify`'s.

## Verification log

Verdict: stopped. 3 PASS, 5 SKIPPED (2–6): the app could not be driven to a DRIFT run, see below.

Suite (`pnpm check`): red for two reasons that are not this work. `app/(tabs)/index.tsx:794`
(`sonarjs/cognitive-complexity` 29 > 20) fails the same way on `HEAD`, and eslint also walks the
git-ignored `.claude/worktrees/road-bandits` checkout (11 errors there). Prettier flags
`components/overlays/replay-consent-overlay.tsx`, also as committed. `tsc`, `knip`, `i18n:verify`,
and all 2363 tests are green, and nothing this work added is flagged.

| #   | Criterion                                         | Result  | Evidence                                                                                                      |
| --- | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Pink scheme; every other mode/challenge as it was | PASS    | `challenges.test.ts` — DRIFT is `lava`; every undressed mode still `day`, no opening, `discs`                 |
| 2   | Every target a morphing blob, none in step        | SKIPPED | needs the app; `lib/wax.test.ts` proves two phases give two outlines                                          |
| 3   | Colour warms as the number rises, clamped         | SKIPPED | `waxColor`/`waxHeat` tested; the card's wiring needs the app                                                  |
| 4   | Rising leans up, falling down, fresh is still     | SKIPPED | `waxPoints` tested (head up/down, life 0 round and still); the card's `wakeIn` needs the app                  |
| 5   | The digit reads at both ends of the scale         | SKIPPED | measured: aubergine ink on the card tint is ≥ 8:1 at both ends by construction; needs a look at the real disc |
| 6   | Full opening ends in `ready`, BEGIN deals; short  | SKIPPED | `runRules(drift).opens` true and the machine tests BEGIN into play; the scene itself needs the app            |
| 7   | Score, streak, hearts, boards unchanged           | PASS    | `challenges.test.ts` DRIFT block and all 14 `machines/game.test.ts` DRIFT tests pass; no rule file touched    |
| 8   | `pnpm check` clean                                | PASS*   | *nothing of this work is flagged; the three failures above are on `HEAD`, outside it                          |

Why 2–6 are skipped: DRIFT's window closed on 28 Oct, and the intro only offers a challenge through a
live row in `challenge_sessions`, which the local database does not have. Opening the window by hand
(temporarily, now restored) lets `usePersistedMode` accept `challenge/drift`, but the app kept
restoring a saved paused run (an Accuracy one, then FOUR KEYS) over the stored mode, four tries in. The
dev server on :8081 was already running this checkout and picked the new files up (no errors on load).
What is needed is a live DRIFT session in the local database (book one in the admin planner), or a
dev-sidebar way into a run of any challenge.
