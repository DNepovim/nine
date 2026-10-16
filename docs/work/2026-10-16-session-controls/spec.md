# Running a challenge's window

Slug: session-controls
Stage: shipped
Skipped: verify (second pass) — skipped at the users instruction on 2026-10-16, after the first pass returned 8 PASS / 1 FAIL / 5 SKIPPED. The fix for criterion 14 and the amendments to 6 and 7 were never re-verified; criteria 1, 2, 3, 10 and 12 have still never been driven in the app.
Next: —
Track: full
Branch: feat/session-controls
Started: 2026-10-16

## Problem

A session's window is fixed the moment it is booked, and the one screen that could
change it cannot be trusted with a live one. An admin cannot say how far ahead a
challenge should start announcing itself — the teaser opens at midnight Prague the day
before, for every session, because that is what `teaserOpensAt` was written to do. A
challenge that is running can have its challenge, its start and its end rewritten from
the same form that plans an unstarted one, and the button beside it deletes the row
outright — taking a session board, its settled places and the points already counted
toward fortune with it. There is no way to give a running challenge more time, and no
way to stop one short of its end.

The player's side of the same window is no better: the intro calls a challenge an
**event**, a word used nowhere else in the app, and when its countdown reaches zero the
card goes on saying the challenge is still coming until the app is restarted.

## Appetite

**A week.** New schema, a new domain word, three RPCs and both sides of the window —
the admin's controls and what the intro says about them. The appetite is the input:
the How to Play guide is deliberately vague about a challenge's rules and stays that
way, and anything below in **Out** was cut to make the rest fit.

## Shape

The admin opens SESSIONS. Along the top, where four pills used to select one filter
each, the same pills now toggle: LIVE and PLANNED are lit on arrival, PAST is dark, and
each still carries its count. Lighting PAST adds those rows to the list rather than
replacing it.

Somewhere on this screen — not a new section — is the one general figure: **how many
hours before it opens a challenge starts announcing itself.** It applies to every
session that does not say otherwise.

Planning or editing a session gains one field: a lead time for _this_ session, blank
by default, which beats the general figure when it is filled.

A row that is live reads differently. Its challenge, its start and its end are no
longer editable — the form shows them and will not take a change — and the button that
deletes a booking is gone, because deleting this one would take a board with it. In
their place, two acts the window actually allows:

- **CLOSE EARLY** — shut the window now. The standings stand exactly as a natural close
  would have left them, and the places settle on the spot.
- **EXTEND** — hours and minutes, added to the end. The session's end moves forward and
  nothing else about it changes.

A player on the intro sees the result. The card says **challenge**, never event. When a
session has been extended, the card says so for the rest of its window. And when a
teaser's countdown runs out, the card becomes the live card on that tick — no restart.

### Areas

- **Schema** — one new home for a single general figure (there is no settings table
  among the seventeen); a per-session lead time on `challenge_sessions`; a mark saying
  a session was extended.
- **RPCs** — close-early and extend, both new; `cancel_challenge_session` learns to
  refuse a live row; `edit_challenge_session` learns to refuse a live row's challenge,
  start and end.
- **Lib** — `lib/challenge-session.ts`: `teaserOpensAt` stops being a day boundary and
  takes a lead time. `lib/admin/sessions.ts`: two writes and one more column.
- **Admin screens** — `admin-sessions.tsx` (toggling filters, the general figure),
  `admin-session.tsx` (the per-session field, the live form, the two buttons).
  `AdminSegments` gains an optional multi-select mode; it is used by three screens, so
  it is extended rather than forked.
- **Intro** — `challenge-card.tsx` (the word, the extended line) and
  `hooks/use-session-card.ts` (the card re-reckons itself at the boundary).
- **Copy** — two or three new strings, English and Czech.

Not a mode's business and not the engine's: none of this touches `RunRules` or
`traitsOf`, and nothing here branches on a challenge's name. It is the admin's booking
and the intro's reading of it.

**No feature of its own.** It lands inside `challenges`, which is `hidden` in
production today — so the floor is already the floor.

## In

- A general lead time in hours, and a per-session override that beats it.
- A live session's challenge, start and end refused by the edit form and by the server.
- A live session that cannot be deleted.
- CLOSE EARLY, keeping the board.
- EXTEND by hours and minutes, announced on the intro for the rest of the window.
- Filters that toggle, default LIVE + PLANNED, counts on each.
- "event" → "challenge".
- The card flipping from teaser to live on the tick, without a reload.

