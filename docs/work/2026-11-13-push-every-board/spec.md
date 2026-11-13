# Push on every board

Slug: push-every-board
Stage: review
Next: /ship push-every-board
Track: full
Branch: feat/push-every-board
Started: 2026-11-13

## Problem

A player is told a record was taken from them only when it is the all-time board of a
mode × difficulty. Losing today's board, this week's, or the lead on a live challenge
session board goes unannounced, so the pushes that would bring a player back most often —
the short windows, where a lead changes hands several times a day — never ring.

## Appetite

**A day or two.** No new screen and no new consent: the same subscription, the same
`send-push` function, the same outbox. It is new triggers and a widened outbox, plus
copy. If it overruns, the session-board half goes first, never the day/week half.
(Decided inline: the earlier push item named exactly these as its first follow-up.)

## Shape

The player has already said yes to push. Nothing about that changes.

1. Someone beats the holder of a board for **today**, **this week** or **ever**, on any
   mode × difficulty (accuracy and speed, easy/hard/extreme). The displaced holder's
   phone rings once: "your daily / weekly / all-time record is gone", naming the taker
   and the board, in the subscriber's language.
2. Someone passes the leader of a **live session board**. The displaced leader's phone
   rings the same way, naming the challenge and the taker. A session board has no
   reign, so this is "passed for the lead", not a settled place.
3. Tapping either opens the app at `/`, as today.

Areas touched:

- **Schema** — `push_outbox` gains a `scope` (`day` | `week` | `ever` | `session`) and a
  way to name a session board instead of a mode × difficulty; its `kind` check and its
  `unique (user_id, mode, difficulty, day)` throttle are widened so scopes do not
  swallow each other. `drain_push_outbox` returns the new columns.
- **Triggers** — one on `daily_scores` (day and week leader before vs after a write),
  one on `session_scores` (leader before vs after). The existing `board_reigns` trigger
  keeps owning `ever`.
- **`send-push`** — `message.ts` learns the scope and the session case; `index.ts`
  passes them through. Czech and English words live there, not in the Lingui catalog.
- **Not a mode's business.** The server already knows nothing about modes; a session's
  challenge name has to travel as the id the session stores and be named in the message
  table, the way modes are today.
- **Copy** — `message.test.ts` is the guard that keeps the tables honest.
- **How to Play / options** — no gameplay change; check the options toggle wording
  ("when your record is taken") still reads true.

## In

- Day, week and ever takeovers on every mode × difficulty board.
- A live session board being passed, for the displaced leader.
- Per-scope throttle (one push per player per board per scope per day).
- The `push` feature gate and the "hidden stops the pushes" rule, applied to the new
  triggers too.

## Out

- Native `expo-notifications` — the adapter stays `'unsupported'`; this reaches web
  subscribers only.
- Pushes for places other than the lead (being passed from 2nd to 3rd).
- A settled place on a closed session; session-opening reminders; winnings pushes.
- Per-scope preferences — it stays on/off.
- A global daily cap across boards (see rabbit holes; only add if spec finds it needed).

## Rabbit holes

