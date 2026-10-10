# Challenge sessions

Slug: challenge-sessions
Stage: shape
Next: /spec challenge-sessions
Track: full
Branch: feat/challenge-sessions
Started: 2026-10-10

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
---

# Phase two — the challenge a player meets

Stage: shape
Next: /spec challenge-sessions

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
ever: a session *is* its own window, and the three periods are what a permanent board
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
- **Admin editing the session board.** No moderation, no removing a score.
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
  `now()` is inside the span *or* within a fixed grace past its close — longer than any
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
- **Two live sessions at once.** The planner refuses overlapping sessions of the *same*
  challenge, not of different ones. Decided: the card shows the one closing soonest,
  and nothing stacks. If two live challenges ever becomes the intention, the card
  becomes a row of cards, and that is a different shape.
- **Fortune must not move for anyone who has not played a challenge.** `lifetimeOf`
  gaining a term is a figure every player's profile recomputes. A player with no
  session rows has to come out at exactly the number they have now — the same stillness
  the podium needed when winnings arrived. One test, pinned.
