# Winnings you accept, and a podium that pays

Slug: claimed-winnings
Stage: shipped
Next: /deploy — on `main`, not live
Track: full
Branch: feat/claimed-winnings
Started: 2026-10-09

## Problem

Two complaints, one mechanism under both.

Winnings arrive as a fact already settled. By the time the card says a reward was added to
the fortune, it was added — days ago, by a server summing a table nobody pressed anything
to. The one moment in the app that pays for beating other people is the one moment the
player has no part in, and the only button on it says LET'S GO.

And only the winner is paid. A board's day pays rank one and nobody else, so second place
on a board six people played gets exactly what last place gets. The profile shows a player
their medals three steps deep; the money knows one step.

## Appetite

**A day or two.** One date on `profiles` and the migration that backfills it, `my_winnings`
returning a podium instead of a winner, one new factor beside the two that already weight a
reward, the deck's button learning a second label, the prose learning second and third
place, Czech, and tests over the arithmetic and the range.

Explicitly not a ledger. No table of pending rewards, no ACCEPT ALL over an absence, no
reward accepted out of order. If the shape stops fitting the appetite, the **podium is the
half that ships second** — the button is the part that changes what winnings are, and the
podium only changes who they pay.

## Shape

A player comes back the morning after a day that went well. The launch popup opens on its
winnings page, as it does now: YOU WON, a sentence per window, each board in its mode's
gradient at its difficulty. Two things have changed on it.

The sentences now say which step of the podium each board gave them — took it, came second
on it, came third on it — and the figure at the foot is no longer a report. Where it said
ADDED TO YOUR FORTUNE it says the figure IS WAITING FOR YOU — and the figure itself is now
set like the figure the page is about — `TYPE.figureLarge`, in `--color-fortune`.
The dialog's own primary button, which would have read NEXT, reads CLAIM. The heading over
all of it asks WHAT DID YOU PULL OFF?, so the card needs no title of its own and has none.

They press it. The day their winnings are paid through moves to yesterday, their fortune is
that much larger the next time the profile is read, and the page advances to the recap or
the release notes queued behind it. There is no way past the page without pressing: the
dialog has no close button and no backdrop dismiss, and winnings are always the deck's
first page.

Suppose instead they kill the app on that page. The next launch offers the same reward
again, because nothing moved — which is what happens today, for the same reason.

Suppose they reinstall, or move the profile to a new phone. The device has forgotten
everything; the profile has not. The launch asks what day their winnings are paid through
and offers everything since, so the reward is still there to accept. This is the one place
the shape departs from what was decided before shaping started — once the paid-through day
is on the server, which it must be for the fortune to be computed there, letting a wiped
device forfeit a reward the server can still name would be throwing money away for nothing.

Later in the week they open the app having come second on Accuracy Hard rather than first.
It pays: half of what that window's gold paid, reckoned on their own score rather than the
winner's. Third pays a tenth. A day is still half a week and Easy still halves where
Extreme doubles — the podium share multiplies those rather than replacing them.

### Areas

- **The schema** — one date on `profiles`: the day this player's winnings are paid through.
  Backfilled to yesterday for every existing row, which is what "no fortune moves" means in
  practice. There is no epoch constant anywhere; each player's backfilled watermark _is_
  the epoch. `player_profile` then sums winnings up to that day instead of up to today.
- **`my_winnings`** — returns a window's top three rather than its winner, each with its
  rank and the player's own score. The `distinct on` becomes a ranked window cut at three.
- **The weighting** — `winFactor` takes a rank, and a podium share sits beside the period
  share it already multiplies. One new factor in one place, so the profile's
  ESY ×0.5 · HRD ×1 · EXT ×2 legend stays as true as it is now.
- **The launch read** — `useWinnings` stops being paced by the local key alone. The span
  starts the day after the server's paid-through day; the local key survives with a smaller
  job, remembering what has already been _asked_ about so a player who never wins is not
  re-querying all of history every launch. Accepting is the only thing that moves the
  watermark, and the first write on this whole path.
- **The dialog** — the deck's primary button takes its label and its action from the page
  when the page wants to own them. One prop on a footer that already exists, not a second
  button on the card and not a second dialog.
- **The copy** — second and third place, the footer's new caption, the button's label, all
  as descriptors with Czech beside them.
