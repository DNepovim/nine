# Every component under 300 lines — Plan

Spec: docs/work/2026-11-14-component-size-limit/spec.md

## Tasks

- [x] 1. `eslint.config.mjs` — both rules at 300 as `warn`; confirm exactly the 17 files warn
- [x] 2. Tests first: `lib/*.test.ts` for the GameScreen helpers, written against today's code (import from the screen temporarily, or move each helper and its test together)
- [x] 3. Move GameScreen's module-level helpers to `lib/intro-standing.ts`, `lib/launch-asks.ts`, `lib/feedback-bookmark.ts`, `lib/board-targets.ts`, `lib/announcements.ts` — also `lib/run-session.ts` (the session-bests family) and `lib/run-title.ts` (accent, wordmark, subtitle); `announcementsReady` went to `lib/session-announcements.ts` instead, beside `SessionTargets`, since that file already imports announcements.ts. Helpers moved and tested together (identical code, so the same as testing first).
- [x] 4. File-only splits: `siege-blow`, `admin-knowledge`, `admin-messages`, `admin-stats` — siege parts → `siege-shot/mote/falling`; knowledge pages and their Section/Formula/Note → `knowledge-*`, `useBoardLabel` hook, `lib/admin/knowledge-figures`; `AdminAnswerDialog`; stats: `AdminStatsModes` + `lib/admin/stat-figures` (the table-row builder stayed: it closes over `t` and the file was under without it)
- [x] 5. File-only splits: `openings/takeoff`, `openings/lever-pull` — flat siblings (`takeoff-*.tsx`, `lever-*.tsx`) rather than subfolders: a `takeoff/` folder beside `takeoff.tsx` reads as two homes for one scene. `SkyUnder`/`SkyRemains` now import from `takeoff-sky`
- [x] 6. File-only splits: `email-code-modal`, `dial`, `best-scores-line`, `pie-countdown`, `game-over-overlay` — moving pieces out was not enough for four of them, so their logic went to hooks: `useCodeEntry`, `useDialPan`, `useBestsReveal` + `usePinnedAnnouncement`, `usePieExit` + `usePieGlimpse`. The strip's vocabulary went to `lib/best-scores.ts` (so `lib/run-session` no longer imports a type from a component); `TARGET_EXIT_MS` to `constants/game.ts`, since the exit hook could not import it back from the pie without a cycle. `Dial`'s doc comment was found detached above the sweep helpers and put back over `Dial`.
- [x] 7. `dial-button` — gesture hook + face pieces — `useKeyMotion` (flip, arrival, tap, squash, the press owed), `useKeyTint`, `DialKeyBadges`, `DialKeyCoats`; tint hook called before motion, as their effects were declared
- [x] 8. `player-profile-overlay` — sections — `ProfileTenure`, `ProfileStatCells`, `ProfileBoards` (with `FACTOR_CODE`), `ProfileColumnHead`, `ProfileReigns` (owns the show-more state now)
- [x] 9. `menu-overlay` — Alone / With friends panels, pickers, state hook — `IntroAlonePanel` (owns the challenge card's `useSessionCard` and the pills' items), `IntroFriendsPanel`, `IntroLinks`, `IntroCta` (PLAY GAME and CREATE ROOM were the same gradient button; one component now, owning the shadow both used), `useTitleGradient`, `useIntroPaging`
- [x] 10. `how-to-play-overlay` — one file per section — `how-to-play-<section>.tsx` ×10, the building blocks as `HowToPlayBody/Card/Bullet/SectionHeader/Contents/TryIt/WeightGrid/ControlsDiagram/ModeCard`, and the section table + `sectionOrder` in `lib/how-to-play-sections.ts`. Each section's lead comment stayed at its call site in the overlay. Catalog unchanged (1021).
- [x] 11. `arcade-game` — frame-loop hook + map / hero / HUD pieces — `useArcadeCamera` (clocks, pan, zoom, turn, tilt, progress), `lib/arcade-canvas.ts` `canvasOf` (what is on the map, pure), `ArcadeSheet` (the turned map and all on it), `ArcadeVitals` (hearts + loaves); `ArcadeRun` type exported from `use-arcade-run`. `RunTopBar` stays drawn in `ArcadeGame` itself: `lib/run-shell.test.ts` asserts every live screen draws the shared bar, and that rule is worth more than the twelve lines.
- [x] 12. GameScreen logic, leaves first: `use-multiplayer-screens`, `use-launch-asks`, `use-screen-dialogs`
- [x] 13. GameScreen logic: `use-run-boards`, `use-run-announcements`, `use-run-session`
- [x] 14. GameScreen logic: `use-run-control`, `use-run-ending`, `use-play-field` — 12–14 landed together, as eleven **consecutive slices** of the body, each a hook called where its slice sat (so every effect keeps its place in the order) and taking the earlier slices' results (`Screen*` = `ReturnType` of each). Boundaries and interfaces computed by a TS-compiler scope pass, not by hand. Also `use-player-account`, `use-life-loss`, `use-intro-standing`. Three `useState`s hoisted (session ids above the restore effect that writes them; menu overlay state down beside the other dialogs) — hooks with no effects, so order-free. `lib/run-shell.test.ts` now finds `usePauseOnBlur(` in `use-run-control`.
- [x] 15. GameScreen markup: `screen-providers`, `run-celebrations`, `run-overlays`, `title-dialogs`, `launch-asks-layer`, `menu-screens`, `multiplayer-screens` — as eight layers cut whole from the tree in place (so z-order is unchanged), each taking the `Screen*` objects it reads: `RunCelebrations`, `GameLayer`, `RunOverlays`, `MenuDialogs` (was `menu-screens`), `LaunchAsksLayer`, `IntroMenuLayer`, `TitleDialogs`, `MultiplayerScreens`. The provider stack stayed in `GameScreen` (13 lines; a component of its own would only wrap them).
- [x] 16. GameScreen markup: `game-layer` with `run-bar`, `target-area`, `dial-area`; `index.tsx` under 300 — `RunBar`, `RunTargets`, `RunSumRow`, `RunDial`. `index.tsx` is 178 code lines. `lib/run-shell.test.ts` and `lib/dial-metrics.test.ts` read the bar and the sum row from `run-bar.tsx` / `run-sum-row.tsx` now.
- [x] 17. Rules to `error`; code-guide Components and CLAUDE.md Rules gain the 300-line bullet; `pnpm check`

