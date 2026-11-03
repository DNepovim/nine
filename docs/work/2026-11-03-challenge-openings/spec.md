# Challenge openings and schemes

Slug: challenge-openings
Stage: shipped
Next: /deploy
Track: full
Branch: feat/challenge-openings
Started: 2026-11-03

## Problem

A challenge changes what the game _is_ for a day, but every run of one starts exactly
like an Accuracy run: the first target simply arrives on the familiar light screen. The
one thing the challenge is about is never _shown_ — on BLACKOUT the player is dropped
onto black keys with no moment that says the lights just went out, and the screen around
them is still the bright one every other mode is played on.

## Appetite

**A week** (decided by the user). Two new domain words, a new value on a mode, a scene that has to land, and a
second set of game-screen colours across components that today hard-code the light ones.
If it does not fit, the shape gets smaller — first to go is the scheme reaching beyond
the game screen (it already stops there), then the opening's polish, never the
abstraction.

## Shape

The player meets it like this, on BLACKOUT:

1. On the **intro**, they pick BLACKOUT and press PLAY GAME.
2. The **game** screen appears in its ordinary light colours. The dial shows its digits
   — the lights are on. No target yet; the clock has not started.
3. The **opening** plays over it: a bulb hangs from the top of the screen on a pull-cord.
   The cord is tugged, the bulb clicks off (a haptic with the click).
4. The **scheme** changes with the click: the screen crossfades to dark, the keys fade
   to black and their digits fade out.
5. The opening ends and the run starts — the first target arrives and the clock runs
   from here, never during the scene. A tap skips straight to this beat.
6. **Pause** and **game over** are overlays and keep their own light screens; the game
   screen under them stays dark.
7. **PLAY AGAIN** plays a **short** version — the click and the fade, about 0.8 s —
   where the first run of the session plays the whole scene (decided by the user). A
   **saved run** restored on launch skips it and comes back already dark.

Two values on a mode, as `mark` and `shot` are — named, bounded, and drawn by a table
the way `GLYPHS` draws marks, so a future challenge reuses one by naming it:

- **opening** — a kind, or null: the scene played before a run's first target. BLACKOUT
  names `lightsOut`. Everything that is not a challenge has none.
- **scheme** — a kind: the colours the game screen is played under. `day` is today's,
  and every mode has it; BLACKOUT names `dark`. A scheme is a small set of named inks
  (surface, text, key fill, key digit, target disc …) the game screen asks for — never a
  mode name.

**Mode's business, not the engine's.** Both are identity on the `ModeDefinition`, like
`shot`, read through the registry; nothing outside `modes/` names a challenge. The
machine is untouched: the opening plays _before_ the run is started, so there is no live
run to freeze.

BLACKOUT's own `dial.blackout` (built, not yet committed) is drawing already; the spec
decides whether it folds into the `dark` scheme or stays a dial flag the scheme
switches on at the click.

Areas:

