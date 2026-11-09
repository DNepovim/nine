# Session candidates

Slug: session-candidates
Stage: review
Next: /ship session-candidates
Track: full
Branch: feat/session-candidates
Started: 2026-11-09

## Problem

A planned "pair" is two **sessions**, each with its own date, so the planner shows two
openings where the admin means one: one session, two challenges players choose between,
one date. The vote, the planner's list and the session's detail all follow from that
mistake — the list cannot say "this one opens in 5 h and Habit is ahead 7 to 3", a live
session's page cannot say who played it and how often, and an admin cannot see who voted.

## Appetite

**A week.** The shape of a table the app's vote, the queue and every admin screen read
changes, a data migration touches the live queue, and three admin screens are rebuilt.
Fixed: if it does not fit, the planner's list and the plan/edit dialog land first and the
live session's richer detail (per-user run counts) is what goes.

decided inline: schema change on a shipped table plus a migration of live rows.

## Shape

**The model.** A session has **two candidates** and **one date**. `challenge_sessions.mode_id`
stays what every reader (boards, summaries, the start screen, scores) already reads — the
challenge the session **runs**, which is the one **leading the vote** until it opens — and a
new `alt_mode_id` holds the other candidate. Each vote is one row (player, session, the
candidate picked); after every vote the leader is written into `mode_id` and the runner-up
into `alt_mode_id`, a tie leaving them as they were. Once the session opens the votes stop
and `mode_id` is the winner. `alt_mode_id` is null on a session booked with one challenge
(the auto-planner's, and any already past).

**Who is voting.** **Voting is in progress** for the **first planned session that has two
candidates** — the one that opens next — and the time left to open is the time left to
vote. Every later planned session is not being voted on yet: no counts, no clock. Players
reach the vote as now (the rating dialog's third step, the intro's link), but it offers that
session's two candidates.

**The planner list** — LIVE / PLANNED / PAST as the gallery's compact coloured pills, no
steps (sessions are no longer reordered; the queue is the order they were booked in).

- **Live row:** date on the left, the winning challenge's name, and one line under it: best
  score · players · time to the end.
- **Planned row:** date, the two candidates one under the other with each one's votes beside
  it, and under them the time to open. Votes and the clock appear **only on the voting
  session**; any other planned row shows names alone.
- **Past row:** as today, with the winner.
  PLAN SESSION is the dialog with two selects (as built), now booking **one** session.

**The session detail.**

- **Live:** title = start date; the winning challenge's name under it; the other candidate in
  smaller text; both with their votes; then the leaderboard, the total number of runs and the
  runs per player. The challenge cannot be changed. No EXTEND.
- **Planned, voting in progress:** title = date; both names with votes; a pie of the votes;
  the voters' nicknames and what each picked. No selects — an **EDIT CHALLENGE** button opens
  the two-select dialog pre-filled. Saving a changed candidate here **asks first**: it
  discards the votes for the one replaced.
- **Planned, not yet voting:** the same without votes, pie or voters.
- **Past:** read-only, as the live one.

**Pending (the state just shipped):** a challenge made pending is taken out of every planned
session it is a candidate in — the session keeps its date and its other candidate (now alone,
so no vote), and a session whose only candidate it was is removed. The confirmation names
both counts.

**The queue migration (chosen by the user):** the planned queue is merged two-by-two into
sessions — first + second, third + fourth — the rest re-packed onto the cadence, and the
existing votes (one per player for a session) are dropped: they were votes for the old model.

Areas:

- **Schema** — `alt_mode_id`; a reshaped `next_votes`; one `plan_challenge_session(a, b)` and
  `edit_challenge_session(id, a, b)`; `vote_next(session, mode)`; `next_vote_options`
  (the next session's two candidates); the leader-settle; an admin `session_voters`; the
  merge; the pending cut rewritten; `plan_challenge_pair`, `move_challenge_pair`,
  `move_challenge_session` go.
- **`lib/admin/sessions.ts`, `lib/session-ratings.ts`, `hooks/use-next-vote.ts`** — the
  candidate on a session, the vote keyed by challenge, the new reads.
- **Planner** (`admin-sessions.tsx`) — rows as above, pills, no steps. **Plan/edit dialog**
  (`admin-plan-pair.tsx`, renamed). **Session detail** (`admin-session.tsx`) — rebuilt in
  three shapes. **`admin-pair.tsx`, `lib/session-pairs.ts`** — deleted.
- **Gallery / challenge page** — "planned" and the planned dates now read a challenge as a
  candidate of a session, with its votes where it is voting.
- **Player vote** (`next-vote*.tsx`, `rating-overlay.tsx`, `challenge-card.tsx`) — tiles are
  the candidates of one session.
- **Domain** — `docs/domain.md` / `CLAUDE.md`: **candidate** in, **pair** out; the
  **vote** and **queue** rows reworded.

No mode branching (everything is the session's rows); no flag.

## In

- Two candidates and one date on a session; votes per candidate; leader-settles into
  `mode_id`.
- The planner list, pills and rows as above; the plan/edit dialog; no reordering, no EXTEND.
- The three session details, the pie and the voters; the confirmation on changing a
  candidate while voting.
- The pending cut on candidates; the production merge migration.

## Out

- Dropping `extend_challenge_session` from the database (the screen stops calling it).
- Reordering in any form; a stored order or a manual drag.
- The auto-planner booking two candidates — it stays single-candidate.
- Closing the vote early, a vote deadline different from the open time, vote reminders.
- Any redesign of the player's vote tiles beyond what they are keyed by.
- Showing players the vote count (they still see none before they vote).

## Rabbit holes

- **Migrating the live queue.** Merging rows deletes sessions and shifts dates; it must run
  in one transaction under the queue lock, re-pack once, and be idempotent against a queue of
  odd length (the last stays a single). This is the step that can hurt production.
- **`mode_id` flipping while planned.** Readers of a _planned_ session's `mode_id` will see
  the current leader; nothing may treat it as final until `opens_at`. The votes stop at open
  (the vote RPC refuses a session that has opened), which freezes it.
- **Ties.** A tie leaves the leader as booked, so a tie never flips on a refresh; the spec
  must say which candidate that is (the one first booked).
- **Editing a candidate during the vote.** Replacing one candidate drops the votes for it;
  the other candidate's votes stay. A session being voted on must be edited under the queue
  lock so a vote cannot land on a replaced candidate.
- **Old clients.** `vote_next(uuid)` is replaced by `vote_next(uuid, text)` and the old one
  dropped, so a device on the previous build gets an error when it votes until it updates.
  The vote shipped a day ago and a refused vote is a visible, honest failure; keeping a
  one-argument form that guesses a candidate would count votes for the wrong challenge.
- **`measure` per candidate.** A session's `measure` (score, time, hits) is stamped when it is
  booked from its challenge, and the server cannot resolve a challenge. With two candidates the
  runner-up's measure rides along as `alt_measure` and swaps with `mode_id` whenever the
  leader changes — otherwise a race that wins the vote would be ranked by score.
- **Per-user run counts** come from `run_receipts.session_id`; the live detail reads them
  through an admin RPC, since receipts are not public.

## Contract

### Domain words

**Used:** session, queue, slot, vote, challenge, state (pending / live — shipped), session
board, measure, `admin` the role (never the room host).

**Introduced:**

- **candidate** — one of the (up to) two challenges on a session's ballot. A session holds
  its **leading candidate** in `mode_id` and its runner-up in `alt_mode_id`; a vote is for a
  candidate. Once the session opens the ballot is closed and `mode_id` is simply the
  challenge it ran. `challenge_sessions.alt_mode_id`, `next_votes.mode_id`; `docs/domain.md`
  gains a row, `CLAUDE.md` its one-liner.
- **voting in progress** — the state of **the first planned session, when it has two
  candidates**: the one that opens next. Its time to open is the time left to vote. No other planned
  session is being voted on. `votingSession` in `lib/session-voting.ts`.

**Retired:** **pair** (introduced in the challenge-state item, never meant to outlive it) —
its rows leave `docs/domain.md` and `CLAUDE.md`; `pairsOf`/`withVotes` go with it.

**Reworded:** the **session** row ("one challenge, one start, one end") now says two
candidates and one date; the **vote** row now says which candidate of the next session; the
**queue** row loses its steps (a queue is no longer reordered).

**Collisions.** "Winner" already means a _player_ (`last_session_winner`, the podium). The
challenge a session runs is the **leading candidate** while it can still change and **what the
session ran** after — never "the winner". "Leading" is not "live": `live` is a session's
status (open now) and a challenge's state (offered).

### Files

Created:

| Path                                                        | Responsibility                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261109000000_session_candidates.sql` | The column, the reshaped vote, the RPCs, the merge, the pending cut.                                             |
| `supabase/tests/session_candidates.sql`                     | Assertions for the above; `challenge_state.sql` and `next_vote.sql` are rewritten onto the new RPCs.             |
| `lib/session-voting.ts` + `.test.ts`                        | `votingSession(sessions, now)`, `leadingOf` / tie rule mirror, `voteSlices(options)` for the pie.                |
| `lib/admin/session-detail.ts`                               | `listSessionVoters(id)`, `listSessionRunCounts(id)` (admin reads).                                               |
| `components/overlays/admin-session-live.tsx`                | A running or past session's detail.                                                                              |
| `components/overlays/admin-session-planned.tsx`             | A planned session's detail (voting or not).                                                                      |
| `components/overlays/admin-candidates-dialog.tsx`           | The two-select dialog, for PLAN SESSION (empty) and EDIT CHALLENGE (pre-filled); replaces `admin-plan-pair.tsx`. |
| `components/overlays/admin-session-votes.tsx`               | The votes block shared by both planned/live details: candidate names with counts, the pie.                       |

Deleted: `components/overlays/admin-pair.tsx`, `components/overlays/admin-plan-pair.tsx`,
`lib/session-pairs.ts` + `.test.ts`; `QueueMoves` from `admin-session-cells.tsx`.

Modified:

| Path                                                                                                                                                        | Change                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lib/admin/sessions.ts`                                                                                                                                     | `AdminSession.altModeId`; `planSession(a, b)`, `editSession(id, a, b)`; `planPair`, `movePair`, `QueueStep` go. |
| `components/overlays/admin-session.tsx`                                                                                                                     | A thin shell: picks the live/past or planned body, owns the filters' nothing.                                   |
| `components/overlays/admin-sessions.tsx`                                                                                                                    | Rows per status as shaped; compact coloured pills; no steps; the dialog books one session.                      |
| `components/overlays/admin-challenges.tsx`, `challenge-page.tsx`                                                                                            | A challenge is "planned" / has planned dates through either candidate; votes per candidate.                     |
| `components/overlays/challenge-state-dialog.tsx`                                                                                                            | Names both counts (removed, trimmed).                                                                           |
| `components/overlays/admin-pills.tsx`                                                                                                                       | none, unless the status pills need a tint the gallery's do not — name it in the tick.                           |
| `lib/session-ratings.ts`, `hooks/use-next-vote.ts`                                                                                                          | `VoteOption` is a candidate (`sessionId` + `modeId`); `voteNext(sessionId, modeId)`.                            |
| `components/overlays/next-vote.tsx`, `next-vote-dialog.tsx`, `next-vote-results-dialog.tsx`, `rating-overlay.tsx`, `challenge-card.tsx`, `menu-overlay.tsx` | Keyed by `modeId` (both options share one `sessionId`).                                                         |
| `lib/duration.ts` + test                                                                                                                                    | `remainingLabel(ms)`.                                                                                           |
| `constants/buttons.ts`, `docs/domain.md`, `CLAUDE.md`, `locales/*/messages.po`, `supabase/dev-fixtures.sql`                                                 | Ids, words, copy, a voting session with votes.                                                                  |

### Data and types

**Migration `20261109000000_session_candidates.sql`.** The code reads `alt_mode_id` and the new
RPCs, so **the push goes first**. It runs in one transaction under `lock_challenge_queue()`.

- `challenge_sessions`: `alt_mode_id text null`, `alt_measure text null`, `first_mode_id text null`
  (check: all three null or all set; `alt_mode_id <> mode_id`; `alt_measure` a valid measure;
  `first_mode_id` one of the two). Shipped rows get null: a past or running session is
  unchanged.
- `next_votes` is **dropped and recreated**: `(user_id uuid, session_id uuid references
challenge_sessions on delete cascade, mode_id text not null, voted_at timestamptz default
now(), primary key (user_id, session_id))`. Votes cast under the old model (one per player
  for a _session_) are discarded — they were for a different question. RLS on, no policy.
- **The merge (chosen by the user):** the planned queue, in `opens_at, created_at` order, is
  merged two-by-two — the first's challenge stays in `mode_id`, the second's moves to
  `alt_mode_id` (with its measure) and its row is deleted; an odd last session stays a single.
  Then one `repack_challenge_queue(now(), '-infinity')`. Sessions that have opened are untouched.
- `plan_challenge_session(p_mode_a, p_measure_a, p_mode_b, p_measure_b)` — replaces the
  one-challenge form (dropped, as the earlier migration drops its predecessors); refuses equal
  or pending candidates; books at the end of the queue as before. `p_mode_b` null books a single.
- `edit_challenge_session(p_id, p_mode_a, p_measure_a, p_mode_b, p_measure_b)` — **planned
  sessions only** (refuses one that has opened: its challenge cannot change). Replacing a
  candidate deletes the votes for the one that left; then settles. Refuses a pending candidate.
- `settle_next_vote()` restated for one session: the candidate with strictly more votes is
  written into `mode_id` (and its measure into `measure`), the other into `alt_*`; a tie leaves
  them as they are, which is the booked order.
- `next_vote_options()` — the **first planned session's** two candidates, as two rows
  `(session_id, mode_id, votes, mine, can_vote)`, in a **fixed order** (by challenge — amended in
  review: the leader first made the two tiles trade places when a vote changed the lead); nothing unless that session
  has two. `can_vote` as shipped (played the last challenge a player can see).
- `vote_next(p_session uuid, p_mode text)` — refuses unless `p_session` is the first planned
  session, `p_mode` is one of its candidates, and `can_vote`; one vote per player, a second
  moves it; settles. The one-argument form is dropped.
- `session_voters(p_session uuid)` — admin only: `(nickname, mode_id, voted_at)`, nameless
  voters' nickname null.
- `session_run_counts(p_session uuid)` — admin only: `(user_id, nickname, runs)` from
  `run_receipts.session_id`.
- `set_challenge_state` restated: making X pending takes X out of every **planned** session it
  is a candidate in — a session that has another candidate keeps its date and that candidate
  (now alone), its votes for X deleted; a session whose only candidate X was is deleted;
  re-pack; settle. Returns how many sessions it touched. A session running now is kept and
  hidden, as shipped.
- `plan_challenge_pair`, `move_challenge_pair`, `move_challenge_session` are **dropped**.
  `extend_challenge_session` stays in the database; the screen stops calling it.
- `plan_next_challenge_session` (the auto-plan) is untouched and still books a single.

**Types.** `AdminSession` gains `altModeId: string | null`. `VoteOption = { sessionId, modeId,
votes, mine, canVote }` — two options share a `sessionId`; the key is `modeId`. `votingSession`
returns the first `upcoming` `AdminSession` with `altModeId !== null`, or null.
Time left is the existing `formatCountdown(ms)` ("5:12:09").

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Copy / i18n** | EDIT CHALLENGE, PLAN SESSION (dialog title, kept), FIRST/SECOND CANDIDATE (kept), "Change a candidate?" with "{n} votes for {name} will be discarded.", KEEP / CHANGE buttons, VOTERS, "{n} without a nickname", RUNS, "{n} runs", "{n} players", "{time} left", "opens in {time}", "Nobody voted yet.", the confirmation's removed/trimmed lines ("{n} sessions lose this candidate and keep the other."). Admin pills (LIVE, PLANNED, PAST) stay plain as the planner's were. All Czech. |
| **How to Play** | No — no gameplay changes; the player's vote is asked as before.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Flag**        | None; none asked for.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Buttons**     | `admin.session_edit_candidates`, `admin.session_candidates_save`, `admin.session_candidates_cancel`, `admin.session_edit_confirm`, `admin.session_edit_keep`; `admin.plan_pair_*` are renamed to these.                                                                                                                                                                                                                                                                                    |

## Acceptance criteria

1. After the migration, the queue that was planned one-challenge-per-row is merged: each
   planned session has two candidates (an odd last one stays single), the number of planned
   sessions is the old number halved, rounded up, the queue is re-packed onto its slots, and nothing that had
   opened changed.
2. A planned session has **one** date. PLAN SESSION opens a dialog with two selects and SAVE
   books **one** session at the end of the queue; the same challenge twice, a missing one, or a
   pending one is refused (server and dialog).
3. Planner list, **live** row: the date on the left, the leading challenge's name, and under it
   one line "best score · N players · time left"; **planned** rows: date, the two candidates
   one under the other; **the voting session only** shows each candidate's votes beside it and
   "opens in …" under them; any other planned row shows neither votes nor a clock.
4. The list has no up/down steps anywhere and no way to reorder; the LIVE / PLANNED / PAST
   filter is a compact one-line row of coloured pills like the gallery's, each with a count.
5. A **live** session's detail: title is its start date; under it the challenge it runs; under
   that, smaller, the other candidate; both with their final votes; then the leaderboard, the
   total number of runs and each player's runs. The challenge cannot be changed and there is no
   EXTEND anywhere in the detail.
6. A **planned session in voting**: title is the date; both candidates with votes; a pie of the
   votes; the voters' nicknames with what each picked (nameless ones counted); **no selects**,
   an EDIT CHALLENGE button.
7. A planned session **not** in voting looks the same without votes, pie or voters.
8. EDIT CHALLENGE opens the two-select dialog pre-filled. Changing a candidate **while voting is
   in progress** asks first, naming the votes that will be discarded; KEEP changes nothing,
   confirming discards exactly the replaced candidate's votes and keeps the other's. Changing a
   candidate of a session not in voting asks nothing.
9. A vote is for a candidate: `vote_next(session, mode)` counts it, a second vote moves it, the
   candidate with strictly more votes is written into `mode_id` (and its measure with it), a tie
   leaves the booked order, and a player who did not play the last challenge is refused.
10. A session that has opened refuses further votes and refuses an edit of its candidates.
11. Making a challenge pending removes it from every planned session it is a candidate in: a
    session with another candidate keeps its date and that candidate; a session where it was the
    only one is removed; the dialog names both counts. A running session is kept.
12. The player's vote (rating dialog step, intro link) offers the voting session's two
    candidates and works against the new RPC; a signed-out or non-voter still sees the results
    dialog with the note.
13. A session booked with one challenge shows no votes or ballot anywhere in its detail (no
    "0 VOTES" claiming a vote nobody was asked to take). _(added in verify)_
14. `pnpm check` is green, Czech included, and the SQL tests pass against the new RPCs.

## Tests

- `lib/session-voting.test.ts` — `votingSession` picks the first upcoming session when it has
  two candidates (null when the first is single even if a later one has two; null for a running
  or past one).
- `lib/admin/stat-people`-style tests are not touched.
- `supabase/tests/session_candidates.sql` — plan/edit guards (equal, pending, opened), the
  vote (strict leader writes `mode_id` + measure, tie keeps booked order, second vote moves,
  non-player refused, opened session refused), edit discards only the replaced candidate's
  votes, `set_challenge_state` trims vs deletes, the merge (a queue of 5 singles → 2 doubles +
  1 single, dates re-packed), `session_voters` / `session_run_counts` admin-only.
  `challenge_state.sql` and `next_vote.sql` are rewritten onto the new RPCs.

## Review focus

1. **The merge migration** (task 1): one transaction under the queue lock, nothing opened is
   touched, an odd queue ends on a single, votes dropped _before_ rows are deleted so no FK is
   violated, and it is safe to read the plan against production's actual queue before pushing.
2. **`mode_id` flips while planned** (tasks 1, 5): every reader of a planned session's
   `mode_id` — the gallery's "planned" dot, the challenge page's dates, the start screen's
   teaser — treats it as "the leading candidate", and `alt_mode_id` is counted wherever a
   challenge is asked "are you planned?" (task 6), or a challenge that is only ever the
   runner-up reads as unplanned.
3. **Edit while voting** (tasks 1, 7): the edit and a vote both take the queue lock; replacing
   a candidate deletes only its votes and settles, so the leader is right afterwards.
4. **Measure follows the leader** (task 1): `measure`/`alt_measure` swap with `mode_id`/
   `alt_mode_id` in `settle_next_vote` and in the pending trim.
5. **What the removed RPCs leave behind** (tasks 6, 8): `QueueMoves`, `planPair`, `movePair`,
   `pairsOf`, `AdminPair` have no caller; Knip is the check, and the pills' `compact` is the
   gallery's own component, not a copy.
