# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Nine** is a mobile number-puzzle game built with Expo (React Native). The player dials a 3×3 grid of digits to match target sums; modes (Trainee / Accuracy / Speed) and difficulties add scoring, lives, and streak mechanics.

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

| Term           | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **mode**       | Trainee / Accuracy / Speed — `Mode` in `machines/modes.ts`. Not `PlayMode` (alone / friends) and not `MultiMode` (the two scored modes only).                                                                                                                                                                                                                                                                                                                                                                                          |
| **difficulty** | Easy / Hard / Extreme — `Difficulty` in `machines/modes.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **run**        | One game from start to game over. "END RUN", "run stats", "this run" — never "round" or "session".                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **board**      | One mode × difficulty pairing, i.e. one leaderboard. Careful: the How to Play copy uses "board" for the 3×3 playfield — call that the **grid** in code and comments.                                                                                                                                                                                                                                                                                                                                                                   |
| **fortune**    | What a career comes to: every point the player has ever scored, weighted by the difficulty it was scored on, plus everything their winnings have paid. It only ever grows — so never a "rating", a "rank" or a "standing", none of which this is. FORTUNE on screen (Czech JMĚNÍ); `Lifetime.fortune` and `fortuneOf` in code. Distinct from **score**, which is what one run was worth and what the per-board table still adds up to.                                                                                                 |
| **tutorial**   | The run a first launch opens on: Trainee with its clock, its cadence and its options taken off — one target at a time, no countdown, the weight on each key and nothing else. A **submode**, not a mode: `mode` stays `trainee` and `tutorial` on the run says which it is, so it is never a `Mode` and never appears on the intro — but it is what the player is shown, via `runLabel`, on the game screen and the pause badge. Also dealt by TRY IT at the end of How to Play. See `constants/tutorial.ts`.                          |
| **lesson**     | The script that runs over a tutorial run: five fixed boards, each dealt so that one move is the obvious answer. A card names the target, a card names the sum, the first route is walked one lit key at a time with the rest of the dial dead, then comes a board apiece for the swipe down, the swipe left and the swipe right, and a sign-off. Boards in `TUTORIAL_TARGETS`, steps and order in `machines/tutorial-lesson.ts`, driven by `hooks/use-tutorial-lesson.ts`. A **step** is one beat of it — not a screen and not a mode. |
| **motto**      | The one line a player writes about themselves, under their nickname on their profile. At most 50 characters. `profiles.motto`, `lib/motto.ts`, `profile-motto.tsx`. Not a "claim" — that word already means a medal standing (`toMedals` keeps a player's best claim per mode).                                                                                                                                                                                                                                                        |
| **role**       | What the app may show a player, held on `profiles.role`: null for an ordinary player — which is all but a handful of rows — then `tester`, `developer`, `admin` in that order. A **ladder**, so a role reaches everything the roles below it reach. Set by hand in SQL, read once per launch, and never a permission: it decides what a player is _shown_, not what a player may do. `lib/role.ts`, `hooks/use-flags.tsx`. Not the multiplayer host, who is also called `admin` — see the trap above.                                  |
| **flag**       | One part of the app that is not for everyone yet, and the lowest **role** that may see it. All of them live in `constants/features.ts`; `useFlag('x')` is how a screen asks. A feature ready for every player loses its flag rather than dropping to rank zero — a flag nobody is kept out by reads as load-bearing long after it stopped being so.                                                                                                                                                                                    |

Three words for three different rewards, and they are not interchangeable:

| Term            | What it is                                                                                                                                                                                                                                                                                                                                | Code                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **record**      | A score crossing a bar, announced mid-run and then gone. A moment, not a thing you keep.                                                                                                                                                                                                                                                  | `crossedRecords` in `lib/announcements.ts`         |
| **medal**       | A podium standing on a board. **Losable** — a rival can take it back tomorrow.                                                                                                                                                                                                                                                            | `lib/medals.ts`, `hooks/use-my-medals.ts`          |
| **achievement** | Permanent, achieved once, never lost, measured against the player's own history rather than against anyone else. _Achieved_ / _unlocked_, never _earned_ and never _won_. Code and the `achievements.earned_at` column still say "earned" — that is a shipped DB column, and renaming it would be a migration for no player-visible gain. | `constants/achievements.ts`, `lib/achievements.ts` |

An achievement's colour is the green nothing else uses (`ACHIEVEMENT_SCALE`), and that is the distinction it draws: gold is a record you currently **hold**, green is one you **keep**.

## Rules

- **Never deploy to production.** Do not run `eas deploy --prod` (or otherwise promote to prod) unless the user explicitly issues that exact command in the current turn. "Continue", "ship it", or prior approvals do NOT authorize a prod deploy — wait for the explicit instruction every time.

- **Never use Claude-in-Chrome browser automation without explicit agreement.** Do not launch the `claude-in-chrome` skill or call any `mcp__claude-in-chrome__*` tool unless the user has agreed to it in the current turn. Ask first.

- **Keep the How to Play guide current.** At the end of every task, check whether the change touched gameplay — controls, targets/timers, modes, difficulty, scoring, streaks, or lives. If so, update the guide (`components/overlays/how-to-play-overlay.tsx`) so it stays accurate.

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
pnpm check          # All of the above in sequence (CI gate)
```