- **Not touched** — `past_winners`, `my_medals`, `board_reigns`, the recap, achievements,
  and every mode, rule and capability in `modes/`.

### A mode's business or the engine's?

Neither. Winnings are about boards, not runs: nothing here reaches `modes/`, reads a mode's
name, or touches `RunRules`. The one list it reads is `SCORED_MODES`, which is already
where "which boards exist" lives.

### Does it need a flag?

No. Winnings have no key in `constants/features.ts` and ship to everyone, and this changes
a card players already see rather than opening a door. A flag would also be a lie about the
money — switched off mid-week it would leave a watermark behind that nothing moves, and a
player's fortune would quietly stop growing.

### The word

`claim` is spoken for: `toMedals` keeps a player's best **claim** per mode, and CLAUDE.md
says so explicitly. Neither the column nor the copy may use it. This shape proposes **paid
through** for the watermark, **accept** for the verb the player reads, and **podium** for
the three steps a closed window now pays. Agreeing those three — and deciding whether
CLAUDE.md's domain table gains a row for any of them — is `spec`'s first job.

## In

- A server-side **paid through** date per profile, backfilled so no existing fortune moves.
- The fortune counting only winnings paid through that day.
- CLAIM on the deck's own button, as the only way off the page. The figure stays on the
  card rather than being printed twice.
- Silver at half and bronze at a tenth of the same window's gold, on the player's own score.
- The card's prose saying which step of the podium each board gave.
- A fresh or restored device reading the paid-through day from the server, so nothing is
  forfeit by a wiped key.
- Czech for every new string, and tests over the new factor and the new range.

## Out

- **A per-window ledger.** No pending table, no ACCEPT ALL, nothing accepted out of order.
- **A counting-up animation.** The figure rides the button and lands in the fortune; it
  does not tick up on screen. Named because it is the obvious next thing to want.
- **Paying below third.** Fourth is not a step of a podium.
- **Changing what a medal is.** MEDALS and reigns on the profile are standings, not
  payments, and keep their own rules and their own gold.
- **Retrospective podium money.** The podium pays windows that close after this ships, for
  the same reason the button does — backfilling every second place in history would move
  exactly the fortunes we just promised not to move.
- **A reward on the game over screen.** Winnings stay something you come back to.
- **Telling the player a reward is waiting.** No notification, no badge on the intro.

## Rabbit holes

- **The backfill is the whole promise.** One statement in the migration stands between
  "nobody's fortune moves" and every existing player watching their fortune fall to their
  scored points alone. A null watermark has to mean _nothing paid yet_ so a new profile is
  right, which is also what a missed backfill would look like — loudly wrong rather than
  quietly wrong, which is the better failure, but it is a migration to get right once.
- **Accepting is a write, and everything else here is a read.** `my_winnings` and
  `player_profile` are `stable` security definers. Moving a watermark is the first mutation
  on this path, so it wants its own function, its own grant, and one rule: a player may
  move only their own, and only forwards. Backwards pays a window twice.
- **The figure on the button must equal what the fortune gains.** They are two
  computations over the same rows — the card's `totalAwards` and the profile's
  `winningsValue` — and the existing code only agrees because both round once at the end.
  A podium share of 0.1 puts tenths into sums that used to land on halves, so the
  round-once rule gets stricter, not looser. A point out and the player watches the number
  lie to them.
- **A quiet player's span only grows.** With the paid-through day as the floor, someone who
  never wins is asking about a wider range every launch. The local asked-through key is the
  brake. If `spec` would rather move the watermark over an empty span instead, that is a
  second write on a path that wanted one, and the decision belongs there.
- **Two sentence shapes become six.** Day and week, times gold, silver and bronze. The
  prose was written when a win had one shape. If the phrasings start to multiply, the
  podium step belongs inside the clause rather than in a sentence of its own — cheaper to
  decide while writing the copy than after the Czech exists.
- **Paid through is a date.** Every bound in this corner is drawn on the Prague clock by
  the app and passed into SQL, deliberately, so there is one definition. A watermark
  written from any other clock is a day of money, in one direction or the other.

---

## Contract

### Domain words

