# Challenge sessions

Slug: challenge-sessions
Stage: build
Next: /verify challenge-sessions — phase two, re-verifying criteria 10, 15 and 16
Track: full
Branch: feat/challenge-sessions
Started: 2026-10-10
Phases: one (admin plans a session) — verified, 15 pass / 1 partial · two (a player meets it) — rebuilt after review · three (what it is worth keeping) — shaped

## Problem

A challenge's window is compiled into the bundle — `from` and `until` are literal
timestamps in `modes/challenges/catalog.ts` — so putting a challenge on the app for a
day means shipping a build on the day it opens and another to take it down. Nothing
about the thing that makes a challenge a challenge can be decided after the build.

Two smaller things are wrong in the same place and are cheaper to fix on the way
through. The flag that opens the DEV screen is called `dev`, which names a door rather
than a thing — so the moment that screen holds a second section, one key is gating two
unrelated audiences. And there is no key at all for the player-facing half of
challenges, so there is nowhere to put the intro link and its copy when it is written.

## Appetite

**A week.** New table, new RPCs, a new admin screen, a date-picker dependency with a
web variant, a feature-key rename that has to carry its grants across. The planner
reaching the game engine does not fit inside it — see Out.

## Shape

### The words

A **session** is a planned appearance of a challenge: one challenge, one start, one end,
one row. It is the admin's booking. It is **not a run** — the glossary's "never
_session_" rule was written against calling a run one, and that rule stands; what is
added is a second, non-overlapping sense, and CLAUDE.md has to say so explicitly in
both entries or the next reader will read a contradiction. The **window** keeps its
present meaning: the `from`/`until` a `ModeDefinition` carries. A session is what a
window will one day be resolved from, which is exactly why they are two words.

### The flags

- `dev` → **`challengeLab`**. Same rows, same audience, a name that says what it opens:
  every challenge playable on demand, outside its window, with no board kept.
- **`challenges`**, new, floor `nobody` — `active = false`, no grants. The player-facing
  half: the intro link and whatever copy goes with it. Nothing reads it in this phase;
  it exists so phase two has a key to guard and so the admin screen shows it as a thing
  being prepared rather than as a thing missing.
- The **DEV link** on the intro stops asking one flag and starts asking whether _any_
  dev feature is reachable. `constants/features.ts` grows a `DEV_FEATURES` list —
  `['challengeLab']` today — and the menu asks over it. That is the whole of what the
  user meant by "the dev menu will depend on more feature flags"; the second entry is
  one line here when it arrives.

### Walking it

The admin opens ADMIN from the intro and no longer lands on PEOPLE / ROLES / FEATURES.
They land on a hub of two buttons: **FEATURES** and **CHALLENGES**, both behind the same
`admin` key the link itself is behind. FEATURES opens what the screen is today, tabs
untouched; a FEATURES button opening a FEATURES tab is a nesting the user chose with
their eyes open, and the hub's WHO SEES WHAT subtitle is what distinguishes them.

CHALLENGES opens the planner. It lists every session already planned, newest window
first, each row naming the challenge, its start, its end, and whether it is over,
live or still to come. A session whose challenge is not in this build is drawn as such
rather than hidden — the same `inBuild` tag `AdminFeature` already carries, for the same
reason: a row the server holds and the code does not is worth seeing.

PLAN SESSION opens a form. The challenge comes from a picker over the compiled catalog —
every challenge ever written, not only the ones with an open compiled window. Start and
end are the **system** date-and-time picker, and they open on **tomorrow at noon** and
**the day after at noon**, local. Moving the start moves the end with it, keeping the
span: the figure held steady is the **duration in milliseconds**, so a span dragged
across a daylight-saving boundary stays twenty-four hours rather than staying noon-to-noon.
An end before its start is refused by the form and by the database.

A planned session can be edited and cancelled. Cancelling deletes the row; a session
that has already closed is kept, because a closed session is the record of what ran.

Back in the challenge lab, each challenge now prints the sessions planned for it beside
its own compiled window. That is the only place this phase is visible outside admin,
and it is what makes the planner verifiable: a tester can see that what was planned is
what the server holds.

### Areas

- **`constants/features.ts`** — `dev` → `challengeLab`, a new `challenges` key, a new
  `DEV_FEATURES` list. `Flag` stays the union it is.
- **The intro** (`menu-overlay.tsx`) — the DEV link asks over `DEV_FEATURES` instead of
  one key.
- **The admin overlay** — becomes a hub of two buttons; today's tabbed body moves into
  a screen of its own beside a new planner screen. Both reached and returned from by
  one BACK, the way `AdminPerson` and `AdminRole` already are.
- **A new admin lib** beside `lib/admin/features.ts` — list, plan, edit, cancel.
- **A pure lib** for the session arithmetic: the default pair, the span-preserving
  move, the validity check, the live/upcoming/over verdict. No React, fully tested —
  this is where the DST decision and the noon default actually live.
- **The schema** — one new table and four RPCs, every write guarded by
  `has_feature(auth.uid(), 'admin')` exactly as the feature RPCs are. Plus the rename
  migration, which has to carry `role_features` and `user_features` across by hand:
  the FKs are `on delete cascade` with no `on update cascade`, so the key cannot simply
  be updated in place.
- **A new dependency** — `@react-native-community/datetimepicker`, with a `.web.tsx`
  variant over `<input type="datetime-local">`. The native module has no web
  implementation, production here is the web bundle, and `datetime-local` _is_ the
  system picker on web. Same platform-split pattern as `lib/supabase.web.ts`.
- **Copy** — every new string extracted and translated into Czech. The existing tab
  pills stay untranslated on purpose (they name database objects); the hub's two
  buttons are ordinary `<Trans>` copy like ADMIN and DONE beside them.
- **Not the engine, not `modes/`.** Nothing here branches on a mode's name and nothing
  here is a rule or a capability. A session is data about when a mode is offered, which
  is the registry's business and not `RunRules`'. In this phase it is not even that.
- **Not How to Play.** No gameplay changes: no player can reach a planned session yet.

## In

- `dev` renamed to `challengeLab`, grants carried across, and a `challenges` key at
  floor `nobody`.