## Architecture

**Expo Router (file-based routing)** — the `app/` directory defines all routes. `app/_layout.tsx` is the root layout wrapping everything in a `ThemeProvider`. `app/(tabs)/` defines the tab group; its `_layout.tsx` configures the bottom tab navigator.

**Theme system** — `AppThemeProvider` in `hooks/use-theme.tsx` owns the active scheme and the cross-fade when it changes; `useTheme()` reads it. Semantic tokens live in `global.css` (a `@theme` block for light, `.dark:root` overriding it for dark), toggled via the `.dark` class on web and `Appearance.setColorScheme` on native.

**Styling** — NativeWind v5 (Tailwind for React Native). Use `className` for static styles; the `style` prop only for values computed at runtime (dynamic colors, pixel sizes).

**Colors, typography, motion** — the three color scales (game / mode / CTA), theme tokens and contrast rules live in the **`design-guide`** skill. Consult it before picking any color the player sees.

**State machines** — XState v5 + `@xstate/react`. Game logic lives in `machines/game.ts`; mode/difficulty config in `machines/modes.ts`; scoring helpers in `machines/scoring.ts`. Components consume the machine via `useMachine` in `app/(tabs)/index.tsx`.

**Persistence** — `@react-native-async-storage/async-storage`. Thin hook wrappers in `hooks/use-persisted-*.ts` hydrate the machine on mount and write back on change.

**Animations** — `react-native-reanimated` v4 with worklets. Use `useSharedValue`, `useAnimatedStyle`, and the `withTiming`/`withSpring`/`withRepeat` drivers. Define animated sub-components at **module level** (not inside render functions) to avoid remounts.

**Platform-specific files** — Expo resolves `.ios.tsx` / `.web.ts` variants automatically. Currently used for `lib/supabase.web.ts`.

**Path alias** — `@/*` maps to the repo root (e.g. `import { mono } from '@/constants/theme'`). Never use relative `../` imports.

**New Architecture & React Compiler** — both are enabled in `app.json`.

## Key directories

| Path          | Contents                                                  |
| ------------- | --------------------------------------------------------- |
| `app/`        | Expo Router screens and layouts                           |
| `components/` | UI components (game, overlays, shared)                    |
| `constants/`  | Colors, theme tokens, storage keys, static game config    |
| `hooks/`      | Custom React hooks (persistence, display logic, spawning) |
| `lib/`        | Pure helper functions (no React, no side effects)         |
| `machines/`   | XState machines and pure game logic                       |
| `types/`      | Shared TypeScript types                                   |