## Out

- **A settings section.** One figure gets a home, not a screen. The second general
  setting is what earns a section.
- **Anything in How to Play.** The guide is vague about a challenge's rules on purpose;
  a lead time is not a rule a player plays by.
- **Push or a popup for an extension.** The banner is the announcement.
- **Changing a live session's challenge.** Stays refused, as it already is once anyone
  has scored.
- **Shortening by an amount.** CLOSE EARLY shuts it now; there is no "take two hours
  off". Extending is the only arithmetic.
- **Undoing a close-early.** A shut window is shut. Re-running the challenge is a new
  session, which is what a second session board is for.
- **A history of who extended what.** The mark says a session was extended, not by whom.
- **Per-session lead time shown to the player.** They see a countdown; they never see
  how long it was set to run.

## Rabbit holes

- **Hours are not a day boundary, and the teaser was a day boundary on purpose.**
  `teaserOpensAt`'s comment says why: midnight Prague is zone-independent, and a day's
  lead means "a player who opens the app once a day sees the thing coming at least once
  before it arrives". A two-hour lead quietly breaks that promise for a daily player.
  The way around: hours is what was asked for, so hours is what it takes — but the
  general default should be set to the lead the app has today, so nothing moves until
  somebody moves it, and `spec` should decide whether the figure is floored.

- **Changing the general figure moves every planned session's teaser at once.**
  Assumed intended — that is what _general_ means, and the per-session field is the way
  out. Worth confirming in `spec`, because it is retroactive by construction.

- **`cancel` already means DELETE.** The word is spoken for: `cancel_challenge_session`
  runs a `delete`, and that is the right act for an unstarted booking. Closing a live
  one early is a different act on a row with a board under it, so it gets its own verb,
  built from the column it moves (`closes_at`). Do not let the two drift into one.

- **More than one boundary to wake on.** A card can be waiting for a teaser to open, a
  session to open, or a session to close — and `use-session-card` currently reckons
  once, at read. Fixing only the teaser-to-live tick leaves the other two still needing
  a restart. `spec` should decide whether the hook re-reckons on every boundary or just
  the one asked for; doing all three is barely more work than doing one and is the
  difference between a fix and the same bug twice more.

- **Every filter toggled off.** A multi-select with nothing lit has to show something or
  say something. Cheapest honest answer: show nothing and say why, the way the list
  already has an empty state per filter.

- **A session extended past another booking of the same challenge.** The overlap rule
  (`challenge_session_clashes`) guards planning and editing; extend is a third door into
  the same column and has to go through the same check, or two sessions of one challenge
  can be made to overlap by extending rather than by editing.

- **Close-early and the podium.** A session's place "is settled the moment its window
  shuts and is paid once". Shutting a window early is still shutting it, so this should
  need no special case — but it is the one place to check that nothing keys off the
  _planned_ end rather than the actual one.

## Contract

### Domain words

**Used, and used precisely.** A **session** is one planned appearance of a challenge;
its **session board** is its standings, kept forever and reset by nothing; a **place**
on one is settled the moment its window shuts. Careful with **window**: `CLAUDE.md`
reserves it for the `from`/`until` a `ModeDefinition` carries, and a session's own pair
of instants is a **span** (`SessionSpan`) in code. This document says window in prose
and span in signatures, and they are not the same field.

**Introduced.**

- **teaser** — not new, but promoted. `teaserOpensAt` already names the face a card
  wears before its session opens; this work makes _how long it runs_ a figure. That
  figure is the **teaser**, in minutes: `teaser_minutes` on the row, `teaserMinutes` in
  code, `ANNOUNCE AHEAD` on screen. Deliberately built on the word the file already
  owns rather than on **lead** — `leader`/`leader_name`/`lead_row` already mean the top
  player on a session board, and a `lead` beside a `leader` is one letter of difference
  carrying two unrelated ideas. `CLAUDE.md`'s table gains a row.
- **closing early** — shutting a live session's window now, keeping its board.
  `close_challenge_session_early`, `closeSessionEarly`, **CLOSE EARLY**. Built from the
  column it moves (`closes_at`), which is how it stays clear of **cancel**: that word
  is spoken for and keeps meaning _delete the booking_. `CLAUDE.md` gains a row saying
  so, because the two are one keystroke apart on the same screen.
