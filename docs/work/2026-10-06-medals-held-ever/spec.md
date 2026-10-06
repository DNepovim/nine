# Medals held, ever

Slug: medals-held-ever
Stage: build
Next: /verify medals-held-ever
Track: small
Branch: feat/medals-held-ever
Started: 2026-10-06

## Problem

The profile's RECORDS HELD, EVER list only knows about all-time rank one, so a player who
has taken a board's day or its week — the thing winnings already pay them for — sees
nothing for it on their own profile. And the rows that are listed lead with a score,
which is the one figure the table above has already given them, while the board the
record was held on is spelled out in words that crowd the dates off a narrow phone.

## Appetite

**A day or two.** No schema change and no new storage. The data for every row already
exists on the server; what is missing is a way to ask for it and a row shaped to hold it.

The record run's own stats — its accuracy, its speed, how long it took — are **out**, and
with them the detail modal that would have shown them. They would need new columns
travelling `daily_scores` → `scores` → `board_reigns`, could never be filled in for a
record already set, and are not worth a week here. The rows stay inert.

## Shape

The player taps a name — a leaderboard row, the winners stripe, a multiplayer tile — and
the profile card opens as it does now: mark, name, motto, medal line, fortune, the stat
row, the per-board tables. Below those, where RECORDS HELD, EVER used to be, the heading
now reads **MEDALS HELD, EVER**, and under it is one row per stretch of holding a board —
all three board lengths, not just the all-time one.

A row is three columns. The medal comes first, and it is always 🥇: every row in this
list is rank one, because holding a board and leading it are the same fact. Then the
board as a code rather than as prose — `ACC ESY ALL`, `SPD HRD DAY`, `ACC EXT WK` — mode,
difficulty and board length in the clipped register the medal line under the title
already sets them in. Then the stretch itself, from–to: `12 AUG – 3 SEP` for something
finished, `SINCE 14 SEP` for a board still theirs, and a bare `14 SEP` where the stretch
is a single day. Nothing is tappable; the row says everything it has.

Consecutive wins on one board collapse into one stretch. A player who took Easy Accuracy
every day for three weeks held that board for three weeks, and that is one row rather
than twenty-one — which is also the only reason this list can carry day boards at all.

Areas it touches:

- **The profile screen** (`player-profile-overlay.tsx`) — the heading's words, and the
  rows fed from a list that now has three board lengths in it.
- **The row** (`profile-reign-row.tsx`) — redesigned: medal, board code, from–to. Loses
  the score column and the spelled mode.
- **Reading a profile** (`lib/player-profile.ts`) — `Reign` gains a period; the new wins
  arrive beside the reigns and sort into one list with them.
- **The modes package** — a `code` on `ModeIdentity` beside `label`, the way
  `DifficultyConfig` already pairs the two, read through a `codeOf`. This is not mode
  branching: nothing asks which mode, only what it is called short. It also retires the
  two hand-written `ACC`/`SPD` pairs in `player-profile-overlay.tsx` and
  `lib/achievements.ts`.
- **One migration** — `player_profile` gains a `wins` key: this player's day and week
  stretches, already collapsed, built on `my_winnings` so "who won a board" keeps one
  definition.
- **The copy** — `MEDALS HELD, EVER`, the two mode codes, extracted and translated.

No flag: this is an existing section of an existing screen, and there is no state in
which a player should see the old one. No How to Play change either — nothing here
touches controls, targets, timers, modes, difficulty, scoring, streaks or lives.

## In

- The heading renamed to MEDALS HELD, EVER.
- The row redesigned to medal · board code · from–to.
- Day and week stretches in the list, over all history, collapsed from consecutive wins.
- A short `code` on every mode, replacing the two copies of `ACC`/`SPD`.

## Out

- **The detail modal, and the record run's stats.** Decided above. Rows are not tappable.
- **New columns anywhere.** Nothing is added to `daily_scores`, `scores` or
  `board_reigns`, and `LocalScore` is untouched.
- **Day/week reigns as stored rows.** `board_reigns` stays all-time only. Day and week
  stretches are derived from `daily_scores` on read, which is what makes them free and
  retroactive — see the winnings migration's own argument for storing nothing.
- **Re-keying `PERIOD_CODES`.** `lib/medals.ts` keeps its `MedalPeriod` vocabulary and
  the medal line keeps using it. This list gets its own three-entry code map.
- **The medal line under the title.** It still shows one current medal per mode and is
  not touched.
- **Losing a board.** `lost-medal-line.tsx` is a different question and stays as it is.

## Rabbit holes

- **`player_profile` is restated in full by every migration that touches it**, and its
  own comments say so twice: _"start from this definition"_. The new migration must carry
  forward `motto`, `achievements`, `bestAcc`/`bestSpd`, `timeMs` and `winnings`, or it
  silently drops them. Start from `20260925020000_profile_best_factors.sql` — seven
  migrations define this function and that is the last of them, confirmed.
