# Winnings — Design

Date: 2026-09-23

## Goal

Taking a board for a day, or for a week, pays. The score you won it with is weighted by
the board's difficulty and added to your rating — so a player who keeps turning up and
keeps winning climbs, and a player who set one enormous score in July does not climb
again for it.

Today a rating answers one question: everything you have ever scored, weighted by where
you scored it. It is a measure of volume. Nothing in the app rewards _beating the people
you are playing against_ — the boards say who is ahead right now, and the moment a day
rolls over that fact is gone. Winnings are what is left of it.

## Domain language

**winnings** — the value a player accumulates by taking a board's day or week. Permanent,
accumulating, and taken from the other players by outscoring them in a closed window.

It is a fourth thing, distinct from the three the app already spends words on:

|                 | what it is                                              | losable |
| --------------- | ------------------------------------------------------- | ------- |
| **record**      | a score crossing a bar, announced mid-run and then gone | —       |
| **medal**       | a podium standing on a board, right now                 | yes     |
| **achievement** | achieved once, measured against your own history        | no      |
| **winnings**    | paid for taking a closed day or week off everyone else  | no      |

A medal is the closest relative and the one to keep it away from: a medal is a standing
you hold _now_ and can lose tomorrow. Winnings are paid once for a window that has shut
and cannot reopen. Nobody takes winnings back.

**award** — one payment, for one board, for one window. Winnings are the sum of awards.

**closed window** — a day before today, or a Monday-to-Sunday week before this one, on
the Prague clock. A window still open pays nothing, because nobody has won it yet.

## The rule

An award is the winning score, weighted by the board's difficulty:

```
award(day)  = winning score × scoreWeight[difficulty] × ½
award(week) = winning score × scoreWeight[difficulty]
```

`scoreWeight` is the weighting the app already has, in `machines/modes.ts`:

|               | easy | hard | extreme |
| ------------- | ---- | ---- | ------- |
| `scoreWeight` | 0.5  | 1    | 2       |
| a day pays    | 0.25 | 0.5  | 1       |
| a week pays   | 0.5  | 1    | 2       |

**One rule, defined once.** A second table of factors was considered and rejected: the
profile modal renders the weighting on screen as `ESY ×0.5 · HRD ×1 · EXT ×2`, and
`modes.ts` states it as "Hard counts for itself, Easy at half and Extreme at double — a
×4 spread, and a rule short enough to say out loud". A near-identical second weighting
that differed only on Easy would make both of those half-true.

A week is won with one of your own day scores, so winning a board's day _and_ its week
pays for both — ×1 and then ×2 on Extreme, off the same number. That is intended: the
week is a separate thing to win.

### Who won a board

Exactly the rule `past_winners` already encodes, and for the same reasons:

- the highest `best_score` in `daily_scores` for that board within the window
- ties to whoever reached it first (`updated_at asc`)
- `best_score > 0` — a zero is not a result; the first submit on a board writes a row
  regardless, and an empty window would otherwise pay whoever touched it last
- the player must have a nickname — a player without one is not on the board at all, so
  they cannot have won it

A period board ranks each player's best day in the window, so the top single day in a
week belongs to whoever leads that week. No aggregation is needed to find it.

## Data model

**Nothing is stored.** There is no `winnings` column, no nightly job, and no backfill.

`daily_scores` already holds every fact an award depends on, and a closed day never
changes — the client stamps `day` from the Prague clock at submit time, and no code path
writes to a past day. So winnings are a pure function of a table that is already there.

This follows the precedent `lifetimeOf` sets in `lib/player-profile.ts`: _"Derived rather
than stored — a seventh row holding the same fact is a seventh chance to disagree with
it."_ Deriving buys four things:

- no scheduled job that must never run twice and never miss a night
- no possibility of the number disagreeing with the boards it is computed from
- every past day anyone has ever won counts from the first deploy, with no migration
- nothing to repair if the rule changes — change the weight, and every figure follows

The cost is that the total is recomputed per read. At the current size of `daily_scores`
that is nothing. If it ever stops being nothing, a materialised view refreshed nightly is
a later optimisation behind the same RPC, not a change to this design.

### Index

`daily_scores` has only its primary key, `(user_id, mode, difficulty, day)` — which leads
on the player and cannot serve a query that groups by board and day across everyone. Both
reads below need:

```sql
create index daily_scores_board_day_idx
  on daily_scores (mode, difficulty, day, best_score desc, updated_at asc);
```

`past_winners` runs the same query shape over two windows and has been doing it without
this index; winnings run it over all history, which is what makes it worth adding.

## Reading it

### The weights stay out of SQL

