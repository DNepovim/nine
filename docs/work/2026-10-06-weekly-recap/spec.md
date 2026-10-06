# Last week in Nine

Slug: weekly-recap
Stage: build
Next: /verify weekly-recap
Track: full
Branch: feat/weekly-recap
Started: 2026-10-06

## Problem

Monday comes and the app says nothing about the week that just closed — the launch popup
only ever speaks about the player's own day, so the contest everyone was part of is
invisible to everyone who did not win a piece of it.

## Appetite

**A week.** Nothing cut: the phrasing pool ships whole, in both languages.

It is an input, not an estimate. The two places this could stop fitting are named under
Rabbit holes, and if either bites, the shape gets smaller rather than the week getting
longer.

## Shape

A player opens the app for the first time since the week turned. The launch popup resolves
the way it already does, except that `ready` now waits on three answers instead of two.
Winnings lead if there are any — the rule `usePopupDeck` already states, that what is about
the player comes first.

The next page is the recap: a violet newspaper square, **LAST WEEK IN NINE**, the window
under it as a date range, and then two or three sentences. The opener says what shape the
week had — one name took it, two split it, nobody held it, nearly nobody played. The middle
names the one board worth naming, held outright or argued over. The closer says what
happened to the all-time records, which is usually nothing.

Names are coloured apart from each other in order of appearance, boards wear their mode's
gradient read at their difficulty, a record is gold. The player dismisses the dialog as a
whole, and the week marker advances with the other two — a launch killed before the dismiss
tells them again next time.

A first-ever launch marks the week as told and stays quiet, the same rule `useWinnings` and
`useWhatsNew` both already keep: a new player should meet the game, not a report on a week
they were not here for.

### Areas

- **The database** — a new `weekly_recap(p_from, p_to)` RPC and its migration. It returns
  the six scored boards × seven days (the nickname that topped each, or nothing) and the
  all-time records whose rows moved inside the window. Built the way `past_winners` is:
  the boundaries are passed in, drawn on the Prague clock by `lib/leaderboard-period.ts`,
  because a second definition of a week in SQL is a second thing to keep in step.
- **The popup deck** — a third kind on `PopupCard`, its arm in `PopupCardView` and
  `popupAccent`, and a third hook behind `usePopupDeck` shaped like `useWinnings`: a
  `SEEN_RECAP_KEY` holding the last week already told, `ready` false until storage answers.
- **The prototype, promoted** — the composer, the phrasings, the card and the sentence
  renderer move out of `dev/` into `lib/` and `components/overlays/`. `WeekFacts` stops
  being a fixture type and becomes what the RPC returns, and `boardWeight` calls the real
  ordering in `lib/medals.ts` rather than repeating it — which its own comment already asks
  for, against the day it ships.
- **The copy** — 47 phrasings become `msg` descriptors inside a catalog path, plus the day
  names and the date range. Czech for all of it.
- **The flag** — `weeklyRecap` in `constants/features.ts`, floor `nobody` until the Czech
  lands. It gates the hook rather than the card, so a player without it makes no request.
- **The gallery** — the six dev entries keep running on `simulateWeek`. The question they
  exist to answer is whether the phrasings hold across many weeks, and production only ever
  has one.
- **How to Play** — untouched. Nothing about a run changes.

### A mode's business or the engine's?

Neither. A recap reads **boards**, and a board is a mode × difficulty pairing — it asks
`SCORED_MODES` and `DIFFICULTY_ORDER` for the six, which is asking the registry rather than
branching on a name. No new rule, no new capability, nothing added to `RunRules`.

## In

- The `weekly_recap` RPC and its migration.
- Real facts in production; `simulateWeek` stays in `dev/` and serves the gallery only.
- The prototype promoted out of `dev/`, with `boardWeight` calling the real ordering.
- The third popup card, in the order winnings → recap → news.
- The week marker, and the first-launch-stays-quiet rule.
- All 47 phrasings as descriptors, English and Czech, plus day names and the date range.
- The `weeklyRecap` flag at floor `nobody`.

## Out

Each of these is reasonable, adjacent and not happening. An unnamed exclusion gets built
by accident.

- **A recap screen.** It is one card in a dialog that already exists. No history, nowhere
  to go back to it, nothing in the menu.
- **Sharing it.** No image export and no share sheet. The pause screen's SHARE is a
  different thing and stays that way.