- **Who leads the week** is each player's best single day since Monday (`leaderboard`'s
  `p_since` branch, `distinct on (user_id)` over `daily_scores`), ties to the earlier
  `updated_at` — not a sum (`weekSum` is the winnings' figure). The trigger needs that same
  computation. Way round: one SQL helper both read, rather than a second copy; if it will
  not share, the appetite does not hold. _(Corrected in spec: the shape said "sum".)_
- **`daily_scores.day` default is `current_date`**, server time, while the throttle day
  is Prague. Verify they agree around midnight before trusting "today".
- **Volume.** Day boards change hands often: up to 6 boards × 3 scopes. The throttle is
  one per board per scope per day, so one player can still receive many pushes a day.
  Way round: the `tag` already makes a lock screen replace rather than stack; decide in
  spec whether a per-player daily cap is also needed.
- **Hand-me-down cascade.** One score can take day, week and ever at once. Way round: one
  push per board per write, naming the widest scope lost, not three.
- **Session lead churn.** Every run on a live session can flip the lead. Way round: the
  same throttle, keyed by session, plus only when the lead actually changes hands.
- **Migrations are not applied by CI**, and the outbox constraint change must land
  before the `send-push` build that reads the new columns. Production writes are the
  user's.
- **Shipped `push_outbox` rows and `unique` constraint.** Widening a shipped constraint
  is a migration on live data; backfill `scope = 'ever'`.

## Flags

No new feature key. It rides the existing `push` feature. (A separate flag for the
session half would be one line to add if you want it — say so.)

## Contract

### Domain words

**Used:** board (mode × difficulty), **takeover**, **record** (players read "record"; code
says takeover), **reign** (only `ever` is stored — unchanged), **session board**, **place**,
**outbox**, **subscription**, **push**, **period** (`day` / `week` / `ever`, as in
`lib/leaderboard-period.ts` and the leaderboard tabs).

**Takeover widens.** It was an all-time board changing hands; it now means a board changing
hands in any of its three **periods**. `docs/domain.md`'s row and CLAUDE.md's one-liner
change from "an all-time board" to "a board, in any period". "One trigger so far" in the
**push** row becomes "two triggers": a takeover and being **passed**.

**Introduced — passed.** The lead of a **live** session board changing hands: the previous
leader has been overtaken for first. Code: `kind = 'passed'` on `push_outbox`,
`session_id` beside it. Not a **takeover** (a session board has no period and no reign),
not a **place** (a place settles when the window shuts and cannot be taken back), not
"overtaken" in copy. Players read it as the same "record is gone" family but says CHALLENGE
by name. `docs/domain.md` gains a row, CLAUDE.md its one-liner.

**Collisions.** `passed` vs `takeover` — kept apart by the table above. `period` here is the
leaderboard's, not a session's; a session has none. `kind` on the outbox stays the one
column that says which trigger owed the row.

### Files

Created:

| Path                                                      | Responsibility                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261113000000_push_every_board.sql` | `push_outbox` widened; the helper, the two new triggers, the changed `board_reigns` trigger, `drain_push_outbox` |

Modified:

| Path                                               | Change                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `supabase/functions/send-push/message.ts`          | `takeoverMessage` learns `period`; new `passedMessage`; a challenge-name table (slug → en/cs) |
| `supabase/functions/send-push/message.test.ts`     | New cases, and a guard that every catalog slug has a name                                     |
| `supabase/functions/send-push/index.ts`            | `Claimed` gains `period`, `session_id`; routes by `kind`                                      |
| `docs/domain.md`, `CLAUDE.md`                      | takeover widened, passed introduced, push row                                                 |
| `docs/push.md`                                     | the diagram and "one trigger" prose                                                           |
| `components/overlays/push-consent-overlay.tsx`     | "when a rival takes your record" → also covers challenges and shorter periods                 |
| `components/overlays/advanced-options-overlay.tsx` | the `ready` line of the NOTIFICATIONS row, same                                               |
| `locales/*.po`                                     | via `pnpm i18n:extract`                                                                       |

The challenge-name table is a **copy** of each catalog entry's `label` (en from the
catalog, cs from `locales/cs/messages.po`), the same arrangement MODES and DIFFICULTIES
already have, and the guard test is what stops a new challenge shipping without one.
`how-to-play-overlay.tsx` is untouched: nothing in it describes notifications.

### Data

Migration `20261113000000_push_every_board.sql`. **Order: function first, schema second**
(amended in review). The new `send-push` tolerates the old schema (a row with no `period`
reads as `ever`, and no `passed` row exists yet). The old function does not tolerate the new
schema: it would send a `passed` row as a takeover with a raw challenge id, already marked
sent. So deploy `send-push`, then push the migration.

`push_outbox`:

- `kind` check widened to `('takeover', 'passed')`.
- `period text` — `'day' | 'week' | 'ever'` for a takeover, null for passed. Existing rows
  backfilled `'ever'`. A check ties it to `kind`.
- `session_id uuid` — null for a takeover, set for passed (`references challenge_sessions
on delete cascade`). For a `passed` row `mode` carries the session's challenge id and
  `difficulty` is `''`, so the existing `not null` columns need no relaxing.
- Throttle: the shipped `unique (user_id, mode, difficulty, day)` is replaced by two partial
  uniques: takeover rows on `(user_id, mode, difficulty, period, day)`; passed rows on
  `(user_id, session_id)` — **one passed push per player per session**.
- **Cascade rule, one write → one push.** A score can take day, week and ever together. A
  takeover insert for a player/board/day is skipped when a row of an equal or wider period
  already exists for it, and deletes any **unsent** narrower rows when it is wider. Widest
  period wins; `ever` > `week` > `day`.

Triggers (all `security definer`, all share one helper that checks the `push` feature is
not `hidden`, that the taker has a nickname, that the displaced is not the taker, and that
the displaced has a subscription — the checks `board_reigns_owe_push` makes today):

- `board_reigns_owe_push` — unchanged in behaviour, now writes `period = 'ever'` through the
  helper.
- on `daily_scores` (after insert or update): only when `new.day` is **today on Prague's
  clock** (a score arriving late for yesterday owes nothing). Decides two takeovers: the
  **day** board (leader among today's rows) and the **week** board (each player's best day
  since Monday, as `leaderboard` computes it). For each, the displaced is the leader before
  the write, the taker is the writer, and a tie does not take (ties go to the earlier
  `updated_at`, the rule every board uses).
- on `session_scores` (after insert or update): only while the session is open
  (`opens_at <= now() < closes_at` — the ten-minute grace for late submits owes nothing).
  The order is the session's own measure, exactly `session_board`'s. Owes `passed` when the
  writer is now first, was not first before the write, and somebody else was.

`drain_push_outbox` returns `period` and `session_id`.

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Push text is **not** Lingui; it lives in `message.ts`. Titles — takeover: `Your daily record is gone` / `Denní rekord je pryč`; `Your weekly record is gone` / `Týdenní rekord je pryč`; `Your all-time record is gone` / `Rekord všech dob je pryč`; passed: `You lost the lead` / `Přišel jsi o vedení`. Bodies — takeover keeps `{who} took your record — {mode}, {difficulty}.` / `{who} ti vzal rekord — …`; passed: `{who} passed you in {CHALLENGE}.` / `{who} tě předběhl v {CHALLENGE}.` Two app strings change and are extracted: the consent line and the options row `ready` text. |
| **How to Play** | None — no controls, targets, timers, modes, scoring, streaks or lives change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Flag**        | None. Rides the existing `push` feature, including its "hidden stops the pushes" rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Buttons**     | None.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Acceptance criteria

1. With `push` public and a subscribed holder, a score that takes **today's** lead on
   ACCURACY HARD from them creates exactly one `push_outbox` row for the holder with
   `kind = 'takeover'`, `period = 'day'`, the taker's nickname whole, and the board.
2. A score that takes the **week** lead but not today's (the holder's best day was earlier
   this week) creates one row with `period = 'week'`; and one taking the lead of all three
   creates one row with `period = 'ever'`, not three.
3. A tie never takes a lead, a player who already led and extends it owes nothing, and a
   score whose `day` is not Prague-today creates no row.
4. The all-time takeover still works: the `board_reigns` insert creates a row with
   `period = 'ever'`, and the rows existing before the migration read `ever`.
5. On a live session board, the writer moving from behind to first creates one
   `kind = 'passed'` row for the previous leader with the session's challenge id and
   `session_id`; a second pass of the same leader in the same session creates none. Ordering
   follows the session's measure (`time` ascending, otherwise score descending, ties earlier).
6. A write to a session outside `opens_at … closes_at`, a write that does not change the
   leader, or a write by a player with no nickname creates no row.
7. With `push` hidden, none of the three triggers creates a row; a displaced player with no
   subscription gets none either.
8. `takeoverMessage` and `passedMessage` produce the English and Czech text in the
   contract, a nickname of ten wide capitals is kept whole, and the `tag` differs per
   period and per session so a lock screen replaces rather than stacks within one board and
   one period only.
9. Every challenge in `catalog.ts` has an English and a Czech name in `message.ts`; adding a
   challenge to the catalog without one fails a test.
10. `send-push` delivers a `passed` row end to end against `supabase functions serve`
    locally (a local subscription fixture is enough), and a `takeover` row as before.
11. `pnpm check` is green, `pnpm i18n:verify` included, and `supabase migration list` shows
    the new file pending, not applied.

## Tests

- `supabase/functions/send-push/message.test.ts` extended: both locales for each period and
  for passed, ten-wide nickname, tags, unknown id fallback, and the catalog-slug guard
  (criteria 8, 9).
- The triggers (criteria 1–7) are SQL: `supabase/tests/push.sql` extended (run with
  `pnpm db:test`).

## Review focus

1. **The throttle swap** (task 1): dropping a shipped unique constraint and replacing it
   with two partial ones must backfill `period` first, or the new check rejects live rows.
2. **Both triggers fire in one transaction** (tasks 2–3): `daily_scores_roll_up` writes
   `scores`, which fires the reign trigger inside the `daily_scores` write. The cascade rule
   (widest wins, no duplicates) depends on firing order; confirm it under an insert that
   takes all three.
3. **"Before the write" in an after-trigger** (task 3): the previous leader is computed
   excluding or predating the writer's own new row; a writer who was already leading must not
   displace themselves or whoever sat second.
4. **Prague vs `current_date`** (task 3): `daily_scores.day` is stamped by the client on
   Prague's clock and the column default is the server's; the guard compares to Prague.
5. **Mode id on a session** (task 5): the challenge name table is keyed by whatever
   `challenge_sessions.mode_id` holds; confirm whether that carries a prefix before keying.
6. **Consent copy** (task 7): the line players already accepted promised "a rival takes your
   record"; the widened scope should not change what a returning player who answered sees.

## Decided

- Throttle is one row per player, board, period and day for takeovers, and one per player
  per session for passed. A global per-player daily cap is out: widening is the point, and
  the cascade rule already stops one score ringing three times. If volume complains, it is a
  follow-up. (decided inline: smallest rule that meets the shape's rabbit hole)
- A backdated score and the post-close grace window push nothing. (decided inline)
- Passed is the lead only, not any place. (decided inline: matches the user's wording
  "takes a session board from me")
