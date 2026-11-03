# The session queue

Slug: session-queue
Stage: shipped
Next: /deploy (push the migration first)
Track: full
Branch: feat/session-queue
Started: 2026-11-03

## Problem

Planning a **session** means picking two dates by hand for every one, and the cadence the
app actually wants — open at noon, run a day, rest a day, open again at noon — is kept in
the admin's head. One mistyped day leaves a gap or a clash, and moving one session means
re-typing every one after it. The challenge picker is a wall of pills that says nothing
about how often each challenge has already run, which is the thing the admin is choosing by.

## Appetite

**A day or two.** One schema change (server-derived times, an order), the planner's two
screens, and one new pressable (the dropdown). No new player-facing copy, no How to Play
change — players still see sessions with times, exactly as now.

decided inline: the user's brief sets the scope precisely; nothing in it wants a week.

## Shape

The admin opens **CHALLENGES** in the admin screen.

1. The list reads as now — LIVE / PLANNED / PAST — but **PLANNED is the queue**, in the
   order it will run, oldest first rather than newest-first. Each planned row shows the
   date it will open, computed, not chosen.
2. Each planned row has **up / down** controls. Moving one re-times every planned session
   behind the live one: no dates are typed anywhere.
3. **PLAN SESSION** opens the form with **no STARTS / ENDS fields**. The admin picks a
   challenge and SAVE puts it at the **end of the queue**. The form says when that will
   open (read-only), so the admin sees the consequence.
4. The challenge picker is a **dropdown**: one closed field showing the chosen challenge,
   which opens a list. Each item is the challenge's mark, its name in its own colours (the
   `ChallengeTitle` treatment), and **how many sessions of it have run** (closed ones).
5. Opening a planned row: change its challenge, or **remove it from the queue** (today's
   CANCEL SESSION) — the ones behind it close up. A live row keeps EXTEND and CLOSE EARLY;
   a past row is read-only. Neither has date fields any more.
6. **The cadence**, owned by the server: a session opens at noon Prague, runs 24 h, then
   24 h with nothing open, and the next opens at the following noon — every other noon.
   The first planned slot is the first noon at least 24 h after the live (or last) session
   closes, or the next noon if that is long past. EXTEND pushes the queue if it has to;
   CLOSE EARLY leaves it where it is (the rest just grows).
7. **The auto-plan stays**: when nothing is live or planned, the cron job still books one
   on its own, on the same cadence slot (today it books the very next noon — it moves to
   the cadence).

Areas:

- **Schema** — `challenge_sessions` gets a queue position; the queue RPCs (append,
  move, remove, re-point) derive `opens_at`/`closes_at` server-side and re-pack the
  planned rows after every write and after extend. `plan_next_challenge_session` moves to
  the cadence slot. The span arguments leave `plan_`/`edit_challenge_session`.
- **`lib/admin/sessions.ts`** — the writes lose their span; gain `moveSession`.
- **`admin-sessions.tsx`** — planned rows in queue order with up/down.
- **`admin-session.tsx`** — no date fields; dropdown; read-only "opens" line.
- **A dropdown** — no select component exists. A new one, built on `ModalCard`/`AdminDialog`
  for the open list and the admin field look for the closed one; it goes in the inventory.
- **`lib/challenge-session.ts`** — `defaultSpan`, `withOpensAt`, `withClosesAt` lose their
  last caller; `DateTimeField` may too (knip will say).

Not a mode's business: nothing here reads rules or branches on a challenge.

## In / Out / Rabbit holes

**In** — server-timed queue with up/down reordering; append-only new sessions; dropdown
with mark, colours and run count; auto-plan on the cadence; date fields gone from the form.

**Out**

- Drag-to-reorder. Up/down is one tap each and needs no gesture work.
- Choosing a session's length or time of day per session. Every session is 24 h at noon.
- Inserting into the middle of the queue directly — append, then move.
- Changing the cadence from the app (a setting). It is a constant in the migration.
- Any player-facing change: teasers, cards and the launch popup read `opens_at` as now.
- Re-timing sessions already booked by hand with odd spans — the first re-pack lays them
  onto the cadence, and that is accepted, not migrated around.
- A feature flag — none asked for.

**Rabbit holes**

- **Times stored or derived?** Derive-on-read would touch every player reader. Instead the
  server keeps writing concrete `opens_at`/`closes_at`, re-packed on each queue write —
  so readers, the overlap rule and the indexes stay as they are. The re-pack must be one
  function every write calls, or the queue drifts.
- **The overlap exclusion constraint** — re-packing moves several rows at once; updating
  them one by one can clash mid-way. Either defer the constraint or re-pack in an order
  that never overlaps (shift latest first when pushing later). Spec must pick.