- **A personal recap.** The recap speaks about the boards, not to you about you — that is
  the winnings card's job. No "your week" sentence, no run stats in it.
- **Push notifications.** Nothing wakes a player on a Monday.
- **A fourth sentence.** Opener, board, record is the design. A recap that grows a
  paragraph stops being read.
- **Challenges and multiplayer.** The six scored boards are the six: a challenge keeps no
  board, and a shared run keeps no score anyone could top.
- **Backfilling.** A player away for a month gets last week, once — not four recaps. News
  catches up; a recap expires.

## Rabbit holes

1. **Czech and the possessive.** Seven of the 47 variants inflect a nickname — `{A}’s`,
   `{W}’s hands`. Czech cannot form a possessive of an arbitrary nickname, and declining
   `Mull3rm1x_` is not something anyone should attempt. **The way around:** the Czech
   variants carry the case on a generic noun beside the name — `týden patřil hráči {A}` —
   and the English pool is left exactly as it is. Decide this before translating, not
   during: it is the difference between a translation pass and a rewrite, and it is the
   likeliest thing to cost the appetite.

2. **What `scores.updated_at` cannot see.** The closing sentence is derived from rank-one
   rows whose timestamp falls inside the window. A record taken on Tuesday and beaten again
   on Friday is one fall rather than two, and a record taken inside the window and then lost
   reads as never having happened. **The way around:** accept it, and hold the copy to the
   rule `lines.ts` is already written under — a phrasing may not claim more than its shape
   proves. A records-history table for one sentence is what would blow the appetite, so it
   is not in.

3. **Seeding the phrasing.** The prototype re-rolls on every render, on purpose. A shipped
   recap must choose the same sentence every time the player reopens the dialog inside that
   week, so the seed is the window itself and nothing else. Wrong here is invisible in dev
   and obvious to the first player who dismisses and reopens.

4. **A week with nothing in it.** `empty` and `quiet` are both reachable, and both have
   copy. What is not decided is whether an `empty` week is worth opening a dialog for at
   all. **Recommendation for the spec: stay quiet and advance the marker**, the way
   `useWinnings` does when nothing was won — "nobody played" is not news to the person who
   also did not play.

5. **42 cells in one round trip.** `past_winners` runs one lateral join per window; this is
   six boards across seven days. Written the same way it is 42 of them. It wants to be one
   grouped pass over `daily_scores` — `distinct on (mode, difficulty, day)` — and that is
   cheap to write first and annoying to discover on production data.

6. **The date range.** `'22 – 28 SEPTEMBER'` is a hardcoded string in the prototype.
   Formatting a range in two languages, with the month declined in Czech — `22. – 28. září`
   — is a small piece of work that looks like none at all.

---

## Contract

### Domain words

**Used as `CLAUDE.md` already defines them.** A **board** is one mode × difficulty
pairing, i.e. one leaderboard — the recap is about six of them and never about the grid.
A **run** is not involved at all: nothing here reads a live game. **Score** keeps its
meaning — what one run was worth — and the recap never adds one up.

**Introduced.** Two, and `CLAUDE.md`'s "Other key words" table gains a row for each:

- **recap** — what last week on the boards came to, told in two or three sentences on the
  first open of a new week. One card in the launch popup, never a screen, never kept.
  `lib/recap.ts`, the `recap` feature key, `SEEN_RECAP_KEY`.
- **takeover** — an all-time board changing hands inside the window: whoever holds rank
  one on the forever board now, where they did not when the week began. `Takeover` in
  `lib/recap.ts`.

**Collisions, and how they stay apart.**

- **takeover vs record.** The closing sentence is player-facing copy and says _record_,
  because that is the word a player uses for rank one on an all-time board. The code may
  not: a **record** in this repo is a score crossing a bar mid-run, announced and then
  gone (`crossedRecords` in `lib/announcements.ts`), and a podium standing is a **medal**.
  So the copy says record, the identifiers say takeover, and this paragraph is why — the
  same arrangement `host`/`admin` already lives under. The prototype's `FallenRecord`,
  `RECORD_LINES`, `RecordKey` and the `'record'` segment kind are all renamed on the way
  out of `dev/`.
- **week shape vs `shape` the stage.** `WeekShape` and `ShapeKind` keep their names. The
  word never reaches a player, and renaming 380 tested lines to dodge a collision with a
  slash command is not worth it — but say "the week's shape" in conversation, never bare
  "the shape", inside this work.