Neither RPC knows what a difficulty is worth. Both return **raw winning scores**, and the
client applies `DIFFICULTIES[d].scoreWeight`.

This is the whole reason the shape is what it is. Putting `case difficulty when 'easy'
then 0.5 ...` in a function would be a second definition of the app's difficulty
weighting, in a second language, that nothing would keep in step with `modes.ts`. The
server knows who won what; the app knows what winning is worth.

### `my_winnings` — what to announce

```sql
create or replace function my_winnings(
  p_user_id  uuid,
  p_from_day date,  -- first day not yet announced, inclusive
  p_today    date   -- today on the Prague clock; only windows closed before it count
) returns table (
  period     text,  -- 'day' | 'week'
  mode       text,
  difficulty text,
  won_on     date,  -- the day won, or the Monday of the week won
  best_score int
)
```

Two halves, unioned:

- **days** — `distinct on (mode, difficulty, day)` over `daily_scores` for
  `day >= p_from_day and day < p_today`, ordered `best_score desc, updated_at asc`,
  filtered to `p_user_id`.
- **weeks** — `generate_series` over the Mondays from `date_trunc('week', p_from_day)` to
  `date_trunc('week', p_today) - 7`, and for each, `distinct on (mode, difficulty)` over
  its seven days. `date_trunc('week', ...)` is Monday in Postgres, which is what
  `weekStart` in `lib/leaderboard-period.ts` also means.

Boundaries are passed in rather than computed in SQL, for the reason `past_winners` and
`my_medals` both already pass theirs: the app draws them on the Prague clock, and a
second definition in SQL is a second thing to keep in step.

### `player_profile` — the running total

The existing RPC gains one key, per board, so the client can weight it:

```json
"winnings": [
  { "mode": "speed", "difficulty": "extreme", "daySum": 402193, "weekSum": 93657 }
]
```

`daySum` is the sum of every winning score for days this player took on that board, over
all history; `weekSum` the same for weeks. The client computes:

```
winnings = Σ boards (daySum × w/2 + weekSum × w)   where w = scoreWeight[difficulty]
```

Read as optional on the client — `winnings?: Board[]` — following `achievements?: number`
and `timeMs?: number` in `PlayerProfileResponse`, so a device talking to a server that
predates this draws a profile without winnings rather than failing to draw one.

## Folding into the rating

`Lifetime.rating` becomes scored-and-weighted **plus** winnings, and stays the single
headline figure under the player's name.

```ts
rating = Σ boards (scoreSum × w) + Σ boards (daySum × w/2 + weekSum × w)
```

Rounded once at the end, as it already is — a half-weighted odd score lands on a half
point, and rounding the parts before adding them is how a total comes to be three off the
sum of its pieces.

**This has a cost, and it is the weakest point in this design.** Two things in
`lib/player-profile.ts` and `components/overlays/player-profile-overlay.tsx` stop being
true and must be rewritten rather than left:

- the comment on `Lifetime.rating` — _"the same points weighted by the difficulty they
  were scored on"_ — which will no longer describe the figure
- the on-screen legend `ESY ×0.5 · HRD ×1 · EXT ×2`, which will explain how the weighting
  works but no longer account for the whole number

The alternative — a second headline figure beside RATING — keeps both true at the cost of
a second number on a modal that is already dense. Folding was chosen deliberately; the
legend gains a line saying that days and weeks won pay into the same figure.

`ratingOf(score, difficulty)` — the per-run line on the game over screen — is untouched.
A run is not a window, and nothing about one run is winnings.

## The modal

### What it says

The boards won since the player last looked, grouped by window, with what each paid and
the rating it paid into.

```
 📈  YOU WON

 YESTERDAY
   SPEED · EXTREME     31,219   +31,219
   ACCURACY · HARD      9,404    +4,702

 LAST WEEK
   SPEED · EXTREME     31,219   +62,438

 RATING                        597,100
```

Boards carry their own colour, the way they do everywhere — the mode gradient read at the
board's difficulty. The award is the figure that matters and is set beside the score it
came from, so the weighting is visible rather than asserted.

### When

On app open, as a card in the What's New popup. Not its own dialog: a Monday would
otherwise stack this, a release and the weekly recap into three modals before the player
reaches the intro.

### Everything missed, not only yesterday

The announcement covers every window closed since the marker, not just the previous day.
A player who skips three days would otherwise never hear about two of them, and the popup
already promises exactly this behaviour for releases — _"Been away a while? You'll see
everything you missed, oldest first."_

### Seen state

`SEEN_WINNINGS_KEY = 'nine.seen-winnings.v1'` in `constants/storage.ts`, holding **the
last day already announced**, as an ISO day string.

