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
- [x] 8. `lib/board-live.ts` — `session_scores` on its own channel, comment corrected (AC 13)
- [x] 9. `sessionRivalChange` + `use-session-rival` — weigh the live run, and keep a lead that was the player's armed until it is really lost; check `time` with a null run time (AC 14)
- [x] 10. `crossedSession` — `sessionFirst` also beats `mine`, opening needs `mine === null` (AC 15)
- [x] 11. `sessionTargetsFor` — null on `board.error` (AC 16)
- [x] 12. `useSessionBoard` — coalesce as `useBoard` does (AC 17)
- [x] 13. `stepRun` — reset a session phase on a new `runSeq`; `crossedOf` branches on `phase.session` and gives `[]` with no live figures (AC 18)
- [x] 14. `stepRun` — a session restart measures the new run against the abandoned run's figures too, since neither the board nor the device has them yet (AC 18)

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
- **Reopened by review (tasks 8-13).** `leadKept` sits beside `sessionRivalChange`, which is
  unchanged, so AC 7 still reads as written: while a lead is kept the hook doesn't advance its
  baseline, and a rival later passing the run still fires. `runSeq` joins `RunInput` and resets
  only a session phase; an ordinary restart is pinned as before by a test. AC 16 and 17 live in
  an unexported helper and a hook with no render tests, so verify has to check them another way.
- **Task 14:** the phase tracks `reached` and carries `abandoned` across a session restart, including one that has to wait for its board. `abandonedBest` counts a run only if it has a figure on the measure.
- **Fixtures:** none needed for these tasks.

## Verification log

**Verdict (round 4):** 18 PASS, 0 FAIL, 0 SKIPPED. Limits are in the rows: 10's throttle was not exercised live, 11 was not replayed live this round, and 12 excludes two failures from other work.

| #   | Criterion                                            | Result | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | score session: first + best, best, equal             | PASS   | `lib/session-announcements.test.ts`                                                                                                                                                                                                                                                                                                                                 |
| 2   | hits session: hits first, score breaks ties          | PASS   | same                                                                                                                                                                                                                                                                                                                                                                |
| 3   | time session: always `[]`                            | PASS   | same                                                                                                                                                                                                                                                                                                                                                                |
| 4   | empty session opens on figure > 0 only               | PASS   | same                                                                                                                                                                                                                                                                                                                                                                |
| 5   | leader is me → never `sessionFirst`                  | PASS   | same                                                                                                                                                                                                                                                                                                                                                                |
| 6   | device best above stale row not "beaten"             | PASS   | same (`ownRowOf`)                                                                                                                                                                                                                                                                                                                                                   |
| 7   | `sessionRivalChange` only on lead from me            | PASS   | same, unchanged by round 3                                                                                                                                                                                                                                                                                                                                          |
| 8   | no board line on a challenge run                     | PASS   | Live FOUR KEYS, real input: 22 hits to 1264, past every Accuracy board figure (ever 267). The bar said only "Nobody is ahead of you".                                                                                                                                                                                                                               |
| 9   | `sessionFirst` posts mid-run                         | PASS   | Same run: one `submit_session_score` (`p_score` 30, `p_hits` 2) as the lead was taken, row in `session_scores` while the run played on. Read from the database, not a second device.                                                                                                                                                                                |
| 10  | rival passing → gray `sessionLost` on bar            | PASS   | Live, new channel: "ACE_9 passed you" once, within 2.5 s of the write. Colour seen in round 1. The 15 s throttle was not exercised live.                                                                                                                                                                                                                            |
| 11  | ordinary runs unchanged                              | PASS   | Tests, including a new pin that an ordinary restart keeps its phase. Not replayed live this round.                                                                                                                                                                                                                                                                  |
| 12  | `pnpm check` green                                   | PASS\* | i18n:verify (958), prettier, tsc, knip clean; 2200 of 2201 tests; ESLint clean on every touched file. \*Excluded as not this item: 11 ESLint errors in `.claude/worktrees/road-bandits/components/date-time-field.tsx` (round 3 full run), and `local-reset.test.ts` on `nine.seen-session.v1`, a key only in uncommitted `constants/storage.ts`.                   |
| 13  | no migration: boards stay live                       | PASS   | Real app with `session_scores` out of the local publication: `sessions` refused alone, `boards` subscribed, a `scores` write reached `boards`. Publication restored.                                                                                                                                                                                                |
| 14  | rival past posted row, below the run                 | PASS   | Live: rival above my row and below the run, silent for 6.5 s; then past the run, one line.                                                                                                                                                                                                                                                                          |
| 15  | `sessionFirst` needs the own row not past the leader | PASS   | Tests, amended in review's second pass. Live in round 3: no claim up to 111 with the device at 1264. The claim at 1336 was the defect that pass fixed; the corrected rule is covered by tests, not replayed live.                                                                                                                                                   |
| 16  | failed read freezes nothing                          | PASS   | Live: `session_board` blocked, a hit announced and posted nothing. Unblocked, the read landed and the run caught up with a post (`p_score` 21). The line itself was queued behind an achievement toast past my window, so not seen in that run.                                                                                                                     |
| 17  | burst → one re-read per window                       | PASS   | Live: 6 writes about 50 ms apart caused 2 reads, 514 ms apart.                                                                                                                                                                                                                                                                                                      |
| 18  | RESTART starts a session run over                    | PASS   | Tests, and live uninstrumented after task 14: run 1 took the lead and posted (row 146), abandoned at 270. The restarted run stayed silent up to 246; "Your best on this challenge" came with the hit that took it to 326. Round 3 said it at 155. Two earlier restarts logged no line and that was not explained, but this sample read the bar directly and saw it. |