- The intro's DEV link gated on any dev feature rather than on one.
- ADMIN becomes a hub: FEATURES (today's screen, unchanged inside) and CHALLENGES.
- `challenge_sessions` and its four RPCs, admin-guarded, public read.
- The planner: list, plan, edit, cancel, with the system picker and the two defaults.
- Span-preserving start moves, and refusal of an end at or before its start.
- The challenge lab printing each challenge's planned sessions.

## Out

Named so they are not built by accident:

- **The player-facing half.** No intro link, no challenge pill driven by a session, no
  copy explaining challenges to anyone. The `challenges` key is created and nothing
  reads it. This is the user's phase two.
- **Sessions reaching the registry.** `openModes(now)` stays synchronous and stays
  compiled. A planned session changes what admin sees and nothing else — a run started
  from the challenge lab is still the lab's run, boardless, exactly as today.
- **Removing the compiled window.** `ChallengeSpec` keeps `from` and `until`, and
  `FOUR_KEYS` keeps the window it has. Dropping them is the right move and it belongs in
  the phase that makes sessions authoritative, not in the one that merely records them.
- **A challenge keeping a board.** `scores.mode` still carries
  `check (mode in ('accuracy','speed'))`. Widening it is its own item with its own
  thinking about whether a one-day board is comparable to anything.
- **Writing new challenges.** The catalog gains nothing. One worked example is enough
  to plan against.
- **Recurrence.** No weekly, no "every Friday", no templates. A session is one span,
  typed once.
- **Notifications, reminders, or any announcement that a session is coming.**
- **A roles/stack change for `challenges`.** No grant rows seeded; it is off for
  everyone including admin until phase two asks.

## Rabbit holes

- **The key rename is a data migration, not a rename.** `role_features.feature_key` and
  `user_features.feature_key` reference `features(key)` with `on delete cascade` and no
  `on update cascade`, so `update features set key = …` either fails or orphans. The way
  through: insert `challengeLab`, copy both grant tables across by select-insert, delete
  `dev` and let the cascade take the old rows. Test the row counts before and after.
- **The migration has to land before the build does.** Migrations are not applied by CI
  in this repo — a push to `main` ships the bundle and never the schema. A build that
  asks for `challengeLab` against a database that still only has `dev` resolves to off,
  and every tester silently loses the DEV screen. Push the migration first, deploy
  second, and say so in the ship notes.
- **The web picker is not the native picker.** Two components, two very different
  interaction models — a modal spinner on iOS, an inline field on web — and the defaults
  and the span-preserving move must behave identically across both. The way through: all
  the arithmetic in the pure lib, both variants reduced to "hand me a Date", and the
  tests written against the lib rather than against either picker. If the native module
  fights Expo 55, the fallback is the web variant everywhere and a note, not a week
  spent on it.
- **Local noon is not a timestamp.** "Tomorrow at noon" is a wall-clock wish; the column
  is `timestamptz`. Decided: the picker works in the admin's local zone, the column
  stores the instant, and the list prints the instant back in local time. Every player
  therefore gets the same window, which is the whole reason a challenge's window was
  absolute in the first place. What this must not quietly become is a window that means
  something different per device.
- **Overlapping sessions of the same challenge.** Two sessions of one challenge running
  at once is nonsense, and phase two would have to pick one. Checked in the RPC rather
  than by an exclusion constraint — `btree_gist` is an extension to enable for one
  check, and the RPC is already the only write path. Note it as a known soft guarantee.
- **The appetite's edge is the hub.** If the two-button split turns into a reshuffle of
  `AdminPerson` and `AdminRole`'s back-navigation, stop: the hub is two buttons and a
  BACK, and the tabbed body moves wholesale or not at all.

## Contract

_Phase one only — the admin planner. Phases two and three keep their shapes below and
are specced separately._

### Domain words

**Used as `CLAUDE.md` defines them:** challenge, mode, run, board, window, rules, dial,
feature, stack, override, role.

**Introduced — one word, and `CLAUDE.md` gains a row for it:**

- **session** — a planned appearance of a challenge: one challenge, one start, one end,
  one row. The admin's booking, and the only thing in this phase that did not exist
  before. `challenge_sessions` in the database, `ChallengeSession` in TypeScript,
  `lib/challenge-session.ts`.

**Collisions, and how each stays apart.** Three, and all three are real:

1. **session vs run.** `CLAUDE.md`'s **run** row says "never _round_ or _session_". That
   rule stands and is about naming a _game_ a session. The **session** row must say so in
   as many words, and the **run** row must gain "— a _session_ is the window a challenge
   is planned for, not a game played in one". Edit both or neither; one without the other
   is a contradiction the next reader will try to resolve by renaming something.
2. **session vs the auth session.** `supabase/migrations/20261009081559_session_bound_writes.sql`
   uses "session" for a Supabase auth session, and so does every `supabase.auth` call.
   Kept apart by never using the bare word in SQL: the table, the columns and the RPCs all
   say **challenge session**, and `session` alone in a database context keeps its old
   meaning.
3. **window.** A challenge's `from`/`until` on a `ModeDefinition`, and a leaderboard window
   in the winnings system. Already a double before this phase; a session resolves _to_ a
   window and is not one, which is why they are two words.

**One label that is not its identifier**, the same arrangement as host/`admin` and
CLAIM/`accept`: the hub's first button reads **FEATURES**, and the screen behind it is
`AdminAccess` in `admin-access.tsx`. The label is the user's choice; the identifier says
_access_ because `admin-features.tsx` already means the FEATURES tab inside it, and two
files called features at two depths is how a codebase stops being navigable.

### Files

**Created**

| Path                                                          | Responsibility                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/challenge-session.ts`                                    | The pure arithmetic: the default span, the span-preserving move, validity, and the live/upcoming/expired verdict. No React, no Supabase. |
| `lib/challenge-session.test.ts`                               | Colocated tests for all of it.                                                                                                           |
| `lib/admin/sessions.ts`                                       | The server half, beside `lib/admin/features.ts`: one read and three writes.                                                              |
| `components/overlays/admin-access.tsx`                        | Today's `AdminOverlay` body, moved whole: the PEOPLE / ROLES / FEATURES tabs and the person and role detail routing.                     |
| `components/overlays/admin-sessions.tsx`                      | The planner list, and PLAN SESSION.                                                                                                      |
| `components/overlays/admin-session.tsx`                       | One session: the challenge picker, the two date-time fields, SAVE, CANCEL SESSION.                                                       |
| `components/date-time-field.tsx`                              | A labelled instant the admin can change, native: a press opens the platform picker.                                                      |
| `components/date-time-field.web.tsx`                          | The same props over `<input type="datetime-local">`, which _is_ the system picker on web.                                                |
| `supabase/migrations/20261010010000_challenge_lab_rename.sql` | `dev` → `challengeLab`, grants carried across, and the `challenges` key created.                                                         |
| `supabase/migrations/20261010020000_challenge_sessions.sql`   | The table, its RLS, and the three write RPCs.                                                                                            |
| `supabase/tests/challenge_sessions.sql`                       | Assertions over the constraint, the overlap refusal, the admin guard and the public read.                                                |

**Modified**

| Path                                    | Change                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `constants/features.ts`                 | `dev` → `challengeLab`, `challenges` added, and a `DEV_FEATURES` list.                                                                |
| `constants/buttons.ts`                  | Seven new `ButtonId`s (below).                                                                                                        |
| `components/overlays/admin-overlay.tsx` | Becomes the hub: two buttons, DONE, and which section is open. Keeps its name and its export, so `app/(tabs)/index.tsx` is untouched. |
| `components/overlays/menu-overlay.tsx`  | The DEV link asks over `DEV_FEATURES` rather than one key.                                                                            |
| `components/overlays/dev-overlay.tsx`   | Prints each challenge's planned sessions, and drops its local `statusOf` for the lib's.                                               |
| `supabase/tests/features.sql`           | Six assertions naming `dev`, one of them an ordered array.                                                                            |
| `CLAUDE.md`                             | The **session** row, and the clause on the **run** row.                                                                               |
| `locales/{cs,en}/messages.po`           | `pnpm i18n:extract`, then Czech by hand.                                                                                              |
| `package.json`                          | `@react-native-community/datetimepicker`.                                                                                             |

Nothing in `modes/`, nothing in `machines/`, nothing in `app/`. A session is data about
when a mode is offered; in this phase nothing resolves it into rules.

### Data and types

**The pure lib.** Instants as `number` throughout — ms since epoch, the unit every other
clock in this app is in — and converted at the two edges only (the picker hands back a
`Date`, the database holds `timestamptz`).

```ts
export type SessionSpan = { opensAt: number; closesAt: number }
export type SpanStatus = 'upcoming' | 'live' | 'expired'

defaultSpan(now: number): SessionSpan // tomorrow 12:00 local → the day after 12:00 local
withOpensAt(span: SessionSpan, opensAt: number): SessionSpan // duration in ms held steady
withClosesAt(span: SessionSpan, closesAt: number): SessionSpan // the end alone moves
isValidSpan(span: SessionSpan): boolean // closesAt > opensAt
spanStatus(span: SessionSpan, now: number): SpanStatus
```

Two different rules on purpose, and this is the subtle part a test has to pin. The
**default** is built from wall-clock noon twice over, so across a daylight-saving boundary
the two defaults are 23 or 25 hours apart — two noons, which is what was asked for. The
**move** holds the duration in milliseconds, so dragging a start across that same boundary
keeps the span it had rather than keeping noon. Both are intended; neither is the other's
bug.

`spanStatus` replaces `dev-overlay.tsx`'s local `statusOf` and keeps its exact vocabulary
— `'live' | 'upcoming' | 'expired'` — so this phase introduces no third word for the same
three states. Boundaries: `now === opensAt` is **live**, `now === closesAt` is **expired**,
matching `isOpenMode`'s `>= from && < until`.

**The server half.**

```ts
export type AdminSession = {
  id: string
  modeId: string
  opensAt: number
  closesAt: number
  // Whether this build has the challenge the row names. False is a row the server holds
  // and the code does not — the same tag and the same reasoning as `AdminFeature.inBuild`.
  inBuild: boolean
}

listSessions(): Promise<{ rows: AdminSession[]; error: string | null }>
planSession(modeId: string, span: SessionSpan): Promise<{ error: string | null }>
editSession(id: string, modeId: string, span: SessionSpan): Promise<{ error: string | null }>
cancelSession(id: string): Promise<{ error: string | null }>
```

The read is a plain `.from('challenge_sessions').select()` under the table's public-read
policy, not an RPC: there are no counts to resolve and phase two needs the same select.
The three writes are RPCs, because the admin guard and the overlap check have to be the
server's and not the client's promise. `inBuild` is `modeById(modeId) !== null`, resolved
on the client — the server has no idea what a mode is.

**Editing changes the challenge as well as the span.** A session is one editable row, not
a booking that has to be torn up to be corrected — so the form behind an existing session
is the same form that planned it, picker included, and `edit_challenge_session` takes a
`p_mode_id` exactly as `plan_` does. The consequence to get right: the overlap check runs
against the **new** `mode_id`, not the stored one, so moving a session onto a challenge
already booked for that span is refused the same way planning it twice would be.

**Schema.** `supabase/migrations/20261010020000_challenge_sessions.sql`:

```sql
create table challenge_sessions (
  id         uuid primary key default gen_random_uuid(),
  mode_id    text not null,
  opens_at   timestamptz not null,
  closes_at  timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null,
  constraint closes_after_opens check (closes_at > opens_at)
);
```

`mode_id` carries no foreign key and cannot: a mode is a value in the bundle, not a row,
so there is nothing to reference. That is the same arrangement `features.key` has — a key
means something because the code holds a guard for it — except that `features` at least
has rows, and this has none. The client's `inBuild` tag is the whole of the integrity
check, which is why the row is drawn rather than hidden when it fails.

RLS: `public read` for `anon, authenticated`, matching every other table in the feature
migration, and no insert, update or delete to anybody. Three RPCs, each opening with
`require_admin()` exactly as `set_feature` does:

- `plan_challenge_session(p_mode_id text, p_opens_at timestamptz, p_closes_at timestamptz)`
- `edit_challenge_session(p_id uuid, p_mode_id text, p_opens_at timestamptz, p_closes_at timestamptz)`
- `cancel_challenge_session(p_id uuid)`

The first two refuse a span that overlaps another session of **the same** `mode_id`
(`tstzrange(opens_at, closes_at) && tstzrange(p_opens_at, p_closes_at)`), raising a message
fit to show a person. Two _different_ challenges may overlap freely. A check in the RPC
rather than an exclusion constraint, because `btree_gist` is an extension to enable for one
guarantee and the RPC is already the only write path — so it is a soft guarantee,
deliberately, and `supabase/tests/challenge_sessions.sql` is what holds it.

`cancel_challenge_session` deletes the row whatever state the session is in. An expired
session is still the record of what ran — nothing deletes one on its own, and the list
keeps drawing it — but an admin who booked the wrong thing can take it away, which is the
trade the user chose: cleaning up a mistake beats preserving a mistake. Phase two is where
deleting a session with a board under it stops being free, and the cascade that governs
that is phase two's decision, not this one's.

**The rename.** `supabase/migrations/20261010010000_challenge_lab_rename.sql`. Not an
`update … set key`: `role_features.feature_key` and `user_features.feature_key` reference
`features(key)` with `on delete cascade` and no `on update cascade`. So, in order — insert
`challengeLab` carrying `dev`'s `active` and a fresh note; `insert … select` both grant
tables across, **`user_features` with its `granted` column copied**, true rows and false
rows alike; delete `dev` and let the cascade take what is left. Then `insert into features`
the `challenges` key with `active = false` and no grants.

**What already-shipped rows do, and the push order.** The table is additive and nothing
reads it yet, so it is safe in either order. The rename is not: **the migration must be
pushed before the build ships.** Migrations are not applied by CI here — a push to `main`
ships the bundle and never the schema — so a build asking for `challengeLab` against a
database that still only has `dev` resolves it to off, and every tester silently loses the
DEV screen with no way to notice. The reverse is also true and accepted: once the migration
lands, a device still running the old bundle loses DEV, because `dev` is gone. The audience
is a handful of testers and the window is one deploy. This goes in the ship notes, and the
`db:push` is handed to the user to run rather than run here.

### Copy, and the gates

**Copy / i18n.** Every string below is new and player-invisible but still goes through
Lingui, because `pnpm i18n:verify` is the gate and a missing catalog entry renders its
generated id:

| String                     | Where                                                |
| -------------------------- | ---------------------------------------------------- |
| `FEATURES`                 | hub button                                           |
| `CHALLENGES`               | hub button                                           |
| `WHEN A CHALLENGE IS ON`   | planner subtitle                                     |
| `PLAN SESSION`             | planner CTA                                          |
| `No sessions planned yet.` | empty planner                                        |
| `NOT IN THIS BUILD`        | a row naming an unregistered mode                    |
| `CHALLENGE`                | the picker's label                                   |
| `STARTS` / `ENDS`          | the two date-time field labels                       |
| `SAVE`                     | the form's CTA                                       |
| `CANCEL SESSION`           | the form's destructive action                        |
| `PLANNED`                  | the dev screen's heading over a challenge's sessions |

Not translated, on the existing precedent and for the existing reason — they name database
objects and sit beside role labels that are rows and cannot carry a message id: the hub's
tab pills (`TAB_LABEL`, unchanged) and the three status words (`STATUS_LABEL`, moved beside
`spanStatus` and reused by both screens).

**How to Play: none.** Phase one changes no controls, targets, timers, modes, difficulty,
scoring, streaks or lives, and no player can reach a planned session. The guide is checked
and left alone. Phase two is where it gains a chapter.

**Flag.** The planner sits behind **`admin`**, the existing key, at its existing floor — no
new door, and the hub's two buttons are both inside the one that already protects the
screen. `challengeLab` replaces `dev` at the same floor: all three stacks, `active = true`.
`challenges` is created at floor **`nobody`** — `active = false`, no grant rows, nothing in
the code reading it — so that phase two has a key to guard and the admin screen shows it as
a thing being prepared rather than as a thing missing.

**Buttons.** `constants/buttons.ts` gains, after the existing `admin.*` block:

```
'admin.section' | 'admin.session' | 'admin.session_new' | 'admin.session_save'
| 'admin.session_cancel' | 'admin.session_challenge' | 'admin.session_when'
```

`admin.section` is both hub buttons, `admin.session_when` both date-time fields — the
breakdown is by screen, and a second id per pair would split one affordance in the funnel
for no question anybody is asking.

## Acceptance criteria

1. `FLAGS` in `constants/features.ts` contains `challengeLab` and `challenges` and does not
   contain `dev`; `DEV_FEATURES` is exactly `['challengeLab']`; `pnpm typecheck` is green,
   which proves no `useFlag('dev')` survives.
2. After `pnpm db:reset`: `role_features` has three rows for `challengeLab` and none for
   `dev`; `features` holds `challengeLab` active and `challenges` inactive; no row in
   `features`, `role_features` or `user_features` names `dev`.
3. A `user_features` row that revoked `dev` (`granted = false`) is, after the migration, a
   row revoking `challengeLab` with `granted` still `false` — a revocation is carried across
   as a revocation, not dropped and not turned into a grant.
4. `pnpm db:test` is green, `supabase/tests/features.sql` updated and
   `supabase/tests/challenge_sessions.sql` passing.
5. On the intro: a profile holding `challengeLab` sees DEV; with `challengeLab` revoked and
   every other feature untouched, DEV is gone; granting `challenges` alone does not bring
   DEV back.
6. ADMIN opens a hub of two buttons, FEATURES and CHALLENGES, over DONE. FEATURES shows the
   PEOPLE / ROLES / FEATURES tabs exactly as before this phase, opening a person and a role
   from their lists still works, and BACK from a person returns to the people list — not to
   the hub.
7. CHALLENGES lists planned sessions, newest start first: challenge name, start and end in
   the reader's local time, and LIVE NOW / UPCOMING / EXPIRED. A session whose `mode_id` is
   not registered in this build shows the raw id and NOT IN THIS BUILD rather than being
   hidden.
8. PLAN SESSION opens with the start at **tomorrow 12:00** and the end at **the day after,
   12:00**, both in the admin's own time zone.
9. `withOpensAt` moves the end by exactly the milliseconds the start moved:
   `withOpensAt({opensAt: a, closesAt: b}, c).closesAt === b + (c - a)`, including when the
   move crosses a daylight-saving boundary. `defaultSpan` is two wall-clock noons, so across
   such a boundary its span is 23 or 25 hours and not 24.
10. SAVE is unpressable while the end is at or before the start, and
    `insert into challenge_sessions` with `closes_at <= opens_at` is refused by the database.
11. Planning a session of a challenge whose span overlaps an existing session of **the same**
    challenge is refused with a readable message; a non-overlapping span is accepted; two
    sessions of two **different** challenges may overlap.
12. Opening an existing session shows the same form that planned it: editing its challenge,
    its start and its end all persist. Moving a session onto a challenge already booked for
    that time is refused, exactly as planning it twice would be.
13. CANCEL SESSION removes a session from the list whatever its state — upcoming, live or
    expired. (Phase two narrows this: once a session has scores under it, cancel is
    refused. True as written while nothing can score.)
14. The date-time fields work on iOS (`pnpm ios`, platform picker) and on web (`pnpm web`,
    `datetime-local`), and criteria 8–10 hold identically on both.
15. The DEV screen prints, under each challenge, the sessions planned for it.
16. `pnpm check` is green, Czech included.

## Tests

| File                                          | Behaviours                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/challenge-session.test.ts` (new)         | `defaultSpan` lands on local noon tomorrow and local noon the day after, from several `now`s including one just before midnight; `withOpensAt` preserves the ms duration, across a DST boundary too; `withClosesAt` moves the end alone; `isValidSpan` refuses equal and inverted spans; `spanStatus` at all four boundaries (one ms before `opensAt`, exactly `opensAt`, one ms before `closesAt`, exactly `closesAt`). |
| `supabase/tests/features.sql` (extended)      | The rename carried all three stack rows and both directions of override; nothing names `dev`; `challenges` exists, is inactive and is in no stack; the ordered-array assertion updated for the new key's sort position.                                                                                                                                                                                                  |
| `supabase/tests/challenge_sessions.sql` (new) | The `closes_after_opens` constraint; the overlap refusal for the same `mode_id` and its absence across two, on `edit_` against its **new** `mode_id` as well as on `plan_`; `require_admin` refusing a non-admin caller on all three RPCs; the public-read policy letting `anon` select.                                                                                                                                 |

No UI tests. The three screens are lists and a form over a lib that is fully covered,
which is where this repo draws the line.

## Review focus

1. **The grant copy must carry both directions.** `user_features.granted` is a tri-state by
   absence: `true` adds, `false` subtracts, no row inherits. An `insert … select` that
   filters, or that defaults `granted`, turns "this tester must not see the dev screen" into
   "this tester sees the dev screen" — a silent re-grant, invisible on every screen because
   the row looks right. Task 6.
2. **`supabase/tests/features.sql` names `dev` six times, and one of them is ordered.** Line
   65 asserts `array_agg(k order by k) = array['czech', 'dev']`; `challengeLab` sorts
   _before_ `czech`, so the array flips and the assertion fails for a reason that reads like
   a resolve bug rather than a rename. Task 6.
3. **The tab body's early returns move with it.** `AdminOverlay` returns `AdminPerson` or
   `AdminRole` _before_ its own render when one is open. If the hub keeps that routing while
   the tabs move out, BACK from a person lands on the hub instead of the people list, and the
   hub grows state about objects it no longer shows. The shape named this as the appetite's
   edge: the body moves whole, detail routing included. Task 4.
4. **`datetime-local` hands back a zoneless string.** `new Date('2026-10-11T12:00')` is
   parsed as local, but `new Date('2026-10-11')` is parsed as **UTC** — so a web field that
   ever yields a date-only value shifts the instant by the reader's offset, and the bug
   appears only for admins west of Greenwich. The field must hand the lib a `Date` built from
   a value that always carries a time. Task 3.
5. **Knip cannot see the web variant.** `knip.json` ignores `**/*.web.tsx`, so a prop the
   native field gained and the web one did not is caught by nothing in `pnpm check` —
   neither knip nor the type checker, since the two files are alternatives rather than
   callers. One exported props type, imported by both, is what makes `pnpm typecheck` the
   guard. Task 3.

---

# Phase two — the challenge a player meets

## Problem

A session planned in admin is invisible. Nothing tells a player a challenge is on, how
long is left of it, or who is ahead on it — and there is nowhere for a challenge score
to go, because a **board** in this app is one mode × difficulty pairing with a day, a
week and an ever on it, and a challenge that runs twice is two separate contests that
would collapse into one such board.

## Appetite

**A week** — and it is tight, for a reason found while shaping rather than guessed at.
See "the capability is already wrong" below: this phase cannot be built without paying
off a latent bug in `modes/`, and that payment is not optional work that can be cut.
If the week runs out, the thing to drop is the **modal's** board (card → straight into
the run, description and standings in a third phase), not the capability split.