The marker is a day already covered, so `p_from_day` is the day _after_ it — `previousDay`
in reverse, which `lib/leaderboard-period.ts` does not have and which
`lib/winnings-announcement.ts` adds beside its window math. Getting this wrong in either
direction is a bug a player would see: one day off one way re-announces yesterday every
launch, one day off the other silently swallows a win.

What gets stored after announcing is **yesterday**, never today. Only windows that closed
before today pay, so yesterday is the last day that could have been announced; storing
today would skip today's own day-window once it closes tonight.

- **absent** — a first-ever launch. Store yesterday and stay quiet, the rule
  `use-whats-new.ts` already applies: a new player should meet the game, not a ledger of
  days they were not here for.
- **present** — announce every window from the day after the marker up to yesterday
  inclusive, then store yesterday.
- **same day, second launch** — the marker is already yesterday, so the range is empty and
  nothing is shown.
- **storage unavailable** — stay quiet and store nothing. Announcing something that
  cannot be recorded as seen would repeat it on every launch.

### Client modules

- `lib/winnings.ts` — the factors and `awardFor`, pure.
- `lib/winnings-announcement.ts` — the window arithmetic between a marker and today, and
  the grouping of awarded rows into the modal's YESTERDAY / LAST WEEK blocks.
- `hooks/use-winnings.ts` — reads the marker, calls `my_winnings`, writes the marker back.

Local rather than server-side, matching `SEEN_NEWS_KEY`. The cost is that a reinstall
loses the marker and the player is treated as new, missing one announcement. The winnings
themselves are on the server and unaffected — only the telling is lost.

## The popup becomes a deck

`WhatsNewOverlay` takes `items: readonly NewsItem[]` today. It becomes a discriminated
union so one dialog can page through cards of different kinds:

```ts
type PopupCard =
  | { kind: 'winnings'; awards: Award[]; rating: number }
  | { kind: 'news'; item: NewsItem }
  | { kind: 'recap'; sentences: Sentence[] }
```

Order: **winnings** first — it is about the player, and it expires — then **releases**,
then the **weekly recap**. This is a real refactor of `whats-new-overlay.tsx` and
`use-whats-new.ts`, not a new card file dropped beside them: the seen-state, the page
dots and the BACK/NEXT footer all currently assume one homogeneous list.

## Testing

Pure logic, colocated, as everything in `lib/` is:

- `lib/winnings.ts` — `awardFor(score, difficulty, period)` at every difficulty for both
  periods; that a day pays exactly half its week; the total over a mixed board set;
  rounding once at the end rather than per board.
- `lib/player-profile.test.ts` — extended: a rating with winnings folded in; a profile
  from a server that sends no `winnings` key at all reading as zero, not as broken.
- `lib/winnings-announcement.ts` — which windows fall between a marker and today: a
  marker of yesterday yielding nothing, a marker several weeks back yielding every day
  and every whole week between, a marker mid-week not re-announcing the week that closed
  before it, and the day-after-marker boundary in both directions.

SQL is exercised through `supabase/seed.sql`: a seeded week with a known winner per board,
asserted against the figures the client computes from it.

The modal and the deck refactor are UI and get no tests, per the existing rule — but both
get gallery entries in `dev/gallery.tsx`, beside the weekly recap ones, so every card
kind and an empty week can be looked at.

## Risks

**Concentration.** Only winners are paid, so on a five-player roster the two who win
accumulate everything and the other three sit at zero permanently — and because history
counts, that is true from the first deploy rather than building up over weeks. Nothing
here softens it; it is inherent in the rule. Worth seeing on real data before shipping.

**Extreme dominates.** An Extreme day pays ×1 against an Easy day's ×0.25, and Extreme
scores are larger to begin with, so the two effects multiply. The rating becomes largely
an Extreme rating. This is the existing `scoreWeight` intent, taken further than it goes
today.

**The legend is no longer the whole story.** Covered above; the mitigation is copy, not
code.

## Out of scope

- A winnings leaderboard. The figure surfaces only inside RATING on the profile modal.
- Any stored column, cron job or backfill.
- Per-run winnings, or winnings for anything but a day or a week.
- Multiplayer, which submits nothing to the server and has no boards to win.
- Trainee, which has no board and no difficulty.

## Rollout

One migration: the index, `my_winnings`, and `player_profile` gaining its `winnings` key.
All additive — the new key is read optionally, so an old client against the new server is
unaffected, and a new client against an old server shows a rating without winnings rather
than failing.

No storage migration, because nothing is stored. Reverting is dropping the function and
the key; no player's data is touched either way.
