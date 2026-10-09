# Winnings you accept, and a podium that pays — Plan

Spec: docs/work/2026-10-09-claimed-winnings/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261009120000_winnings_accepted.sql` — `winnings_paid` with RLS and no policies; the backfill; `my_winnings` gaining `rank` and `p_podium_from` (drop the 3-arg form, revoke its grants); `my_unpaid_winnings`; `accept_winnings`; `player_profile` summing to `paid_through` and grouping by period × rank — three decisions the spec left open: `wins` filters `rank = 1` (the podium pays three deep, a reign is one deep); a `mine`/`my_weeks` pre-filter keeps the window function proportional to one career rather than the whole table; and a week is reduced to one row per player _before_ anyone is ranked, or one player's three good days would fill all three steps. Verified locally: 26 seeded profiles' weighted winnings byte-identical before and after.
- [x] 2. `lib/winnings.ts` — `WinRank`, `PODIUM_SHARE`, `winFactor(period, difficulty, rank)`, `rank` on `Award`, `BoardWinnings` as one row per board × period × rank; `lib/winnings.test.ts`
- [x] 3. `lib/winnings-announcement.ts` — key a block by rank too, order gold → silver → bronze inside a day, replace `announcementRange`/`markerAfter` with the asked-today brake; `lib/winnings-announcement.test.ts`
- [x] 4. `lib/player-profile.ts` — read `period`/`rank` off the wire, treat a row without `rank` as the old gold shape; `lib/player-profile.test.ts`
- [x] 5. `lib/leaderboard.ts` — `fetchUnpaidWinnings`, `acceptWinnings`, `rank` on the row type
- [x] 6. `constants/storage.ts` + `lib/local-reset.ts` + `hooks/use-winnings.ts` — `ASKED_WINNINGS_KEY`, and the hook asking, offering and accepting
- [x] 7. `hooks/use-popup-deck.ts` — expose `accept`; `dismiss` stops settling winnings
- [x] 8. `constants/buttons.ts` + `components/overlays/popup-card-view.tsx` + `components/overlays/whats-new-overlay.tsx` — `news.accept`, `popupPrimary(card)`, and the footer button taking its label and action from the page
- [x] 9. `lib/winnings-lines.ts` — a lead pool per period per rank, `ALL_PHRASINGS`; `lib/winnings-lines.test.ts`
- [x] 10. `components/overlays/winnings-card.tsx` — the footer saying the reward is waiting
- [x] 11. `dev/gallery.tsx` — ranks on the award builder, a podium case
- [x] 12. `pnpm i18n:extract` + Czech, and the `CLAUDE.md` rows for podium / paid through / accept

## Tasks, reopened by review

- [x] 13. **R1** `hooks/use-winnings.ts` + `hooks/use-popup-deck.ts` — `dismiss` returns, clearing `blocks` and touching no watermark; the deck calls it beside the other two.
- [x] 14. **R2** `supabase/migrations/20261009120000_winnings_accepted.sql` — `player_profile`'s `winnings` key carries `daySum`/`weekSum` beside the step, for the builds already on the phones; `lib/player-profile.test.ts` pins that a new client ignores them.
- [x] 15. **R3** `hooks/use-winnings.ts` — `offeredFor` holds the day the offer was drawn for, and the accept settles against that rather than re-reading the clock.
- [x] 16. **R4** `hooks/use-winnings.ts` — `accepted` is set when the write returns clean, not when the button is pressed.
- [x] 17. **R5** `components/overlays/popup-card-view.tsx` + `components/overlays/whats-new-overlay.tsx` — the comments stop claiming the press is the only way off the page.
- [x] 18. **R6** `CLAUDE.md` — the **accept** row describes the button that was built.
- [x] 19. Notes — the migration's backfill comment covers weeks and the server clock; `'nine.seen-winnings.v1'` joins `RETIRED_KEYS`.

## Build notes

**What differs from the spec, and why.**

- **`player_profile`'s `wins` key had to be pinned to rank one.** The spec named the
  `winnings` key and missed that the same function calls `my_winnings` a second time, for
  MEDALS HELD. Left alone, coming third on a board every day for a week would have drawn as
  a week of _holding_ it. `won` now filters `m.rank = 1`, which is what a reign always was.
  This is the hazard Review focus 2 was pointing at, one call site over.
- **A week is reduced to one row per player before anyone is ranked.** A period board ranks
  each player's best day, so ranking the raw days would have let one player's three good
  days fill all three steps of a week's podium. The old function could not make this
  mistake, having only ever looked for the top row.
- **`my_winnings` narrows to the player's own boards and days first** (`mine`, `my_weeks`).
  The old `distinct on` could be answered from the index; a window function cannot be
  filtered before it runs, and this query sums over all history on every profile open. The
  pre-filter changes no answer — a window the player has no row in is not one they placed
  in — and keeps the work proportional to one career.
- **`winnings_paid` turned out to be stronger than "RLS with no policies".** It has no
  grants to `authenticated` at all, so a direct read is refused outright rather than
  returning nothing. Confirmed from a session-scoped psql.
- **The blocks are not cleared when a reward is accepted.** The spec implied the card goes;
  it cannot. The launch deck builds its pages from those blocks, so clearing them would
  take a page out from under the index the dialog is holding and land the player on the
  card _after_ the one they expected. The page stays, settled — `accepted` flips, the
  footer says ADDED TO YOUR FORTUNE, and the button goes back to saying NEXT.
- **Two strings were extracted that the spec did not list.** `NEXT` and `LET’S GO` in
  `whats-new-overlay.tsx` were raw literals, in no catalog, rendering English to Czech
  players. They are the expression the accept label had to be threaded into, so they were
  fixed in place rather than left for their own item.

**Decisions at a fork.** The icon on the accept press is a tick rather than an arrow
(`ICONS` in `whats-new-overlay.tsx`): the press settles something, and the mark that says
so should not also be the mark that means onwards. Nothing new was added to
`constants/colors.ts` — the page's violet already existed.

**Left undone, deliberately.** Nothing from the task list. The 89 ESLint warnings the suite
reports are all pre-existing, including the two in `winnings-card.tsx` (a raw `text-[22px]`
on the figure, there before this work and confirmed by stashing the file).

**Local database.** The migration is applied to the local stack, not rolled back, so
`verify` can drive against it. Production has it pending — it must be pushed **before** the
app ships; see the spec's order-of-deployment note.

**My own read of the criteria, before `verify` does it properly.**

| #   | Believe satisfied        | On what evidence                                                                                                                                              |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Yes                      | 26 seeded profiles' weighted winnings diffed byte-identical across the migration.                                                                             |
| 2   | Yes, unproven in the app | `popupPrimary` + the overlay's one button; the gallery carries an unaccepted PODIUM case to look at.                                                          |
| 3   | Yes, unproven in the app | The two figures are computed independently and both round once; the ±1 arithmetic is unit-tested. The end-to-end comparison wants the running app.            |
| 4   | Yes                      | `accept` is the only caller that moves the watermark; `usePopupDeck.dismiss` no longer touches winnings.                                                      |
| 5   | Yes                      | `greatest()` proven idempotent in psql — accept, re-accept and a stale day all land on the same date — plus the in-flight ref guard against a double request. |
| 6   | Yes                      | The span comes from `my_unpaid_winnings`, which reads the watermark itself; the device holds no boundary any more.                                            |
| 7   | Yes                      | Unit-tested exactly, including rank one matching every number the two-argument version returned.                                                              |
| 8   | Yes                      | psql: ranks 1–3 returned with the player's own `best_score`, cut at three.                                                                                    |
| 9   | Yes                      | psql: the same call with the real floor returns a highest rank of 1.                                                                                          |
| 10  | Yes                      | Unit-tested — blocks split by step, ordered gold before silver before bronze, one sentence each.                                                              |
| 11  | Yes                      | psql with a session id absent from `auth.sessions` raises `session revoked`.                                                                                  |
| 12  | Yes                      | `tsc` clean, 1 633 tests pass, `knip` clean, `i18n:verify` passes at 672 messages, ESLint 0 errors. `pnpm check` as one command is `verify`'s to run.         |

## Follow-up changes, after the build

A pass over the card's design, asked for once it could be looked at. The spec's Contract,
its copy table and criteria 2 and 3 were amended to match, so `verify` is still held to
what shipped.

- **The dialog's heading is per page now** — `popupTitle` beside `popupAccent` and
  `popupPrimary`, the same seam. The winnings page asks WHAT DID YOU PULL OFF? and every
  other page keeps WHAT’S NEW IN THE GAME?, which was the wrong question over a player's
  own rewards. The card's own `YOU WON` title goes with it: the heading poses the question
  and the sentences answer it, so a second heading between them said nothing.
- **Two words the brief asked for were changed anyway, and here is why.** The title was to
  be "what you did _yesterday_" — but the page carries every unaccepted window, so a player
  back after a week reads four or five days, and naming one of them would be wrong for
  exactly the player with the most to read. And the Czech was to be _Co jsi včera dokázal?_,
  whose participle is masculine; the catalogue's existing winnings lines all avoid gendered
  past tense (`ti patřilo`, `šlo všechno podle tebe`), so this took the neutral idiom —
  `CO SE TI POVEDLO?`.
- **The hairline above the figure is gone.** A rule earns its place between two things of
  the same kind; this one was fencing a number off from the sentences explaining it.
- **The figure is green, in the app's own mono voice.** It wore DSEG7 for one pass and was
  sent back: the seven-segment face is the scoreboard over a live run, and a reward is not
  being counted in front of anybody. The green stayed, and worth saying plainly —
  `--color-score` is **already green** (`#147a32`), so "green like the score" cost no new
  colour and did not touch `ACHIEVEMENT_SCALE`, which the design guide reserves for the one
  thing it means. The violet the card used to carry is gone from it; the page's dots and
  BACK arrow are still violet, via `popupAccent`.