## Shape

### The word

A **session board**: the standings of one session, and the only standings a challenge
has. One row per player per session, keyed on the session rather than on the challenge
— so a challenge aired twice is two contests, each starting at nothing, and the first
airing's standings stay readable as the history of what happened. No today, no week, no
ever: a session _is_ its own window, and the three periods are what a permanent board
needs precisely because it has none.

It is deliberately not called a **board**. A board is one mode × difficulty pairing,
and everything in the app that reasons about boards — medals, reigns, the podium, the
recap, `heldBoards`, `WIN_RANKS` — means that. A session board carries no medal, no
reign and no winnings, and the separate word is what keeps those systems from having to
learn an exception.

### Walking it

A session is live. The player opens the intro and the **first row of the ALONE panel**,
above the mode pills, is a card:

```
     [ ALONE ] [ WITH FRIENDS ]
  ┌───────────────────────────┐
  │ ⚡ FOUR KEYS     1:52:09 ⏳│
  │ OWL leads · 12 400       ›│
  └───────────────────────────┘
   ╭ TRAINEE  ACCURACY  SPEED ╮
```

Two lines in one card, the whole card the press target: the challenge's name and the
time left of the session on the first, who leads the session board and with what on the
second. The countdown ticks. Inside the paging panel, so it slides away on WITH FRIENDS
— a challenge is played alone — and above the pills, because it is the thing that goes
away and the three below it are not.

