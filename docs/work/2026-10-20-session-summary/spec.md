# The summary a closed session leaves behind

Slug: session-summary
Stage: verify
Next: /review session-summary — the simplify pass
Track: full
Branch: feat/session-summary
Started: 2026-10-20

## Problem

A player who put a run into a **session** never finds out how it ended. The card leaves
the intro the instant the window shuts, the **session board** goes with it, and there is
no screen anywhere that says who took it. The one contest in this game with a real end
is the only one that never announces its result.

## Appetite

**A week.** All three ways a window can shut on a player, a new page in the launch popup,
one new server read, one new game-machine event, and a line on the best-scores strip.

## Shape

### The word

A **summary**: what one closed **session** came to — its three places and where the player
themselves came — told once, on the first intro they reach after the window shuts.

Deliberately not a **recap**, which is spoken for and is a different kind of thing: a recap
speaks for the six scored boards over a week and to nobody in particular, where a summary
speaks for one session and only to somebody who played it. The two can appear on the same
morning, which is exactly why they may not share a word. Not **results** either — that is
the multiplayer screen. Not a **place**, which is one metal on one row; a summary is the
page the three places are printed on.

### Who gets one, and once

Eligibility is the server's answer and nothing is kept locally to decide it: the player has
a `session_scores` row on that session. That is what "played it at least once" means, it is
already written, and it is right across devices and after a **restore**.

Whether it has been _shown_ is a local watermark, one timestamp — the latest `closesAt`
already summarised — following `useWeeklyRecap`'s idiom exactly: the marker advances only
on dismiss, so a launch killed before the dialog closes tells the player next time, and a
device with no marker at all writes one and says nothing rather than reciting every session
the profile ever played. A lookback bound sits beside it so a player back after a month
reads the sessions that closed while they were away rather than a stack going back to
launch.

### The three ways in

**The window shut while the app was closed.** The read at launch finds a closed session the
player scored on and un-summarised; the summary joins the launch popup as a page, and if
winnings or the recap are also due that morning the deck carries all of them — `usePopupDeck`
already orders and dismisses a deck of mixed pages, and this is a fourth `PopupCard` kind.

**The window shut mid-run, on that session.** The countdown already on the best-scores strip
(`ChallengeCountdown`, fed from `runSessionClosesAt`) turns red as it runs out, and a second
later the run ends: a new event takes the machine from `playing` to `gameOver` the way a last
life does. The game-over title says the window shut rather than what the run was worth —
`TitleWords` is already two four-letter words, so this is one more pair outside the tier
pools. PLAY AGAIN is dead on that screen; there is nothing left to play again. HOME leads to
the intro, where the summary is up.

**The window shut while they were playing something else.** The announcement bar over the
best-scores strip says the session closed and who took it — one new `AnnouncementId`, carried
by the mechanism records already use. The summary itself waits: it is on the intro when they
get there, this run or three runs later.

All three end in the same place and draw the same page. The deck is what the intro opens —
at launch, and again when a summary falls due while the app is already running.

### The page

A large gold medal at the top with the winner's nickname and their figure. Under it, silver
to the left and bronze to the right, smaller. A player who is one of the three reads
themselves there and needs nothing more. A player who is not gets their own figure under the
podium, and an invitation to the next session of anything — omitted when nothing is booked,
rather than a line promising a session that does not exist.

The figure is the session's **measure**, which is already stamped on the row: a score on most,
a time on a race. The name is drawn in the player's own colours like every other name the app
writes on its own surface.

### Areas

- **The popup deck** — a fourth `PopupCard` kind, its title, its accent, its page component;
  `usePopupDeck` gains a fourth source and `popupTitle` a heading that fits a result.
- **A hook and a watermark** — the read at launch, the seen-marker, a storage key.
- **The server** — one new read for closed sessions this player scored on. `session_board`
  already answers for a closed session unchanged, so the standings cost no new SQL; what is
  missing is the list. `open_sessions_with_leaders` gains a `played` flag for the same reason
  — the mid-run cases need to know the live session is one of _theirs_.