Past the criteria: live `sessionBest` is now seen ("Your best on this challenge"). The first-launch, tutorial and offline notes from round 1 still hold, since those paths were not touched.

## Review

`/code-review high` over 11775f2, 10 findings, each checked against the code.

**Reopened (tasks 8-13, AC 13-18):**

- **Boards go dark without the migration.** Measured on local Realtime: the join replies ok,
  then a system message rejects the unpublished table, and a `scores` write reaches nobody on
  that channel. The control channel with every table published got the event. The comment in
  `lib/board-live.ts` and the spec's "the push can follow the app" were both wrong.
- **False `sessionLost`.** It compares posted rows only, and `sessionFirst` posts once, so a
  leader still playing is told they lost to a rival they are ahead of.
- **`sessionFirst` ignores the own row.** A player with no nickname is invisible to
  `session_board`, so their session reads empty and every run "opens" it, with fireworks and
  a post. PLAY AGAIN on a stale leader does the same.
- **Failed read freezes.** `sessionBoardOf` returns rows `[]` with `error` set, so a run
  freezes "no leader, not empty" and stays silent. This is the spec's own rabbit hole.
- **No coalesce.** `useBoard` waits before re-reading; `useSessionBoard` re-reads per event,
  and each refresh marks the read in flight stale.
- **RESTART keeps the frozen phase** when `inRun` stays true, so the new run stays silent and
  never posts mid-run. Boards share this gap; only the session side is reopened here.

**Kept:**

- **English bar lines:** the user's decision at spec. The two spec lines contradicting it are
  corrected. Not a defect here, but see below.
- **Targets frozen at run start:** the spec's design. Its cost is below.
- **`HAS_FIGURE.time`:** unreachable, but the `Record<Measure, …>` requires it.

**Rejected:** "challenges lost their personal best" is not a regression. `machines/game.ts:769`
has never kept a best for a mode with no board, so `record` could not fire on a challenge before
this commit either.

**Review focus:** none of the five is real.

- Board targets neutralised: `boardTargetsOf`, and a live hit gave no board line.
- Leader compared by id: `sessionRivalChange` and its test.
- Other sessions' events filtered: `use-session-card.ts:188`, `sessionOf` tests.
- `runFigures` identity: `use-announcements` keys on its fields.
- Device best keyed by `sessionId`: `deviceBestOf` and its test.

**House pass:** domain words used correctly, no mode name read outside `modes/`, value maps are
exhaustive, new `lib/` code has tests, comments give the why, scales are the existing ones. How
to Play is unaffected: no controls, scoring or rules changed.

**Worth their own items:**

- A frozen leader can say "Nobody is ahead of you" under a rival who has since posted more, and
  retaking the lead is silent with no post.
- The bar can say "You beat your best" on a run game over doesn't call a personal best, and it
  doesn't count towards `tenBests`. Whether a session best should count is a product call.
- RESTART keeps the frozen phase on an ordinary run too.
- The whole bar is English for Czech players.

### Review, second pass

`/code-review high` over the fix files, 10 findings, checked against the code.

**Fixed here, small and covered by tests, not replayed live:**

- `sessionFirst` could still claim a lead the player's own row already held, and a test
  encoded it. It now needs the own row **not** already past the leader. This corrects AC 15's
  live evidence: the line at 1336 in round 3 was this false claim, not a pass of it.
- The rival baseline now resets on `runSeq`, so a kept lead isn't judged against a restarted
  run's zeroed figures.
- `lib/board-live.ts` comments now describe two channels.

**Added to the items worth their own work:**

- An ordinary RESTART keeps `crossed`, so a 10-point run after a record can read as a personal
  best at game over. Pre-existing, and a real bug.
- The bar's queue, current line and opening quiet aren't reset on a straight restart.
- A failed first read has no retry, so a quiet session with no pause stays silent. It was silent
  before this work too.
- A run restarted before its targets froze leaves nothing behind.
- The coalesce is a trailing debounce: under sustained events under 300 ms apart it would not
  read at all. `useBoard` has the same shape, and the session traffic to cause it doesn't exist
  yet.
- Small duplication: the two reconnect flags and the coalesce block.