Pressing it opens a `ModalCard`: the challenge's name, its description, the session
board in full, and START. START deals the run. No second door — see below.

The run plays as any challenge run does, under its own rules. On game over the score
goes to the session board, which the game-over screen shows in place of the three-period
board it shows for a scored mode. The session's points count toward **fortune** and the
run counts toward **achievements**, at the challenge's pinned difficulty weight.

When the window shuts the card is gone from the intro. The session board is not deleted
— it is what happened.

### The pill goes

A live challenge currently appears as a mode pill with a CHALLENGE badge
(`modeItems`, `CHALLENGE_TAG` in `menu-overlay.tsx`). It leaves. Two doors to one thing
on one screen, one of which skips the description and the standings, is the drift the
house rule about forking components exists to prevent — and it buys something
structural: with no challenge in `modeItems`, **`openModes(now)` stays synchronous and
stays compiled.** Sessions are a server read held beside the feature set, consulted by
the card and the modal and by nothing else. The registry never becomes async, which was
the largest thing threatening this appetite.

### The capability is already wrong

Found while shaping, and the reason the week is tight. `traitsOf('challenge/four-keys')`
answers `scored: true` today — a challenge inherits its base mode's capabilities, and
`defineChallenge` does not override them. So a challenge run already asks `use-board.ts`
for a board keyed `challenge/four-keys × hard`, already draws a best-scores strip for
it, already writes a board key into the career, and is stopped from submitting only by
`!isOneOf(mode, SCORED_MODES)` in `lib/score-submission.ts:84`. The capability claims a
board the schema's `check (mode in ('accuracy','speed'))` forbids.

`scored` is doing two jobs, and this phase is where they come apart:

- **`scored`** — this run has a score worth showing and recording: the strip, the pause
  badge, the run stats, the career, fortune. True for a challenge.
- **a second capability** — this mode keeps a mode × difficulty leaderboard, with its
  three periods, its medals and its reigns. False for a challenge, forced by
  `defineChallenge` rather than remembered by each spec.

Every current reader of `scored` gets sorted into one or the other. That is a `modes/`
change plus a sweep of eleven or so call sites, and it is what makes the rest of this
phase possible rather than a workaround layered over it.

### Areas

- **`modes/`** — the capability split, and `defineChallenge` forcing the board one off.
  Nothing outside `modes/` gains a name check; the readers ask the capability they
  actually meant.
- **The intro** — one new card as the ALONE panel's first row, and the challenge
  removed from `modeItems`.
- **A new dialog** — `ModalCard`, not a new card type. Name, description, session
  board, START.