- **The game machine** — one new event, `playing → gameOver`. No mode is named: the run
  carries a session id, which is a fact about the run and not about its mode.
- **The best-scores strip** — the countdown's red final second, and a new announcement line.
- **The game-over screen** — a title pair for a shut window, and PLAY AGAIN disabled.
- **Copy** — every string extracted and translated; `pnpm i18n:verify` is the gate.

Not a **rule** and not a **capability**. A session is a row, not a mode, and everything here
keys off `runSession !== null` as the screen already does. No new feature key either: this
rides `challenges`, which already gates the card, the dialog and the read.

## In

- The summary page, drawn as described, in the launch deck.
- The closed-session read, the `played` flag, the local watermark and its lookback bound.
- All three ways in: launch, the mid-run kill with its own game-over title, and the
  announcement for a player in another mode.
- The invitation to the next booked session, and its absence when there is none.

## Out

- **Any history of summaries.** It is told once and never kept — no archive, no re-opening it
  from the profile, nothing on a session that closed before this ships.
- **A summary for a session you only watched.** No `session_scores` row, no page.
- **Anything paid.** A session **place** settles when the window shuts and that is already
  true today; this page reports it and moves no fortune, no **winnings** and no **paid through**.
- **Reigns, periods or medals on a session.** A session board still has none and gains none.
- **A push notification** when a window shuts.
- **Changing what a closed window does to a score already queued.** The refusal path stays
  exactly as it is.

## Rabbit holes

- **Two reads of one board disagreeing.** The game-over screen already reads the session board,
  and in scenario 2 the summary reads it again seconds later. A rival's score landing between
  them puts the player on a podium the other screen does not show. The way around is to read
  once on that path and hand it down, the same fix `SessionStandings` already took when the
  medal and the table were reading separately.
- **Killing a live run.** The machine has no event that ends a run from outside today — `MENU`
  goes home and `RESTART` deals a new one. The new event has to leave the run in the state
  game-over reads from (score, hits, elapsed, the dying sequence's hand-off of the flying
  title) without going through a life loss. This is the one piece that could eat the week;
  the way around, if it does, is to end the run through the same path a last life takes and
  only override the title.
- **A clock the app does not control.** All three triggers fire off `closesAt` against the
  device clock, which a player can move. The server is still the authority — it refuses the
  write — so the worst case is a summary shown early or late, not a wrong result. Worth
  deciding in `spec` whether the mid-run kill tolerates a skewed clock or re-checks.
- **"The day or week summary"** in the original description: there is no daily recap in this
  app. Read as the **winnings** page and the weekly **recap**, which are the two other pages a
  launch can carry. If a daily one was meant, it is a separate piece of work.
- **The lookback bound.** Too short and a player back from a holiday loses sessions they
  played; too long and a first launch after a **restore** opens on five pages. A figure has to
  be picked in `spec` and defended, not left to fall out of the query.

---

## Contract

### Domain words

**Used, and used precisely.** A **session** (one planned appearance of a challenge, one
row of `challenge_sessions`). Its **session board** (the one set of standings it has, and
never shortened to "board"). A **place** on it — gold, silver or bronze, settled the moment
the window shuts and not losable, so not a **medal** in this file's sense. The session's
**measure** (`score` everywhere but a race, `time` there), stamped on the row. A **run**
(one game to game over). A **challenge** (the mode), never `Challenge` (the dare on the
game-over screen). **Closing early** moves `closes_at`, and a session closed early is
closed — every rule here reads `closesAt` and never asks why it is what it is.

**Introduced.**

> **summary** — What one closed **session** came to: its three **places**, where the player
> themselves came, and an invitation to the next session. Told **once**, on the first intro
> the player reaches after the window shuts, and only to somebody with a `session_scores`
> row on it. Never kept and never re-opened — a summary expires the way a **recap** does.
> `SessionSummary` in `lib/session-summary.ts`, a `summary` page of the launch popup.