### Files

**Created**

| Path                                                  | Responsibility                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20261006020000_weekly_recap.sql` | The `weekly_recap(p_from, p_to)` RPC. No new table and no new index — `daily_scores_board_day_idx` already serves this exact shape.              |
| `lib/rng.ts`                                          | `Rng`, `seeded`, `idSeed`, `pickFrom`. A **verbatim** move of the first three out of `machines/arcade.ts`, so arcade is bit-for-bit unchanged.   |
| `lib/rng.test.ts`                                     | Pins `seeded` and `idSeed` against fixed outputs, so the move is provably behaviour-preserving.                                                  |
| `lib/recap.ts`                                        | The composer: rows → `WeekFacts` → sentences. From `dev/weekly-recap/recap.ts`, plus `BOARDS`, the day index, `factsFromRows` and `periodLabel`. |
| `lib/recap.test.ts`                                   | From `dev/weekly-recap/recap.test.ts`, repointed and extended.                                                                                   |
| `lib/recap-lines.ts`                                  | The 47 phrasings as `msg` descriptors, the weekday and month names, and `fill`. From `dev/weekly-recap/lines.ts`.                                |
| `components/overlays/recap-card.tsx`                  | From `dev/weekly-recap/recap-card.tsx`. Resolves descriptors and composes, so a locale switch re-renders it.                                     |
| `components/overlays/recap-sentence.tsx`              | From `dev/weekly-recap/recap-sentence.tsx`, unchanged but for the segment-kind rename.                                                           |
| `hooks/use-weekly-recap.ts`                           | The marker, the flag gate and the fetch. Shaped like `useWinnings`.                                                                              |

**Modified**

| Path                                      | Change                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `types/popup.ts`                          | A third arm on `PopupCard`.                                                                                                  |
| `components/overlays/popup-card-view.tsx` | Its arm, and `popupAccent` returning `APP_VIOLET` for it.                                                                    |
| `hooks/use-popup-deck.ts`                 | A third source, between winnings and news; `ready` waits on all three.                                                       |
| `constants/storage.ts`                    | `SEEN_RECAP_KEY`.                                                                                                            |
| `constants/features.ts`                   | `'recap'`.                                                                                                                   |
| `lib/leaderboard.ts`                      | `fetchWeeklyRecap(range)` — the request and the row type only; the rows become facts in `lib/recap.ts`.                      |
| `lib/medals.ts`                           | Export the board ordering so the recap's tiebreak calls it instead of repeating it, which `recap.ts`'s own comment asks for. |
| `machines/arcade.ts`                      | Imports `seeded`/`idSeed`/`Rng` from `lib/rng.ts` rather than declaring them.                                                |
| `lib/place-names.ts`                      | Drops its local `Rng` alias for the shared one.                                                                              |
| `dev/weekly-recap/facts.ts`               | Keeps `simulateWeek`, `POOLS`, `PLAYERS`; everything else moves to `lib/`. Still dev-only, still the gallery's source.       |
| `dev/gallery.tsx`                         | Import paths only.                                                                                                           |
| `CLAUDE.md`                               | Two rows: **recap**, **takeover**.                                                                                           |

### Data and types

```ts
// lib/recap.ts — what the RPC says, once it is rows no more.
type WeekFacts = {
  // [dayIndex 0..6 from Monday][boardIndex into BOARDS] — who topped it, or null.
  cells: readonly (readonly (string | null)[])[]
  takeovers: readonly Takeover[]
}
type Takeover =
  | { board: Board; boardIndex: number; dayIndex: number; nickname: string }

  // types/popup.ts — the third arm. Facts rather than sentences: the card composes, so a
  // locale switch re-renders it instead of leaving whichever language it was built in.
  | { kind: 'recap'; facts: WeekFacts; from: string; to: string }