- **`TYPE.figureLarge` is new, and agreed before being added.** Reverting the face could not
  mean reverting to the raw `font-mono text-[22px] … tracking-[1px]` that was there before —
  that is the thing ESLint flags and CLAUDE.md forbids. No existing role fitted: `figure` is
  11px for a row, and `cardTitle` carries 2px of tracking, which a number must not. So the
  scale gained the role for _the figure a card is about_, at the size that was already on
  screen and with the tracking dropped. The sweep that found this also found **17 raw
  large-mono values** elsewhere — `profile-score`'s suffix, both admin screens,
  `run-top-bar`, `how-to-play` — which this role would own if they were ever brought onto
  it. That is a separate item and deliberately not this change.
- **`groupDigits` rather than `toLocaleString`.** DSEG7 has no comma glyph, and the
  separator `toLocaleString` reaches for is a decimal point in Czech. A no-break space is
  what a scoreboard does, and the helper already existed for this.
- **The caption is `IS WAITING FOR YOU`**, flipping to `ADDED TO YOUR FORTUNE` once claimed.
- **The button reads `CLAIM` and carries no figure.** Printing the total twice on one page
  made the button restate the thing it was meant to act on — and the second copy would have
  been the one to keep in step. On the word: the code still says `accept` throughout, since
  `toMedals` already means a standing by `claim`; only the label a player reads says CLAIM,
  which is the split this repo already runs between host/guest and `admin`. `CLAUDE.md`'s
  **accept** row says so now.

One incidental gain: using the type role for the figure retired the two ESLint warnings this
card had been carrying for a raw `text-[22px]`. The suite reports 87 warnings now, down
from 89, and still zero errors.

### A fortune's own colour

Asked for after the figure was already on screen: a fortune should wear a game colour, and
every fortune figure in a modal should wear the same one. Swept first, per the design
guide, because this is a shared style and not one value.

The sweep found **six** `text-score` call sites, of which only three are fortunes — the
other three are the live score over the dial, the top bar's best scores and a leaderboard
row. So the token could not be moved: repainting `--color-score` would have repainted every
score in the game. What was missing was an owner, so there is one now.