CLAUDE.md's "Other key words" table gains this row, under **session board**.

**Collisions, and how they stay apart.**

- **summary** vs **recap**. A recap speaks for the six scored **boards** over a week and to
  nobody in particular; a summary speaks for one session and only to somebody who played it.
  They can be two pages of the same dialog, which is exactly why they may not share a word.
- **summary** vs **multiplayer results**. Results are the final scores of one shared run;
  a summary is the standing of a contest that ran for a day.
- **place** vs **medal**. Already settled in CLAUDE.md under **session board**; nothing here
  may call a session place a medal, and `BoardMedal.period` stays `null` for one.

### Files

| Path                                                          |     | Responsibility                                                                                                                                                                  |
| ------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/session-summary.ts`                                      | new | Pure. The `SessionSummary` shape, which summaries a set of rows owes against a watermark and a clock, the lookback bound, the page cap, and which session the invitation names. |
| `lib/session-summary.test.ts`                                 | new | Colocated test for the above.                                                                                                                                                   |
| `hooks/use-open-sessions.ts`                                  | new | One launch-time read of `open_sessions_with_leaders`, behind a module-level store so every consumer shares the single request. Gated on the `challenges` feature.               |
| `hooks/use-session-summaries.ts`                              | new | The read, the watermark, the wake at each `closesAt` still ahead, and `dismiss`. Shaped like `useWeeklyRecap`.                                                                  |
| `lib/session-summaries.ts`                                    | new | The Supabase half: `loadSessionSummaries(since)` over the new RPC. Beside `lib/session-board.ts`, which it does not belong inside — that file is the card's and the write's.    |
| `components/overlays/summary-card.tsx`                        | new | The page: the podium, the player's own line, the invitation.                                                                                                                    |
| `components/overlays/summary-place.tsx`                       | new | One place — medal, nickname, figure — at the two sizes the podium uses.                                                                                                         |
| `supabase/migrations/20261020000000_my_session_summaries.sql` | new | `my_session_summaries(timestamptz)`.                                                                                                                                            |
| `types/popup.ts`                                              | mod | A fourth `PopupCard` kind.                                                                                                                                                      |
| `hooks/use-popup-deck.ts`                                     | mod | A fourth source, its place in the order, its share of `dismiss`.                                                                                                                |
| `components/overlays/popup-card-view.tsx`                     | mod | Render, title and accent for the new page.                                                                                                                                      |
| `hooks/use-session-card.ts`                                   | mod | Takes its rows from `useOpenSessions` instead of reading itself. Behaviour unchanged.                                                                                           |
| `machines/game.ts`                                            | mod | One new event: `EXPIRE`, `playing → gameOver`.                                                                                                                                  |
| `lib/game-over-title.ts`                                      | mod | An `expired` tier, its pool, and the fact that selects it.                                                                                                                      |
| `components/overlays/game-over-sequence.tsx`                  | mod | Passes that fact through to the title.                                                                                                                                          |
| `components/overlays/game-over-overlay.tsx`                   | mod | PLAY AGAIN dead and the dare withheld on an expired run.                                                                                                                        |
| `components/overlays/run-screen.tsx`                          | mod | `RunCta` gains `disabled`.                                                                                                                                                      |
| `components/game/best-scores-line.tsx`                        | mod | The countdown's red at the boundary, and the call upward.                                                                                                                       |
| `lib/announcements.ts`                                        | mod | Two new ids and their pools.                                                                                                                                                    |
| `lib/announcement-style.ts`                                   | mod | Their scale.                                                                                                                                                                    |
| `hooks/use-announcement-request.ts`                           | mod | Comment only: it is no longer dev-only.                                                                                                                                         |
| `app/(tabs)/index.tsx`                                        | mod | The one-second grace and the `EXPIRE` send; the expiry announcement request.                                                                                                    |
| `constants/storage.ts`                                        | mod | `SEEN_SUMMARY_KEY`.                                                                                                                                                             |
| `components/overlays/how-to-play-overlay.tsx`                 | mod | One bullet in CHALLENGES.                                                                                                                                                       |
| `dev/gallery.tsx`                                             | mod | Summary variants.                                                                                                                                                               |
| `CLAUDE.md`                                                   | mod | The **summary** row.                                                                                                                                                            |
| `locales/en/messages.po`, `locales/cs/messages.po`            | mod | `pnpm i18n:extract`, then Czech.                                                                                                                                                |

`ChallengeCountdown` is deliberately **not** on the list. It already fires `onArrive` on a
mount that is past `until` — the note in it says why — so a run resumed after the window
shut announces on its first frame, and the red is a gradient the caller passes.

### Data and types

```ts
// lib/session-summary.ts
export type SummaryPlace = {
  rank: 1 | 2 | 3
  nickname: string
  score: number
  timeMs: number | null
  avgAccuracy: number | null
  avgSpeed: number | null
}

