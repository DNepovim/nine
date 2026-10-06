# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Nine** is a mobile number-puzzle game built with Expo (React Native). The player dials a grid of digits — nine of them, on the dial every shipped mode is played on — to match target sums; modes (Trainee / Accuracy / Speed, plus Arcade behind a flag) and difficulties add scoring, lives, and streak mechanics.

A mode is a value, not a branch: `modes/` holds one file per mode and resolves each into the rules a run is governed by, so the engine never names one. That is what makes room for **challenges** — custom modes on the app for a day at a time, each free to change the dial, the clock, how targets arrive, the scoring and the lives.

## Domain language

The words below are how we talk about the app. Use them in conversation, comments and commit messages. Several differ from the identifiers in the code — the **Code** column is where each one actually lives, so a name in this table always resolves to something real.

### Screens

A **screen** is a full-viewport view. The app has a single route (`app/(tabs)/index.tsx`); every screen except the game itself is a `<Screen overlay>` stacked over it, so "screen" never means "route".

| Screen          | What it is                                                                                                       | Code                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **splash**      | The logo animation on cold start, before anything else. Outside the game machine.                                | `components/splash-screen.tsx`, gated by `splashDone` in `app/_layout.tsx` |
| **intro**       | The start screen: Alone / With friends, mode, difficulty, PLAY GAME, HOW TO PLAY. Where HOME on game over leads. | machine state `menu`, `components/overlays/menu-overlay.tsx`               |
| **game**        | A live run — dial, targets, top bar, best-scores strip. The only screen that is not an overlay.                  | machine state `playing`, rendered by `app/(tabs)/index.tsx`                |
| **tutorial**    | The game screen playing the tutorial run — the same screen, stripped. Not a screen of its own.                   | `tutorial` on the machine's context, `constants/tutorial.ts`               |
| **pause**       | Mid-run: CONTINUE / END RUN, run stats, high scores, OPTIONS and SHARE.                                          | machine state `paused`, `components/overlays/paused-overlay.tsx`           |
| **game over**   | End of a run: score, run stats, high scores, PLAY AGAIN / challenge / HOME.                                      | machine state `gameOver`, `game-over-overlay.tsx` (+ `game-over-sequence`) |
| **options**     | Display and advanced settings. Reachable from both intro and pause.                                              | `menuOverlay === 'advanced'`, `advanced-options-overlay.tsx`               |
| **how to play** | The player-facing guide. Keep it current — see Rules.                                                            | `menuOverlay === 'howToPlay'`, `how-to-play-overlay.tsx`                   |

### Multiplayer

| Term                    | What it is                                                                                           | Code                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **multiplayer intro**   | Not its own screen: the With friends tab of the intro, where you CREATE GAME or type a code to join. | `playMode === 'friends'` in `menu-overlay.tsx`, `game-code-input.tsx` |
| **waiting room**        | The room before the start: player tiles, the code to share, host starts the game.                    | phase `waiting`, `multiplayer-waiting.tsx`                            |
| **multiplayer game**    | The shared live run.                                                                                 | phase `playing`, `multiplayer-game.tsx`                               |
| **multiplayer results** | Final scores after a shared run.                                                                     | phase `results`, `multiplayer-game-over.tsx`                          |
| **host**                | The player who created the room — starts the game, owns its lifecycle.                               | **called `admin` in code and DB**: `admin_id`, `isAdmin`              |
| **guest**               | Anyone who joined by code. There is no `isGuest`; a guest is `!isAdmin`.                             | `hooks/use-multiplayer-room.ts`                                       |

Two naming traps here: `multiplayer-menu.tsx` is **not** the multiplayer intro — it is the multiplayer _pause_ screen (CONTINUE / LEAVE mid-game). And `host`/`guest` are our words; the code and the Supabase schema say `admin`. Don't rename either without a deliberate pass.

A third trap, newer: that room `admin` — `rooms.admin_id`, `isAdmin` — has nothing to do with the **role** `admin` on `profiles`. One says who started a room; the other says what the app may show a person. Never read one off the other.

### Other key words