- **The session board on screen** — `TabPanel` already draws a ranked list from a
  `PeriodBoard`; it takes `tab: LeaderboardTab` to pick its empty line. A fourth value
  for the one-window case, commented with which caller asked for it. Not a second
  leaderboard component, and not `HighScores`, which is tabs, medals and a publish
  button a session has none of.
- **The game-over screen** — shows the session board instead of the three-period one
  when the run was in a session.
- **The schema** — one table (`session_id`, `user_id`, best score, hits, updated_at,
  primary key on the pair) with the same no-downgrade trigger `daily_scores` has; and
  three reads: the live sessions for the card, one session's standings in full, and the
  write. The write is an RPC rather than an upsert, because the window check has to be
  the server's and not the client's promise.
- **The run carries its session** — `LocalScore` gains the session id, so a score
  written offline still knows where it belongs when the connection comes back.
- **Fortune** — `lifetimeOf` gains one term and the profile read gains one field.
  Fortune is computed on the client from board totals, so session totals are an extra
  summand rather than a new system.
- **Achievements** — mostly already true. They run off `RunFacts` and `Career`, both of
  which a `scored` challenge run already feeds. The rules keyed to `SCORED_MODES` stay
  keyed to it, so a challenge cannot take a board-specific achievement, which is right.
- **How to Play** — a new chapter. This is the first phase a player can reach, and it
  must say that a challenge has one window, one set of standings, and rules that may
  differ from everything else — including the dial, which a challenge may change, so
  the chapter must not promise nine keys.
- **Copy** — every string extracted and translated.

## In

- The live-session card: name, ticking countdown, leader, as the ALONE panel's first row.
- The challenge dropped from `modeItems`.
- The modal: name, description, session board, START.
- `session_scores`, its no-downgrade trigger, and three server calls.
- Session scores reaching fortune and achievements, at the pinned difficulty's weight.
- The game-over screen showing the session board for a session run.
- The capability split, and `defineChallenge` forcing the board capability off.
- A How to Play chapter for challenges.

## Out

- **Medals, reigns, the podium, winnings and the recap.** A session board carries none
  of them. No MEDALS HELD row, no `board_reigns`, no gold, no takeover, no recap line.
- **The three periods.** One session, one set of standings, forever.
- **A session board on a profile.** A player's card lists boards and reigns; a session
  is neither. Where a challenge shows up on a profile is its own question.
- **Notifications or any announcement that a session has opened.** The player finds the
  card when they open the app.
- **Carrying standings between sessions of the same challenge.** Each airing starts
  empty, which is the user's decision and falls out of keying on the session.
- **Admin editing the session board.** No moderation, no removing a score, and no way to
  cancel a session that has any — see the refusal in the schema section.
- **A session for a permanent mode.** Sessions air challenges only.
- **Widening `scores.mode`.** The session board is its own table precisely so that
  check constraint, and everything downstream of it, stays as it is.

## Rabbit holes

- **The capability sweep is the work.** Eleven-odd readers of `scored`, each of which
  has to be sorted into "has a score" or "keeps a board", and getting one wrong is a
  screen quietly asking the server for a board that cannot exist. The way through:
  split the capability first, sweep with the type system refusing to compile until
  every reader has chosen, and only then build the card. If this runs long, the modal's
  board is what gets cut.
- **A run in flight when the window shuts.** Decided: the write is accepted while
  `now()` is inside the span _or_ within a fixed grace past its close — longer than any
  run can last. Checked server-side in the RPC. A player who started in time is not
  robbed by the clock, and a player who starts late cannot post at all.
- **The countdown re-rendering the intro once a second.** The intro already runs a
  repeating gradient worklet and a paging panel. The way through: the ticking figure in
  a component of its own so the second hand cannot re-render the screen around it.
- **Offline.** `local-scores.ts` already queues a pending score and republishes it; the
  session id has to ride along, and a session that has closed by the time the queue
  drains has to be refused cleanly rather than retried forever. `noteRefusal` is the
  existing shape for that.
- **A session naming a mode this build does not have.** The planner can book any
  challenge in the catalog, and a device can be older than the server. Skipped silently
  — no card, no modal, no crash — the same answer `modeById` already gives.
- **Two live sessions at once.** The planner refuses overlapping sessions of the _same_
  challenge, not of different ones. Decided: the card shows the one closing soonest,
  and nothing stacks. If two live challenges ever becomes the intention, the card
  becomes a row of cards, and that is a different shape.
- **Fortune must not move for anyone who has not played a challenge.** `lifetimeOf`
  gaining a term is a figure every player's profile recomputes. A player with no
  session rows has to come out at exactly the number they have now — the same stillness
  the podium needed when winnings arrived. One test, pinned.

## Contract — phase two

_Phase one's contract is above and is shipped code. This section is phase two only._

### Domain words

**Used as `CLAUDE.md` defines them:** challenge, session, run, board, mode, rules, dial,
difficulty, fortune, achievement, medal, record, capability, feature.

**Introduced — one word, and `CLAUDE.md` gains a row:**

- **session board** — the standings of one session, and the only standings a challenge
  has: one row per player per session, no today/week/ever. A session _is_ its own window,
  which is exactly why it needs none of the three. `session_scores` in the database,
  `SessionBoard` in `lib/session-board.ts`.

**Collisions, and how each stays apart.** The dangerous one is **board**:

1. **session board vs board.** A **board** is one mode × difficulty pairing with three
   periods, a medal, a reign and a place in the podium. A session board is none of that.
   They are kept apart by never shortening the new one: it is a _session board_ in every
   sentence, and the code says `session_scores` / `SessionBoard`, never `board` alone.
   The new capability below is where the app asks which it means.
2. **session board vs the session's own card.** The card on the intro shows _who leads_;
   the session board is the full standings. One is a line, the other a list.