export type SessionSummary = {
  sessionId: string
  modeId: string
  closesAt: number
  measure: Measure
  places: readonly SummaryPlace[] // 0–3, ranked
  players: number
  // Always present — eligibility *is* having a row. `rank` is null for a player with
  // no nickname, who is kept off every board in this app and off this podium too.
  mine: { rank: number | null; score: number; timeMs: number | null }
}
```

```ts
// types/popup.ts — the fourth kind
| { kind: 'summary'; summary: SessionSummary; invite: OpenSession | null }
```

There is at most one of these on a deck — see the bound below — so `kind: 'summary'`
appears either once or not at all.

`invite` is resolved by the deck rather than by the card, from the rows `useOpenSessions`
already holds, and by `cardSession` — the function the intro already uses to decide which
session it may speak about. Reusing it is what keeps the summary from announcing a session
earlier than that session's own **teaser** allows. `null` when there is nothing to name,
and the card then says so in general terms rather than promising a session that does not
exist.

**Bounds, both of them deliberate.**

```ts
export const SUMMARY_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000
```

The lookback is what a device with no marker, or a marker from before a long absence, asks
about. **At most one summary is ever told** — the newest close in that window — and the
watermark then advances past every older one, told or not. A summary expires the way a
**recap** does: it speaks for a contest that is over, and the one that just ended is the
only one anybody is still thinking about. So `summariesOwed` returns a `SessionSummary |
null` rather than a list, and the deck carries at most one `summary` page.

Both halves are stated in `lib/` so a test can pin them, and the lookback stays a span
rather than collapsing into "the newest ever": a player who has not opened the app in three
months should not be met with a podium from a contest they have forgotten playing.

**Storage.** `SEEN_SUMMARY_KEY = 'nine.seen-summary.v1'` — the `closesAt` of the newest
session already summarised, as epoch milliseconds in a string. `useWeeklyRecap`'s rules
exactly: absent means a first launch, which writes `Date.now()` and says nothing; the
marker advances only on dismiss, so a launch killed with the dialog up tells the player
next time; a failed read leaves it alone.

**Machine.** `Event` gains `{ type: 'EXPIRE'; now: number }`, handled only in `playing`:
`target: 'gameOver'`, `actions: assign(stopClock(context, event.now))` — the same stop the
other three ways into `gameOver` take. It is **not** a life loss and sets no lives to zero;
the run's score, hits and streaks stand as they were. No mode is named: the fact that
selects it is the run having a session, which is a fact about the run.

`Context` gains nothing. Whether the window shut is held by the screen, beside
`runSessionClosesAt` which it already holds — a run put back from storage has neither, and
that is the same near-miss the existing comment there describes.

**Title.** `ClaimTier` gains `'expired'`, `TITLES` gains its pool, and `tierFor` gains
`windowShut?: boolean` which it answers **first**, above the crown. A challenge may still
name its own words for it through `claims`, like every other tier.

```ts
expired: [
  ['TIME', 'GONE'],
  ['DOOR', 'SHUT'],
  ['BELL', 'RANG'],
]
```

**Announcements.** `ANNOUNCEMENT_IDS` gains `sessionWon` and `sessionTaken` — the player
took the session, or somebody else did. Two rather than one because the `{name}` in the
second is the whole of its news and the first has no name to carry. Both wear the `cta`
scale: a real event without the shine of a prize, which is what `everRaised` already uses
it for. They reach the bar through `requestAnnouncements`, the module store that exists for
exactly this and has until now had only the dev gallery writing to it.

**Schema.** One migration, one function, nothing dropped and no column added:

```sql
create or replace function my_session_summaries(p_since timestamptz)
returns table (
  id uuid, mode_id text, closes_at timestamptz, measure text,
  players int, places json, mine json
) language sql stable security definer set search_path = public
```

- Rows: `challenge_sessions` where `closes_at <= now()`, `closes_at > greatest(p_since,
now() - interval '30 days')`, and `exists (select 1 from session_scores ss where
ss.session_id = s.id and ss.user_id = auth.uid())`. Newest close first.
- `places` is `session_board(s.id)` limited to three, as a json array; `players` is its
  full count. Reusing `session_board` is what keeps the podium ordered by the session's own
  **measure** without that rule being written a second time.
- `mine` comes from `session_scores`, not from the board — a player with no nickname is off
  the board and still has a figure, and eligibility is the row rather than the standing.
- The thirty-day floor is the server's own bound on a client that asks about the epoch. It
  is not the client's cap and the two are not the same number on purpose: the client's
  fourteen days is a product decision about what is still news, this is a guard.
- Granted to `authenticated` only. `anon` has no `session_scores` rows and `auth.uid()`
  would be null.

**Already-shipped rows:** nothing changes. No table, column or existing function is
touched, so every row behaves exactly as it does today. **The code cannot run against the
old schema** — `loadSessionSummaries` calls a function that will not exist — so the
migration goes first. A client that calls it before the push gets a Postgres error, which
`loadSessionSummaries` reports as an error and the hook treats as "say nothing", leaving the
marker where it is. That is a degradation, not a break.

### Copy, and the gates

**Copy / i18n.** Every string below goes through Lingui and gets Czech; `pnpm i18n:verify`
is the gate.

| Where                                 | English                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Dialog heading (`popupTitle`)         | HOW DID IT END?                                                                                    |
| Summary card, over the podium         | the challenge's own name, from `labelOf` — already extracted                                       |
| Under the name                        | THE WINDOW HAS CLOSED                                                                              |
| Empty podium                          | — NOBODY SCORED —                                                                                  |
| The player's own line, off the podium | YOU CAME {rank} OF {players}                                                                       |
| The same, with no nickname            | YOUR SCORE                                                                                         |
| Invitation, naming one                | NEXT UP: {challenge}                                                                               |
| Invitation, naming none               | ANOTHER CHALLENGE IS ON ITS WAY                                                                    |
| How to Play, new bullet               | If the window closes while you are playing, the run ends there — and you are told how it finished. |

**One deliberate exception, named so `review` does not re-derive it.** The two new
announcement lines are plain strings in `ANNOUNCEMENT_MESSAGES`, because every one of the
thirteen pools already in that file is. The structure is
`satisfies Record<AnnouncementId, readonly [string, ...string[]]>` and a `msg` descriptor
cannot join it without converting all thirteen, the hook, the bar, the gallery and the
tests. That conversion is a separate piece of work — `docs/superpowers/specs/2026-09-16-locales-design.md`
already describes it — and this work does not start it half way. Lines:

```
sessionWon:  ['You took the challenge', 'The challenge is yours', 'First on the challenge']
sessionTaken: ['{name} took the challenge', 'The challenge went to {name}', 'Challenge over: {name} won']
```

Longest is 10 (name) + 23 = 33, inside `MAX_MESSAGE_LENGTH` of 40.

**How to Play.** Yes — the run now ends when the window shuts, which is a rule of play.
One bullet in the CHALLENGES section of `how-to-play-overlay.tsx`, the copy above.

**Flag.** No new `constants/features.ts` key. All of this rides `challenges`, which already
gates the card, the dialog and the reads — and which `useOpenSessions` keeps gating.

**Buttons.** No new `ButtonId`. The page borrows the dialog's own button, as the recap and
news pages do — `popupPrimary` returns `null` for it, so the dialog goes on saying NEXT and
LET'S GO. The invitation is text, not a door.

## Acceptance criteria

1. A player with a `session_scores` row on a session that closed while the app was shut
   opens the app and, after the splash, the launch popup is up with a **summary** page on
   it. A player with no row on that session sees nothing.
2. On a morning that also owes **winnings** and a **recap**, one dialog carries all three
   with page dots, the summary first, then winnings, then the recap, then news.
3. A player owed two closed sessions is told about the newer one only, and the older one is
   never offered again — the watermark advances past both.
4. Dismissing the dialog is what marks the summary told. Killing the app with the dialog
   up and relaunching shows the same summary again; dismissing it and relaunching shows
   nothing.
5. A run on a session whose window shuts mid-run: the countdown on the best-scores strip
   turns red at the boundary, and one second later the run ends on the game-over screen
   with the title from the `expired` pool. PLAY AGAIN is visibly dead and does nothing when
   pressed; no step-up dare is offered. HOME leads to the intro with the summary up.
6. A run in another mode while a session the player played shuts: the announcement bar takes
   over the best-scores strip with `sessionWon` or `sessionTaken`, the run is untouched, and
   the summary is up on the intro whenever they next reach it.
7. The page draws a large gold place at the top with nickname and figure, silver left and
   bronze right beneath it and smaller. Both challenge names — the one that ended and the
   one offered next — are drawn in that challenge's own gradient. Every figure is in the
   seven-segment face. The player's own place is marked with a pill behind the nickname; a player off the podium gets
   their own figure under it instead, a rung smaller than the podium's. The count of
   players is on the page. The invitation carries a countdown — to the open for a teased
   session, to the close for a live one. A session with an empty podium produces **no page
   at all**.
8. A **place** on a closed session pays into the player's **fortune**: first their score
   again, second half of it, third a fifth, weighted by the rung and added on top of the
   points the run already earned. The page prints the reader's own figure, and only for
   the three it pays. Nothing closed before `session_podium_from()` pays anything, so no
   fortune already earned moves.
9. On a session **measured** by the clock, every figure on the page is a time; on every other
   session they are scores.
10. The invitation names the next session `cardSession` would let the intro name, and says
    so in general terms when there is none.
11. `my_session_summaries(now() - interval '1 day')` returns only sessions the caller scored
    on; a second account with no row on the same session gets an empty set. A `p_since` of
    the epoch returns no session that closed more than thirty days ago.
12. `loadOpenSessions` is called **once** per launch with both the intro's card and the
    summaries mounted — one request, two consumers.
13. A summary whose read fails leaves the watermark where it stands, and the next launch
    asks again.
14. `pnpm check` is green, Czech included, and `pnpm i18n:verify` passes.

## Tests

| File                                | Behaviours                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/session-summary.test.ts`       | new — which rows are owed against a watermark and a clock; the lookback bound; that exactly one summary is returned when several are owed, the newest close, and that the watermark still advances past the older ones; the invitation's choice including the none case; a `mine` with a null rank. |
| `lib/game-over-title.test.ts`       | extended — `windowShut` selects `expired` above every other tier, including the crown; a challenge's `claims` still override it.                                                                                                                                                                    |
| `lib/announcement-style.test.ts`    | extended — the two new ids resolve, and the existing exhaustiveness test over `ANNOUNCEMENT_IDS` still passes.                                                                                                                                                                                      |
| `machines/game.test.ts`             | extended — `EXPIRE` takes `playing` to `gameOver`, stops the clock, and leaves score, hits and lives as they were; it is ignored in `paused`, `menu` and `gameOver`.                                                                                                                                |
| `supabase/tests/session_scores.sql` | extended — the three row rules of criterion 10, under pgTAP beside the existing session tests.                                                                                                                                                                                                      |