- **modes/** — the two kinds on the mode and a resolver for each; BLACKOUT's entry names
  them.
- **The game screen** (`app/(tabs)/index.tsx`) — holds the run's start until the opening
  finishes, and wraps the game in the scheme's token overrides
  (`VariableContextProvider`, which NativeWind v5 exports).
- **components/game/** — a new opening layer with a table of scenes; the components that
  hard-code light colours (the dial key, target card, pie countdown, hearts, best-scores
  line, score digits and others — fifteen files today) read their inks from the scheme.
- **constants/colors.ts** — the `dark` scheme's inks, beside the light ones they
  mirror.
- **Copy** — likely none; a skip hint would be one string.

## In

- `opening` and `scheme` as values on a mode, each a bounded union drawn by a table.
- The `lightsOut` opening: bulb, cord, pull, click, haptic, tap to skip, about 2.5 s.
- The `dark` scheme over the whole game screen, including the dial, targets, top bar
  and best-scores strip.
- The run's start held until the opening ends; restore skips it.
- BLACKOUT wired to both.

## Out

- **Dark overlays.** Pause, game over, options and how to play stay light.
- **A dark mode for the app**, system-driven or a player toggle. `userInterfaceStyle`
  stays `light`; this is a run's scheme, not a theme.
- **Openings or schemes for the challenges already shipped.** The mechanism is ready
  for them; none is added.
- **Sound.** The click is a haptic.
- **Arcade and multiplayer.** Neither plays a challenge.
- **A flag.** Ships with BLACKOUT to whoever plays it — say so if one is wanted.

## Rabbit holes

- **One colour scheme, hard-coded.** The app has a single `@theme` and fifteen game
  components with hexes or colour constants in them, some inside worklets
  (`interpolateColor` on the dial key). Way around: token users get the scheme through
  `VariableContextProvider` at the game screen's root; hex users ask one scheme hook
  for named inks and pass them into worklets as values. Spec lists every one; any that
  cannot take an ink is where the appetite might not hold. Web: confirm the provider
  works there before the build leans on it.
- **The clock during the scene.** If the run were started first and paused for the
  opening, every timer, the saved-run writer and the session `EXPIRE` would have to know.
  Way around: don't start it — the opening sits between PLAY GAME and the machine's
  START, so the machine never learns there was one.
- **The scene has to land.** A cord pull reads as fake if it is physics done badly. Way
  around: timed tweens on Reanimated (drop, tug, release, click) rather than a
  simulation, at a fixed length; judged on device, not in a test.
- **The phone's own chrome.** The status bar over a dark screen needs light icons, and
  the safe-area strips must not stay pale. Small, but visible on the first frame.
- **PLAY AGAIN fatigue.** Twenty retries is twenty scenes. Answered: a retry plays the
  short version, and any of them skips on a tap.
- **"Scheme" beside the theme system.** The user's word, chosen over "lighting". The
  domain table must say what it is _not_: not the app's `@theme`, not a colour scale
  from the design guide, not a system dark mode — the colours one run's game screen is
  played under.

## Contract

### Domain words

**Uses:** run, mode, challenge, dial, rules, game (screen), intro (screen), pause, game
over, submode, tutorial, strike/shot (unchanged). "Intro" stays the start screen and is
never used for the new scene.

**Introduces** (each gains a row in `docs/domain.md` and a one-liner in `CLAUDE.md`'s
table):

| Word        | One line                                                                                                                                                              | Code                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **opening** | The scene a mode plays on the game screen before its run's first target, while the clock has not started. A **take** is how much of it plays: `full` or `short`.      | `OpeningKind`, `ModeDefinition.opening`, `openingOf`, `OPENINGS`          |
| **scheme**  | The colours the game screen is played under for a run: `day` (every mode) or `dark`. Not the app's `@theme`, not a design-guide colour scale, not a system dark mode. | `SchemeKind`, `ModeDefinition.scheme`, `schemeOf`, `SCHEMES`, `useScheme` |
| **ready**   | Machine state: a run dealt and held while its opening plays. No targets, no clock. Left by `BEGIN`. Not a pause.                                                      | `ready` in `machines/game.ts`, `BEGIN`                                    |

**Collision, resolved:** `Submode.opening` (the tutorial's starting grid and target) is
renamed `Submode.setup`, decided by the user, so **opening** means one thing. Code only;
no player-visible change. The scene the tutorial plays is not an opening, and the
tutorial never opens (a run under a submode has `opens: false`).

### Files

Created:

| Path                                      | Responsibility                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `components/game/opening-layer.tsx`       | Draws the mode's opening over the game screen from the `OPENINGS` table; tap to skip; reports the switch and the end. |
| `components/game/openings/lights-out.tsx` | BLACKOUT's scene: the bulb drops on its cord, the cord is tugged, the bulb clicks off (haptic), done.                 |
| `hooks/use-scheme.tsx`                    | `SchemeProvider` (token overrides through `VariableContextProvider`, plus the inks) and `useScheme()` for hex users.  |

Modified:

| Path                                                                                                                                                                         | Change                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `modes/types.ts`                                                                                                                                                             | `OpeningKind`, `SchemeKind`; `ModeDefinition.opening?`, `.scheme?`; `Submode.opening` → `setup`.                                       |
| `modes/rules.ts`, `modes/registry.ts`                                                                                                                                        | `RunRules.opens`, resolved from the mode's opening (false under a submode); `openingOf(id)`, `schemeOf(id)` beside `markOf`.           |
| `modes/challenges/define.ts`                                                                                                                                                 | `ChallengeSpec.opening?`, `.scheme?`, passed through.                                                                                  |
| `modes/challenges/catalog.ts`                                                                                                                                                | BLACKOUT names `opening: 'lightsOut'`, `scheme: 'dark'`.                                                                               |
| `modes/definitions/tutorial.ts`, `machines/coach.ts`                                                                                                                         | The `setup` rename.                                                                                                                    |
| `machines/game.ts`                                                                                                                                                           | `ready` state and `BEGIN`; START/RESTART deal into `ready` when `rules.opens`; the `setup` rename.                                     |
| `constants/colors.ts`                                                                                                                                                        | `SCHEMES`: per kind, the token values and the named inks; `day` is today's values exactly.                                             |
| `constants/buttons.ts`                                                                                                                                                       | `opening_skip`.                                                                                                                        |
| `app/(tabs)/index.tsx`                                                                                                                                                       | `isReady`; renders the opening layer in `ready`; sends `BEGIN`; picks the take; wraps the game screen in `SchemeProvider`; status bar. |
| `components/game/dial.tsx`, `dial-button.tsx`                                                                                                                                | Key inks from the scheme; a rim on dark keys; `dial.blackout` drawing applies only once the scheme has switched.                       |
| `components/game/target-card.tsx`, `pie-countdown.tsx`, `heart-icon.tsx`, `best-scores-line.tsx`, `score-digit.tsx`, `strike-beam.tsx`, `burst-round.tsx`, `dial-flames.tsx` | Hard-coded game-screen colours read from `useScheme()`.                                                                                |
| `docs/domain.md`, `CLAUDE.md`                                                                                                                                                | Rows for opening, scheme, ready.                                                                                                       |

`gesture-hint.tsx` and `route-hint.tsx` are Trainee/tutorial only, which never has a dark
scheme: left alone. Arcade and multiplayer files: out.

### Data and types

```ts
type OpeningKind = 'lightsOut'
type SchemeKind = 'day' | 'dark'
type OpeningTake = 'full' | 'short'

// ModeDefinition, beside `mark` and `shot`
opening?: OpeningKind   // absent = none
scheme?: SchemeKind     // absent = 'day'

// RunRules
opens: boolean          // the mode has an opening and no submode is applied

// Machine
state 'ready'
event { type: 'BEGIN'; now: number }

// constants/colors.ts
SCHEMES: Record<SchemeKind, { tokens: Record<TokenName, string>; inks: SchemeInks }>
```

- `OPENINGS: Record<OpeningKind, ComponentType<{ take; onSwitch(); onDone() }>>`: exhaustive,
  so a new kind cannot ship without a scene.
- **`ready`:** entered from START (menu) and RESTART (playing, paused, gameOver) when the
  fresh run's rules have `opens`. `freshGame` runs as today, but `playingSince` is null.
  `BEGIN` → `playing` with `playingSince = now`. Handled in `ready`: `BEGIN`, `MENU`.
  Everything else (PRESS, TICK, TARGET_EXPIRED, PAUSE, EXPIRE) is ignored. `RESTORE` is
  unchanged and lands in `paused`, never `ready`.
- **The take:** full when `ready` was entered by START, short when by RESTART. Decided in
  the screen from the event, not stored in context.
- **No storage change.** A `ready` run is not `inRun`, so `usePersistedRun` never saves
  one. No storage key, no schema, no migration.

### Copy and gates

| Gate            | Answer                                                                                                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | One string: the skip pressable's accessibility label, `Skip to the run` (Czech `Přeskočit rovnou do hry`). The scene itself has no words and is hidden from screen readers. (Amended in build: the spec said none, but a pressable needs a label.) |
| **How to Play** | None. The challenges chapter is deliberately vague; an opening changes no control, timer or score.                                                                                                                                                 |
| **Flag**        | None.                                                                                                                                                                                                                                              |
| **Buttons**     | `opening_skip` in `constants/buttons.ts`, for the full-screen skip pressable.                                                                                                                                                                      |

## Acceptance criteria

1. `runRules(challengeId('blackout'), 'hard').opens` is `true`. It is `false` for every
   permanent mode at every rung, for every other challenge, and for the tutorial.
   `openingOf(challengeId('blackout'))` is `'lightsOut'` and `schemeOf(...)` is `'dark'`.
   Every other mode has `null` and `'day'`.
2. Machine: START on BLACKOUT lands in `ready` with no targets and `playingSince` null.
   `BEGIN { now }` lands in `playing` with `playingSince === now`. RESTART from
   `playing`, `paused` and `gameOver` on BLACKOUT lands in `ready`. RESTORE never lands in `ready`: it lands
   in `paused`, as today (amended in build: the spec said `playing`). START on Accuracy lands in `playing`, as today.
3. In `ready`, PRESS, TICK, TARGET_EXPIRED, PAUSE and EXPIRE change nothing (same state,
   same context). `MENU` returns to `menu`.
4. On device, BLACKOUT from the intro: the game screen shows in day colours with the
   dial's digits visible. A bulb drops on a cord, the cord is tugged, the bulb clicks
   off with a haptic, and the screen turns dark. The keys turn black with no digits and
   are still visible as keys (rimmed). The first target arrives only after the scene,
   and its ring starts full. The dead bulb stays hanging, grey, behind the run for its whole length
   (amended at ship, asked for by the user: it was to fade). About 2 s in total.
5. PLAY AGAIN from game over, and RESTART from pause, play the short take: the click and
   the switch, about 0.8 s.
6. A tap anywhere during either take ends it at once: the screen is dark, and the run
   begins on that tap.
7. Pause and game over over a BLACKOUT run are drawn in their usual light colours, and
   the game screen under them stays dark. While the dark game screen is showing, the
   status bar's icons are light. They are dark again on the intro.
8. HOME to the intro, then an Accuracy run: everything is in day colours, with no scene
   and no `ready`.
9. Every other mode and challenge plays exactly as before: no `ready` state, day
   scheme, keys drawn as today.
10. `Submode` has no `opening` field (it is `setup`), and the tutorial still opens on its
    scripted grid and first target.
11. `pnpm web`: BLACKOUT's dark scheme renders on web too, with tokens overridden on the
    game screen only.
12. `pnpm check` is green, and `docs/domain.md` and `CLAUDE.md` carry opening, scheme
    and ready.

## Tests

- `machines/game.test.ts`: criteria 2 and 3 (the `ready` transitions, ignored events,
  RESTORE skipping it, Accuracy unchanged).
- `modes/challenges/challenges.test.ts`: criterion 1 for BLACKOUT, plus "is the only mode
  that opens".
- `modes/rules.test.ts` (or `registry`'s): `opens` is false under the tutorial submode;
  `openingOf` / `schemeOf` defaults. The `setup` rename keeps the existing tutorial tests
  green (criterion 10).
- `constants/colors` scheme completeness: `day`'s tokens equal `global.css`'s values;
  `dark` defines every token and every ink. The union being exhaustive makes the
  `OPENINGS` table a type check.

## Review focus

- **Both RESTART paths** (task 3): `paused → RESTART` and `gameOver → RESTART` are
  separate transitions in the machine. One of them left targeting `playing` would play
  that retry with no scene.
- **`inRun` excludes `ready`** (task 6): persistence, `useRivalRecords` and
  `useHitCelebration` all key on it. Check none needs to see a `ready` run, and that
  nothing restores a `ready` run.
- **Scheme identity** (task 4): the inks object must be stable per kind (a module
  constant). One rebuilt each render re-runs every animated style and worklet reading
  it.
- **The dark-key gate** (task 7): `dial.blackout` must not hide digits before the
  switch, and must hide them on the very first dark frame. A restored run (no opening)
  starts switched.
- **EXPIRE swallowed in `ready`** (task 3): the session window shutting mid-scene has
  to be caught once `BEGIN` lands. Confirm what sends EXPIRE and that it re-checks in
  `playing`.