- **extending** — moving a live session's end forward. `extend_challenge_session`,
  `extendSession`, **EXTEND**, and the mark it leaves is `extended_at`. Not a
  **record**, a **medal** or a **winning**; nothing is paid and nothing is kept.

### Files

| Path                                                      | State    | Responsibility                                                                     |
| --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `supabase/migrations/20261016020000_session_controls.sql` | created  | The settings table, two columns, two new RPCs, two guards, one RPC re-signed       |
| `lib/admin/settings.ts`                                   | created  | Read and write the one general figure. Beside `features.ts` and `sessions.ts`      |
| `lib/challenge-session.ts`                                | modified | `teaserOpensAt` takes minutes; `cardSession` reads each row's own; `shownByStatus` |
| `lib/challenge-session.test.ts`                           | modified | The new arithmetic and the filter predicate                                        |
| `lib/admin/sessions.ts`                                   | modified | Two more columns on `AdminSession`; `closeSessionEarly`, `extendSession`           |
| `lib/session-board.ts`                                    | modified | `OpenSession` gains `teaserMinutes` and `extendedAt`                               |
| `hooks/use-session-card.ts`                               | modified | Re-reckon the card when a teaser's countdown arrives                               |
| `components/overlays/challenge-countdown.tsx`             | modified | An `onArrive` callback, fired once at `until`                                      |
| `components/overlays/challenge-card.tsx`                  | modified | "challenge" not "event"; the given-more-time line                                  |
| `components/overlays/admin-pills.tsx`                     | modified | An optional multi-select mode. Extended, not forked — four screens use it          |
| `components/overlays/admin-teaser-modal.tsx`              | created  | The general figure, behind the planner's cog                                       |
| `components/overlays/admin-sessions.tsx`                  | modified | Toggling chips with counts; the cog on the title row                               |
| `components/overlays/admin-session.tsx`                   | modified | The per-session field, the live form's lockdown, CLOSE EARLY and EXTEND            |
| `constants/buttons.ts`                                    | modified | Six new `ButtonId`s                                                                |
| `locales/en/messages.po`, `locales/cs/messages.po`        | modified | Extraction and Czech                                                               |
| `CLAUDE.md`                                               | modified | Three rows: teaser, closing early, extending                                       |

### Data and types

**Migration `20261016020000_session_controls.sql`.**

```sql
create table settings (
  key text primary key, int_value int not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);
insert into settings (key, int_value) values ('teaser_minutes', 2160);

alter table challenge_sessions
  add column teaser_minutes int,       -- null = use the general figure
  add column extended_at timestamptz;  -- null = never extended
```

`settings` is public-read like `challenge_sessions` — a lead time is configuration, not
a secret — with writes through `set_setting(key, int)` behind `require_admin()`.

- **2160 minutes (36 hours) is the default, and it is not a round number by accident.**
  Today's teaser opens at midnight Prague the day before, which for the noon-to-noon span
  `defaultSpan` hands out is exactly 36 hours ahead. Seeding today's effective lead means
  nothing moves on the day the migration lands.
- **Zero is allowed** (`check (teaser_minutes is null or teaser_minutes >= 0)`), and
  means no teaser at all — the card appears when the session opens. A floor would be a
  second opinion about something an admin can already see the effect of.

**New RPCs.** `close_challenge_session_early(uuid)` — admin, refuses a span that is not
live, sets `closes_at = now()`, touches `session_scores` never.
`extend_challenge_session(uuid, int)` — admin, refuses a non-live span and a
non-positive figure, **runs `challenge_session_clashes` against the new end**, then sets
`closes_at = closes_at + make_interval(mins => p_minutes)` and `extended_at = now()`.

**Guards tightened.** `cancel_challenge_session` refuses a live row, and also any row
with `session_scores` on it — the same `count(*)` guard `edit_challenge_session` already
runs before a challenge change. `edit_challenge_session` refuses a change to `mode_id`,
`opens_at` or `closes_at` on a live row; `extend` and `close early` are the only doors
into a live `closes_at`.