`pnpm typecheck && pnpm lint && pnpm test` after every task; each task is its own commit
(`git commit --only`), so a regression bisects to one split.

## Build notes

- **How the big two were split.** `GameScreen` and the files that would not come under by
  moving pieces were split by a TypeScript-compiler scope pass rather than by eye: a
  block's inputs and outputs are computed, so a hook takes exactly what it reads and
  returns exactly what is read after it. `GameScreen`'s logic became eleven **consecutive**
  slices called in their old order, which is what keeps every effect where it was (the
  review-focus risk); its markup became layers cut whole from the tree, so nothing draws in
  a different order.
- **Off-spec, decided in the build.** Flat sibling files for the openings instead of
  subfolders; `MenuDialogs` for the spec's `menu-screens`; no `screen-providers`
  component (13 lines, nothing to own); `RunBar`/`RunTargets`/`RunSumRow`/`RunDial` for
  `run-bar`/`target-area`/`dial-area`; `TARGET_EXIT_MS` to `constants/game.ts`;
  `announcementsReady` to `lib/session-announcements.ts`; `lib/` files take a few types
  from `hooks/` and `components/` as `import type` (erased at runtime).
- **Two tests re-pointed, not loosened.** `lib/run-shell.test.ts` and
  `lib/dial-metrics.test.ts` read source files to assert the shared top bar, the pause on
  blur and the reserved sum row; they now read the files those moved to.
- **Found on the way.** This morning's `ScoreReadout` (the bar's count-up) shared a name with
  the pause/game-over `ScoreReadout`; renamed `BarScore` in its own commit. `IntroCta` merges
  PLAY GAME and CREATE ROOM, which were the same button twice. `RunTopBar` stays drawn in
  `ArcadeGame` so the shell test keeps its teeth.
- **Not touched.** The three hooks over the limit (`use-arcade-run`, `use-multiplayer-game`,
  `use-achievements`), the 79 typography warnings, the shadow copied across ten files.
- **Dev data:** none — no table, column or screen reading the database changed.

## Verification log

**Verdict: criteria 1–5 and 13 PASS. Criteria 6–12 are PENDING, for the user to walk on a
device, as decided at spec — verify did not drive the app.** One suite failure predates this
work (Knip, below).

Suite: `pnpm check` — i18n verify, lint (0 errors; the 79 typography warnings this work
started with), Prettier (after formatting `siege-blow.tsx`, a comment edit from task 4),
types, 2464 tests. **Knip fails** on `coldBelow`, exported in `lib/game-over-title.ts` and used
only in that file. It came in with `ae0417f` from another session, before this work's first
commit, in a file this work never touched. It is not fixed here.

