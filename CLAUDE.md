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

A fourth, about a mode: the player reads **ADVENTURE** (Czech **VÝPRAVA**) where the code says `arcade` — the mode id, the `arcade` feature key, `machines/arcade.ts`, `use-arcade-run.ts` and every `Arcade*` identifier. The player-facing name changed and the code word did not, the same split host/guest runs over `admin`.

### Other key words

One line each. The full definitions — the reasoning, the edge cases, what each word is _not_ — are in **`docs/domain.md`**. Read it before naming anything new, writing a spec, or reviewing domain language.

| Term              | In one line                                                                                                        | Code                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **mode**          | What a run asks for. Not `PlayMode` (alone/friends), not `MultiMode`.                                              | `modes/definitions/`, `modes/registry.ts`, `Mode`, `ModeId`               |
| **difficulty**    | Easy / Hard / Extreme, orthogonal to the mode; a mode may pin one (`fixedDifficulty`).                             | `modes/difficulty.ts`                                                     |
| **run**           | One game, start to game over. Never "round" or "session".                                                          | —                                                                         |
| **board**         | One mode × difficulty leaderboard. The 3×3 playfield is the **grid**, its keys the **dial** — never "board".       | —                                                                         |
| **reign**         | One unbroken stretch of holding a board (ever / week / day). Only `ever` is stored.                                | `Reign`, `heldBoards` in `lib/player-profile.ts`, `board_reigns`          |
| **fortune**       | Every point ever scored, difficulty-weighted, plus accepted winnings. Only grows; never "rating"/"rank".           | `Lifetime.fortune`, `fortuneOf`                                           |
| **podium**        | 1st/2nd/3rd of a closed window, paid 1, ½, ⅒ of its gold. Settled once; not a medal.                               | `WIN_RANKS`, `PODIUM_SHARE` in `lib/winnings.ts`                          |
| **paid through**  | Last day a player's winnings are in their fortune; moves only on accept. `podium_from` beside it.                  | `winnings_paid.paid_through`                                              |
| **accept**        | Turning winnings into fortune. Code word only — the button reads CLAIM (VYZVEDNOUT). Never "collect"/"redeem".     | `accept_winnings`, `useWinnings().accept`                                 |
| **tutorial**      | A **submode** of Trainee offered on first launch; never a `Mode`.                                                  | `modes/definitions/tutorial.ts`, `constants/tutorial.ts`                  |
| **lesson**        | The six-board script over a tutorial run; a **step** is one beat of it.                                            | `TUTORIAL_TARGETS`, `machines/tutorial-lesson.ts`                         |
| **motto**         | The ≤50-char line under a nickname. Not a "claim".                                                                 | `profiles.motto`, `lib/motto.ts`                                          |
| **role**          | A flat, named stack of features on `profiles.role`; decides what is _shown_, never a permission. Not room `admin`. | `roles`, `profiles.role`                                                  |
| **rules**         | Everything a live run is governed by, as one value. The engine reads these and names no mode.                      | `RunRules` in `modes/rules.ts`, `runRules()`, `TargetRules`               |
| **dial**          | The keys a run is played on; a **grid** is one position of it (flat, row-major). Never "board".                    | `DialSpec`, `NINE_DIAL` in `modes/dial.ts`                                |
| **capability**    | What a mode is _shown as_: `board`, `scored`, `coached`, `keyHints`, `usesDifficulty`. Ask these, not the name.    | `traitsOf(mode)`                                                          |
| **challenge**     | A mode on the app for a window. Not `Challenge` in `lib/next-challenge.ts` (the game-over dare).                   | `modes/challenges/define.ts`, `catalog.ts`                                |
| **session**       | One planned appearance of a challenge. Not a run, not a window, not an auth session.                               | `challenge_sessions`, `lib/admin/sessions.ts`, `lib/challenge-session.ts` |
| **session board** | One session's standings, kept forever. Never shortened to "board"; its gold/silver/bronze is a **place**.          | `session_scores`, `sessionBoardOf`, `sessionMedal`                        |
| **summary**       | What one closed session came to, told once on the launch popup to those who played it. Not a recap or results.     | `lib/session-summary.ts`, `my_session_summaries`                          |
| **rating**        | One player's 1–9 answer to a session, asked once after its summary. Not fortune; pays and orders nothing.          | `session_ratings`, `rate_session`, `lib/session-rating.ts`                |
| **drill**         | The fixed nine targets (values and places) a session deals, derived from its id. Not a lesson.                     | `spawn.drill`, `lib/drill.ts`                                             |
| **glimpse**       | How long a target's number shows before fading. Not "flash".                                                       | `spawn.glimpse`, `PieCountdown`                                           |
| **drift**         | A target's number stepping ±1 while it stands. Streak rule: **fresh**.                                             | `spawn.drift`, `Target.drift`, `lib/target-drift.ts`                      |
| **scramble**      | Every key jumping to a new digit after a hit, onto no standing number. Not a drift.                                | `DialSpec.scramble`, `lib/scramble.ts`                                    |
| **measure**       | What a session board is ordered by: `score`, `time` or `hits`. Not the **headline**.                               | `scoring.measure`, `measureOf`, `challenge_sessions.measure`              |
| **teaser**        | A session card's face before it opens. Not a "lead".                                                               | `teaser` on `SessionCard`, `cardSession`                                  |
| **closing early** | Shutting a live session now, standings kept. Never "cancel", which deletes a booking.                              | `close_challenge_session_early`, `closeSessionEarly`                      |
| **extending**     | Giving a live session more minutes; leaves `extended_at`.                                                          | `extend_challenge_session`, `extendSession`                               |
| **recap**         | Last week on the boards in two or three sentences, on the launch popup.                                            | `lib/recap.ts`, `lib/recap-lines.ts`, `weekly_recap`                      |
| **takeover**      | An all-time board changing hands in a window. Players read "record"; code may not.                                 | `Takeover` in `lib/recap.ts`                                              |
| **stage**         | Arcade fight difficulty as one number; only stage one exists. Not depth, not an SDLC stage.                        | `lib/arcade-stage.ts`, `constants/siege.ts`, `constants/ambush.ts`        |
| **satiety**       | How fed the arcade hero is, 0–1, drawn as five loaves. Arcade only.                                                | `machines/satiety.ts`, `satiety-loaves.tsx`                               |
| **ambush**        | A fight on a way; a way that has one is **ambushed**, never "held". Not a siege.                                   | `machines/ambush.ts`                                                      |
| **bandit**        | One man on an ambushed road; one hit each.                                                                         | `SiegeSoldier`                                                            |
| **spoil**         | What clearing an ambush pays once: food, a heart, or nothing.                                                      | `Spoil`, `spoilOf` in `machines/ambush.ts`                                |
| **submode**       | A mode with rules taken off; the tutorial is the only one.                                                         | `Submode` in `modes/types.ts`                                             |
| **feature**       | A part of the app behind a key (formerly "flag"); who reaches it is rows.                                          | `constants/features.ts`, `effective_features`, `useFlag`                  |
| **stack**         | The set of features a role opens.                                                                                  | `role_features`                                                           |
| **override**      | One person's granted/revoked departure from their stack; no row = inherit.                                         | `user_features`                                                           |
| **visibility**    | hidden / private / public on a feature. Public beats stack and overrides.                                          | `features.visibility`, `Visibility` in `lib/features.ts`                  |
| **role preview**  | An admin wearing another role's stack. A view, not a grant.                                                        | `hooks/use-role-preview.ts`, `features_as_role`                           |
| **address**       | A profile's email, pending then confirmed. Lives in `auth.users`.                                                  | `email`, `email_change`/`new_email`, `use-supabase-auth`                  |
| **restore**       | Moving a profile onto this device from its address. A **move** — never "sync"/"copy".                              | `restoreProfile`, `lib/account-email.ts`                                  |
| **account**       | The `auth.users` row under a profile. Code word only; the player has a **profile**.                                | `auth.users`                                                              |
| **orientation**   | `upright` or `sideways` dial. Not turn, not tilt.                                                                  | `DialSpec.orientation`, `orientMove`                                      |
| **tilt**          | How far the arcade map lies back (perspective). Arcade only.                                                       | `lib/arcade-tilt.ts`                                                      |

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