- **A sporadic winner does not collapse.** Someone who took a board every other day for a
  year collapses to ~180 single-day rows, not three. So the list needs a cap: keep every
  all-time stretch, then the most recent day and week ones up to a total of 20 rows. The
  collapse alone is not enough.
- **Two period vocabularies already exist** — `MedalPeriod` is `today | week | ever`,
  `WinPeriod` is `day | week`. Reusing `MedalPeriod` would mean labelling a stretch that
  ended in August with `'today'`. Use `WinPeriod | 'ever'` instead, which composes from
  what is there and reads true for a closed day.
- **Two date granularities in one column.** `board_reigns` holds `timestamptz`,
  `daily_scores` a bare `date`. They need the two different formatters that already exist
  for exactly this reason — `formatShortDate` for an instant, `formatShortDay` for a bare
  day, which is parsed by hand so it does not shift a day backwards west of Greenwich.
  Do not feed a bare day to `Date`.
- **The word "reign" widens.** It has meant all-time rank one, and the table in
  CLAUDE.md does not define it at all. If the code keeps the word for all three lengths,
  the domain table needs the line — otherwise `review` will be right to flag it.
- **Performance is probably already paid, but confirm it.** `player_profile` already
  calls `my_winnings` over all history for the sums it shows today, so the scan exists;
  collapsing is a window function over one player's rows on top of it. If that turns out
  not to hold, the cap above is the fallback.
- **Migrations are not applied by CI.** The migration has to be pushed by hand, and the
  app shipping ahead of it must read a missing `wins` key as "no wins" rather than
  failing — the shape every optional key on this response already uses.

## Tasks

- [x] `code` on `ModeIdentity`, filled in for every mode definition, exposed as `codeOf` from
      the modes package; delete the hand-written `ACC`/`SPD` maps in
      `player-profile-overlay.tsx` and `lib/achievements.ts` and read `codeOf` instead.
      — ACC/SPD/TRN/ARC; `ChallengeSpec.code` is optional and inherits from its base, as
      `gradient` and `shot` already do. `STAGE_CODE` reads `codeOf`. The profile overlay's
      `FACTOR_LABEL` was **not** replaced by `codeOf`: it labels the _factor_ a column
      measures, not the mode, and the two coincide only because both scored modes are named
      after what they measure. Re-keyed by `Headline` and read via `headlineOf` instead,
      which removes the hand-written per-mode map the task was after without teaching a
      column to print a mode's name where it means a factor.
- [x] Migration: `player_profile` restated in full, gaining a `wins` key — per-board,
      per-period collapsed stretches from `my_winnings`, each with its first and last day.
      — `20261006030000_profile_held_boards.sql`. Numbered 030000, not 020000: another
      session landed `20261006020000_weekly_recap.sql` while this was being written and two
      migrations cannot share a version. That file only creates `weekly_recap`, so neither
      clobbers the other's function. Verified on the local stack via `supabase db reset`
      plus a rolled-back transaction: 3 consecutive days collapse to one row, a gap splits
      off a second, a lone day reads `from == to`, and two adjacent Mondays collapse to a
      week stretch ending on its Sunday. No score in the payload — the row does not show
      one.
- [x] `lib/player-profile.ts`: `Reign` gains `period: WinPeriod | 'ever'` and renames its
      dates to the stretch they describe; read `wins` as optional; sort reigns and wins into
      one newest-first list and apply the 20-row cap. Unit tests for the merge, the cap and
      the single-day case.
      — `BoardPeriod = WinPeriod | 'ever'`; `tookAt`/`lostAt` → `from`/`to`; `score` dropped
      from `Reign` since no row shows it (still sent on the wire, just unread).
      `sortReigns` became `heldBoards`, which sorts _and_ caps — ordering by string compare
      rather than `Date.parse`, so the instant/bare-day mix needs no opinion about which it
      is holding. 40 tests pass, including an all-time stretch ordered against a bare day.
- [x] Redesign `profile-reign-row.tsx`: medal, board code, from–to, with the right formatter
      per period and the open stretch keeping its primary ink.
      — Three tails, not two: `SINCE 12 AUG` open, `12 AUG – 3 SEP` closed, and a bare
      `14 SEP` where a stretch began and ended the same day. `PERIOD_CODE` reads its strings
      out of `PERIOD_CODES` so the row and the medal line on the same card cannot drift.
- [x] Rename the heading to MEDALS HELD, EVER in `player-profile-overlay.tsx` and feed it the
      merged list. — Row key now includes the period, since one board can hold a day and a
      week stretch starting on the same date.
- [x] `pnpm i18n:extract`, translate the new strings into Czech, `pnpm i18n:verify`.
      — Three new strings: `MEDALS HELD, EVER` → `HISTORIE MEDAILÍ` (following the old
      `HISTORIE REKORDŮ`), `TRN` → `NOV`, `ARC` → `ARK`. `ACC`/`SPD` already existed and
      keep their `PŘES`/`RYCH`. `--clean` removed `RECORDS HELD, EVER` from both catalogs.
      The other 69 untranslated messages belong to the weekly-recap item in another
      session and were deliberately left alone.
