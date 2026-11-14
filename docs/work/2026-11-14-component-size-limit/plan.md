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
- [ ] 15. GameScreen markup: `screen-providers`, `run-celebrations`, `run-overlays`, `title-dialogs`, `launch-asks-layer`, `menu-screens`, `multiplayer-screens`
- [ ] 16. GameScreen markup: `game-layer` with `run-bar`, `target-area`, `dial-area`; `index.tsx` under 300
- [ ] 17. Rules to `error`; code-guide Components and CLAUDE.md Rules gain the 300-line bullet; `pnpm check`

`pnpm typecheck && pnpm lint && pnpm test` after every task; each task is its own commit
(`git commit --only`), so a regression bisects to one split.

## Verification log

_(verify fills this in)_
