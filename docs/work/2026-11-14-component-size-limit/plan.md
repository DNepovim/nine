# Every component under 300 lines — Plan

Spec: docs/work/2026-11-14-component-size-limit/spec.md

## Tasks

- [x] 1. `eslint.config.mjs` — both rules at 300 as `warn`; confirm exactly the 17 files warn
- [x] 2. Tests first: `lib/*.test.ts` for the GameScreen helpers, written against today's code (import from the screen temporarily, or move each helper and its test together)
- [x] 3. Move GameScreen's module-level helpers to `lib/intro-standing.ts`, `lib/launch-asks.ts`, `lib/feedback-bookmark.ts`, `lib/board-targets.ts`, `lib/announcements.ts` — also `lib/run-session.ts` (the session-bests family) and `lib/run-title.ts` (accent, wordmark, subtitle); `announcementsReady` went to `lib/session-announcements.ts` instead, beside `SessionTargets`, since that file already imports announcements.ts. Helpers moved and tested together (identical code, so the same as testing first).
- [x] 4. File-only splits: `siege-blow`, `admin-knowledge`, `admin-messages`, `admin-stats` — siege parts → `siege-shot/mote/falling`; knowledge pages and their Section/Formula/Note → `knowledge-*`, `useBoardLabel` hook, `lib/admin/knowledge-figures`; `AdminAnswerDialog`; stats: `AdminStatsModes` + `lib/admin/stat-figures` (the table-row builder stayed: it closes over `t` and the file was under without it)
- [ ] 5. File-only splits: `openings/takeoff`, `openings/lever-pull`
- [ ] 6. File-only splits: `email-code-modal`, `dial`, `best-scores-line`, `pie-countdown`, `game-over-overlay`
- [ ] 7. `dial-button` — gesture hook + face pieces
- [ ] 8. `player-profile-overlay` — sections
- [ ] 9. `menu-overlay` — Alone / With friends panels, pickers, state hook
- [ ] 10. `how-to-play-overlay` — one file per section
- [ ] 11. `arcade-game` — frame-loop hook + map / hero / HUD pieces
- [ ] 12. GameScreen logic, leaves first: `use-multiplayer-screens`, `use-launch-asks`, `use-screen-dialogs`
- [ ] 13. GameScreen logic: `use-run-boards`, `use-run-announcements`, `use-run-session`
- [ ] 14. GameScreen logic: `use-run-control`, `use-run-ending`, `use-play-field`
- [ ] 15. GameScreen markup: `screen-providers`, `run-celebrations`, `run-overlays`, `title-dialogs`, `launch-asks-layer`, `menu-screens`, `multiplayer-screens`
- [ ] 16. GameScreen markup: `game-layer` with `run-bar`, `target-area`, `dial-area`; `index.tsx` under 300
- [ ] 17. Rules to `error`; code-guide Components and CLAUDE.md Rules gain the 300-line bullet; `pnpm check`

`pnpm typecheck && pnpm lint && pnpm test` after every task; each task is its own commit
(`git commit --only`), so a regression bisects to one split.

## Verification log

_(verify fills this in)_
