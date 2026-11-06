# Challenge state

Slug: challenge-state
Stage: review
Next: /ship challenge-state
Track: full
Branch: feat/challenge-state
Started: 2026-11-06

## Problem

Every challenge in the catalog can be planned and played the moment it ships, so a challenge
that is half-built, or one the admin wants to rest, has no way to be held back — the only
handle is not booking it, and nothing on the gallery says which are ready. And the queue
shows a flat list of sessions, though what an admin is really deciding, two at a time, is
which of two challenges the players will vote for: the planner never shows that vote, and
planning means a full-screen form for one session.

## Appetite

**A week.** A new table and a state on every challenge (new domain word), changes to the
queue RPCs and to what players can read, and four admin surfaces — gallery, challenge page,
planner list, plan dialog. Fixed: if it does not fit, the pair's storage stays flat (below)
and the lesser admin polish goes first.

decided inline: new table + domain word + several screens; no smaller shape holds it.

## Shape

**State.** A challenge is `live` or `pending`. The catalog is code, so the state is a row:
`challenge_states (mode_id, state)`, one per challenge an admin has ever set; **no row means
live**, which keeps everything shipped working and means a new catalog entry is live until
somebody holds it. Players cannot see a pending challenge: every read of sessions players
make (open sessions, the vote's options, the queue's teaser) leaves out sessions of a
pending challenge. Planning a pending challenge is refused by the server (append, edit,
re-point).