- [x] Add the widened **reign** to CLAUDE.md's domain table. — Placed before
      **fortune**, and says explicitly that only `ever` is stored and only `ever` can be
      open.

## Acceptance criteria

1. The section heading reads MEDALS HELD, EVER (Czech translated), and no string in the
   app says RECORDS HELD, EVER.
2. A row shows, left to right: 🥇, the board code (`ACC ESY ALL` / `SPD HRD DAY` /
   `ACC EXT WK`), and the stretch. No score column, no spelled mode.
3. A profile with day or week wins lists them; one with none lists only its all-time
   stretches; one with neither draws no section at all.
4. Consecutive wins on the same board and period appear as one row spanning them. A
   single day shows one date, not a range of one day to itself.
5. An open all-time stretch reads `SINCE <date>` and keeps the primary ink; a closed one
   reads `<date> – <date>` in dim.
6. The list never exceeds 20 rows, and every all-time stretch survives the cap.
7. A build talking to a server without the `wins` key draws the all-time stretches and no
   error.
8. `pnpm check` passes, `codeOf` is the only source of a mode's short code, and no file
   outside `modes/` branches on a mode's name.

## Build notes

**What differs from the spec.**

- **`FACTOR_LABEL` was not replaced by `codeOf`.** Task 1 said to retire both
  hand-written `ACC`/`SPD` maps. `STAGE_CODE` in `lib/achievements.ts` was retired — its
  axis is literally the mode. The profile overlay's map was not: it labels the _factor_ a
  column measures, and it coincides with the mode's code only because both scored modes
  are named after the thing they measure. Pointed at `codeOf`, a third scored mode judged
  on accuracy would print its own name where the column means accuracy. Re-keyed by
  `Headline` and read through `headlineOf` instead, which removes the hand-written
  per-mode map the task was actually after. The "In" line about replacing both copies is
  satisfied in spirit, not literally.
- **The migration is `20261006030000`, not `020000`.** Another session landed
  `20261006020000_weekly_recap.sql` mid-build and two migrations cannot share a version.
  Checked that it only creates `weekly_recap`, so neither clobbers the other's function.
- **`Reign.score` was dropped rather than kept.** No row shows a score now, and an unread
  field rots. The RPC still sends it for all-time reigns — removing a key nothing reads
  would be a server change for no gain — so `PlayerProfileResponse` still declares it.

**Decisions taken at a fork.**

- `heldBoards` orders by **string compare**, not `Date.parse`. The list mixes instants
  (all-time) with bare days (day/week), and ISO 8601 sorts chronologically either way, so
  the comparison needs no opinion about which it is holding. Where a bare day ties with an
  instant on the same day the order is arbitrary — nothing records which came first.
- `PERIOD_CODE` takes its three strings **from `PERIOD_CODES`** rather than restating
  them. The medal line and this list are drawn on the same card, so they must say the same
  ALL. That also kept the spec's "no new untranslated copy" promise — `PERIOD_CODES` is
  plain strings today, and re-keying it was explicitly out of scope.
- The collapse lives in **SQL**, the cap in **TS**. The scan was already being paid for
  (`player_profile` has always called `my_winnings` over all history for the `winnings`
  sums), so collapsing is a window function over one player's rows; the cap is pure and
  belongs where it can be tested.

**Verified during the build.** The migration applies clean from scratch via
`supabase db reset`, and a rolled-back transaction on the local stack proved the collapse:
three consecutive days → one row, a gap → a second row, a lone day → `from == to`, and two
adjacent Mondays → one week stretch ending on its Sunday.

**Left undone, deliberately.** Nothing player-visible has been seen running — `verify`
owns driving the app, and that is where criteria 2–7 actually get checked. The migration
is applied **locally only**; production needs it pushed by hand (CI does not apply
migrations), and criterion 7 exists because the build can ship ahead of it.

**For `ship`: the working tree is shared.** It carries an unrelated, in-progress
weekly-recap item from another session — `lib/recap*.ts`, `lib/rng.ts`,
`components/overlays/recap-*.tsx`, `hooks/use-weekly-recap.ts`, `dev/weekly-recap/*`,
`constants/features.ts`, `constants/storage.ts`, `types/popup.ts`, `hooks/use-popup-deck.ts`,
`components/overlays/popup-card-view.tsx`, `lib/medals.ts` (`boardClaim`),
`lib/leaderboard.ts`, `lib/place-names.ts`, `machines/arcade.ts`, `dev/gallery.tsx`, and
`supabase/migrations/20261006020000_weekly_recap.sql`. None of it is mine. This item's
files are: `CLAUDE.md`, `components/overlays/player-profile-overlay.tsx`,
`components/overlays/profile-reign-row.tsx`, `lib/achievements.ts`, `lib/player-profile.ts`,
`lib/player-profile.test.ts`, `locales/*/messages.po`, `modes/**`, and
`supabase/migrations/20261006030000_profile_held_boards.sql`. The 69 untranslated Czech
messages in the catalogs are the recap item's, not this one's.