**Used as CLAUDE.md already defines them.** **fortune** (what a career comes to, and the
only figure this work moves), **board** (one mode × difficulty), **winnings** (what taking
a board's day or week pays), **medal** (a losable standing — _not_ what is being paid
here), **record**, **achievement**, **run**. A **window** is a day or a week of a board;
`WinPeriod` already names the two.

**Introduced — three, and `CLAUDE.md`'s table gains a row for each.**

- **podium** — the three places a closed window pays: first, second and third, at 1, ½ and
  ⅒ of the same window's gold. `WinRank` and `PODIUM_SHARE` in `lib/winnings.ts`. The
  _medal_ words gold / silver / bronze stay player-facing and stay out of the code, where
  they would read as the standings on the profile rather than as a payment for a window
  that has shut.
- **paid through** — the last day whose winnings are in a player's fortune. One date per
  player, `winnings_paid.paid_through`. Moves forward only, and only when a player accepts.
- **accept** — what the player does to turn winnings into fortune. The verb in code
  throughout: `accept_winnings`, `useWinnings().accept`, `paid_through`. The **button says
  CLAIM**, which is the word a player uses for taking a reward — the same split the repo
  already runs between host/guest and `admin`, and between a takeover and a record. The
  code may not say claim, because `toMedals` means something else by it.

**Collisions, and how they stay apart.**

- **`claim`** is spoken for: `toMedals` keeps a player's best _claim_ per mode, and
  CLAUDE.md says so. It appears nowhere in this work — not the column, not the function,
  not the copy, not a variable. `accept` is the verb; `paid through` is the state.
- **gold / silver / bronze** already colour the profile's medals. On this path they are
  player-facing words only; the code says rank 1, 2, 3.
- **podium** vs **medal**: a podium is the three steps of one _closed_ window and is paid
  once; a medal is a standing on an _open_ board and can be taken back. `heldMedals` keeps
  its own podium rule for standings and is not touched.

### Files

**Created**

| Path                                                       | Responsibility                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261009120000_winnings_accepted.sql` | The `winnings_paid` table and its backfill; `my_winnings` gaining ranks and a podium floor; `my_unpaid_winnings`; `accept_winnings`; `player_profile` summing to the watermark. |

**Modified**

| Path                                               | What changes                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/winnings.ts`                                  | `WinRank`, `PODIUM_SHARE`, `winFactor` taking a rank, `rank` on `Award`, `BoardWinnings` becoming one row per board × period × rank. |
| `lib/winnings.test.ts`                             | The podium share, and that a sum is rounded once.                                                                                    |
| `lib/winnings-announcement.ts`                     | A block is keyed by rank as well as period and day; `announcementRange`/`markerAfter` give way to the asked-today brake.             |
| `lib/winnings-announcement.test.ts`                | Blocking and ordering with ranks in play.                                                                                            |
| `lib/winnings-lines.ts`                            | A lead pool per period **per rank**; `ALL_PHRASINGS` grows.                                                                          |
| `lib/winnings-lines.test.ts`                       | Second and third place read correctly, and no two stacked sentences open alike.                                                      |
| `lib/leaderboard.ts`                               | `fetchMyWinnings` becomes `fetchUnpaidWinnings`; `acceptWinnings` added; the row type gains `rank`.                                  |
| `lib/player-profile.ts`                            | The `winnings` wire rows gain `period` and `rank`; a row without `rank` is read as the old gold-only shape.                          |
| `lib/player-profile.test.ts`                       | The fortune over podium rows, and over legacy rows.                                                                                  |
| `hooks/use-winnings.ts`                            | Asks the server what is unpaid, offers it, and accepts rather than dismisses.                                                        |
| `hooks/use-popup-deck.ts`                          | Exposes `accept`; `dismiss` no longer settles winnings.                                                                              |
| `components/overlays/winnings-card.tsx`            | The footer says the reward is waiting rather than added.                                                                             |
| `components/overlays/popup-card-view.tsx`          | `popupPrimary(card)` beside `popupAccent(card)` — a page's own button, when it wants one.                                            |
| `components/overlays/whats-new-overlay.tsx`        | The footer's `PrimaryButton` takes its label and action from the page.                                                               |
| `constants/buttons.ts`                             | `'news.accept'`.                                                                                                                     |
| `constants/storage.ts`                             | `SEEN_WINNINGS_KEY` → `ASKED_WINNINGS_KEY`, new string, new meaning.                                                                 |
| `lib/local-reset.ts`                               | The renamed key in `RESET_KEYS`.                                                                                                     |
| `dev/gallery.tsx`                                  | Awards gain a rank; a podium case among the winnings variants.                                                                       |
| `locales/en/messages.po`, `locales/cs/messages.po` | The new copy.                                                                                                                        |
| `CLAUDE.md`                                        | Rows for **podium**, **paid through** and **accept**; the **fortune** row saying winnings are accepted rather than counted.          |