```

`composeRecap(facts, weekStart, t)` takes a descriptor resolver as its third argument.
That is what keeps it pure — the same week, the same Monday and the same locale always
give the same paragraph — and what lets the test pass an English resolver and the card
pass Lingui's.

**The seed is the window's Monday and nothing else.** Not the render, not the facts'
identity, not the clock.

**Storage.** `SEEN_RECAP_KEY = 'nine.seen-recap.v1'`, holding the Monday of the last week
already told, as an ISO day. A new key, so nothing migrates; absent means a first-ever
launch. The window itself is `previousWeek(todayISO())` from `lib/leaderboard-period.ts`,
which already exists and already means Monday-to-Sunday on the Prague clock — nothing here
computes a week by subtracting seven days.

**Schema.** One migration, one function, no table and no column. Already-shipped rows do
nothing on the day it lands: it reads `daily_scores`, `scores` and `profiles` and writes
nothing.

```sql
create or replace function weekly_recap(p_from date, p_to date)
returns table (kind text, mode text, difficulty text, day date, nickname text)
```

- `kind = 'cell'` — one row per (mode, difficulty, day) that anybody topped, by the rule
  `past_winners` and `my_winnings` already encode: highest `best_score` in the day, ties to
  the earliest `updated_at`, no zeros, no nickname no board. One `distinct on (mode,
difficulty, day)` pass over the window, not forty-two lateral joins.
- `kind = 'takeover'` — one row per board whose current rank-one row on `scores` has an
  `updated_at` falling inside the window. `day` is that timestamp read as a Prague
  calendar day, which is the one thing in this work SQL has to draw: `daily_scores.day` is
  stamped by the client, `scores.updated_at` is not. It uses `at time zone 'Europe/Prague'`
  rather than re-deriving the rule, so there is still only one definition of when a Prague
  day turns — the IANA zone and `lib/leaderboard-period.ts` are the same rule, written once
  each in the only form their language offers.

**The code cannot run against the old schema**, so the migration is pushed before the
build that calls it. The failure if it is not is the designed one — a failed read is not an
empty week, the hook leaves the marker alone and shows nothing — and the `recap` floor is
`nobody` regardless, so no player is in a position to notice either way.

### Copy, and the gates

**Copy / i18n.** Everything below becomes a `msg` descriptor in `lib/recap-lines.ts` or the
card, and gets Czech. `lib/` is already a catalog path.

| What                   | Count | Note                                                                                                                                       |
| ---------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Headline variants      |    27 | Eight pools, one per opener shape.                                                                                                         |
| Board-line variants    |    11 | Four pools.                                                                                                                                |
| Takeover-line variants |     9 | Three pools.                                                                                                                               |
| Weekday names          |     7 | Monday–Sunday, named in the prose.                                                                                                         |
| Month names            |    12 | For the window label.                                                                                                                      |
| Window label           |     2 | One month — "22 – 28 SEPTEMBER"; two — "29 SEPTEMBER – 5 OCTOBER".                                                                         |
| Card title             |     1 | LAST WEEK IN NINE.                                                                                                                         |
| **Board names**        |     0 | Already translated: `labelOf(mode)` and `DIFFICULTIES[d].label`. The prototype's `.toUpperCase()` on the raw id does not survive the move. |

Two rules the Czech is written under, both decided here rather than during translation:

1. **No variant may inflect a nickname.** Czech cannot form a possessive of `Mull3rm1x_`.
   Seven English variants do (`{A}’s`, `{W}’s hands`); the English pool keeps them, and the
   Czech variants carry the case on a noun beside the name — `patřil hráči {A}`.
2. **A Czech variant must read correctly for every value its placeholders can take.** The
   templates are filled by splitting on `[A]`-style tokens, not by ICU interpolation —
   deliberately, because three segments in a sentence are coloured and ICU returns a flat
   string — so there is no `plural` to lean on. The translator restructures instead
   (`{P} z 7 dnů` rather than `{P} dny`). The ranges each placeholder can take are
   documented beside the pools: day counts 1–7, player counts 2–5, takeover counts 2–6.

The token syntax changes from `{A}` to `[A]` on the way out of `dev/`: `{A}` is ICU's own
placeholder syntax, and a message whose text contains one is at the mercy of the formatter
that resolves it.

**How to Play.** None. Nothing about controls, targets, timers, modes, difficulty, scoring,
streaks or lives changes — the recap reads boards that already exist and alters no run.

**Flag.** `recap` in `constants/features.ts`, floor **`nobody`** until the Czech lands. It
gates the hook, not the card: a player who cannot see it must not fire the request.

**Buttons.** None. The recap is a page inside a dialog that already owns its pressables
(`news.action`, `news.dismiss`).

## Acceptance criteria

1. With the `recap` feature off, a launch fires no `weekly_recap` request and the launch
   popup shows exactly the pages it shows today.
2. Feature on, `SEEN_RECAP_KEY` absent: no recap card appears, and the key is written with
   the Monday of the week that has just closed.
3. Feature on, marker older than last week's Monday: the popup's pages run winnings (if
   any), then the recap, then news — in that order — and the dots and BACK arrow tint
   `APP_VIOLET` while the recap is the page on screen.
4. The card reads LAST WEEK IN NINE over the window: `22 – 28 SEPTEMBER` when the week sits
   inside one month, `29 SEPTEMBER – 5 OCTOBER` when it crosses one. In Czech,
   `22. – 28. září`.
5. Dismissing the dialog writes last week's Monday to `SEEN_RECAP_KEY`. A launch killed
   before the dismiss shows the same recap again next time, and the marker is unmoved.
6. Reopening the dialog — and relaunching the app — inside the same week shows the **same**
   phrasings, every time. Switching language keeps the same variant and changes only its
   language.
7. A window in which no board was topped on any day produces no recap card, and the marker
   still advances. `composeRecap` can still build that week's paragraph — the gallery's
   `empty` entry still shows it — the decision not to show it lives in the hook.
8. `select * from weekly_recap('2026-09-21', '2026-09-27')` returns at most one `cell` row
   per (mode, difficulty, day), naming the nickname that topped it, and one `takeover` row
   per board whose current all-time leader took it inside that window. A player with no
   nickname, and a `best_score` of zero, appear in neither.
9. Board names in the prose are the translated labels — `labelOf(mode)` and
   `DIFFICULTIES[difficulty].label` — so the Czech recap names Czech difficulties. No raw
   mode or difficulty id reaches a sentence.
10. No Czech variant inflects a nickname, and every one reads correctly across the full
    range its placeholders take. Amended during build to the ranges the code actually
    produces, which the spec had estimated: day counts 1–7, player counts 3–7 in
    `scattered` and 4–7 in `contested`, takeover counts 2–6. The ranges are documented
    beside the pools in `lib/recap-lines.ts`.
11. A given arcade seed grows the same map after the RNG move as before it.
12. `pnpm check` is green, `pnpm i18n:verify` included.

## Tests

| File                      | Covers                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/rng.test.ts`         | **New.** `seeded` and `idSeed` against fixed expected outputs, so the move out of `machines/arcade.ts` cannot silently change what arcade grows.                                                                                                                                                                                                                                                                           |
| `lib/recap.test.ts`       | **Moved and extended.** Everything the prototype's test already covers — day winners, the seven week shapes, no unfilled placeholder, determinism, name colours — plus: `factsFromRows` builds the right cells and drops a row whose mode or difficulty the app does not recognise; `periodLabel` across a month boundary and a year boundary; the no-unfilled-placeholder sweep run against **Czech** as well as English. |
| `machines/arcade.test.ts` | Untouched, and that is the point — it must pass unchanged after the RNG move.                                                                                                                                                                                                                                                                                                                                              |