No UI test for the card. The podium is a layout, and the arithmetic behind it is all in
`lib/`; `dev/gallery.tsx` gets the four variants — won, silver, off the podium, nobody
scored — which is how it is actually looked at.

## Review focus

1. **The shared open-sessions read, and its two consumers.** `useSessionCard` must keep
   behaving exactly as it does: read once, held, no re-reckon when a live session closes,
   `reckon` only at the teaser boundary. A module-level store makes it very easy to turn
   that frozen card into one that re-renders on every consumer's wake. **Task 2.**
2. **The watermark advancing past the summaries not told.** Only the newest is shown, but
   the marker must move past every older one in the window — set it from the page shown and
   a player owed two gets the second one offered on the very next launch, forever. The
   figure the marker takes and the figure the page carries are deliberately not the same
   value. **Task 3.**
3. **`EXPIRE` arriving when the run is not playing.** The strip fires `onArrive` on a mount
   already past `until`, which is exactly what happens on RESUME after a window shut and on
   a re-render during the game-over sequence. The one-second grace means the send lands a
   tick later still. The guard has to hold for `paused`, `gameOver` and `menu`, and the
   timer has to be cleared on unmount or it sends into a run that has already restarted.
   **Tasks 7 and 9.**
4. **A deck that is visible with nothing to say.** `usePopupDeck.visible` is `cards.length
   > 0` and every source must empty itself on dismiss — a hook that clears its page but not
   > its state keeps the whole dialog mounted and invisible over the intro, which is the
   > failure the existing comment in that file warns about. **Task 6.**