**`open_sessions_with_leaders` is dropped and recreated** — the precedent is
`20261014000000_session_leader_factors.sql`, which did the same to add the two factors —
returning `teaser_minutes` already resolved
(`coalesce(s.teaser_minutes, (select int_value from settings where key = 'teaser_minutes'))`)
and `extended_at`. Resolving in SQL is newly acceptable: the old rule needed a Prague day
boundary and so had to live in `lib/`, and minutes before an instant is plain arithmetic.

**Already-shipped rows:** every existing session gets `teaser_minutes = null` and
`extended_at = null`, so each resolves to 36 hours and none claims an extension.

**The push has to go first.** A client carrying this code against the old schema reads
`teaser_minutes` off a row that has no such column, and every teaser becomes `NaN`. An
old client against the new schema is fine — it ignores two extra columns. `deploy` asks
the database what is pending; this is the answer it must get before the build goes out.

**Types.** `OpenSession` and `AdminSession` each gain `teaserMinutes: number` and
`extendedAt: number | null`. `teaserOpensAt(opensAt: number, teaserMinutes: number)`
replaces the single-argument form and drops the `dayInPrague` / `previousDay` /
`startOfDayInPrague` imports. `shownByStatus(rows, enabled: ReadonlySet<SpanStatus>, now)`
is the list's pure half. `AdminSegments` gains a discriminated second mode rather than a
`multi?: boolean` beside a now-ambiguous `value`.

### The four gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Player: `challenge starts in` (replacing `event starts in`), and `given more time`. Admin, which this screen does translate — its form already says `<Trans>STARTS</Trans>`: `ANNOUNCE AHEAD`, `HOURS`, `MINUTES`, `CLOSE EARLY`, `EXTEND`, `GIVE MORE TIME`, `CLOSE THIS CHALLENGE NOW?`, `CONFIRM`. The filter pills stay untranslated, for the reason `STATUS_LABEL` already gives. |
| **How to Play** | **None.** Nothing here touches controls, targets, timers, modes, difficulty, scoring, streaks or lives. The challenges chapter says a challenge "is on for a window and then it is gone" and "the clock on the card is what is left of it" — both stay true of a window closed early or extended.                                                                                      |
| **Flag**        | **No new key.** This lands inside `challenges`, which is `hidden` in production, so the floor is already the floor.                                                                                                                                                                                                                                                                    |
| **Buttons**     | `admin.session_close_early`, `admin.session_extend`, `admin.session_extend_confirm`, `admin.session_close_confirm`, `admin.session_settings`, `admin.session_settings_save`. The chips reuse `admin.filter`.                                                                                                                                                                           |

## Acceptance criteria

1. Admin → SESSIONS shows **three loose chips**, LIVE / PLANNED / PAST, each with its
   count and air between them. ALL is gone: with toggles it was the union of the other
   three, and a pill that is the sum of its neighbours is not a filter. A segmented track
   is the shape for choosing one of several views of one thing; a set of independent
   switches should look like a set of independent switches.
2. LIVE and PLANNED are lit on arrival. Lighting PAST **adds** expired rows to the list
   without removing the others; unlighting PLANNED removes only those.
3. With all three dark the list shows its empty state rather than every row.
4. The cog on the SESSIONS title row opens a window holding ANNOUNCE AHEAD. Setting it to
   `3` there and saving makes a session with no override of its own appear on the intro
   three hours before it opens, and not before. The figure is not on the list itself.
5. A session whose own field says `1` teases one hour ahead while the general figure still
   says three — the override wins, and the general figure is unchanged by setting it.
6. On a session **anybody has scored on**, the challenge, start and end are not editable
   and SAVE is absent; calling `edit_challenge_session` on that row directly raises. A
   **live session with an empty board stays fully editable** — the lock is about the board,
   not the clock, which is what lets an admin correct a booking a minute after it opened.
   Amended 2026-10-16: the first rule keyed on liveness and silently removed two behaviours
   `supabase/tests/session_scores.sql` had asserted since session boards arrived.
   Deleting keeps the stricter rule — see criterion 7.
7. `cancel_challenge_session` raises for any session with rows in `session_scores`
   (which it already did, since `20261012000000_session_scores.sql` — only the live guard
   is new here) **and** for a live session even with an empty board. A session nobody has
   played and which is not live is still deletable in any status, so an admin who booked
   the wrong thing can still take it away. The asymmetry with criterion 6 is deliberate:
   editing an untouched booking corrects it, deleting it takes the card out from under
   whoever is looking at it.