| #   | Criterion                                    | Result  | Evidence                                                                                                                                                                                                                                    |
| --- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Both rules `error` at 300, none reported     | PASS    | config at `eslint.config.mjs:133`; 0 size problems over `app/`+`components/`; a 305-line probe component errors on both rules                                                                                                               |
| 2   | Created hooks and `lib/` files under 300     | PASS    | both rules run as errors over the 35 created files: 0                                                                                                                                                                                       |
| 3   | One named component per created file         | PASS    | compiler pass over the 71 created component files: each has 1 top-level component, none nested                                                                                                                                              |
| 4   | `pnpm check` green; no msgid added/removed   | PASS*   | everything green but the Knip failure above; `git diff 6e97a12~1 HEAD -- locales` changes no `msgid`; 1021 messages before and after                                                                                                        |
| 5   | Every earlier test passes, plus the new ones | PASS    | 2464 pass (2378 this morning, + the spec's helper tests); two source-reading tests repointed to the files their subject moved to (build notes)                                                                                              |
| 6   | Scored run unchanged                         | PENDING | user, on a device                                                                                                                                                                                                                           |
| 7   | Tutorial unchanged                           | PENDING | user, on a device                                                                                                                                                                                                                           |
| 8   | Challenge with an opening unchanged          | PENDING | user, on a device                                                                                                                                                                                                                           |
| 9   | ADVENTURE run unchanged                      | PENDING | user, on a device                                                                                                                                                                                                                           |
| 10  | Intro dialogs and the bookmark unchanged     | PENDING | user, on a device                                                                                                                                                                                                                           |
| 11  | Restore mid-run unchanged                    | PENDING | user, on a device                                                                                                                                                                                                                           |
| 12  | Multiplayer unchanged                        | PENDING | user, on a device                                                                                                                                                                                                                           |
| 13  | _(added)_ The web bundle builds              | PASS    | `expo export --platform web` exports all four routes; every module in the game route evaluates (no import cycle breaks it). The static render is the splash only, so this does **not** prove the game screen renders — that stays with 6–12 |

## Review

`/code-review high` over `6e97a12~1..HEAD` (17 commits, 151 files): **no runtime defects.** It
compared token streams and found every layer's JSX identical to the old screen's, and the
hooks' bodies in their old order.

**Fixed in review**

- Three source-reading guards had quietly narrowed when their subject moved out of the file
  they read: `modes/engine.test.ts` now scans `use-dial-pan`, `use-key-motion` and
  `use-key-tint`; `lib/run-shell.test.ts` checks for a second `<PauseButton` across every
  file the live screen is drawn from; `lib/dial-metrics.test.ts` checks for `DialButton`
  where the dial is laid out. Each was probed: a planted `<PauseButton` and an `index % 3`
  both fail now.
- Eleven slice hooks were `.tsx` with no JSX, so they are `.ts` now.
- Stale pointers into `app/(tabs)/index.tsx` in twelve comments, `CLAUDE.md`'s
  `useMachine` line and the design guide's `accentFor`, rewritten to where the code is.
- `RunTargets`' header said "board" for the targets area. A board is a leaderboard.

**Review focus, confirmed**

1. Effect order. The slices are consecutive and called in order; the three hoisted
   declarations are `useState` (no effect). Elsewhere: carve effect before the pan, tint
   before motion, clock, then glimpse, then exit; reveal before pin; camera before land. The
   one move is `useHoldsDialogOpen` after the code field's effects, which touch disjoint state.
2. Fresh identities. The layers re-render with `GameScreen`, as the inline tree did: no
   regression, and no isolation either (see below). `BarScore` still keeps the count-up to
   itself.
3. Module level. Every animated piece is a module-level component in its own file, and every
   shared value is still created once per mount.
4. Refs. Each lives in the hook that writes it; `boardSize`/`sumRowRect` reach the layers as
   the same ref objects.
5. Lingui. Every translating component calls `useLingui()` itself; 1021 msgids unchanged.

**Left, deliberately**

- **The layers take the hook results whole** (`control`, `field`, …). They are new objects
  on every render, so a layer re-renders whenever the screen does, exactly as before the
  split. The size limit is met, but the code-guide's "take only what they draw" is not yet,
  for the game screen's layers. Narrowing each layer to the props it reads is a design job,
  not a move.
- The `.po` origin comments still point at old line numbers. `i18n:extract` would rewrite a
  catalog that carries another session's uncommitted Czech; the msgids are unchanged.
- Knip's `coldBelow` (another session's, `ae0417f`).

**Worth their own items**

- Narrow the game screen's layers to their real props, so a run's machine tick stops
  re-rendering the intro, the dialogs and the overlays. This is the performance half the
  split made possible.
- `lib/arcade-canvas.ts` has no test. It moved verbatim, and its input is the arcade hook's
  whole run, so it needs a fixture first.
- The three hooks still over 300: `use-arcade-run`, `use-multiplayer-game`,
  `use-achievements`. Then widen the lint to `hooks/`.
- The `shadowRadius: 12` shadow, copied across ten files (a sweep; it is the user's call).

Shipped to `main` at `9d12ef6` (pushed `bc3a13e..9d12ef6`), not deployed: criteria 6–12 are still to be walked on a device.