5. **Two reads of one session board disagreeing.** The game-over screen reads the board with
   `useSessionBoard` and the summary reads the same session seconds later through the new
   RPC. A rival landing a score between them puts the player on a podium the other screen
   does not show. The window has shut, so no new score can land — but `closeSessionEarly`
   and a clock-skewed device both make it possible, and the screens must not contradict each
   other about a settled place. **Tasks 4 and 5.**
6. **The announcement firing for a session the player did not play.** The wake is scheduled
   from every open session, and the request is made only once the RPC has confirmed a
   summary is owed. Firing off the wake alone would announce a contest the player never
   entered. **Task 10.**

## Follow-ups

Two things were asked for mid-build as new mechanics rather than details of this one. One
has since been built in part; the other has not been started.

- **A session podium should pay.** ✅ **Built** (sixth pass), after it was asked for
  again with the shares named. `session_podium_bonus` pays first their score again, second
  half, third a fifth — weighted by the rung, added on top of the points the run already
  earned, and bounded by `session_podium_from()` so no fortune already earned moved. See
  criterion 8 and the sixth-pass build notes.

  **What is still not built, and is still `/shape session-winnings`:** the bonus is paid
  **automatically**, where a board's **winnings** are _offered_ and only reach a fortune
  when the player **accepts** them on the launch popup. There is no session page on the
  winnings card, no per-player watermark, and nothing to press. That difference is
  deliberate for now — it is the smallest honest version of what was asked for — but the
  two paths through a fortune should not stay different without someone deciding they
  should.

- **The winner wears a mark until the next session closes.** `championMark` in
  `lib/champions.ts` is already "the mark a player wears in front of their name, anywhere
  their name appears" — 👑 for both Extreme all-time boards, 🦉/🦅 for one. A challenge
  winner's mark belongs beside it and **both must show at once**, which is the part that
  makes this its own item: `championMark` returns one mark and six files pass it down as a
  singular `mark` prop (`tab-panel`, `player-tile`, `player-profile-overlay`,
  `compare-overlay`, `compare-head-side`, and the profile). It also needs a lifetime rule
  with a case nobody has decided — what "until the end of the next session" means when no
  next session is booked. **`/shape challenge-mark`.**