8. CLOSE EARLY on a live session sets its end to that moment and it leaves the intro. Its
   session board afterwards holds the same rows, the same scores and the same places as
   before the press.
9. EXTEND by 1 hour 30 minutes moves the end forward ninety minutes and nothing else about
   the session changes. An extension that would overlap another session of the same
   challenge is refused with the same message planning and editing give.
10. After an extension the intro card says the challenge was given more time, for the rest
    of its window, and goes on saying it across an app restart.
11. The intro card reads `challenge`, never `event`, in English and in Czech.
12. A teaser whose countdown reaches zero becomes the live card **on that tick**, with no
    restart — and the start screen still re-renders once at that boundary rather than once
    a second, which is the thing `challenge-countdown.tsx` exists to protect.
13. `pnpm check` is green, Czech included (`i18n:verify` reports 0 missing).
14. The resolved teaser never reaches the client as `null`. `OpenSession.teaserMinutes` is
    typed `number`, and `teaserOpensAt` multiplies it — so a null arrives as `0` and turns
    every teaser off silently, with nothing raised and nothing logged. Added by `verify`
    on 2026-10-16 after confirming the RPC returns null when the `settings` row is absent.

## Tests

- **`lib/challenge-session.test.ts`** (extended) — `teaserOpensAt` as minutes before an
  instant, including `0`; `cardSession` picking a teaser by each row's own figure rather
  than one shared rule, so two sessions with different teasers tease at different times;
  `shownByStatus` over every subset of the three statuses, the empty set included.
- **`lib/admin/settings.test.ts`** (created) — only if the module gains arithmetic worth
  pinning; a thin Supabase wrapper gets none, the way `lib/admin/sessions.ts` has none.
- **No UI tests.** The toggles and the form are wiring; criterion 12 is the one piece of
  component behaviour worth a human driving it, which `verify` does.

## Review focus

1. **The once-a-second trap.** `use-session-card` must re-reckon on the countdown's
   arrival, not on its ticks. `challenge-countdown.tsx` exists _because_ a `setInterval`
   above it would wake a gradient worklet, a paging panel, a viewport measurement and four
   lists every second. An `onArrive` that is a fresh closure every render, or that lands in
   a dependency array, re-creates exactly the problem that file was written to avoid.
2. **Which boundaries wake, and which deliberately do not.** The frozen `Date.now()` in
   that hook is a decision with a reason on it — "a card that vanished under a thumb
   already travelling towards it is worse than a card that is a few minutes stale". The
   teaser→live flip changes a card's face and is safe to wake on. A live session _closing_
   makes the card vanish, and is the case that comment is about. Criterion 12 asks for the
   first only; do not quietly fix the third.
3. **Three doors into `closes_at`.** Plan, edit and now extend. `challenge_session_clashes`
   guards the first two; an extend that skips it makes overlapping sessions of one
   challenge creatable by a route the overlap rule never sees.
4. **Two opinions about `null`.** The coalesce lives in SQL and the arithmetic in `lib/`.
   If `teaserMinutes` is ever allowed to arrive null on the client as well, there will be
   two places deciding what a missing figure means — and they will disagree.
5. **The guard that preserves the mistake.** Criterion 7 tightens a button whose breadth
   was deliberate. Check the escape still exists: an admin who booked the wrong challenge,
   nobody having played it, must still be able to delete it in any status.

## Amendment — 2026-10-16, after build

Two changes to the planner's own surface, agreed before `verify` ran so that the stage
does not walk criteria against a surface already replaced.

- **The filters are loose chips, not a segmented track.** `AdminSegments` is back to the
  single-select control it was, and the toggle mode moved to `AdminPills`, which is
  already the chips-with-air shape and is what three other screens use for a row of them.
  A track is the right thing for choosing one of several views of one thing; a set of
  independent switches should look like a set of independent switches. Criterion 1 amended.
- **ANNOUNCE AHEAD moved behind a cog on the title row.** It was a labelled field above the
  list, which put a figure somebody sets once in front of the list on every open.
  `admin-teaser-field.tsx` became `admin-teaser-modal.tsx`, and commit-on-blur became a
  SAVE — a dialog is answered by answering it. Criterion 4 amended.

Nothing else in the contract moved: no schema change, no new domain word, and criteria 2,
3 and 5–13 stand exactly as agreed.