- **Sweep a shared style before changing it.** A size, colour, radius or spacing in this app is almost never in one place, so changing it where you found it is how the app came to have three sizes of the same primary button. Resolve the style to its owner (`constants/typography.ts`, `constants/colors.ts`, `global.css`), grep every occurrence of the owner _and_ the raw value, **list them for the user and ask before applying**, then change it in the owner once — never across the call sites. A sweep that touches eleven screens is the user's decision, not yours. The **`design-guide`** skill owns the procedure.

- **Never pick a text size by hand.** Type is a set of named roles in `constants/typography.ts` — `TYPE.button`, `TYPE.label`, `TYPE.prose`, plus `READOUT` for DSEG7 digits and `GLYPH` for emoji. A screen asks for a role; it does not choose a size, a weight or a tracking, and it does not override one field of a role. If no role fits, add one there and agree it first. ESLint reports raw `text-[Npx]` and `tracking-[Npx]` under `app/` and `components/`.

- **Extend a component, don't fork one.** Never add a second dialog, button, card or row when one already does the job — a copy does not read as a copy, it reads as a drifted original. A dialog is `ModalCard` (`CardModal` only when a keyboard sits under it); a screen is `Screen`/`ScreenLayer`; a run's last screen is `RunScreen`; a primary button is `PrimaryButton`; a link or quiet way out (CLOSE, NOT NOW) is `LinkButton`. Check the inventory before drawing anything pressable — never copy the markup from a neighbouring file, which may be one of the drifted originals. If something is close, give it a prop and comment which caller asked for it. `design-guide`'s `references/components.md` is the inventory.