- **Extend past the next slot** — a live session extended across the first planned noon
  has to push the queue a full cadence step (two days), never into a half-day gap.
- **A planned session that opens while the admin has the list up** — moving it would
  re-time a live row. The move RPC refuses anything no longer planned; the screen reloads.
- **Daylight saving** — slots are wall-clock noon Prague, 24 h literal duration, as the
  auto-plan migration already does. Reuse its expression.

## Contract

### Domain words

Uses: **session**, **challenge**, **session board**, **extending**, **closing early**,
**teaser**, **measure**. "Cancel" stays the word for deleting a booking; on the form it now
reads REMOVE FROM QUEUE but the RPC and `cancelSession` keep their names.

Introduces (each gains a row in `docs/domain.md` and a one-liner in `CLAUDE.md`):

- **queue** — the planned sessions, in the order they will open. Not a table: the order
  _is_ `opens_at` among rows not yet open. `queueOrder` in `lib/challenge-session.ts`,
  `move_challenge_session`, `repack_challenge_queue`.
- **slot** — a noon (Prague) a queued session is timed to. The first slot is the first
  noon at least 23 h after the live or last session's **end** — `greatest(closes_at,
opens_at + 24h)`, so closing early never pulls the queue forward and extending pushes it
  (23, not 24, so a daylight-saving close at 13:00 still rests one day); each later slot
  is two calendar days after the one before. A session runs 24 h literal from its slot.
  `challenge_queue_slot` in SQL.

Collision: none. "queue" is unused in the repo; "slot" appears only in prose.

### Files

| Path                                                          | C/M | Responsibility                                                                                                                          |
| ------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261103000000_session_queue.sql`        | C   | slot fn, repack fn, new plan/edit/move signatures, re-pack in cancel/extend/close, auto-plan                                            |
| `components/overlays/admin-select.tsx`                        | C   | `AdminSelect<T>`: a closed field that opens an `AdminDialog` list of rich options                                                       |
| `lib/admin/sessions.ts`                                       | M   | `planSession(modeId)`, `editSession(id, modeId)`, new `moveSession(id, delta)`; span args gone                                          |
| `lib/challenge-session.ts` (+ `.test.ts`)                     | M   | `queueOrder` (live, then queue ascending, then past descending), `pastCountByMode`; dead span helpers removed                           |
| `components/overlays/admin-sessions.tsx`                      | M   | rows in `queueOrder`; up/down on queued rows; `lastClosesAt` prop gone                                                                  |
| `components/overlays/admin-session.tsx`                       | M   | no date fields; `AdminSelect` for the challenge; read-only STARTS/ENDS for an existing row; REMOVE FROM QUEUE                           |
| `components/date-time-field.tsx`                              | M/D | deleted if knip shows no caller left                                                                                                    |
| `constants/buttons.ts`                                        | M   | `admin.session_move_up`, `admin.session_move_down`, `admin.session_challenge_option`; `admin.session_when` removed with its last caller |
| `supabase/tests/challenge_sessions.sql`, `session_scores.sql` | M   | rewritten onto the new signatures; queue assertions added                                                                               |
| `.claude/skills/design-guide/references/components.md`        | M   | `AdminSelect` in the pressables inventory                                                                                               |
| `docs/domain.md`, `CLAUDE.md`                                 | M   | **queue**, **slot**; **session** row says times are the server's                                                                        |

### Data

No new column. Migration `20261103000000_session_queue.sql`:

- `challenge_queue_slot(p_after timestamptz, p_now timestamptz) returns timestamptz` —
  first Prague noon ≥ `p_after + 23h`; if `p_after` is null or that is before `p_now`, the
  first Prague noon ≥ `p_now`.
- `repack_challenge_queue(p_now timestamptz default now())` — anchor = max
  `greatest(closes_at, opens_at + 24h)` of rows with `opens_at <= p_now`; walks rows with `opens_at > p_now` in `opens_at` order and
  sets row _k_ to `opens_at = noon of (slot0's Prague date + 2k)`, `closes_at = opens_at +
24h`. Idempotent. No client grant. Never lays the first slot before the queue's
  current first row (`p_floor`, amended after review): the anchor can move back (close
  early after an extension, delete an opened row) and the queue must not follow it.
  Only removing a queued row hands its slot on. Every queue write takes
  `lock_challenge_queue()`, a transaction advisory lock, first.
- `plan_challenge_session(p_mode_id text, p_measure text default 'score') returns uuid` —
  admin; inserts after the last queued row (a placeholder time that sorts last), then
  re-packs onto its slot.
- `edit_challenge_session(p_id uuid, p_mode_id text, p_measure text default 'score')` —
  admin; re-points the challenge only; keeps the played-guard message verbatim; leaves
  times, `teaser_minutes` and `extended_at` alone.
