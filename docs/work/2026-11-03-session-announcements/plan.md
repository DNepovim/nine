# Session announcements — Plan

Spec: docs/work/2026-11-03-session-announcements/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261103020000_session_scores_realtime.sql` — publication + replica identity; applied locally
- [x] 2. `lib/announcements.ts` — three ids and pools; style, effect, record-medals entries; tests
- [x] 3. `lib/session-announcements.ts` + test — targets, `crossedSession`, reconcile, `sessionRivalChange` (AC 1–7); also `sessionTargetsOf`, `deviceBestOf`
- [x] 4. `lib/announcement-run.ts` + test — freeze session targets through the same `stepRun`
- [x] 5. `lib/board-live.ts` `subscribeSessions`; `useSessionBoard` refreshes on it; `sessionOf` in `lib/board-events.ts` (+test)
- [x] 6. `hooks/use-session-rival.ts`; `use-announcements` takes session input; `hooks/use-run-rival.ts` picks board vs session rival; one shared `nextRivalSeq`
- [x] 7. `app/(tabs)/index.tsx` — wiring, neutral board targets on a session run, combined rival

## Build notes

- **Beyond the file table:** `hooks/use-run-rival.ts` (board or session rival) and the
  module-level helpers `boardTargetsOf`, `sessionTargetsFor`, `sessionRunOf` in
  `app/(tabs)/index.tsx`. They exist because the extra ternaries pushed `GameScreen` past
  sonarjs' cognitive-complexity limit of 20. No behaviour differs from the spec.
- **Rival seq:** a single module counter (`nextRivalSeq`) is shared by both rival hooks, so
  the bar's `seq` check can't confuse the session's first event with the boards' first.
- **Realtime DELETE:** `sessionOf` reads `new` and then `old`, because Realtime sends an
  empty `new` on a delete.
- **`sessionFirst` fires once per run.** The frozen leader isn't re-armed after a
  `sessionLost`, so retaking the lead in the same run is silent, the same way a board record
  announces once.
- **Dev data:** none needed. The migration only adds a publication, with no new rows or states.
- **Unrelated red test:** `lib/local-reset.test.ts` fails on `nine.seen-session.v1`, a key
  from the uncommitted challenge-openings work in the shared checkout (`hooks/use-session-ask.ts`),
  not from this item.

## Verification log

**Verdict (round 1, incomplete):** 10 PASS, 0 FAIL, 2 SKIPPED (8, 9: need a real hit in the app; the Chrome extension disconnected before one landed).

| #   | Criterion                                   | Result  | Evidence                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | score session: first + best, best, equal    | PASS    | `lib/session-announcements.test.ts`                                                                                                                                                                                                                                                                                                 |
| 2   | hits session: hits first, score breaks ties | PASS    | same                                                                                                                                                                                                                                                                                                                                |
| 3   | time session: always `[]`                   | PASS    | same                                                                                                                                                                                                                                                                                                                                |
| 4   | empty session opens on figure > 0 only      | PASS    | same (score and hits cases, failed read)                                                                                                                                                                                                                                                                                            |
| 5   | leader is me → never `sessionFirst`         | PASS    | same                                                                                                                                                                                                                                                                                                                                |
| 6   | device best above stale row not "beaten"    | PASS    | same (`ownRowOf` case)                                                                                                                                                                                                                                                                                                              |
| 7   | `sessionRivalChange` only on lead from me   | PASS    | same, 4 cases                                                                                                                                                                                                                                                                                                                       |
| 8   | no board line on a challenge run            | SKIPPED | Unit: `announcement-run.test.ts` "asks the session, never the board". Not seen live: no run landed a hit, and no board line can fire without one.                                                                                                                                                                                   |
| 9   | `sessionFirst` posts mid-run                | SKIPPED | Unit: `publish` asserted in `announcement-run.test.ts`. Not seen live: a scripted tap run posted nothing in about 30 s, and the extension disconnected before its log could be read, so it's unknown whether the taps registered.                                                                                                   |
| 10  | rival passing → gray `sessionLost` on bar   | PASS    | Web build, local stack, FOUR KEYS: player's row seeded as leader, run started, rival's `session_scores` row raised mid-run. Bar showed "Challenge: ACE_9 leads now" in gray with the implosion, seen in a screenshot about a second after the write. The 15 s throttle is not exercised live (same code path as `useRivalRecords`). |
| 11  | ordinary runs unchanged                     | PASS    | full vitest run: 2162 pass. Existing announcement / run / rival tests unchanged except rival count 6→7                                                                                                                                                                                                                              |
| 12  | `pnpm check` green                          | PASS\*  | eslint 0 errors, prettier, tsc, knip, i18n:verify (958) clean on the main tree. \*Excluded: `.claude/worktrees/road-bandits` lint errors and `local-reset.test.ts` on `nine.seen-session.v1`, both from other in-progress work (uncommitted `constants/storage.ts` + `hooks/use-session-ask.ts`)                                    |

Past the criteria: tutorial and Trainee runs have `runSession === null`, so the path is
unchanged. Offline, `ready` still needs `online`. With no profile (`userId === null`), the
steal never fires and nothing reads as "leading".