## Development cycle

Work worth a document goes through seven stages, one skill each, and they **chain**: each one finishes by invoking the next, backwards included (a failed `verify` runs `build`, which runs `verify` again). A question a stage would ask goes first to the **`sdlc-advisor`** agent (`.claude/agents/sdlc-advisor.md`), which answers it from the spec, this file, memory and the repo — the user is stopped only for what it hands back, and always for production writes and the deploy:

```
brainstorm → shape → spec → build → verify → review → ship
```

| Stage           | Skill        | Produces                                                             |
| --------------- | ------------ | -------------------------------------------------------------------- |
| **brainstorm**  | `brainstorm` | Costed directions for an itch. Decides nothing. Optional.            |
| **shape**       | `shape`      | The appetite, the boundary, the rabbit holes, and the **track**.     |
| **spec**        | `spec`       | The contract: domain words, files, data, gates, acceptance criteria. |
| **build**       | `build`      | The code, task by task, against those criteria.                      |
| **verify**      | `verify`     | A pass or fail per criterion. Hands **backwards** on a failure.      |
| **code review** | `review`     | `/code-review` and the house pass. Also hands backwards.             |
| **ship**        | `ship`       | Commit, branch + PR or `main`, and the offer to **`deploy`**.        |

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

**Theme system** — one colour scheme, and no switch. Semantic tokens live in `global.css` as a single `@theme` block; `userInterfaceStyle: "light"` in `app.json` pins the platform to it so nothing underneath renders against a scheme the tokens do not describe. A colour a class cannot reach — an icon's `color` prop, a worklet interpolating two inks — comes from `constants/colors.ts`, where `DIM_INK` and `MUTED_INK` mirror their tokens.

**Styling** — NativeWind v5 (Tailwind for React Native). Use `className` for static styles; the `style` prop only for values computed at runtime (dynamic colors, pixel sizes).

**Colors, typography, motion** — the three color scales (game / mode / CTA), theme tokens and contrast rules live in the **`design-guide`** skill. Consult it before picking any color the player sees.

**Modes** — `modes/` is a package, not a table. One file per mode in `modes/definitions/`, each written as the difference from one base set of rules; `modes/registry.ts` collects them and is the only thing that knows how many there are; `modes/rules.ts` resolves a mode × difficulty × submode into the `RunRules` everything else reads. Nothing outside `modes/` branches on a mode's name — it asks the rules, or `traitsOf`. Adding a mode is one file in `definitions/` plus one entry in the registry's tuple; adding a **challenge** is one entry in `modes/challenges/catalog.ts` — the **`challenge`** skill walks that entry's six decisions and owns the defaults.

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