Nothing `code-guide` forbids: the new helpers are pure and colocated with tests, the one
new component seam is a function beside `popupAccent` rather than a second dialog, and no
file here branches on a mode's name.

### Data and types

```ts
// lib/winnings.ts
export const WIN_RANKS = [1, 2, 3] as const
export type WinRank = (typeof WIN_RANKS)[number]

// What each step of the podium pays, as a share of the window's gold.
const PODIUM_SHARE = { 1: 1, 2: 0.5, 3: 0.1 } as const satisfies Record<WinRank, number>

export const winFactor = (period: WinPeriod, difficulty: Difficulty, rank: WinRank): number

export type Award = { period; mode; difficulty; wonOn; score; rank: WinRank }

// One row per board × window kind × step, replacing daySum/weekSum: a second pair of sums
// per step would be six numbers on a row, and a third step would be eight.
export type BoardWinnings = {
  mode: ScoredMode
  difficulty: Difficulty
  period: WinPeriod
  rank: WinRank
  scoreSum: number
}
```

`score` on an `Award` is **the player's own** best in that window, not the winner's — which
for rank 1 is the same number it is today.

**Storage key.** `SEEN_WINNINGS_KEY` (`nine.seen-winnings.v1`) held _the last day
announced_ and was what the money hung on. It becomes `ASKED_WINNINGS_KEY`
(`nine.asked-winnings.v1`), holding _the day the server was last asked and answered
nothing owed_ — a brake on re-querying, never a record of payment. A new string rather
than a new meaning on the old one, because a v1 value read under v2 rules would be a date
in the past claiming the server was asked then. The old key is left on the device
unread; `RESET_KEYS` carries the new one.

**Schema** — `supabase/migrations/20261009120000_winnings_accepted.sql`.

- **`winnings_paid`** — `user_id uuid primary key references profiles(id) on delete
cascade`, `paid_through date not null`, `podium_from date not null`. RLS enabled and
  **no policies at all**: every read and write goes through the `security definer`
  functions below, so the table is unreachable directly. That is also what keeps it off
  `profiles`, whose `public read` policy would publish a player's paid-through day — and
  with it when they last opened the app — to anyone.
- **`podium_from`** is why there are two dates rather than one. Ranks 2 and 3 pay only for
  windows on or after it, so a player's history of second places does not land in their
  fortune the day this ships. Set once at backfill and never moved; `paid_through` is the
  one that advances.
- **The backfill, in the same migration:** one row per existing profile, `paid_through =
current_date - 1` and `podium_from = current_date`. This is the whole of "no fortune
  moves" — every window already closed is already paid, and the podium starts tomorrow.
- **A profile with no row** (one created after the migration) reads as `paid_through =
created_at - 1` and `podium_from = created_at`: they cannot have won before they existed.
  `accept_winnings` inserts their row on first accept with `podium_from = created_at`.
- **`my_winnings(p_user_id, p_from_day, p_today, p_podium_from)`** — the ranged primitive,
  now returning a window's top three with each player's own score and its `rank`, with
  ranks 2 and 3 suppressed for `won_on < p_podium_from`. The `distinct on` becomes a
  `rank() over (partition by mode, difficulty, day order by best_score desc, updated_at
asc)` cut at three; the no-zeros and nickname-required rules are unchanged. The three-arg
  version is **dropped explicitly** — a `create or replace` adding a parameter leaves the
  old function and its grant standing beside the new one, which is the trap the existing
  migration's own closing comment warns about. Its grants to `anon`/`authenticated` are
  **revoked**: no client calls it any more.
- **`my_unpaid_winnings(p_today date)`** — `auth.uid()`, so a player cannot ask what anyone
  else is owed. Reads the watermark itself and returns `my_winnings` over
  `(paid_through, p_today)`.