No test for `hooks/use-weekly-recap.ts` or the two components: the hook is a storage read
and a fetch with the same shape as `useWinnings`, which has none either, and the cards are
presentation. Criteria 1–7 are walked in the real app by `verify`.

## Review focus

1. **The RNG move must be a move.** `lib/rng.ts` has to be `machines/arcade.ts`'s
   implementation verbatim. A re-typed LCG with a different constant passes every recap
   test and silently regenerates every arcade map in existence. The diff should read as a
   cut-and-paste, and `lib/rng.test.ts` is what proves it.
2. **What the phrasing is seeded on.** The seed is the window's Monday. Anything that
   changes per render in the memo's dependency list — a fresh `t`, a new `facts` identity
   out of a hook that rebuilds its array — re-rolls the sentence between a dismiss and a
   reopen, which is invisible in dev and the first thing a player notices.
3. **`fill()` runs over translated text.** A Czech variant that drops a placeholder loses
   the sentence's subject silently; one that adds a placeholder the composer does not
   supply loses a word. The sweep that asserts nothing is left unfilled has to run over the
   Czech catalog, not only the English source.
4. **The flag gates the hook.** Gating only the card still fires the RPC on every launch
   for every player who will never see it.
5. **One definition of the week.** `previousWeek` already is the window. A second
   derivation anywhere here — minus-seven-days in the hook, `date_trunc` recomputed in the
   migration against bounds that were passed in — is exactly what `past_winners` and
   `my_winnings` both wrote comments to prevent.