3. Already-standing: **session** vs run vs auth session (phase one's row), and
   `Challenge` the dare in `lib/next-challenge.ts` vs a challenge the mode.

**Renamed — and this is the load-bearing change.** `capabilities.scored` is doing two
jobs. It splits in two, and the assignment is the opposite of what the shape guessed,
which is what makes this phase fit a week:

- **`board`** — _new field, keeps the old meaning._ This mode keeps a mode × difficulty
  leaderboard: a rank, a medal, a personal best, a published score, a best-scores strip.
  **False for a challenge**, forced by `defineChallenge`. Eleven of the sixteen current
  readers of `.scored` mean this and are renamed.
- **`scored`** — _keeps its name, takes the narrower meaning._ This run has a score
  worth showing and counting: the readout on the game screen, the pause screen's score,
  RESTART RUN, the factor in the run stats, the poor-run streak. **True for a
  challenge**, inherited from its base mode with no patch at all.

Taking it this way round means the five sites that must change meaning change by
**not being touched**, and the eleven that keep their meaning change by a rename `tsc`
cannot get wrong except by omission. The shape had it the other way round — the five renamed and the
eleven re-pointed; same outcome, four times the surface to get wrong.

### Files

**Created**

| Path                                                    | Responsibility                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `lib/session-board.ts`                                  | The server half: the card's read, one session's standings, and the write. Beside `lib/admin/sessions.ts`, which stays admin-only. |
| `hooks/use-session-card.ts`                             | The one session the intro draws, resolved once per launch and held: which session, its state, and who leads it.                   |
| `components/overlays/challenge-card.tsx`                | The ALONE panel's first row, in both states — teaser and live.                                                                    |
| `components/overlays/challenge-countdown.tsx`           | The ticking figure, alone in its own file so the second hand cannot re-render the intro around it.                                |
| `components/overlays/challenge-modal.tsx`               | The `ModalCard` behind the card: name, description, session board, START.                                                         |
| `supabase/migrations/20261011000000_session_scores.sql` | The table, its no-downgrade trigger, the submit RPC and the two reads.                                                            |
| `supabase/tests/session_scores.sql`                     | The window-and-grace rule, the no-downgrade, the ranking, and who may read.                                                       |

**Modified**

| Path                                          | Change                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modes/types.ts`                              | `board: boolean` on `Capabilities`.                                                                                                                                                                                                          |
| `modes/rules.ts`                              | `board: true` in the base capabilities.                                                                                                                                                                                                      |
| `modes/definitions/trainee.ts`                | `board: false` beside its existing `scored: false`.                                                                                                                                                                                          |
| `modes/challenges/define.ts`                  | Forces `board: false` after the patch, so no challenge spec can turn it back on.                                                                                                                                                             |
| `modes/registry.ts`                           | `NO_TRAITS` gains `board: false`.                                                                                                                                                                                                            |
| `modes/registry.test.ts`                      | Line 41's `SCORED_MODES` check reads `.board`.                                                                                                                                                                                               |
| `modes/rules.test.ts`                         | Trainee's capability assertions gain `board`.                                                                                                                                                                                                |
| **The eleven renames**                        | `hooks/use-board.ts` (×4), `machines/game.ts` (×2), `lib/career.ts` (×1), `lib/score-submission.ts`, `lib/invite-message.ts`, `components/game/best-scores-line.tsx`, `components/overlays/paused-overlay.tsx` (the `BoardMedals` one only). |
| `components/overlays/menu-overlay.tsx`        | The card as the ALONE panel's first row; challenges dropped from `modeItems` and `CHALLENGE_TAG` retired.                                                                                                                                    |
| `components/overlays/tab-panel.tsx`           | An optional `emptyLine` override, so a session board can say its own thing.                                                                                                                                                                  |
| `components/overlays/game-over-overlay.tsx`   | The session board in place of `HighScores` when the run was in a session.                                                                                                                                                                    |
| `lib/challenge-session.ts`                    | `teaserOpensAt`, `cardSession`, `SessionCard`.                                                                                                                                                                                               |
| `lib/leaderboard-period.ts`                   | `startOfDayInPrague(day): number` — the teaser rule needs the instant, and only `msUntilNextDay` computes one today, privately.                                                                                                              |
| `lib/local-scores.ts`                         | `sessionId` on `LocalScore`.                                                                                                                                                                                                                 |
| `lib/player-profile.ts`                       | `lifetimeOf`'s third argument, and one optional field on the RPC response.                                                                                                                                                                   |
| `app/(tabs)/index.tsx`                        | Which session the live run belongs to; START from the modal.                                                                                                                                                                                 |
| `components/overlays/how-to-play-overlay.tsx` | A challenges chapter.                                                                                                                                                                                                                        |
| `constants/buttons.ts`                        | Four new `ButtonId`s.                                                                                                                                                                                                                        |
| `CLAUDE.md`                                   | The **session board** row, and the **capability** row gains `board`.                                                                                                                                                                         |
| `locales/{cs,en}/messages.po`                 | Extract, then Czech.                                                                                                                                                                                                                         |

### Data and types

**The capability**, in `modes/types.ts`:

```ts
export type Capabilities = {
  // Keeps a mode × difficulty leaderboard: a rank, a medal, a personal best, a
  // published score. Every *board*-shaped question in the app is this flag.
  board: boolean
  // Has a score worth showing and counting — the readout, the pause screen, the run
  // stats, the career. True for a challenge, which has a score and no board.
  scored: boolean
  coached: boolean
  keyHints: boolean
}
```

**The sixteen readers, and which each becomes.** This table is the authority; `tsc`
cannot check it, because both fields are booleans on the same object.

| Site                                         | Becomes                 | Why                                                      |
| -------------------------------------------- | ----------------------- | -------------------------------------------------------- |
| `hooks/use-board.ts:274`                     | `board`                 | Subscribes to a board that cannot exist for a challenge. |
| `hooks/use-board.ts:306`                     | `board`                 | The Prague-midnight rollover of a board's day rows.      |
| `hooks/use-board.ts:321`                     | `board`                 | `refresh` of the same board.                             |
| `hooks/use-board.ts:332`                     | `board`                 | `NO_BOARD` for a mode that keeps none.                   |
| `machines/game.ts:139`                       | `board`                 | `hydrateStats` — stats are per mode × difficulty bests.  |
| `machines/game.ts:562`                       | `board`                 | Writing that best back.                                  |
| `lib/career.ts:191`                          | `board`                 | `boardKey` — a challenge puts nothing on a board.        |
| `lib/score-submission.ts:84`                 | `board`                 | Publishing to `scores`. `SCORED_MODES` stays beside it.  |
| `lib/invite-message.ts:17`                   | `board`                 | Boasting a best _on a board_.                            |
| `components/game/best-scores-line.tsx:320`   | `board`                 | The strip is board bests.                                |
| `components/overlays/paused-overlay.tsx:152` | `board`                 | `BoardMedals`.                                           |
| `app/(tabs)/index.tsx:1735`                  | **`scored`, untouched** | The live score readout. A challenge run shows its score. |
| `components/overlays/paused-overlay.tsx:147` | **`scored`, untouched** | The pause screen's score.                                |
| `components/overlays/paused-overlay.tsx:218` | **`scored`, untouched** | RESTART RUN.                                             |
| `lib/run-stats.ts:55`                        | **`scored`, untouched** | The factor stat.                                         |
| `lib/career.ts:217`                          | **`scored`, untouched** | The poor-run streak.                                     |

**The pure half**, extending `lib/challenge-session.ts` rather than a new file:

```ts
// Midnight Prague on the day before a session opens — when its teaser appears. The
// same day boundary every board in this app is reckoned by.
teaserOpensAt(opensAt: number): number

export type SessionCard =
  | { state: 'teaser'; session: AdminSession; opensAt: number }
  | { state: 'live'; session: AdminSession; closesAt: number }
  | null

// Which session the intro draws, or null. Live beats teased; among several live, the
// one closing soonest; among several teased, the one opening soonest. A session naming
// a mode this build does not have is skipped — no card, which is what `modeById`
// answering null already means everywhere else.
cardSession(sessions: readonly AdminSession[], now: number): SessionCard
```

**The server half**, `lib/session-board.ts`:

```ts
export type SessionBoardRow = LeaderboardRow  // rank, user_id, nickname, best_score, …
export type SessionLeader = { nickname: string; score: number } | null

loadOpenSessions(): Promise<{ rows: AdminSession[]; leaders: Map<string, SessionLeader>; error: string | null }>
loadSessionBoard(sessionId: string): Promise<{ board: PeriodBoard; error: string | null }>
submitSessionScore(sessionId: string, entry: LocalScore): Promise<Sent>
```

`loadOpenSessions` is one round trip: every session whose close is still ahead, each with
its leader. The client decides teaser-or-live with `cardSession`, so the Prague-midnight
rule stays in the one place that owns day boundaries and is not written again in SQL.

**`TabPanel` gains an override, not a fourth tab.** `tab: LeaderboardTab` is used in
exactly one place — `emptyBoardLine(headline, difficulty, tab)` at line 150. Adding
`'session'` to `LeaderboardTab` would force a session entry into `lib/empty-board.ts`'s
thirty-six lines, `tabSince`, `qualifiesForTab`, `my_medals` and `lib/medals.ts`, for one
sentence. So instead: `emptyLine?: MessageDescriptor`, passed by the session caller only,
and `LeaderboardTab` is untouched. **This is a divergence from the shape**, which said a
fourth value; it is the same result for a fraction of the blast radius.

**The run carries its session, outside the machine.** `app/(tabs)/index.tsx` holds
`runSession: string | null`, set when START is pressed in the modal, cleared when the
mode changes or the player reaches the intro, and kept across RESTART RUN. Not on the
game machine's context: the engine has no business knowing what a session is, and a
session id there would be the first thing in `RunRules`' neighbourhood that is not a
rule. Consequence to accept: a run restored from storage mid-run loses its session and
posts to no session board. The grace rule below makes that a near-miss rather than a
loss, and a player who was mid-run across an app death is already an edge.

**`LocalScore` gains `sessionId?: string | null`** and the storage key **does not move**.
`LOCAL_SCORES_KEY` is `nine.scores.v1`; the field is optional and absent means "not a
session run", which is the correct reading of every row written before this ships.
Bumping the key would discard every score still queued for publication, which is a
strictly worse outcome than the migration it would avoid. `readLocalScores` is a bare
`JSON.parse`, so a widened optional field needs nothing.

**Fortune**, in `lib/player-profile.ts`:

```ts
lifetimeOf(
  totals: readonly BoardTotals[],
  winnings: readonly BoardWinnings[] = [],
  sessions: readonly SessionTotals[] = [],   // new, defaulted
): Lifetime

export type SessionTotals = { difficulty: Difficulty; scoreSum: number }
```

Defaulted for the reason `winnings` is: a server that predates this sends nothing, and the
honest reading of nothing is no session points. The RPC response gains
`sessionTotals?: { difficulty: string; scoreSum: number }[]`, read `?? []` exactly as
`winnings?` is.

**Fortune only — not `runs`, `hits`, `score` or `timeMs`.** Those four are what the
per-board table on the profile adds up to, and a session is not a board, so a session run
feeding them would make the table stop explaining the figures beside it. The consequence
is already true of winnings and the modal already says so: FORTUNE can exceed what the
table accounts for.

The difficulty comes off the **row**, not off the registry: `session_scores` stores it,
written from what the client sends, because `fixedDifficulty` is a fact in the bundle and
the server has never heard of a mode. A session whose challenge this build lacks still
weights correctly.

**Schema**, `supabase/migrations/20261011000000_session_scores.sql`:

```sql
create table session_scores (
  session_id uuid not null references challenge_sessions (id) on delete cascade,
  user_id    uuid not null references profiles (id)           on delete cascade,
  best_score int  not null,
  hits       int  not null,
  difficulty text not null,
  updated_at timestamptz not null,
  primary key (session_id, user_id)
);

create trigger session_scores_no_downgrade
  before update on session_scores
  for each row execute function prevent_score_downgrade();
```

`prevent_score_downgrade()` is reused verbatim from `…_init.sql` — it reads
`new.best_score < old.best_score` and nothing else, so it fits without a second copy.

**The cascade stays, and `cancel_challenge_session` learns to refuse.** The FK is
`on delete cascade` so standings can never outlive the session they belong to — that is
the correct shape for the data. But phase one made CANCEL SESSION unconditional, and from
this phase on the row underneath it is scores people played for. So phase two
`create or replace`s that function with a guard: it refuses while any `session_scores`
row names the session, and the message says how many players have scored on it — the same
arrangement `delete_role` uses for a role somebody still holds, and for the same reason,
which is that a constraint name is not something to show to a person.

This narrows phase one's criterion 13, deliberately: cancel is still free whatever the
session's _state_, and no longer free once it has _scores_. A session booked by mistake
can still be cleaned up, because nobody has played it. One that ran is a record, and
taking it away would take its players' standings with it.

No new copy: `admin-session.tsx` already prints `res.error`, so the server's sentence
reaches the screen the way every other admin refusal does.

RLS: public read, no direct writes. Three functions:

- `submit_session_score(p_session_id uuid, p_score int, p_hits int, p_difficulty text, p_achieved_at timestamptz)` —
  `security definer`, writes as `auth.uid()`. Refuses unless
  `now() < closes_at + interval '10 minutes'` **and** `now() >= opens_at`: a player who
  started in time is not robbed by the clock, and one who arrives after the window cannot
  post at all. Ten minutes is longer than any run.
- `session_board(p_session_id uuid)` — the standings, ranked
  `order by best_score desc, updated_at asc`, shaped like the existing `leaderboard`
  RPC's rows so `TabPanel` draws it unchanged.
- `open_sessions_with_leaders()` — every session whose close is still ahead, with the top
  row's nickname and score. One round trip for the card.
- `cancel_challenge_session(p_id uuid)` — **replaced**, not added: phase one's function
  gains the scores guard above. `create or replace`, so the grant already made stands.

**Push order.** Additive — a new table, new functions, one new optional field on
`player_profile`. The old bundle runs against the new schema untouched. The new bundle
against the old schema is the problem: no `session_scores`, so the card's read fails and
the card never draws. **Push before deploy**, same rule as phase one.

### Copy, and the gates

**Copy / i18n.** All player-visible, all through Lingui, all Czech:

| String                             | Where                              |
| ---------------------------------- | ---------------------------------- |
| `{time} LEFT`                      | the live card's countdown          |
| `OPENS IN {time}`                  | the teaser's countdown             |
| `{nickname} leads · {score}`       | the live card's second line        |
| `NOBODY HAS PLAYED IT YET`         | a live session with an empty board |
| `START`                            | the modal's CTA                    |
| `OPENS IN {time}` (button)         | the teaser modal's unpressable CTA |
| `— NOBODY HAS SCORED HERE —`       | the session board's empty line     |
| `ONE WINDOW, ONE SET OF STANDINGS` | the modal's subtitle               |
| A How to Play chapter              | heading, three or four sentences   |

**How to Play: yes, a new chapter.** This is the first phase a player can reach. It must
say: a challenge is on for a window and then gone; it has one set of standings that never
resets and never pays a medal; and its rules may differ from everything else — **including
the dial**, so the chapter must not promise nine keys. `components/overlays/how-to-play-overlay.tsx`,
a chapter after the modes and before multiplayer, gated on the `challenges` feature the
way the arcade and multiplayer chapters are gated on theirs.

**Flag.** Everything player-visible here is behind **`challenges`**, the key phase one
created at floor `nobody`. The card, the modal, the How to Play chapter and the card's
server read all ask it — the read as well as the card, the way `recap` gates both. Its
floor moves to `tester` as part of this phase so the feature can be looked at; it stays
`active = false`, so the switch is one tap when it is ready for players.

**Buttons.** `constants/buttons.ts` gains:

```
'menu.challenge' | 'challenge.start' | 'challenge.dismiss' | 'challenge.board'
```

## Acceptance criteria

1. `traitsOf('challenge/four-keys')` answers `{ board: false, scored: true, … }`;
   `traitsOf('trainee')` answers `board: false, scored: false`; `traitsOf('accuracy')`
   answers `board: true, scored: true`.
2. A challenge spec that sets `capabilities: { board: true }` still resolves to
   `board: false` — `defineChallenge` forces it after the patch, so no catalog entry can
   claim a board.
3. On a challenge run: the game screen shows the score readout and the streak badge; the
   best-scores strip is blank but keeps its height; the pause screen shows the score and
   RESTART RUN but no board medals; no request is made for a `challenge/… × hard` board.
4. On Trainee and Accuracy, every one of those behaves exactly as it does today — no
   screen changed for a mode that is not a challenge.
5. With a session live, the intro's ALONE panel shows the card as its **first row**, above
   the mode pills: challenge name, a countdown to the close that ticks every second, and
   who leads with their score. No challenge appears among the mode pills.
6. With a session planned and not yet open, the card appears from **midnight Prague on the
   day before** it opens — not before — showing a countdown to the **start** and the
   challenge's description in place of a leader.
7. A live session and a teased one at once: the card shows the live one. Two live: the one
   closing soonest. Nothing stacks.
8. A session whose `mode_id` is not registered in this build draws no card and no modal,
   and logs no error.
9. Pressing the card opens a `ModalCard` with the challenge's name, its description, the
   session board in full, and START. On a teaser the CTA reads the time until it opens and
   is unpressable. On a live session with no scores the board says
   `— NOBODY HAS SCORED HERE —`.
10. START deals a run of that challenge under its own rules. On game over the score is on
    the session board, and the game-over screen shows the session board rather than a
    three-period one.
11. A run started inside the window and finished within ten minutes of the close still
    posts; a run started after the close cannot post at all (both refused server-side,
    both covered by the SQL test).
12. A second run of the same session with a worse score does not lower the standing; a
    better one raises it.
13. Two sessions of the same challenge have independent standings: the second starts
    empty, and the first's rows are still readable.
14. CANCEL SESSION on a session with no scores still works. On one with scores it is
    refused, and the planner shows a sentence naming how many players have scored on it.
    Deleting the row by any other route still takes its standings with it.
15. A player's FORTUNE rises by `score × scoreWeight[difficulty]` after a session run; a
    player with no session rows reads **exactly** the fortune they read before this
    shipped, to the point.
16. Offline: a session run queues and publishes on reconnection; a session that has closed
    by then is refused rather than retried forever.
17. How to Play has a challenges chapter, it appears only with the `challenges` feature,
    and it does not say the dial has nine keys.
18. `pnpm check` green, Czech included, and `pnpm db:test` green.

## Tests

| File                                                                          | Behaviours                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/challenge-session.test.ts` (extended)                                    | `teaserOpensAt` lands on midnight Prague the day before, across a month end and a DST boundary; `cardSession` prefers live over teased, soonest-closing among live, soonest-opening among teased, null when nothing is in range, and skips an unregistered mode.                                                                 |
| `lib/player-profile.test.ts` (extended)                                       | `lifetimeOf` with no third argument returns byte-identical results to today (the stillness test); one session total adds `scoreSum × scoreWeight`; session totals do not move `runs`, `hits`, `score` or `timeMs`.                                                                                                               |
| `lib/leaderboard-period.test.ts` (extended)                                   | `startOfDayInPrague` for a winter day, a summer day and both DST changeover days.                                                                                                                                                                                                                                                |
| `modes/rules.test.ts` (extended)                                              | The base has `board: true`; Trainee has both false; a challenge has `board: false, scored: true`; a challenge patch claiming `board: true` is overridden.                                                                                                                                                                        |
| `modes/registry.test.ts` (extended)                                           | `SCORED_MODES` matches the modes whose `board` is true — the existing invariant, now on the right field.                                                                                                                                                                                                                         |
| `lib/local-scores.test.ts` (extended)                                         | A stored entry with no `sessionId` reads as not-a-session; one with a `sessionId` round-trips; the two never collide in a slot.                                                                                                                                                                                                  |
| `supabase/tests/session_scores.sql` (new)                                     | The window-and-grace rule in all three positions (before open, inside, inside grace, past grace); the no-downgrade trigger; `session_board`'s ranking and its tie-break on `updated_at`; `open_sessions_with_leaders` returning the top row; `cancel_challenge_session` refusing a session with scores and allowing one without; |
| the cascade still firing on a direct delete; public read and no direct write. |

## Review focus

1. **The eleven renames are not type-checked.** `board` and `scored` are both booleans on
   the same object, so a site left reading `.scored` compiles cleanly and misbehaves for
   challenges only — a best-scores strip asking for a board that cannot exist, or a career
   filing a board key for a session. The sixteen-row table above is the authority, and the
   count is the check: after the sweep, exactly five `.scored` readers remain. Task 2.
2. **`defineChallenge` must force `board` after `patchRules`, not before.** `patchRules`
   merges `{ ...base.capabilities, ...patch.capabilities }`, so a force applied before the
   merge is overwritten by any spec that mentions capabilities at all — and the catalog's
   one worked example does not, which is exactly how this would ship green and fail on the
   second challenge anybody writes. Criterion 2 is the test. Task 3.
3. **The countdown must not re-render the intro.** `menu-overlay.tsx` already runs a
   repeating gradient worklet, a paging panel and a `useViewport`. A `setInterval` in it
   re-renders all of that once a second. The interval belongs in
   `challenge-countdown.tsx` and nowhere else — and it must clear on unmount and stop when
   the span it is counting has run out, or a closed session leaves a ticking negative. Task 6.
4. **`lifetimeOf`'s third argument must be defaulted.** Four callers pass two arguments
   today (`compare-overlay.tsx` ×2, `player-profile-overlay.tsx`, `lib/compare.ts`). A
   required third would be four type errors, which is fine — but a _defaulted_ one is what
   makes criterion 15's stillness true by construction for every player with no session
   rows, including on a server that sends the field as absent. Task 8.
5. **A closed session must refuse, not fail.** `lib/score-submission.ts` treats a network
   failure as "try again later" and a refusal as counting toward `MAX_PUBLISH_ATTEMPTS`.
   `submit_session_score` raising for a shut window has to arrive as a refusal, so
   `isNetworkFailure` must not match its message and `reportRefusal` must not treat an
   expected closure as an error worth logging. Criterion 16. Task 9.

---

# Phase three — what a challenge is worth keeping

## Problem

A session board tells a player where they came, and then the window shuts and it is
over. Nothing of a challenge survives it. A player who took a one-day contest outright
has nothing to show for it a week later — and a one-day contest is the only thing in
this app that cannot be re-won, so it is the one standing most worth keeping.

## Appetite

**An evening or two.** Four entries in a list that already exists, one point-in-time
check inside an RPC phase two already writes, and one settle-on-close pass. The whole of
it rides on machinery the two phases before it put there; if it does not, something in
those phases was built wrong.

## Shape

### The word stays "achievement", and the definition moves

CLAUDE.md says an achievement is "permanent, achieved once, never lost, measured against
the player's own history rather than against anyone else" — and that last clause is what
separates it from a **medal**. A challenge win is measured against other people, so by
the letter of it this would have to be a fourth reward word.

It does not, and the user's reasoning is the right one: _you were top when the window
shut, and you never lost it._ The clause actually doing the work is **losable**, not
self-measured. A medal can be taken off you tomorrow because its board is still open; a
closed session has no tomorrow, so first place on it is as permanent as a personal best.
So the glossary entry loses "rather than against anyone else" and keeps what always
distinguished the two, and the table of three rewards gains a line: an achievement may
be settled against a contest that can no longer be reopened.

### The four

| Achievement            | What clears it                                  | Where it is known                                                                                                         |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **TRY A CHALLENGE**    | Finish one challenge run.                       | Client, the moment the run ends.                                                                                          |
| **TRY TEN CHALLENGES** | Take part in ten different sessions.            | Server — a count of the player's session rows. Ten _sessions_, not ten runs, so grinding one challenge does not clear it. |
| **LEAD A CHALLENGE**   | Be first on a live session board at any moment. | Server, inside the submit RPC: after the write, am I top?                                                                 |
| **WIN A CHALLENGE**    | Be first when the window shuts.                 | Server, settled once the session has closed.                                                                              |

LEAD and WIN are deliberately two. LEAD is the one a good run can clear on the spot and
is what gives a player a reason to push while the window is open; WIN cannot be known
until it is over, and is the rarer thing.

**LEAD is a moment, not a stretch.** No duration, no "held it for an hour" — the user's
call, and it is what makes this phase an evening rather than a week: a point-in-time
check needs no history, so phase two's one-row-per-player table stands exactly as shaped
and nothing has to be logged.

### How each is found out

- **TRY** rides the existing path. Achievements already run off `RunFacts` and `Career`
  the moment a run ends, and a challenge run already feeds both.
- **LEAD** is a flag on the answer to a write phase two already has to make. The submit
  RPC checks the window; it can say "and you are now top" in the same breath, so the
  client learns it without a second read and without polling.
- **WIN** settles lazily, on the pattern `winnings` already uses: no cron and no
  scheduled job. On launch, any closed session the player has a row in and has not been
  settled for is settled then — the same watermark-and-catch-up shape as `paid_through`,
  which is what kept winnings honest without a scheduler.
- **TRY TEN** is a count, read with the rest of the player's achievement state.

### Areas

- **`constants/achievements.ts`** — four entries, in a group of their own. Green, like
  every achievement; the colour is the distinction the app already draws.
- **`lib/achievements.ts`** — the two client-side rules, and the two that arrive as
  facts from the server rather than being computed from a run.
- **The achievements screen** — a challenge group, shown to whoever holds the
  `challenges` feature, the way the multiplayer group already gates on `multiplayer`.
- **The submit RPC** — one extra field on its answer.
- **The settle pass** — one function and one watermark, read at launch.
- **CLAUDE.md** — the achievement definition, and a line in the three-rewards table.
- **How to Play** — the challenge chapter gains what a challenge is worth keeping.

## In

- The four achievements, their copy, and their Czech.
- The lead flag on the submit answer.
- The settle-on-close pass and its watermark.
- The glossary amendment, with the reasoning written down so the next reader does not
  re-open it.

## Out

- **Any duration achievement.** No "led for an hour", no "held it to the close". The
  settled win covers the second of those.
- **A rank-two or rank-three achievement.** A podium belongs to the winnings system and
  a closed session pays nothing.
- **Session standings on a profile card.** Still its own question, still not this.
- **Retroactive settlement of sessions that closed before this ships.** The watermark
  starts where the feature does, exactly as `podium_from` did.
- **Announcing a win to anybody but the winner.** No recap line, no takeover, no news.

## Rabbit holes

- **Two players tied at the close.** The session board sorts ties by `updated_at`, the
  way every board here does, so first place is always exactly one player. Say so in the
  copy rather than leaving it to be found out.
- **A win arriving from the server widens how an achievement arrives.** Every
  achievement today is derivable on the device from a run and a career; two of these are
  not, and a client that cannot compute one has to be able to be _told_ one. That is a
  widening, not a new system — but it is where this phase could sprawl, and the way
  through is to make the server's answer look like the facts the rules already read
  rather than giving it a path of its own.
- **Settling has to be idempotent.** `achievements.earned_at` is achieved-once by
  definition, so a pass that runs on every launch must land on the same answer forever,
  including for a player who takes a second session later.
- **Nobody played it.** A session closing with an empty board settles to no winner and
  must not stall the watermark behind it.