| Term           | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **mode**       | What a run asks for. One file per mode in `modes/definitions/`, collected by `modes/registry.ts`; `Mode` is the union of the three the game machine runs, `ModeId` is any mode by name — arcade, or a challenge whose id nobody wrote down at build time. Not `PlayMode` (alone / friends) and not `MultiMode` (the two scored modes only).                                                                                                                                                                                                                                                                                              |
| **difficulty** | Easy / Hard / Extreme — `Difficulty` in `modes/difficulty.ts`. Orthogonal to the mode, and a mode may pin its own rung (`fixedDifficulty`) and so show no difficulty row at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **run**        | One game from start to game over. "END RUN", "run stats", "this run" — never "round" or "session".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **board**      | One mode × difficulty pairing, i.e. one leaderboard. Careful: the How to Play copy uses "board" for the 3×3 playfield — call that the **grid** in code and comments, and the keys themselves the **dial**. Nothing describing the keys is ever called a board; that is what `DialSpec` is for.                                                                                                                                                                                                                                                                                                                                           |
| **fortune**    | What a career comes to: every point the player has ever scored, weighted by the difficulty it was scored on, plus everything their winnings have paid. It only ever grows — so never a "rating", a "rank" or a "standing", none of which this is. FORTUNE on screen (Czech JMĚNÍ); `Lifetime.fortune` and `fortuneOf` in code. Distinct from **score**, which is what one run was worth and what the per-board table still adds up to.                                                                                                                                                                                                   |
| **tutorial**   | The run a first launch opens on: Trainee with its clock, its cadence and its options taken off — one target at a time, no countdown, the weight on each key and nothing else. A **submode**, not a mode: `mode` stays `trainee` and `tutorial` on the run says which it is, so it is never a `Mode` and never appears on the intro — but it is what the player is shown, via `runLabel`, on the game screen and the pause badge. Also dealt by TRY IT at the end of How to Play. Its rules are a `RulesPatch` in `modes/definitions/tutorial.ts`; the lesson's own numbers stay in `constants/tutorial.ts`.                              |
| **lesson**     | The script that runs over a tutorial run: six fixed boards, each dealt so that one move is the obvious answer. A card names the target, a card names the sum, the first route is walked one lit key at a time with the rest of the dial dead, then comes a board apiece for the swipe down, the swipe left and the swipe right, a board asking for three of them in a line so that one drag answers it better than three gestures, and a sign-off. Boards in `TUTORIAL_TARGETS`, steps and order in `machines/tutorial-lesson.ts`, driven by `hooks/use-tutorial-lesson.ts`. A **step** is one beat of it — not a screen and not a mode. |
| **motto**      | The one line a player writes about themselves, under their nickname on their profile. At most 50 characters. `profiles.motto`, `lib/motto.ts`, `profile-motto.tsx`. Not a "claim" — that word already means a medal standing (`toMedals` keeps a player's best claim per mode).                                                                                                                                                                                                                                                                                                                                                          |
| **role**       | A named stack of features, held on `profiles.role` as a foreign key into the `roles` table: null for an ordinary player, which is all but a handful of rows. **Flat** — roles are not ranked and none inherits from another, so `admin`'s stack is spelled out in full. Created, renamed and deleted from the admin screen rather than set by hand in SQL. Never a permission: it decides what a player is _shown_, not what a player may do. Not the multiplayer host, who is also called `admin` — see the trap above.                                                                                                                 |
| **rules**      | Everything a live run is governed by, as one value: the dial under it, the clock and what tightens, how targets arrive, the blend a hit is scored by, the lives, and the capability flags. `RunRules` in `modes/rules.ts`, resolved by `runRules(mode, difficulty, tutorial)`. The engine reads these and names no mode, so a mode it has never heard of runs correctly. A mode's own half of it, before a difficulty is applied, is `TargetRules`.                                                                                                                                                                                      |
| **dial**       | The keys a run is played on: how many, how they are arranged, what each multiplies its digit by, and how far a digit goes. `DialSpec` in `modes/dial.ts`; the one every shipped mode uses is `NINE_DIAL`. A **grid** is one position of it — a flat, row-major list of digits, so nothing holding one has to know the shape it is drawn in. Never call either a "board".                                                                                                                                                                                                                                                                 |
| **capability** | What a mode is _shown as_ rather than what it is scored by: `scored` (keeps a leaderboard), `coached` (teaches), `keyHints` (the dial may print what a key is worth), plus `usesDifficulty`. Each one replaces a `mode === 'trainee'` that used to live in the screen it affected — ask `traitsOf(mode)` or the run's rules, never the mode's name.                                                                                                                                                                                                                                                                                      |
| **challenge**  | A mode that is on the app for a window and then is not — twenty-odd of them, each a day long. Not a special case in the engine: `defineChallenge` (`modes/challenges/define.ts`) turns a spec into an ordinary mode definition with a `window` on it, and the registry holds it beside the permanent ones. Careful: `Challenge` in `lib/next-challenge.ts` is the _dare_ the game-over screen offers — the same run one rung harder — and has nothing to do with these.                                                                                                                                                                  |
| **submode**    | A run of a mode with some of its rules taken off, under a name of its own. The **tutorial** is the only one: `Submode` in `modes/types.ts`, the patch itself in `modes/definitions/tutorial.ts`. A second one is a new value there, not another boolean.                                                                                                                                                                                                                                                                                                                                                                                 |
| **feature**    | One part of the app that is not for everyone yet, named by a key the code holds a guard for. `constants/features.ts` is the whole of what the code knows — the list of keys, and nothing about who reaches them. Who reaches them is rows: a role's **stack**, a person's **overrides** on top of it, and the feature's own `active` switch, all resolved by `effective_features` in SQL and asked for once per launch. `useFlag('x')` is how a screen asks. Formerly **flag**, which named a build-time switch; the identifiers still say flag and are renamed separately.                                                              |
| **stack**      | The set of features a role opens. A role _is_ its stack plus a name; there is nothing else to a role. `role_features` in the database, the ROLES tab on the admin screen. Plain on or off — the third state belongs to an override, not to a stack.                                                                                                                                                                                                                                                                                                                                                                                      |
| **override**   | One person's departure from their role's stack, in either direction: granted puts a feature on that the role does not give, revoked takes one away that it does. No row at all is the third state and the usual one — _inherit_. **Reset** deletes a person's override rows, returning them to the stack. `user_features`, and the tri-state rows on the admin screen's person view.                                                                                                                                                                                                                                                     |

Three words for three different rewards, and they are not interchangeable:

| Term            | What it is                                                                                                                                                                                                                                                                                                                                | Code                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **record**      | A score crossing a bar, announced mid-run and then gone. A moment, not a thing you keep.                                                                                                                                                                                                                                                  | `crossedRecords` in `lib/announcements.ts`         |
| **medal**       | A podium standing on a board. **Losable** — a rival can take it back tomorrow.                                                                                                                                                                                                                                                            | `lib/medals.ts`, `hooks/use-my-medals.ts`          |
| **achievement** | Permanent, achieved once, never lost, measured against the player's own history rather than against anyone else. _Achieved_ / _unlocked_, never _earned_ and never _won_. Code and the `achievements.earned_at` column still say "earned" — that is a shipped DB column, and renaming it would be a migration for no player-visible gain. | `constants/achievements.ts`, `lib/achievements.ts` |

An achievement's colour is the green nothing else uses (`ACHIEVEMENT_SCALE`), and that is the distinction it draws: gold is a record you currently **hold**, green is one you **keep**.

## Rules

- **Never deploy to production.** Nothing deploys on its own — a push to `main` runs the static checks (`.github/workflows/checks.yml`) and nothing else; both deploy workflows are manual-only. Do not run `gh workflow run deploy.yml`, `eas workflow:run .eas/workflows/deploy.yml`, `eas deploy --prod`, or otherwise promote to prod unless the user explicitly asks for a deploy in the current turn. "Continue", "ship it", or prior approvals do NOT authorize a prod deploy — wait for the explicit instruction every time. The **`deploy`** skill owns the procedure. A deploy goes through GitHub Actions, which runs the suite and `pnpm audit` and only then creates the EAS run; the EAS workflow on its own is an ungated bypass.

- **Never use Claude-in-Chrome browser automation without explicit agreement.** Do not launch the `claude-in-chrome` skill or call any `mcp__claude-in-chrome__*` tool unless the user has agreed to it in the current turn. Ask first.

- **Extract every string you write.** New copy is not shipped by writing it — run `pnpm i18n:extract` and translate it into Czech. A production build strips the English out of the descriptor, so a message missing from the catalog does not fall back the way it does in dev: it puts its generated id, `trdBEB`, on the player's screen. `pnpm i18n:verify` is the gate.

- **Keep the How to Play guide current.** At the end of every task, check whether the change touched gameplay — controls, targets/timers, modes, difficulty, scoring, streaks, or lives. If so, update the guide (`components/overlays/how-to-play-overlay.tsx`) so it stays accurate. The **`review`** stage of the cycle is where this check lands for work that came through it.

## Development cycle

Work worth a document goes through seven stages, one skill each, and none of them moves on its own — each stops at its own edge and names the command that follows:

```
brainstorm → shape → spec → build → verify → review → ship
```

| Stage           | Skill        | Produces                                                              |
| --------------- | ------------ | --------------------------------------------------------------------- |
| **brainstorm**  | `brainstorm` | Costed directions for an itch. Decides nothing. Optional.             |
| **shape**       | `shape`      | The appetite, the boundary, the rabbit holes, and the **track**.      |
| **spec**        | `spec`       | The contract: domain words, files, data, gates, acceptance criteria.  |
| **build**       | `build`      | The code, task by task, against those criteria.                       |
| **verify**      | `verify`     | A pass or fail per criterion. Hands **backwards** on a failure.       |
| **code review** | `review`     | `/code-review`, `simplify`, and the house pass. Also hands backwards. |
| **ship**        | `ship`       | Commit, branch + PR or `main`, and the offer to **`deploy`**.         |

The state lives on disk — `docs/work/<date>-<slug>/spec.md` and `plan.md` — so any stage can be run in a session that knows nothing about the ones before it. `.claude/skills/sdlc/PROTOCOL.md` owns that format; **`sdlc`** is the status board (`/sdlc`) and the dispatcher for work whose stage isn't obvious.

Two escape hatches, both deliberate. `shape` can put an evening's work on the **small** track — shape → build → verify → ship, no spec and no plan file. And a one-line fix skips the cycle entirely: fix it, **`check`**, **`commit`**. Seven stages over a typo is how a process stops being used.

## Commands

```bash
pnpm start          # Start Expo dev server
pnpm ios            # Run on iOS simulator
pnpm android        # Run on Android emulator
pnpm web            # Run in browser
pnpm lint           # ESLint
pnpm format         # Prettier (auto-fix)
pnpm typecheck      # tsc --noEmit
pnpm knip           # Dead-code / unused-export check
pnpm test           # Vitest (run once)
pnpm test:watch     # Vitest (watch mode)
pnpm i18n:extract   # Pull new copy into locales/*.po — run it whenever you add a string
pnpm i18n:verify    # Fail if locales/*.po no longer says what the source says
pnpm check          # All of the above in sequence (CI gate)
```

## Architecture

**Expo Router (file-based routing)** — the `app/` directory defines all routes. `app/_layout.tsx` is the root layout wrapping everything in a `ThemeProvider`. `app/(tabs)/` defines the tab group; its `_layout.tsx` configures the bottom tab navigator.

**Theme system** — `AppThemeProvider` in `hooks/use-theme.tsx` owns the active scheme and the cross-fade when it changes; `useTheme()` reads it. Semantic tokens live in `global.css` (a `@theme` block for light, `.dark:root` overriding it for dark), toggled via the `.dark` class on web and `Appearance.setColorScheme` on native.

**Styling** — NativeWind v5 (Tailwind for React Native). Use `className` for static styles; the `style` prop only for values computed at runtime (dynamic colors, pixel sizes).

**Colors, typography, motion** — the three color scales (game / mode / CTA), theme tokens and contrast rules live in the **`design-guide`** skill. Consult it before picking any color the player sees.

**Modes** — `modes/` is a package, not a table. One file per mode in `modes/definitions/`, each written as the difference from one base set of rules; `modes/registry.ts` collects them and is the only thing that knows how many there are; `modes/rules.ts` resolves a mode × difficulty × submode into the `RunRules` everything else reads. Nothing outside `modes/` branches on a mode's name — it asks the rules, or `traitsOf`. Adding a mode is one file in `definitions/` plus one entry in the registry's tuple; adding a **challenge** is one entry in `modes/challenges/catalog.ts`.

**State machines** — XState v5 + `@xstate/react`. Game logic lives in `machines/game.ts`, which is the engine for every `engine: 'targets'` mode and names none of them; scoring and the route DP in `machines/scoring.ts`, both parameterised by the run's dial. Arcade is the one mode on another engine (`machines/arcade.ts`, `hooks/use-arcade-run.ts`). Components consume the machine via `useMachine` in `app/(tabs)/index.tsx`.

**Persistence** — `@react-native-async-storage/async-storage`. Thin hook wrappers in `hooks/use-persisted-*.ts` hydrate the machine on mount and write back on change.

**Animations** — `react-native-reanimated` v4 with worklets. Use `useSharedValue`, `useAnimatedStyle`, and the `withTiming`/`withSpring`/`withRepeat` drivers. Define animated sub-components at **module level** (not inside render functions) to avoid remounts.

**Platform-specific files** — Expo resolves `.ios.tsx` / `.web.ts` variants automatically. Currently used for `lib/supabase.web.ts`.

**Path alias** — `@/*` maps to the repo root (e.g. `import { mono } from '@/constants/theme'`). Never use relative `../` imports.

**New Architecture & React Compiler** — both are enabled in `app.json`.

## Key directories

| Path          | Contents                                                   |
| ------------- | ---------------------------------------------------------- |
| `app/`        | Expo Router screens and layouts                            |
| `components/` | UI components (game, overlays, shared)                     |
| `constants/`  | Colors, theme tokens, storage keys, static game config     |
| `hooks/`      | Custom React hooks (persistence, display logic, spawning)  |
| `lib/`        | Pure helper functions (no React, no side effects)          |
| `machines/`   | XState machines and pure game logic                        |
| `modes/`      | One file per mode, the registry, and the rules a run reads |
| `types/`      | Shared TypeScript types                                    |