- **`accept_winnings(p_today date)`** — the only write on this path and the first anywhere
  near it. `security definer`, `auth.uid()`, and a `private.session_is_live()` check that
  raises, exactly as `record_run` does — a profile that has moved to another phone may not
  settle rewards from the one it left. `paid_through = greatest(existing, p_today - 1)`, so
  it only ever moves forward: backwards would pay a window twice. Raises if `p_today` is
  more than a day from `current_date`, in the spirit of `record_run`'s range guards.
  Returns the new `paid_through`.
- **`player_profile`** — unchanged signature. Its `winnings` key now sums `my_winnings` over
  `[min(day), paid_through]` and groups by `period` **and** `rank`.

**Order of deployment.** The app must not ship before the migration. The new client calls
`my_unpaid_winnings`, which an un-migrated server does not have, and the winnings page
would be silently empty while the old `player_profile` kept paying gold as before — no
money lost, but the feature simply absent. The reverse order is safe: the migration alone
changes no fortune, because the backfill is what makes it a no-op. **Push the migration
first**, then deploy. CI applies neither.

> **Review found this paragraph wrong where it matters.** The reverse order is _not_ safe:
> the backfill keeps the fortune's **value** still but not its **wire shape**, and the
> shipped client reads `daySum`/`weekSum`, which the new `player_profile` stops sending. It
> renders `FORTUNE  NaN` for every player between the migration landing and the bundle
> reaching them. Do not push the migration on the strength of this note — see **R2** in
> `plan.md`, which carries the fix.

### Copy, and the gates

**Copy / i18n** — every string through Lingui, Czech beside it, `pnpm i18n:extract` then
`pnpm i18n:verify`.

| String                                            | Where                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `WHAT DID YOU PULL OFF?`                          | the dialog's heading while it is on the winnings page, via `popupTitle`       |
| `IS WAITING FOR YOU`                              | the card's footer caption, replacing `ADDED TO YOUR FORTUNE` while unaccepted |
| `CLAIM`                                           | the deck's button on the winnings page                                        |
| 2 day leads and 2 week leads for **second place** | `LEADS` in `lib/winnings-lines.ts`                                            |
| 2 day leads and 2 week leads for **third place**  | same                                                                          |

The eight new leads obey the rule the file already states: every phrasing ends with its
first board as `[B] with [S]`, and a week phrasing says the week. `MORE` and `LAST` are
untouched — a block is one rank throughout, so the tail never has to name a step. Shapes,
for `build` to finish: _On [DATE] you came second on [B] with [S]_ · _The week of [DATE]
left you second on [B] with [S]_ · _On [DATE] you took third on [B] with [S]_ · _The week
of [DATE] put you third on [B] with [S]_. All eight join `ALL_PHRASINGS`, which is what the
catalog test reads to check Czech keeps every token.

**How to Play** — **no**. Nothing here touches controls, targets, timers, modes,
difficulty, scoring, streaks or lives: a run plays and scores identically. The guide does
not explain winnings today and does not start.

**Flag** — **none**, and deliberately. Winnings have no key in `constants/features.ts` and
ship to everyone; this changes a card players already see. A flag would also strand the
watermark — switched off mid-week, nothing would move it and a fortune would quietly stop
growing.

**Buttons** — one new `ButtonId`: `'news.accept'`, under the News group beside
`news.action`, `news.dismiss` and `news.done`.

## Acceptance criteria

1. **No fortune moves on the day it lands.** With the migration applied and the app
   unchanged, a profile that showed a fortune of _F_ before still shows exactly _F_.
2. A board's day won yesterday is offered on the next launch under the heading `WHAT DID
YOU PULL OFF?`, with the deck's button reading `CLAIM` — not `NEXT`, and not `LET'S GO`.
   The card shows _N_ = `totalAwards` of the offered awards in `TYPE.figureLarge` and
   `text-fortune`, over the caption `IS WAITING FOR YOU`. The figure appears once on the
   page: it is not also on the button. The profile modal's own FORTUNE is the same colour.
3. Pressing CLAIM advances the page, and the profile's FORTUNE read afterwards is higher by
   _N_ ± 1 point. (The one point is inherent and bounded — see Review focus 3 — and the
   criterion is that neither figure is derived from the other.)