**Admin: the challenge page** gets a state control (LIVE / PENDING). Switching live →
pending asks first, through a `ModalCard`, naming what will be removed ("N planned sessions
will be taken out of the queue") and removes them (the queue re-packs behind them). A
**live** session (running now) is not touched — it plays out; the dialog says so. Switching
back to live restores nothing.

**Admin: the challenge page, planned.** When the challenge has planned sessions, the page
lists the dates it is planned for and, where it is one of the vote's two candidates, its
votes. Votes are read through the vote's existing counts (`next_vote_options`).

**Admin: the planner.** PLAN SESSION opens a **dialog** (a `ModalCard`) in place of the
full screen: **two selects**, the two candidate challenges, both required and different,
pending challenges not offered. SAVE books both at the end of the queue as a pair. The
queue is shown in **pairs**: the first pair is the live vote — one item, both challenges,
their vote counts, the one with more votes on top; when it opens, the winner runs and the
loser stays queued as the first of the next pair. Editing a single planned session (change
its challenge, remove it) stays as today's form.

**Admin: the gallery.** One indicator in the tile's top-right corner for everything:
**red, blinking** = running now · **green** = planned (in the queue) · **blue** = live, with
nothing running or booked · **black** = pending. A running or planned challenge is
necessarily live, so the dot reads in that order of precedence and is never ambiguous. A
**filter** (the planner's pills) over the four.

Areas:

- **Schema** — `challenge_states` table (admin write via an RPC, admin read); queue RPCs
  (`plan_`/`edit_challenge_session`, auto-plan) refuse a pending challenge; a `set_challenge_state`
  RPC that removes the challenge's planned sessions and re-packs; the players' session
  reads and `next_vote_options` leave pending out.
- **`lib/admin/`** — a challenge-state read/write beside `sessions.ts`.
- **Challenge page** (`challenge-page.tsx`) — the state control, the confirm dialog, the
  planned dates and votes.
- **Planner** (`admin-sessions.tsx`, `admin-session.tsx`) — the plan dialog with two
  selects; the pair item with counts in the queue.
- **Gallery** (`admin-challenges.tsx`, `live-dot.tsx`, `admin-tile.tsx`) — one dot, four
  values, a filter.
- **Copy** — admin screens are not translated, but the confirm dialog and the dot legend
  go through `pnpm i18n:extract` like the rest.
- **Domain** — `docs/domain.md` and the CLAUDE.md table gain **state** (and **pair**).

## In

- `challenge_states` and the live/pending state, with the server refusing to plan a pending
  challenge and hiding it from players.
- State control + confirm dialog on the challenge page; planned dates and votes there.
- Plan-session dialog with two selects; the first pair shown as one item with votes.
- Gallery dot (four values) and filter.

## Out

- A state per **session** — the state is the challenge's.
- A feature flag (none asked for).
- Showing players _why_ something is missing, or any player-facing copy or How to Play
  change — a pending challenge is simply not there.
- Re-ordering inside the queue by dragging; the up/down controls stay.
- Scheduling a state change for later.

## Rabbit holes

- **The pair vs. the flat queue.** The vote today swaps the slots of the queue's first two
  sessions, and `repack_challenge_queue` assumes a flat list. The way round it: **keep
  storage flat** — the dialog books two rows, and "pair" is how the first two (and every two
  after) are drawn. If a pair breaks apart after a winner opens, the next two simply
  re-pair. This is why the appetite might not hold if the user wants true pair rows.
- **Hiding from players** is every read that names a session — easy to miss one. The spec
  lists them; the verify walks each.
- **A removed-planned dialog for a challenge that is the vote's current candidate** changes
  the pair under people who have voted; their vote stops counting by itself (the vote
  already works that way).
- **Auto-plan** (the cron that books when nothing is queued) must skip pending challenges.
- The gallery dot reuses `LiveDot`/`PlannedDot`; a four-valued dot is one component, not
  three — extend it rather than add a fourth.

Decided with the user: the pair is the vote (the first two of the queue, booked together,
winner on top); the gallery uses one dot for everything — red blinking (running), green
(planned), blue (live), black (pending).

## Contract

### Domain words

**Used:** challenge, session, queue, slot, vote, drill (not touched), `admin` — the **role**
(who may set a state), never the room host.

**Introduced:**

- **state** — whether a **challenge** is `live` or `pending`. `live` is the usual one: the
  challenge may be planned and players see its sessions. `pending` holds it back: it cannot
  be planned and players see none of its sessions. A fact about the challenge, not a session.
  `challenge_states`, `ChallengeState` in `lib/challenge-state.ts`, `set_challenge_state`.
  No row means live. `docs/domain.md` gains a row, `CLAUDE.md` its one-liner.
- **pair** — the queue read two at a time: the first pair is the vote's two candidates; later
  pairs are the two that will be. Not stored — drawn from the flat queue by
  `pairsOf` in `lib/session-pairs.ts`. The planner books a pair at once. `docs/domain.md`
  gains a row, `CLAUDE.md` its one-liner.

**Collisions.**

- **state vs. status vs. machine state.** A _session_ has a **status** (`SpanStatus`:
  `live` / `upcoming` / `expired`, from the clock); a _challenge_ has a **state** (`live` /
  `pending`, from an admin). Both use the word `live`: in prose a session is **running**
  and a challenge is **live**; in code `SpanStatus` is untouched and `ChallengeState` is its
  own type. The XState "state" (`menu`, `playing`) is a third sense; this one is always
  "challenge state".
- **The gallery dot** now says four things, in this precedence: **pending** (black) beats
  **running** (red, blinking) beats **planned** (green) beats **live** (blue). A running or
  planned challenge is necessarily live, so the dot never contradicts the state.

### Files

Created:

| Path                                                     | Responsibility                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261106020000_challenge_state.sql` | The table, the guard, the state RPC, the policy and the player read.                                |
| `supabase/tests/challenge_state.sql`                     | Assertions for the above (run by `pnpm db:test`).                                                   |
| `lib/challenge-state.ts` + `.test.ts`                    | `ChallengeState`, `challengeDotOf` (the dot's four values and precedence), the filter's membership. |
| `lib/session-pairs.ts` + `.test.ts`                      | `pairsOf(queue)`: chunk a queue in twos; `withVotes(pair, options)`: order a pair by votes.         |
| `lib/admin/challenge-states.ts`                          | `listChallengeStates()`, `setChallengeState()`.                                                     |
| `components/overlays/admin-plan-pair.tsx`                | The PLAN SESSION dialog: two selects, SAVE, CANCEL.                                                 |
| `components/overlays/challenge-state-dialog.tsx`         | The confirmation before live → pending.                                                             |

Modified:

| Path                                       | Change                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `components/overlays/admin-challenges.tsx` | Reads states and votes; the tile's one dot; the filter pills.                                 |
| `components/overlays/live-dot.tsx`         | A `ChallengeDot` over the four kinds (extends `LiveDot` / `PlannedDot`, adds blue and black). |
| `components/overlays/challenge-page.tsx`   | State control, planned dates, votes.                                                          |
| `components/overlays/admin-sessions.tsx`   | PLAN SESSION opens the dialog; the queue drawn as pairs, the first with its votes.            |
| `components/overlays/admin-session.tsx`    | Loses its new-session path; keeps editing a planned / live / past session.                    |
| `lib/admin/sessions.ts`                    | `planPair`; `planSession` goes. `editSession` unchanged.                                      |
| `constants/buttons.ts`                     | New `ButtonId`s (below).                                                                      |
| `docs/domain.md`, `CLAUDE.md`              | The two rows.                                                                                 |
| `locales/*/messages.po`                    | New copy.                                                                                     |

### Data and types

**Migration `20261106020000_challenge_state.sql`** — the code reads columns and RPCs this adds,
so **the push goes first**; the old code against the new schema is harmless (it books through
the old RPC, which now also refuses a pending challenge).

- `challenge_states (mode_id text primary key, state text not null check (state in ('live','pending')), changed_at timestamptz not null default now(), changed_by uuid)`. RLS on; select policy `has_feature(auth.uid(), 'admin')`; no write grants.
  Shipped challenges have no row and are therefore live.
- `challenge_is_pending(p_mode_id text) returns boolean` — `stable security definer`; granted to `anon, authenticated` (the policy calls it as the reader).
- **Policy on `challenge_sessions`:** `"public read"` is replaced by one that reads
  `not challenge_is_pending(mode_id) or has_feature(auth.uid(), 'admin')`.
- `open_sessions_with_leaders()` — a `security definer`, so the policy does not reach it —
  restated in full from `20261026000000_session_hits_measure.sql` with one added predicate,
  `not challenge_is_pending(s.mode_id)`. Its columns are unchanged.
- `set_challenge_state(p_mode_id text, p_state text) returns int` — `require_admin()`;
  takes the queue lock; upserts the row; on `pending` deletes the challenge's **planned**
  sessions (`opens_at > now()`, which have no scores) and re-packs the queue; returns how
  many it deleted. A running session is kept, and is hidden from players by the read above.
  Setting `live` deletes nothing and restores nothing.
- `plan_challenge_session`, `edit_challenge_session` — each raises
  `…: that challenge is pending` for a pending target.
- `plan_challenge_pair(p_mode_a text, p_measure_a text, p_mode_b text, p_measure_b text) returns uuid[]` — `require_admin()`; queue lock; refuses equal modes and a pending
  either; inserts both at placeholders (a day past the queue's last and a day beyond that)
  and re-packs once. Atomic, which two `plan_challenge_session` calls would not be.
- `move_challenge_pair(p_id uuid, p_delta int)` — `require_admin()`; queue lock; `p_id` is the first session of a pair, read in queue order cut in twos; swaps that pair with the neighbouring one by re-assigning the slots, then re-packs. A session that does not start a pair is refused.
- `plan_next_challenge_session` — the auto-plan's pool leaves out pending challenges.
- `next_vote_options` is unchanged: planned sessions of a pending challenge cannot exist.

**Types.** `ChallengeState = 'live' | 'pending'`. `ChallengeDot = 'running' | 'planned' | 'live' | 'pending'`.
`pairsOf<T>(queue: readonly T[]): { first: T; second: T | null }[]`.
`withVotes(pair, options: readonly VoteOption[])` returns the pair ordered by votes, descending,
a tie keeping booking order, and each side's count (`null` when the pair is not the vote's).

**No storage key; no machine change; no How to Play change.**

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | State control: LIVE, PENDING. Confirm dialog title "Take it off the queue?" and body "{n} planned sessions will be removed from the queue. A session running now stays, and players will no longer see it." (+ singular), buttons MAKE PENDING / KEEP LIVE. Page: "Planned" heading, "Votes {n}", "Not planned". Gallery filter: RUNNING, PLANNED, LIVE, PENDING. Plan dialog: "Plan a pair", "First candidate", "Second candidate", SAVE, CANCEL. Queue: "Vote {n}". All via Lingui, Czech filled. |
| **How to Play** | No — nothing a player plays changes; a pending challenge is simply absent.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Flag**        | None; none asked for.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Buttons**     | `admin.challenge_state` (the segments), `admin.challenge_state_confirm`, `admin.challenge_state_keep`, `admin.challenge_filter`, `admin.plan_pair_save`, `admin.plan_pair_cancel`.                                                                                                                                                                                                                                                                                                                  |

## Acceptance criteria

1. On the CHALLENGES gallery, every tile's top-right corner shows one dot: **black** for a
   pending challenge, else **red and blinking** if one of its sessions is running now, else
   **green** if one is planned, else **blue**.
2. The gallery has four toggle pills — RUNNING, PLANNED, LIVE, PENDING — each with its count;
   turning one off hides the tiles of that kind; all off shows "No filters are on."
3. A challenge page has a LIVE / PENDING control showing the current state. Choosing PENDING
   on a challenge with planned sessions opens a dialog naming how many will be removed;
   KEEP LIVE changes nothing; MAKE PENDING removes them from the planner's queue and the
   queue re-packs onto its slots.
4. Choosing PENDING on a challenge with nothing planned changes it without a dialog about
   removal (a plain confirm is not required); choosing LIVE needs no dialog.
5. With a challenge pending, the planner's selects do not offer it, and `plan_challenge_session`,
   `plan_challenge_pair` and `edit_challenge_session` raise for it; the auto-plan never books it.
6. A signed-out or non-admin read of `challenge_sessions`, and `open_sessions_with_leaders()`,
   return no row for a pending challenge — planned or running — while an admin still reads all.
7. A challenge page for a challenge with planned sessions lists each planned date; where one is
   a candidate of the vote it shows that session's votes. A challenge with none says "Not planned".
8. PLAN SESSION opens a dialog (not a screen) with two selects. SAVE with two different, live
   challenges books both at the end of the queue; the same twice, or an empty one, is refused
   on the dialog.
9. The planner's queue is drawn in pairs, each pair **one item**: one row with both challenges
   (the one with more votes on top, a tie keeping booking order), one set of up/down buttons
   that moves the whole pair, and one door to a **pair detail** showing both candidates —
   each with its slot and, on the first pair, its votes — where either candidate can be
   changed and the pair taken off the queue. The first pair's rows carry the vote counts. A
   lone last session is drawn alone.
10. The gallery filter is one compact line of four pills, each in its dot's colour (a glyph
    and a count), and none of its text is cut off at phone width. _(added in verify: the
    user asked for it mid-cycle)_
11. Moving a pair in the planner moves both candidates together, and the list re-forms
    around them. _(added in verify: the pair became one item mid-cycle)_
12. `pnpm check` is green, Czech included, and `pnpm db:test` passes `challenge_state.sql`.

## Tests

- `lib/challenge-state.test.ts` — `challengeDotOf`: pending beats running beats planned beats
  live; filter membership; counts.
- `lib/session-pairs.test.ts` — `pairsOf` on 0, 1, 2, 3, 4 sessions; `withVotes` orders by votes,
  keeps booking order on a tie, returns null counts for a non-vote pair.
- `supabase/tests/challenge_state.sql` — the guard on the three writes, `set_challenge_state`
  removing exactly the planned sessions and re-packing, the policy hiding a pending row from a
  non-admin, `open_sessions_with_leaders` leaving a pending out, the auto-plan skipping one,
  `plan_challenge_pair` atomic on a refusal.

## Review focus

1. **Every player read of sessions** (task 1, 6): the policy covers direct selects but
   `security definer` functions bypass it — `open_sessions_with_leaders` is the one a player
   calls for what is on; `my_session_summaries`, `my_session_places`, `session_board` are
   _history_ and stay (a past session a player played is theirs). Check none of them lists a
   _future_ or _running_ session by name.
2. **The policy's cost and its admin branch** (task 1): `has_feature(auth.uid(), …)` runs per
   row of a read the planner makes over the whole table; `auth.uid()` null for anon must be
   false rather than an error.
3. **Removing planned sessions while a vote stands** (task 1, 5): `next_votes` cascades on the
   deleted session, so votes for it vanish; `settle_next_vote` should run so the surviving
   first slot is right.
4. **Race:** the state change and a plan interleaving — both take `lock_challenge_queue()`.
5. **The dot's precedence in the filter** (task 4): a pending challenge with a running session is
   PENDING, not RUNNING, so the pill counts add up to the number of tiles.
6. **`admin-session.tsx`** keeps editing a session after the new path goes: the `session === null`
   branches must be removed, not left dead (Knip, and a form that could post nothing).