- **`--color-fortune: #a82a22`** in `global.css` — the game scale's red, darkened to carry
  text. The raw stops cannot: `APP_RED` is 2.92:1 on card, `APP_BLUE` 3.03:1 and
  `APP_VIOLET` 3.41:1, against the green's 4.51:1, which is why `GOLD_SCALE` and
  `ACHIEVEMENT_SCALE` each ship a separate ink. This one is **5.49:1 on card and 6.07:1 on
  surface** — better than what it replaces, at every size. It went violet (#4f4fa8) for one
  pass before red was asked for; the contrast target was kept the same so the two are
  equally legible.
- **Depth is doing a second job here.** `APP_RED` is not only too light, it already means
  something: a mistyped game code in `code-cells.tsx` and a life coming off in
  `floating-life-loss.tsx`. A fortune only ever grows, and must not be written in the hue
  that means something was just lost — at #a82a22 it reads as its own colour rather than as
  a dimmer version of that one.
- **Three call sites moved**: the profile modal's FORTUNE headline, its `k`/`M` suffix, and
  the winnings figure. The game scale is the right scale because a fortune is every point
  ever scored across every mode, where a mode's own colour would be a claim about one.
- **Two were deliberately left.** The compare overlay's FORTUNE row is coloured by _who is
  ahead_ — gold, primary or dim — a system it shares with RUNS, HITS and TIME, and tinting
  only its fortune row would have cost the column one of its five comparisons. The game-over
  screen's `+N TO YOUR FORTUNE` is a dim caption rather than a figure, and on a screen
  rather than in a modal.
- **No entry in `GOLD_SCREEN_TOKENS` or `MODE_SCREEN_TOKENS`**, and that was checked rather
  than assumed: both re-bind the theme for a `RunScreen` subtree, and no fortune figure is
  drawn inside one — `PlayerProfileOverlay` mounts as a sibling of the profile provider's
  children, outside any painted screen. A violet on the mode screens' dark paint would have
  been unreadable, so this was worth confirming.
- No `FORTUNE_INK` mirror in `constants/colors.ts`. The mirrors exist for colours computed
  in JS, and all three call sites reach the token through `className`; an unused export
  would only have given `knip` something to find.

## Verification log

**Verdict: 13 PASS, 0 FAIL, 3 SKIPPED.** Every criterion about the money, the podium and
the arithmetic holds, measured against the local database rather than read off the source.
Criterion 15 failed on the first pass and was fixed in the same unpushed migration — see
the row below. Three criteria were not checked: they describe what a player sees and
presses, and driving the app was declined this pass, so the player-visible surface goes to
`review` unseen.

| #   | Criterion                                           | Result  | Evidence                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No fortune moves on the day it lands                | PASS    | Snapshot of all 26 profiles' weighted winnings taken from the **old** function pre-migration, re-read through `player_profile`'s own `winnings` key post-migration: identical to 4 decimal places, 8 of them non-zero.                                                       |
| 2   | Heading, CLAIM, the figure once, `text-fortune`     | SKIPPED | Player-visible; driving the app declined. The dev gallery's PODIUM / SECOND ONLY variants are built and waiting.                                                                                                                                                             |
| 3   | CLAIM advances, fortune up by _N_ ± 1               | SKIPPED | Same. The server half is covered by 5 — the watermark moves and the windows enter `player_profile`'s sum — but the figure on screen was not compared to the fortune after.                                                                                                   |
| 4   | Killing or paging past re-offers it, unpaid         | SKIPPED | Same. `usePopupDeck.dismiss` provably no longer calls accept, but "kill the app on the page" was not exercised.                                                                                                                                                              |
| 5   | Accepting twice pays once                           | PASS    | psql: 10 windows offered → two presses both return `2026-10-08` → 0 offered after. `greatest()` holds, and a stale day (`current_date - 1`) does not drag it back.                                                                                                           |
| 6   | A wiped device is offered everything since the mark | PASS    | The span is watermark-derived, not device-derived: `my_unpaid_winnings` returned 10 windows over 14 days from a dragged-back `paid_through`. Client half by unit test — a null key answers "never asked", so it asks. End-to-end wipe not driven.                            |
| 7   | `winFactor` over all three steps                    | PASS    | `vitest run lib/winnings.test.ts -t winFactor` — 6 tests, including rank one matching every number the two-argument version returned.                                                                                                                                        |
| 8   | Second pays half, third a tenth, fourth nothing     | PASS    | psql on ACC EASY 2026-10-06, five published players: SPEEDY 1st on 231, ACE_9 2nd **on 218 — their own score, not the winner's**, PIXEL 3rd on 174, DOMINO 4th and NOVA 5th offered nothing.                                                                                 |
| 9   | A pre-`podium_from` second place pays nothing       | PASS    | The same call with the real floor returns a highest rank of 1; silver and bronze vanish from a historical day.                                                                                                                                                               |
| 10  | The prose says which step, ordered                  | PASS    | 10 tests over actual output strings and block order: a lesser step never reads as a win on **any** rotation of its pool, three boards of one step sit under one opening, gold → silver → bronze within a day. Rendering itself not looked at (`ProseSentence` is unchanged). |
| 11  | A revoked session cannot accept                     | PASS    | psql with a `session_id` absent from `auth.sessions` raises `accept_winnings: session revoked`; the raise aborts before any write, so the watermark stands and the reward is still offered.                                                                                  |
| 12  | `pnpm check` green, Czech included                  | PASS    | `pnpm check` exit 0 — i18n verify, ESLint (0 errors), Prettier, `tsc`, Knip, 1 633 tests.                                                                                                                                                                                    |

### Found in step 3, past the criteria

| #   | Criterion                                          | Result          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | A profile created after the backfill behaves       | PASS            | Four anonymous profiles exist locally that post-date the backfill and so have no watermark row. `player_profile` returns 0 winnings for them without erroring — the `coalesce` to `created_at` holds — and `accept_winnings` on one wrote `podium_from = 2026-10-09`, the day it joined, not today. This is the insert branch, which no criterion named.                                                                                                                                                                                                                                                                                                          |
| 14  | A nameless profile is on no board                  | PASS            | Gave one a 99999 on a past day: offered nothing itself, **and it did not displace the named winner of that day**, who kept rank 1 on 231. The nickname filter runs before the ranking, not after it.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15  | The new functions are not reachable by `anon`      | **FAIL → PASS** | First pass: `has_function_privilege('anon', …, 'execute')` was **true** for both `accept_winnings` and `my_unpaid_winnings` — `create function` grants EXECUTE to `PUBLIC` by default, and only `my_winnings` had the explicit `revoke all … from public`. Both already refused an `anon` call with `not authenticated`, so this was surface rather than a hole, but …_session_bound_writes.sql revokes from `PUBLIC` precisely because of this default. Fixed in the same migration (unpushed, so no follow-up migration): `anon_may` is now false for both, `authenticated` keeps execute, and the authenticated path still offers 10 windows and accepts them. |
| 16  | One player takes at most one step of a week podium | PASS            | psql on a week with three published players: ranks 1, 2 and 3 went to ACE_9, DOMINO and SPEEDY on 312 / 287 / 251 — three players, not one player's three best days.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### What reopened, and closed

**Task 1, by two lines**, applied in this pass at the user's request rather than handed back
for a build cycle: a `revoke all … from public` before each of the two `grant … to
authenticated` statements. The migration had not been pushed, so it stays one migration.
Re-verified three ways — `anon` loses execute, `authenticated` keeps it, and the real
authenticated call still offers and accepts — and `pnpm check` is green after it.

### Still unverified

Criteria 2, 3 and 4 — the heading, the CLAIM press and the skip-and-return — plus how the
prose and the figure actually render. Five design revisions have gone through this card and
none of them has been looked at on a screen. `dev/gallery.tsx` carries `winnings('PODIUM')`
and `winnings('SECOND ONLY')` for exactly this.

## Review

**Verdict: hands backwards to `build`.** Two blockers, four defects and four notes. The
money arithmetic is sound — `verify` was right about that, and `/code-review high`
independently re-derived the rank-one equivalence and the `paid_through + 1` / `v_from`
boundaries and found no gap and no overlap. What neither pass had looked at is the two
things that only happen _around_ the arithmetic: what the deck does when the dialog
closes, and what a client that has not been updated yet reads off the new server.

`/code-review high` stalled once on the first run (600s watchdog, no output) and was
re-run; the second run completed. Every finding below was re-confirmed by hand against the
source before being written down — the two blockers with a run or a quoted line, not by
reading the agent's summary.

`simplify` was **not** run. It applies fixes, and applying them on top of code that is
about to be reopened would make the handback harder to read. It belongs in the next
review pass, after R1 and R2 are closed.

### Blockers

**R1 — closing the launch popup leaves an invisible layer over the intro, and the app is
dead until it is restarted.** `hooks/use-popup-deck.ts:51`.

`useWinnings` lost its `dismiss` along with the marker it used to move. But the old
`dismiss` did two things, and only one of them was about paying: `setBlocks([])` at
`HEAD:hooks/use-winnings.ts:71` is what emptied the deck. Nothing clears `blocks` now —
not `accept`, which documents at `use-winnings.ts:67` why it must not, and not `dismiss`,
which no longer exists. Its two siblings both still clear: `useWhatsNew.dismiss` →
`setUnseen([])`, `useWeeklyRecap.dismiss` → `setFacts(null)`.

So `cards.length > 0` and `visible` stay true for the rest of the session. `ModalCard`'s
`onDismiss` is documented at `modal-card.tsx:80` as "called once the exit animation has
finished … **this is what unmounts the dialog**" — and the gate at `index.tsx:2254` never
goes false, so it never unmounts. The root it leaves behind is
`absolute inset-0`, `zIndex: LAYER.dialog`, animated on `opacity` alone and with **no
`pointerEvents`** (`modal-card.tsx:129–135`): invisible, full-screen, and still taking
every touch.

Three more things are gated on `!whatsNew.visible` and so are suppressed for good in the
same stroke — the install prompt (`index.tsx:2273`), the replay-consent ask (`:2294`) and
the email ask (`newsVisible`, `:1432`).

Any player who is owed winnings hits this on the press the feature is named after.

The fix is to put `dismiss` back and have it clear `blocks` **without** touching the
watermark — the separation the item wanted all along. Accept still must not clear them,
for the reason `use-winnings.ts:67` gives.

**R2 — a server that has this migration and an app that does not shows every player
`FORTUNE  NaN`.** The spec's deployment note is wrong where it matters most.

The spec (`spec.md:320–325`) says **"Push the migration first, then deploy … The reverse
order is safe: the migration alone changes no fortune, because the backfill is what makes
it a no-op."** The backfill does make the _sum_ a no-op. It does not make the _wire shape_
one: `player_profile`'s `winnings` key stops emitting `daySum`/`weekSum` per board and
starts emitting `period`/`rank`/`scoreSum`. The shipped build reads only the old fields,
so `board.daySum` is `undefined`, `undefined * 0.5` is `NaN`, and `lifetimeOf` rounds
`NaN`. `groupDigits` then renders the string `"NaN"`.

Run against the shipped reading, verbatim in shape:

```
shipped app + old server : FORTUNE 13 100
shipped app + NEW server : FORTUNE NaN
```

The new client reading the _old_ shape is handled and tested
(`player-profile.test.ts:552`); this is that compatibility seam in the other direction,
which is the direction the spec actually mandates. It holds for the whole window between
pushing the migration and the bundle reaching a player.

Cheapest fix keeps one key and one migration: have the `winnings` key carry `daySum` and
`weekSum` **beside** the new fields, as `case when period = 'day' and rank = 1 then
score_sum else 0 end` and its week twin. An old client sums those across all rows and
lands on exactly its old number; a new client prefers `rank` and ignores them. Worth a
test pinned to it.

### Defects

**R3 — a session that crosses midnight swallows a day's winnings.** `use-winnings.ts:35`
and `:75` each call `todayISO()`. The offer is fetched with day _D_ (exclusive, so _D_
itself is never offered); if the app sits on the intro past midnight and the player then
presses, `acceptWinnings(D+1)` sets `paid_through = D`, marking a window paid that was
never offered and never shown. The watermark only moves forward, so it is gone. Capture
`today` with the fetch and reuse it for the accept.

**R4 — a failed accept tells the player the money was added.** `setAccepted(true)`
(`use-winnings.ts:74`) fires before the request and is never reverted, so the footer flips
to ADDED TO YOUR FORTUNE even when the RPC raised — offline, or `session revoked` because
the profile moved to another phone. Review focus 5 licensed _advancing the page_ on
failure, and that part is right; it did not license asserting a payment that did not
happen. The footer should hold on IS WAITING FOR YOU unless the write returned clean.

**R5 — the winnings page is not the only way off itself, which is what its design assumed.**
`popupPrimary`'s comment and the button's both say the press is the only exit. Neither is
true: `PageDots onSelect={setIndex}` (`whats-new-overlay.tsx:87`) jumps past the page on
any multi-card deck, and `ModalCard` renders its 5-dot `MenuButton` close unconditionally
(`modal-card.tsx:175`) regardless of `closeButton={false}`. Harmless by itself — the reward
is re-offered — but it is the second route into R1, and the comments should stop asserting
something the components do not provide.

**R6 — CLAUDE.md's `accept` row describes a button that was not built.** It still reads
"ACCEPT with the figure on it (Czech PŘIJMOUT) … **Never claim** — that word is already a
medal standing in `toMedals`". What shipped is CLAIM / VYZVEDNOUT, carrying no figure
(`popup-card-view.tsx:74`). The build notes say this row was updated; it was not. This is
the one file whose whole job is stopping the next person renaming that button back.

### Notes, not fixed

- **Weekly silver is gated on the week's Monday, not on when the week closed**
  (`migration:183`). Ship on a Thursday and the week closing that Sunday pays nothing for
  second or third, because its Monday predates `podium_from`. Defensible — that week was
  mostly played before the podium existed — but the header comment at `:21` ("the first
  window it pays for is the one closing tonight") is true of days only and should say so.
- **The backfill reads the server's `current_date`, the app reasons on the Prague clock.**
  Run the migration between 22:00 and 00:00 UTC and `paid_through` lands a day early, so
  the previous day's winnings leave the fortune until accepted. Not a loss — they are
  re-offered and restored on accept — but deploy outside that window.
- **`lib/winnings-lines.ts:116` still formats a score with `toLocaleString()`**, whose
  separator is the device locale's and is the decimal point in Czech. The line is
  pre-existing and untouched, but this diff moved the card's total to `groupDigits` for
  exactly that reason (`winnings-card.tsx:81`), so one card now groups its figure two ways.
  One-line fix; left out because it is pre-existing.
- **`'nine.seen-winnings.v1'` was retired but not added to `RETIRED_KEYS`**
  (`constants/storage.ts`), against that list's own stated policy of not leaving retired
  data on the device forever. `storage.ts:54` says the key is "left on the device, unread".

### Confirmed clean — the spec's six review-focus items

| #   | Focus                                               | Finding                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The backfill is the promise                         | Clean. One statement, one `current_date`, every profile including those with no `daily_scores` (`on conflict do nothing`). `podium_from = current_date` keeps every historical window at rank one, which is what the old function returned.                                |
| 2   | `podium_from` read on both paths                    | Clean. `player_profile` resolves it once in the `settled` CTE and passes it to the `winnings` call; `my_unpaid_winnings` computes the identical `coalesce(wp.podium_from, pr.created_at::date)`. Same floor, so historical silver cannot arrive through the back door.     |
| 3   | The figure and the delta are two computations       | Clean. Card is `Math.round(Σ score × winFactor)`; fortune is `Math.round(scored + Σ scoreSum × winFactor)`. Neither is derived from the other, both round once, so the two differ by at most 1. Nothing on screen promises equality — the caption says IS WAITING FOR YOU. |
| 4   | `dismiss` must no longer settle winnings            | Clean **as asked** — `use-popup-deck.ts:48` calls only `recap.dismiss()` and `news.dismiss()`. But removing the call took the deck-clearing with it: see R1.                                                                                                               |
| 5   | A failed accept must not advance into a lost reward | Half clean. The in-flight `accepting` ref guards the double request, and `ASKED_WINNINGS_KEY` is written only inside the `error === null` branch, so the watermark holds and the reward is re-offered. The page's _claim_ that it was paid is R4.                          |
| 6   | `my_winnings`' old signature                        | Clean. `drop function if exists public.my_winnings(uuid, date, date)` runs before the new one is created, and grants die with the function. The new 4-arg form is `revoke all … from public` with no grant to either role.                                                 |

### The house pass

- **Domain language** — R6. Otherwise the new words land: `podium` and `paid through` have
  their CLAUDE.md rows, and the CLAIM/`accept` split is spelled out at
  `popup-card-view.tsx:65` as the same arrangement as host/guest over `admin`.
- **Mode branching** — clean. Nothing outside `modes/` reads a mode's name;
  `SCORED_MODES.indexOf` is ordering, not branching.
- **Value maps** — clean. `PERIOD_SHARE`, `PODIUM_SHARE`, `PERIOD_ORDER` and `LEADS` are
  all `as const satisfies Record<…>`, so a fourth rank would break the build.
- **Strings** — clean. `i18n:verify` green at 672 messages. The Czech was read, not just
  counted: `VYZVEDNOUT`, `ČEKÁ NA TEBE`, `CO SE TI POVEDLO?`, and the podium lines keep the
  catalogue's gender-neutral idiom (`ti patřilo druhé místo`, `ti vyneslo bednu`) rather
  than a masculine participle.
- **How to Play** — no update needed, and checked rather than assumed. The diff touches no
  controls, targets, timers, modes, difficulty, scoring, streaks or lives; winnings and
  fortune do not appear in the guide.
- **Design** — clean. `--color-fortune: #a82a22` measures **5.49:1 on card and 6.07:1 on
  surface**, matching its comment to the stated decimal. The sweep that preceded it is
  recorded above and found 6 `text-score` call sites, moving the 3 that are fortunes.
  `TYPE.figureLarge` is a role, agreed before use.
- **Comments** — unusually strong, and carrying the _why_ throughout. The exceptions are
  the three that have gone out of date with the code: R5's two and the migration note in
  the notes above.
- **Tests** — 1640 pass. `lib/` coverage is real rather than happy-path: `winFactor` over
  all three steps, `awardBlocks` ordering, the Czech catalogue, and the legacy wire shape
  at `player-profile.test.ts:552`.

### Found outside this item

The working tree holds two other bodies of work with no item of their own — the address /
email-change work, and the splash-on-quick-return work. Three things turned up in them:

- **`app/(tabs)/index.tsx` did not compile.** The nickname modal's conversion to
  `ModalCard` never added the `ModalCard` or `PRIMARY_INK` imports; `tsc` reported four
  errors and ESLint two. **Fixed here** (two import lines) because nothing else could be
  checked until it was.
- **`use-account-email.ts:261`** — the confirmed-card `DONE_HOLD_MS` timer has no cleanup
  and no identity check, so closing that card and immediately reopening ADD AN EMAIL gets
  the fresh card closed under the player by the stale timer.
- **`email-code-modal.tsx:278`** — `sentBySelf.current` is cleared only by the erase
  animation, which runs for `CODE_FAULTS` only. After an `offline` or `rate_limited`
  answer the latch stays held, so retyping the same code will not auto-submit.

These are notes for whoever shapes those two items, not work for this one.

### Worth their own item later

- The **17 raw large-mono values** the `TYPE.figureLarge` sweep found and deliberately left
  — `profile-score`'s suffix, both admin screens, `run-top-bar`, `how-to-play`.
- A **`pointerEvents` guard on `ModalCard`'s root**, so a caller that forgets to unmount
  degrades to a visible stuck dialog rather than an invisible dead app. R1 is a bug in this
  item; that it could be silent is a sharp edge in the component.
- The **89 → 87 pre-existing ESLint warnings**, all `no-restricted-syntax` over raw text
  sizes and tracking.

## Build notes — the review pass

Six findings closed, two notes taken. `pnpm check` is green: 0 ESLint errors, 87 warnings
all pre-existing, 1641 tests (one new).

**R1 — the stuck overlay.** `useWinnings` has a `dismiss` again, and it does exactly one of
the two things its predecessor did: `setBlocks([])`, and nothing to the watermark. That
split is the whole point of the item, and losing the clearing along with the settling is
what broke it. `usePopupDeck.dismiss` now calls all three hooks, and its comment says why
leaving one out is not a cosmetic omission — the deck's `visible` is what unmounts the
dialog, so a hook that keeps its state keeps a transparent full-screen layer over the intro.

**R2 — the shape an old client reads.** `player_profile`'s `winnings` rows carry `daySum`
and `weekSum` beside `period`/`rank`/`scoreSum`. A rank-one row carries its own sum in the
matching field and every other row carries nought, so a build that predates the podium —
which sums `daySum × dayFactor + weekSum × weekFactor` across all rows — lands on exactly
the number it had before, however many podium rows it is handed.

Proved against the local stack rather than argued. Across all 26 profiles:

|                                     | podium rows        | old-client arithmetic | new arithmetic, rank one | what podium rows leak into the old sum |
| ----------------------------------- | ------------------ | --------------------- | ------------------------ | -------------------------------------- |
| as backfilled                       | 0                  | 1617.0000             | 1617.0000                | 0.0000                                 |
| `podium_from` dragged to 2000-01-01 | 9 silver, 6 bronze | 1617.0000             | 1617.0000                | 0.0000                                 |

The second row is the one that matters: fifteen podium rows appear and the old client's
total does not move. `lib/player-profile.test.ts` pins the other direction — a new client
reading a row that carries both shapes must take the step and ignore the pair, or a
rank-one board would be counted twice.

The spec's order-of-deployment paragraph keeps the warning review put on it. Migration
first is still right; it is now also safe.

**R3 — the clock read twice.** `offeredFor` holds the day the offer was drawn for and the
accept settles against it. The offer asks for windows _before_ that day, so settling against
a later one told the server to pay through a window that had never been offered — and the
watermark only moves forward, so it was gone rather than deferred.

**R4 — the claim of payment.** `setAccepted(true)` moved into the clean-response branch.
The page still advances on the press, which review focus 5 licensed and which stands: a
failed request must not strand the player on a page with one button. What it did not license
was the footer saying ADDED TO YOUR FORTUNE over a write the server refused.

**R5 — comments that outran the components.** Both now say what is true: the press is the
only thing on the page that _acts_, not the only way off it. The dots jump and `ModalCard`
always draws its header close — `closeButton={false}` governs the CLOSE button under the
content, which is a different control. This matches acceptance criterion 4, which already
expected paging past to re-offer the reward unpaid.

**R6 — the domain row.** CLAUDE.md's **accept** row described a button nobody built. It now
says what shipped: the code word is `accept` throughout, the player reads CLAIM
(VYZVEDNOUT), the button carries no figure, and the split runs the same way as host/guest
over `admin`.

**The two notes taken.** The migration's backfill comment now says that weeks are filed
under their Monday, so the week in progress pays gold only and the first week to pay silver
starts on the next Monday — conservative and intended, but not what "the first window it
pays for is the one closing tonight" said. The same comment now names the server-clock
window to deploy outside. And `'nine.seen-winnings.v1'` joins `RETIRED_KEYS` rather than
sitting on the device looking like a date that still means something.

**One note left, deliberately.** `lib/winnings-lines.ts:116` still formats a score with
`toLocaleString()`, whose separator follows the device locale rather than the app's. The
line is pre-existing and untouched by this item; changing it is a one-liner but it is the
neighbourhood, not the task.

**What is not covered by a test, and why.** R1, R3 and R4 all live in `useWinnings` and
`usePopupDeck`, and this repo has **no hook tests and no `@testing-library` dependency** —
`lib/` is where its tests live. Standing that up is its own work item, not something to
smuggle into a review fix. So those three are verified by reading, and the app has to be
driven to confirm them. R1 in particular is the one `verify` must actually watch: open the
launch popup, close it, and press something on the intro.

**Still unverified from before.** Criteria 2, 3 and 4 were skipped at `verify` because
driving the app was declined, and nothing here changes that. `dev/gallery.tsx` carries
`winnings('PODIUM')` and `winnings('SECOND ONLY')`.

## Verification log — the review pass

**Verdict: 12 of 12 criteria PASS, 0 FAIL, 0 SKIPPED.** The three that had gone unchecked
through two passes — 2, 3 and 4 — were driven in the real app this time, as was the R1
regression, which is recorded below as criterion 17.

Driven on Chrome via the devtools MCP against the **local** stack
(`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, checked before a single press, since
CLAIM writes). A fresh anonymous profile was given a nickname, a day taken outright
(SPD HRD 7 Oct, 500) and a day placed second on (ACC ESY 6 Oct, 225), with its watermark
dragged back five days. All seeded rows were removed afterwards.

Expected figure, computed before looking: `500 × 1 × 0.5 × 1 + 225 × 0.5 × 0.5 × 0.5`
= `250 + 28.125` → **278**.

| #   | Criterion                                           | Result | Evidence                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No fortune moves on the day it lands                | PASS   | Across all 26 profiles the old client's arithmetic over the new payload comes to **1617.0000**, identical to the rank-one weighting the old function paid. Re-proved with the podium forced on: still 1617.0000, podium leak **0.0000**.                                                                 |
| 2   | Heading, CLAIM, the figure once, `text-fortune`     | PASS   | Card read `WHAT DID YOU PULL OFF?` / `278` / `IS WAITING FOR YOU` / `CLAIM`. Computed style on the figure: `rgb(168,42,34)` = `#a82a22`, `22px`, weight `900`, mono — `TYPE.figureLarge` + `--color-fortune`. `278` occurs **once** on the page. The profile modal's own figure is `rgb(168,42,34)` too. |
| 3   | CLAIM advances, fortune up by _N_ ± 1               | PASS   | Fortune before was provably **0** (`totals: []`, `winnings: []`). Pressed CLAIM; the profile then read **FORTUNE 278**. _N_ = 278, delta = 278, difference **0**. The two are computed independently — the card from the awards, the profile from `player_profile`.                                      |
| 4   | Killing or paging past re-offers it, unpaid         | PASS   | Closed via the header close without pressing: `paid_through` stayed `2026-10-04`, `winnings` stayed `[]`, and the brake key was never written. Reloaded — the same 278 was offered again.                                                                                                                |
| 5   | Accepting twice pays once                           | PASS   | psql as the player: one window offered → accept returns `2026-10-08` → second accept returns `2026-10-08` → a stale `current_date - 1` also returns `2026-10-08` → 0 offered after.                                                                                                                      |
| 6   | A wiped device is offered everything since the mark | PASS   | Watermark dragged back a fortnight; `my_unpaid_winnings` returned the window from the server's own boundary, with no device-side date involved.                                                                                                                                                          |
| 7   | `winFactor` over all three steps                    | PASS   | `vitest run lib/winnings.test.ts` and the three siblings — 102 tests.                                                                                                                                                                                                                                    |
| 8   | Second pays half, third a tenth, fourth nothing     | PASS   | ACC EASY 2026-10-06, five published players: SPEEDY 1st on 231, ACE_9 2nd **on 218 — their own score**, PIXEL 3rd on 174. DOMINO (4th) and NOVA (5th) offered nothing.                                                                                                                                   |
| 9   | A pre-`podium_from` second place pays nothing       | PASS   | The same day with each player's real backfilled floor returns a highest rank of **1**; silver and bronze vanish.                                                                                                                                                                                         |
| 10  | The prose says which step, ordered                  | PASS   | On screen: "Nobody beat you on 7 Oct: SPD HRD with 500." then "6 Oct left you one place short on ACC ESY with 225." Newest first, gold before silver, one sentence per window per step.                                                                                                                  |
| 11  | A revoked session cannot accept                     | PASS   | psql with a `session_id` absent from `auth.sessions` raises `accept_winnings: session revoked` at the RAISE, before any write; the watermark stood.                                                                                                                                                      |
| 12  | `pnpm check` green, Czech included                  | PASS   | 0 ESLint errors, 87 pre-existing warnings, Prettier, `tsc`, Knip, i18n verify, 1641 tests.                                                                                                                                                                                                               |

### The review findings, re-checked in the app

| #   | Criterion                                                 | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 17  | **R1** — the dialog unmounts and leaves nothing behind    | PASS   | On both paths — pressing CLAIM, and closing without pressing — a sweep for full-screen `absolute`/`fixed` elements above `z ≥ 10` returned **zero**. `elementFromPoint` at the intro's PROFILE button returned `SPAN:PROFILE`, the button itself. Pressing it opened the profile. Corroboration: the replay-consent ask, gated on `!whatsNew.visible`, appeared after the dialog closed — under the bug it was suppressed for the session. |
| 18  | **R2** — a new server feeds an old client its old fortune | PASS   | Live payload carries both shapes: the rank-one row has `daySum: 500`, the rank-two row `daySum: 0`. An old client sums `500 × 1 × 0.5` = 250, the gold alone, which is exactly what the old server paid it.                                                                                                                                                                                                                                |
| 19  | **R4** — a refused accept makes no claim of payment       | PASS   | By construction and by reading: `setAccepted(true)` is inside the `error === null` branch. The happy path was driven; the failure path was not forced, so this rests on the code rather than on a run.                                                                                                                                                                                                                                     |
| 20  | **R5** — the press is not the only way off the page       | PASS   | The dialog's card carries exactly two pressables: the 22×22 unlabelled header close and CLAIM. `closeButton={false}` leaves the header close standing, which is what the corrected comments now say.                                                                                                                                                                                                                                       |
| 21  | `wins` takes rank one only                                | PASS   | Unlooked-for and worth recording: MEDALS HELD, EVER listed **SPD HRD** only. The ACC ESY second place did not appear as a board held — the build note's rank-one filter, confirmed on screen.                                                                                                                                                                                                                                              |

### Not checked

- **R3's midnight case** — the fix is a captured ref rather than a second clock read, and
  forcing a session across midnight was not attempted. Reading only.
- **R4's failure path** — the accept was never made to fail, so the footer holding on
  IS WAITING FOR YOU over a refused write is unproven in the app.
- **Czech on screen.** `i18n:verify` passes and the catalogue was read at `review`, but the
  card was not driven with the locale switched.

## Review — second pass, over the fixes

**Verdict: clean.** One defect found and fixed in place; everything else confirmed. The
six original review-focus items now hold without the two caveats the first pass attached
to them, and the house pass turned up one gap that belongs to another item entirely.

### Found and fixed

**R7 — the in-flight guard could latch shut and kill the button for the session.**
`accepting.current` was released only inside `.then`. If `acceptWinnings` ever rejects
rather than resolving with an error in hand, the guard stays closed and `accept` returns
early forever after.

This mattered more after R4 than before it. Until R4, a failed accept flipped `accepted`
true and the button vanished, so there was nothing to press again. Now the button correctly
goes on offering CLAIM after a failure — and a latched guard would make that offer a dead
one. The release moved to `.finally`, which runs however the promise ended. The comment
says which of the two jobs the guard has: stop two writes, not stop a second attempt.

### The six review-focus items, re-confirmed

1. **The backfill** — unchanged by this pass and still exact: the old client's arithmetic
   over the new payload comes to 1617.0000 across all 26 local profiles, with the podium
   forced on and off alike.
2. **`podium_from` on both paths** — unchanged. `player_profile` resolves it once in
   `settled`; `my_unpaid_winnings` computes the identical coalesce.
3. **Two computations** — now measured end to end rather than argued: the card showed 278
   and the profile afterwards read 278, from independent code paths.
4. **`dismiss` must not settle winnings** — fully clean now, where the first pass could only
   say "clean as asked". `usePopupDeck.dismiss` calls all three hooks; `useWinnings.dismiss`
   clears `blocks` and touches no watermark. Driven in the app: closing without pressing
   left `paid_through` at `2026-10-04` and re-offered the same reward next launch.
5. **A failed accept must not advance into a lost reward** — fully clean, and this pass
   forced the failure rather than reasoning about it. With the session row deleted, CLAIM
   was refused: the card never said ADDED TO YOUR FORTUNE, the watermark held, the brake key
   was never written, and `my_winnings` still returned the window.
6. **`my_winnings`' old signature** — unchanged; the drop runs before the create and grants
   die with the function.

### The house pass

- **Domain language** — the stale **accept** row is corrected and now describes the button
  that exists. The new comments stay inside the vocabulary: watermark, paid through,
  fortune, reward.
- **Mode branching** — none. Nothing in the fixes reads a mode's name.
- **Value maps** — none added; the existing four remain `as const satisfies Record<…>`.
- **Strings** — no new copy in this pass. The Czech card was **driven on screen** for the
  first time, which closes the gap `verify` left open: `CO SE TI POVEDLO?` /
  `7. 10. tě nikdo nepřekonal: RYCH TĚŽ se skóre 500.` /
  `6. 10. ti k vítězství chybělo jedno místo — PŘES LEH se skóre 225.` / `ČEKÁ NA TEBE` /
  `VYZVEDNOUT`. Board codes localise, the date takes Czech form, the figure keeps
  `--color-fortune`, and no generated ids appear. Both podium lines stay clear of gendered
  participles — `nikdo nepřekonal` takes its gender from _nobody_, not from the player, and
  `chybělo jedno místo` is neuter.
- **How to Play** — still untouched and still true; no controls, targets, timers, modes,
  difficulty, scoring, streaks or lives changed.
- **Design** — no visual change in this pass.
- **Comments** — the three that had gone out of date with the code were corrected last
  pass and remain accurate; the dialog's card carries exactly two pressables, which is what
  they now say.
- **Tests** — one added, pinning that a client which understands the podium ignores the
  legacy pair. R1, R3, R4 and R7 remain untested for the reason already recorded: no hook
  test setup exists in this repo.

### Checked and found not to bite

- **Stale `accepted` / `blocks` across a profile change.** `useWinnings`'s effect keys on
  `userId`, which is React state in `use-supabase-auth` — so a restore could in principle
  re-run it in place, leaving the previous player's rewards on screen or a stale `accepted`
  suppressing the button. It cannot: `restoreProfile` ends in `reloadApp()`
  (`use-supabase-auth.ts:448`), so the tree is torn down and the hook remounts clean. Worth
  recording because the guard is three files away from the thing it protects.
- **A shrinking deck mid-render.** `dismiss` empties `cards` while the overlay may still
  hold an index past the end; `whats-new-overlay.tsx` already returns null on
  `card === undefined`, so the shrink is handled rather than thrown.

### Simplify

Run inline rather than as four subagents — this session carries a standing instruction not
to use the Agent tool unasked. Nothing to apply: `dismiss` deliberately mirrors its two
sibling hooks, `offeredFor` is not derivable from `blocks`, and the SQL adds two `case`
expressions on a path that runs once per profile open.

The one altitude note stands and is deliberately **not** this item's work: the deeper fix
for R1 is a `pointerEvents` guard on `ModalCard`'s root, so any caller that forgets to
unmount degrades to a visible stuck dialog rather than an invisible dead app.

### Worth their own item later

- **`ModalCard` should not be able to fail silently** — the `pointerEvents` guard above.
- **The intro greeting is not translated.** `menu-overlay.tsx:333` builds it from raw
  template literals — `` `Hi ` ``, `` `, let's multiply` `` and the no-nickname fallback
  `` `Let's multiply` `` — so a Czech player reads English there. The catalogue's
  `msgid "Let's multiply"` looks orphaned from when it was a `<Trans>`. Found by driving the
  card in Czech; **outside this diff** (the file is unmodified) and left alone.
- **`lib/winnings-lines.ts:116`** still formats a score with `toLocaleString()`.
- **The legacy `daySum`/`weekSum` pair** is dead weight the moment no build in the wild
  reads it. The migration comment says so; somebody should eventually delete it.
- **The 17 raw large-mono values** `TYPE.figureLarge` would own.
- **The two defects in the un-itemed email work** — `use-account-email.ts:261` (a
  `DONE_HOLD_MS` timer with no cleanup and no identity check) and
  `email-code-modal.tsx:278` (the auto-submit latch held after a non-code fault). Both
  re-confirmed present and both still belong to whoever shapes that item.

### `/code-review high` — triage

It completed on the third attempt (stalled once at 600s, re-run, then an 11-minute pass over
~3,000 lines across 61 files — the diff against `origin/main`, so **six committed commits**
as well as the working tree). It independently traced the SQL date arithmetic across
accept-on-Monday, accept-mid-week and accept-twice sequences and found no double-pay and no
lost window, and signed off on the old/new client compatibility seam.

Six findings. **Two are this item's; four belong to the account-restore and email work.**

| #   | Finding                                              | Mine? | Outcome                                                                |
| --- | ---------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| 1   | `session-verdict.ts:44` — an outage reads as revoked | No    | **Reported, not fixed.** Committed work, `account-restore`. See below. |
| 2   | `use-supabase-auth.ts:279` — the 2-minute check      | No    | **Reported, not fixed.** Same item. See below.                         |
| 3   | `email-code-modal.tsx:417` — resend keeps the digits | No    | Reported. The email work's.                                            |
| 4   | `whats-new-overlay.tsx:131` — the confirmation copy  | Yes   | **Left, deliberately.** The spec chose this. A design question, below. |
| 5   | `use-winnings.ts:41` — `ready` can never release     | Yes   | **Fixed** — R8 below.                                                  |
| 6   | `use-account-email.ts:261` — the stale hold timer    | No    | Reported. Already flagged twice in this document.                      |

#### R8 — fixed: `ready` could stay false for the life of the session

Task 6 rewrote this hook and, in doing so, dropped the `try { … } finally { setReady(true) }`
that used to wrap the IIFE; four exits each set `ready` individually, and a throw is a fifth
exit that sets nothing. `useWinnings.ready` is one of three the deck waits on, and the
install prompt (`index.tsx:2272`) and the session-recording ask (`:2293`) both sit behind the
same gate — so one unforeseen throw and neither is ever shown again, with nothing on screen
to explain it. The same shape as R1: a gate with no release. The `finally` is back, and the
comment says what it is guarding.

The remaining throw surface is small — `AsyncStorage.getItem` is `.catch`-ed and
`supabase.rpc` returns errors rather than throwing — which is why this is low rather than
high. The guard cost nothing and was load-bearing.

#### Finding 4 — left alone, and why it is a question rather than a defect

`usePopupDeck` always puts winnings at index 0, so `isLast` is true exactly when winnings is
the **only** card — the ordinary case once the recap week and the news queue are empty.
Pressing CLAIM then runs `onAccept()` and `close()` in one handler, and the dialog is gone
before the server has answered. Two consequences, both real:

- **`ADDED TO YOUR FORTUNE` is near-unreachable copy.** It shows only on a multi-card deck,
  and only if the player pages back. This matches what the app actually did when driven: the
  dialog vanished on the press.
- **A failed accept is silent.** The player read IS WAITING FOR YOU, pressed, and is told
  nothing when the write did not land.

The review's proposed fix — hold the page until `accepted` flips — is the one thing the spec
forbids. Review focus 5 and the Shape both chose advance-on-press _precisely_ so a failed
request cannot strand the player on a page whose only action is the button; holding until
`accepted` flips means a failure holds them there for ever. Anything better (advance on
success, say something on failure) is new state and new copy, which is `shape`'s to decide
and not a review's to invent. Recorded as a question for the user, not applied.

#### Findings 1 and 2 — not this item's, and they should not ship unexamined

Both are in the **account-restore** work (`docs/work/2026-10-07-account-restore`, marked
shipped and waiting on `/deploy`), so they are outside this item and were left alone. They
are recorded here because they are severe and are queued to go out:

`isNetworkFailure` matches transport phrasings only — `failed to fetch`, `timeout`,
`aborted`. A Supabase **503, 500 or 429 is not one of them.** In `sessionVerdict`, the
`'gone'` branch pairs both reads (`accountError !== null && profileError === null &&
!profileFound`), but the `'revoked'` branch on the next line asks nothing about
`profileError`. So an outage that answers _both_ reads with a 5xx returns `'revoked'` — and
`'revoked'` means `markProfileMoved()`, `signOut`, and a fresh anonymous session. The
player's career leaves the device, and an anonymous player with no address has no way back.
The old code took the opposite branch on a profile-read error and kept the session, so this
is a new failure mode rather than an inherited one.

The two-minute / on-foreground `check()` in `use-supabase-auth.ts:279` is blunter still: it
has no `sessionVerdict` cross-check at all, so any transient non-network error from
`/auth/v1/user` discards the profile. Both want the same shape of fix — require the profile
row to still be there, or demand a repeated refusal before acting — and both want their own
spec, because "when do we decide a profile has moved" is a design decision about the one
piece of a player that outlives the device.