4. Killing the app on an unaccepted winnings page, or paging past it with the dots and
   closing, offers the same reward again on the next launch, and the fortune has not moved.
5. Accepting twice for the same day — accept, kill, relaunch, and the dialog offers nothing
   — adds the reward once. `accept_winnings` called twice with the same `p_today` leaves
   `paid_through` where the first call put it.
6. A device with its storage wiped but the same profile is offered everything since the
   profile's `paid_through`, not a quiet yesterday.
7. `winFactor('day', 'extreme', 1)` is `1`, `('day', 'extreme', 2)` is `0.5`,
   `('day', 'extreme', 3)` is `0.1`; `('week', 'easy', 2)` is `0.25`. Rank 1 returns what
   the two-argument version returned for every period × difficulty pair.
8. A player who came second on a board's day after `podium_from` is offered half of what
   that window's winner was paid, reckoned on **their own** score; third is paid a tenth.
   Fourth place is offered nothing.
9. A second place on a window that closed **before** `podium_from` is offered nothing and
   adds nothing to the fortune, on any launch.
10. The card's prose says which step each board gave — took it, came second, came third —
    with one sentence per window per step, newest first and gold before silver before
    bronze within a day.
11. `accept_winnings` from a device whose session has been revoked raises, and the fortune
    does not move; the reward is still offered on the device that holds the profile.
12. `pnpm check` is green, Czech included, and `pnpm i18n:verify` passes.

## Tests

| File                                | Behaviours                                                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/winnings.test.ts`              | `winFactor` over all three ranks × both periods × three difficulties; rank 1 matching today's numbers; `totalAwards` rounding once over a mixed podium, including the tenths a rank-3 share introduces; `winningsValue` over the new row shape. |
| `lib/winnings-announcement.test.ts` | Blocks split by rank as well as by period and day; ordering newest-first then day-before-week then gold-before-silver-before-bronze; the asked-today brake answering true only for today.                                                       |
| `lib/winnings-lines.test.ts`        | A second-place and a third-place sentence read correctly with one board and with three; no two stacked sentences open with the same lead; `ALL_PHRASINGS` holds every new descriptor.                                                           |
| `lib/player-profile.test.ts`        | A fortune over podium rows; a legacy `daySum`/`weekSum` row read as gold so an older server still pays; an unknown rank dropped rather than thrown on.                                                                                          |

No UI test. The card and the dialog are drawn from these pure functions, and `dev/gallery.tsx`
carries the podium case for looking at.

## Review focus

1. **The backfill is the promise** (task 1). Read it against a profile with winnings in
   three difficulties and confirm the fortune is unchanged to the point. A `current_date`
   evaluated in the wrong statement, or a row missed for a profile with no `daily_scores`,
   is a player's fortune falling.
2. **`podium_from` has to be read on both paths** (tasks 1, 5). The paid sum inside
   `player_profile` and the unpaid read in `my_unpaid_winnings` must apply the same floor.
   If only the unpaid path suppresses historical silver, the money appears the moment the
   window crosses the watermark — paid retrospectively through the back door.
3. **The button's figure and the fortune's delta are two computations** (tasks 3, 6). The
   card rounds the awards it is showing; the profile rounds a career. With a ⅒ share, sums
   now carry hundredths, so the two can differ by a point. Confirm neither is recomputed
   from the other and that nothing on screen promises they are equal — and that the
   difference cannot exceed one.
4. **The deck's dismiss must no longer settle winnings** (task 7). `usePopupDeck.dismiss`
   calls all three markers today. If it keeps calling the winnings one, closing the dialog
   pays the reward without a press, which is the whole feature inverted.
5. **A failed accept must not advance silently into a lost reward** (task 8). The page
   advances on press whether the write succeeded or not — deliberately, so a failure cannot
   trap the player on a page whose only exit is the button — so the watermark must move
   only on success, and the next launch must offer the reward again. Check the in-flight
   press guard too: two presses are harmless at the database thanks to `greatest`, but
   should not fire two writes.
6. **`my_winnings`' old signature** (task 1). Adding a parameter with `create or replace`
   leaves the three-argument function and its grants in place. Confirm the drop ran and
   that nothing is still granted on it.