- `move_challenge_session(p_id uuid, p_delta int) returns void` — admin; `p_delta` is −1
  or +1; refuses a row not in the queue (`'that session is no longer in the queue'`);
  swaps the row's times with its neighbour's in the queue, then re-packs. At either end it is a no-op.
- `cancel_challenge_session`, `extend_challenge_session`, `close_challenge_session_early`
  — unchanged guards; each ends with `perform repack_challenge_queue()`. Extend drops its
  clash check (nothing in a single re-packed queue can overlap it).
- `plan_next_challenge_session` — calls `repack_challenge_queue(p_now)` first; when
  nothing has `closes_at > p_now` it books on `challenge_queue_slot(last close, p_now)`
  (anchored as the re-pack is) rather than the next noon. Pool logic unchanged. Same cron job.
- The old arities of `plan_`/`edit_challenge_session` are **dropped**; grants re-issued.

Shipped rows: past and live rows are never touched. Already-booked upcoming rows are laid
onto the cadence by the first re-pack (cron, within five minutes of the push) in their
current order — accepted per Out.

Order: **push the migration before the app ships.** The new client calls signatures the
old schema lacks; an old admin build against the new schema gets an error from PLAN /
SAVE (admins only; accepted).

### Gates

| Gate        | Answer                                                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copy / i18n | New: `REMOVE FROM QUEUE`, `MOVE UP` / `MOVE DOWN` (accessibility labels), `{count} RUN` / `{count} RUNS` (plural), `CHOOSE A CHALLENGE`. Removed with their callers: none player-facing. Czech for each; `pnpm i18n:extract`. |
| How to Play | No — admin-only planning; players see sessions as before.                                                                                                                                                                     |
| Flag        | None.                                                                                                                                                                                                                         |
| Buttons     | `admin.session_move_up`, `admin.session_move_down`, `admin.session_challenge_option`.                                                                                                                                         |

Decided inline (cheap and visible): the new-session form shows no "opens on" date — the
list shows it one tap back, and computing it on the client would be a second copy of the
cadence. Reorder is up/down on the row, not inside the form.

## Acceptance criteria

1. The session form, new or existing, has no STARTS/ENDS pickers. An existing session shows
   its STARTS/ENDS as read-only rows.
2. PLAN SESSION → choose a challenge → SAVE adds a row at the bottom of PLANNED whose start
   is noon Prague two days after the start of the row above it (or the first slot when the
   queue was empty), and whose end is 24 h later.
3. PLANNED rows are listed in the order they will open (earliest first), under LIVE and
   above PAST (PAST newest first).
4. Each PLANNED row has MOVE UP and MOVE DOWN; the first has no MOVE UP, the last no MOVE
   DOWN. Moving swaps the two challenges' places; the dates stay on the cadence.
5. REMOVE FROM QUEUE on a planned row deletes it and every row after it moves one slot
   earlier.
6. Extending a live session past 23 h before the first slot moves the whole queue to the
   next slot that rests ≥ 23 h; closing early never moves the queue earlier.
7. With nothing live or planned, `plan_next_challenge_session(now)` books one on
   the first slot — a session that ran noon Monday to noon Tuesday is followed by one at
   noon Wednesday; a close long past falls forward to the next noon.
8. The challenge field is a closed dropdown; opening it lists every challenge in the
   catalog with its mark, its name in its own colours, and the count of its closed
   sessions (`0 RUNS` included). Picking one closes the list and shows it in the field.
9. A played session's challenge field is not openable (as the pills were not).
10. `pnpm db:test` passes, including new queue assertions; `pnpm check` is green, Czech
    included.

## Tests

- `lib/challenge-session.test.ts` — `queueOrder` (mixed statuses, ties), `pastCountByMode`
  (counts only expired, zero for absent).
- `supabase/tests/challenge_sessions.sql` — slot fn across a DST weekend and with a stale
  anchor; append timing; move up/down incl. ends and refusal of a live row; cancel closes
  the gap; extend pushes; close early does not pull; auto-plan cadence; admin guard on
  move. Span-edit assertions removed with the arity.
- `supabase/tests/session_scores.sql` — the played-guard on edit, on the new arity.

## Review focus

1. Every queue write re-packs — plan, move, cancel, extend, close early, cron. One missed
   call and the queue drifts off the cadence (task 1).
2. `repack` touches only `opens_at > now`; a row opening during an admin's move must be
   refused, not re-timed while live (task 1).
3. Old arities really dropped — `create or replace` with fewer params adds an overload
   (task 1).
4. `AdminSelect` reuses `AdminDialog`/`TrackedPressable`, not a new modal or a copied row
   (task 3).
5. The dropdown's run count comes from the rows the list already loaded, not a new read
   (task 4).
