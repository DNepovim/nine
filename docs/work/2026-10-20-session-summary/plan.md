# The summary a closed session leaves behind — Plan

Spec: docs/work/2026-10-20-session-summary/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261020000000_my_session_summaries.sql` **(amended, 3rd pass: `closes_at` truncated to milliseconds)** — `my_session_summaries(timestamptz)`; `supabase/tests/session_scores.sql` covers its three row rules — also corrected a stale assertion in that file that fails on `main` (see build notes)
- [x] 2. `hooks/use-open-sessions.ts` — one shared launch read; `hooks/use-session-card.ts` consumes it, behaviour unchanged
- [x] 3. `lib/session-summary.ts` + `lib/session-summaries.ts` — the shape, which single summary is owed, the lookback, the watermark it advances to, the invitation, the RPC call; `lib/session-summary.test.ts`
- [x] 4. `hooks/use-session-summaries.ts` **(reopened by verify, criterion 1: the flag gate)** — the read, the watermark, the wake, `dismiss`; `constants/storage.ts` gains the key — the hook also owns the announcement request (it is the only thing that knows a window shut while the app was open), so task 10's `index.tsx` half is not needed
- [x] 5. `components/overlays/summary-place.tsx` + `summary-card.tsx` — the podium, the player's own line, the invitation
- [x] 6. `types/popup.ts`, `hooks/use-popup-deck.ts`, `components/overlays/popup-card-view.tsx` — the fourth page, its place in the order, its title and accent
- [x] 7. `machines/game.ts` — the `EXPIRE` event; `machines/game.test.ts` covers it
- [x] 8. `lib/game-over-title.ts`, `game-over-sequence.tsx`, `game-over-overlay.tsx`, `run-screen.tsx` — the `expired` tier, `RunCta.disabled`, the dare withheld
- [x] 9. `components/game/best-scores-line.tsx`, `app/(tabs)/index.tsx` — the red at the boundary, the one-second grace, the `EXPIRE` send. **Reopened by verify (criterion 5) and fixed:** the red was a sticky boolean; it is now the instant that shut, derived
- [x] 10. `lib/announcements.ts`, `lib/announcement-style.ts` — the two lines and the request. `sessionLost` renamed `sessionTaken` (see build notes). Also `lib/record-medals.ts` and `components/game/announcement-effect.tsx`, two exhaustive maps over `AnnouncementId` the spec did not list; `use-announcement-request.ts` comment still to do
- [x] 11. `dev/gallery.tsx` — won, silver, off the podium, nobody scored, plus **ASK THE SERVER**, an `Action` that fetches a real summary (see the fourth-pass notes). **Reopened by verify (criterion 14) and fixed:** the variant key omitted `invite`, so two entries collided
- [x] 12. `how-to-play-overlay.tsx` bullet, `CLAUDE.md` row, `pnpm i18n:extract` + Czech (8 strings); also `lib/local-reset.ts`, which the spec did not list — see build notes

## Verification log

### Fourth pass — the review's nine, and the drill

**Verdict: 0 FAILED, 8 PASS, 2 PARTIAL.** Both partials are staging limits, not misbehaviour.

| Finding                             | Result           | Evidence                                                                                                                                                                                                                                                      |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** a fortune could go down       | PASS             | inside the grace the figure is nought _before and after_ a rival posts — nothing to lose; out of the grace the same place pays its settled 500. Two assertions added; `pnpm db:test` green                                                                    |
| **B** How to Play                   | PASS             | the CHALLENGES bullet names the payout; Czech written; `i18n:verify` green                                                                                                                                                                                    |
| **C** untested share table          | PASS, by removal | the TypeScript function is deleted — there is no second implementation left to test                                                                                                                                                                           |
| **D** the title rewriting itself    | PARTIAL          | the gate is in place and correct by inspection (`if (inRun) onWindowShut()`, and `inRun` is `isPlaying \|\| isPaused`, false on game over). Reproducing it needs a run that dies on _lives_ within seconds of a close — the same staging limit as criterion 5 |
| **E** a bonus the server never paid | **PASS, driven** | took **first place** on a session that closed before `session_podium_from()` and the page printed **no** fortune line. The old client-side version would have claimed +8 000                                                                                  |
| **F** the wake racing the submit    | PARTIAL          | the re-ask on a run releasing its session is in place and reads correctly; the end-to-end HOME flow was not driven, for the staging reason above                                                                                                              |
| **G** `invite` rebuilt every render | PASS             | memoised on `[summary, sessions]`, both of which change about twice a launch                                                                                                                                                                                  |
| **H** a board ranked per session    | PASS             | the gates are a `case` and short-circuit; correctness unchanged (`db:test` green). The saving itself is structural, not measured                                                                                                                              |
| **I** the circular import           | PASS             | gone with the function that caused it; `pnpm check` green                                                                                                                                                                                                     |
| **drill** second run ending at once | PASS             | the new test fails against `nextTargetId` and passes against `dealt` — confirmed by reverting the fix and watching it go red                                                                                                                                  |

### The criteria the changes could have moved

- **8 — a place pays into the fortune.** Stronger than it was. The figure now comes from
  `session_podium_bonus` itself: a paying session printed **+3 100** against the server's own
  3 100, and the pre-watermark session printed nothing at all. The page cannot drift from
  the money because it no longer computes any of it.
- **7 — the page.** Unchanged and correct: HABIT in its own gradient, `2 PLAYERS`, gold over
  silver, the reader's nickname on its pill, the fortune line in the fortune red.
- **10 — the invitation.** Re-observed live: `ON NOW / FOUR KEYS / 5:21:14`.
- The dev sidebar still lists all seven entries and renders, which is the regression the new
  `bonus` field could have caused.

### Third pass

**Verdict: 0 FAILED, 11 PASS, 2 PARTIAL, 1 SKIPPED.** Nothing is broken. The two partials
are sub-clauses I could not stage, not behaviour that misbehaved — both are named below
rather than waved through.

| #   | Criterion                                              | Result      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Summary after the splash for an eligible player        | PASS        | with a `session_scores` row and a backdated watermark the dialog is up on the intro; with the rows deleted, nothing appears                                                                                                                                                                                                                                                                                                                                                          |
| 2   | One dialog, summary first, with winnings and the recap | SKIPPED     | could not stage it — it needs unpaid winnings _and_ a freshly turned week alongside a closed session. The deck's order is a pure list in `usePopupDeck` and the summary is first in it, but that is reading, not running                                                                                                                                                                                                                                                             |
| 3   | Newer of two told; marker past both                    | PASS        | `vitest run lib/session-summary.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | Dismiss marks it told; a killed launch re-offers       | PASS        | relaunched with the dialog unread → same summary, marker unmoved. Dismissing moves it to the session's own close and it does not return                                                                                                                                                                                                                                                                                                                                              |
| 5   | Mid-run shut: red, 1s, expired title, dead PLAY AGAIN  | **PARTIAL** | driven: clock read `0:00`, the run ended **one second later** (2″ elapsed, so it was the grace and not the lives), the title came from the `expired` pool — **BELL RANG** — PLAY AGAIN was visibly dead and no step-up dare was offered. **Two sub-clauses unproven:** the countdown's _colour_ at the boundary (the 0:00 was observed, the red was not sampled), and HOME→summary as one continuous flow. The latter's mechanism is proven separately by the wake under criterion 6 |
| 6   | The wake: a window shutting under a live app           | PASS        | at +10s after load no summary and the challenge card still live; at **+34.6s** the summary appeared with no reload. That is the wake firing at `closesAt + SETTLE_MS`. The _announcement_ half — the bar line during a run in another mode — is **not** driven, for the same staging reason as 5                                                                                                                                                                                     |
| 7   | The podium's layout and the player's own line          | PASS        | all gallery cases plus live data. Criterion amended this pass: it still said the place "carries a YOU", which was replaced by the pill                                                                                                                                                                                                                                                                                                                                               |
| 8   | A place pays into the fortune                          | PASS        | `session_podium_bonus` returns 1000 / 400 / 120 for a 1000 / 800 / 600 podium; 0 before the watermark; 0 while open; `player_profile` reports base + bonus exactly. Live: silver on 6 200 printed **+3 100 TO YOUR FORTUNE**, twice                                                                                                                                                                                                                                                  |
| 9   | A race prints times everywhere                         | PASS        | 9.4″ / 11.2″ / 12.9″ on all three places                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 10  | The invitation names what `cardSession` names          | PASS        | both halves, incl. **NEXT UP: HABIT** and the general line                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 11  | The RPC's three row rules                              | PASS        | `pnpm db:test`; anon sees 0 rows where the owner sees 1                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 12  | `loadOpenSessions` once per launch                     | PASS        | **exactly one** `open_sessions_with_leaders` on a launch where both consumers are live — the intro card and the summary hook (which fired its own `my_session_summaries`). Unprovable last pass, when the flag bug had the second consumer switched off                                                                                                                                                                                                                              |
| 13  | A failed read holds the marker                         | PASS        | cut the gateway: marker unmoved, nothing shown. Restored it: the same summary was offered again, marker still unmoved                                                                                                                                                                                                                                                                                                                                                                |
| 14  | `pnpm check` green, Czech included                     | PASS        | exit 0 — 1969 tests, 118 files                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### What the two partials actually cost

Both come from one obstacle rather than two: a challenge run dies of its own three lives in
about fifteen seconds when nobody is playing it, and the client fixes its copy of `closesAt`
when the run starts — so the window has to be made to shut inside a fifteen-second slot that
opens after a page load I cannot time to better than a few seconds. Synthetic clicks do not
open the challenge modal (React Native Web wants real pointer events), and real ones cost a
round trip each.

What that leaves unseen is narrow: the countdown's red, and the announcement line. Both are
one-line consequences of boundaries that **were** observed firing — `onArrive` reached the
screen (the run ended on its grace) and the wake reached the hook (the summary appeared at
+34.6s). Worth a human eye before anyone calls them done; not worth blocking on.

### Second pass

> **Numbering note.** This table predates the sixth pass, which inserted the podium payout
> as criterion 8 and pushed the old 8–13 down one. Read rows 1–7 against the spec as it
> stands; rows 8–13 here are the spec's 9–14; and row 14 here (the gallery key) is not a
> spec criterion at all — it was raised by this stage and is kept for the record.

**Verdict: 1 FAILED, 7 PASS, 5 SKIPPED.** Both failures from the first pass are fixed and
confirmed. In their place is a larger one, found only because the server was finally
reachable: **the summary never appears in the app at all.** Reopens **task 4**.

| #   | Criterion                                             | Result              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Summary after the splash for an eligible player       | **FAIL**            | the feature is inert. `useSessionSummaries` gates itself on `useFlag('challenges')`, but it is reached through `usePopupDeck`, called in `GameScreen`'s **body** at `index.tsx:869` — while `FlagsProvider` is rendered in that same component's **JSX** at `index.tsx:1775`. A provider in a component's own markup is not above that component's hooks, so `useFlag` there reads the default context and is **always false**. Instrumented and watched: `[SUMMARY] launch effect, canSee= false`, twice, never true. Seeded a closed session this profile scored on (board `DEV_554295=18400, SPEEDY=15120, DEV_95CA01=4300`) and set the marker two days back; `my_session_summaries` was never requested and no dialog appeared. `MenuOverlay` is a _child_ of that JSX, which is why `useSessionCard` works and the FOUR KEYS card does draw — that split is what gave it away. |
| 2   | One dialog, summary first, with page dots             | SKIPPED             | nothing to carousel until 1 is fixed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | Newer of two told; marker past both                   | PASS                | `vitest run lib/session-summary.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | Dismiss marks it told; a killed launch re-offers      | SKIPPED             | blocked by 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5   | Mid-run shut: red, 1s, expired title, dead PLAY AGAIN | SKIPPED             | the sticky-red fix is structural — `shutAt` against `session.closesAt` cannot go stale — but proving it needs two consecutive challenge runs around a closing window. Deferred so it can be driven in the same pass as 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6   | Other-mode shut: the bar line, run untouched          | SKIPPED             | the announcement comes from the same dead hook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7   | The podium's layout and the player's own line         | PASS                | all four gallery cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 8   | A race prints times everywhere                        | PASS                | 9.4″ / 11.2″ / 12.9″ on all three places                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9   | The invitation names what `cardSession` names         | PASS                | **both halves now.** The general line renders, and with failure 14 fixed the invited variant is reachable and draws **NEXT UP: HABIT**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10  | The RPC's three row rules                             | PASS                | `pnpm db:test`; anon sees 0 rows where the owner sees 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 11  | `loadOpenSessions` once per launch                    | SKIPPED             | exactly one `open_sessions_with_leaders` request per launch was observed — but only one consumer is live, the other being disabled by failure 1, so the _sharing_ is unproven                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 12  | A failed read holds the marker                        | SKIPPED             | blocked by 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 13  | `pnpm check` green, Czech included                    | PASS                | exit 0 — 1967 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 14  | Each gallery variant has a unique key                 | **PASS** (was FAIL) | the duplicate-key error is gone and the six variants read distinctly, incl. `OFF THE PODIUM · NEXT UP`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### The same bug, one hook over

**`useWeeklyRecap` is broken in exactly the same way, and it is not mine.** It reads
`useFlag('recap')` and is reached through the same `usePopupDeck` call, so `canSee` is
always false there too and the weekly recap can never appear. Its work item
(`docs/work/2026-10-06-weekly-recap`) is still `Stage: build` and was never verified, which
fits. It deserves its own item rather than a fix smuggled in here — but whatever fixes the
summary should fix the recap in the same move, because they fail through one line.

### How the server was reached

CleanMyMac still holds port 54321, so Kong could not publish its own. Rather than stop a
user application or restart the stack, a `socat` container was attached to
`supabase_network_nine` publishing **54399 → supabase_kong_nine:8000**, and `.env` pointed
at it. `.env` is gitignored and nothing tracked was touched. **Both are still in place** so
the next pass need not rebuild them: container `nine-kong-proxy`, and
`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399` (the original is saved in the scratchpad).

### First pass

Criteria 5 and 14 failed, 6 passed, 6 were skipped behind the port conflict. Both failures
were sticky state outliving the thing it described; both are fixed — see the build notes.

## Build notes — seventh pass — the review's nine, and one that was not ours

**A — a fortune could go down.** `session_podium_bonus` now waits out the ten minutes a
score is still accepted for, because that is exactly the span during which the standings
can still move. Paying from the close meant a rival posting inside the grace could halve
what somebody had already been paid. The ten minutes is now `session_score_grace()` rather
than a second literal; `submit_session_score` still holds its own copy inline and the
comment says the two must move together. Proven both ways: inside the grace the figure is
nought before _and_ after a rival posts, so there is nothing to lose; out of it, second
place pays its settled 500. Two assertions pin it.

**E, C and I together — the client stopped having an opinion about money.** The share table
on the TypeScript side is **deleted**. `my_session_summaries` now returns `mine.bonus`,
reckoned by the same function that pays it, and the card prints what it is given. That one
change fixes all three: the page can no longer print a figure for a session older than the
watermark (E), there is no second implementation left to test (C), and the import cycle
between `lib/winnings.ts` and `lib/player-profile.ts` is gone with the function that caused
it (I). The bonus key had to go in the _second_ migration — a `language sql` body is
validated as it is defined, and the function it calls is created there.

**H — one board ranking per session became almost none.** The gates in
`session_podium_bonus` are a `case` rather than a `where`, so they genuinely short-circuit:
a session still open, inside its grace, or older than the watermark costs one row read and
never ranks a board. Only sessions that actually pay are ranked.

**D — the game-over title stopped rewriting itself.** `session` stays set through game over,
so the countdown kept ticking there and a run that ended on its _lives_ a few seconds before
the close had the boundary land behind the screen, flipping the title to `TIME GONE` about a
run that ended for quite another reason. The call upward is now gated on `inRun`
(`isPlaying || isPaused`, false on game over). The red is left ungated — it is correct
either way.

**F — the wake stopped racing the submit.** The run a window shuts under posts its score at
about the close plus the one-second grace plus a round trip, which the read at +2 s could
beat; where that was the player's only run, the summary was not there when they pressed
HOME. The hook now also asks when a run lets go of its session — which is the player
reaching the intro — skipped when a page is already up.

**G — `invite` stopped rebuilding every render.** It returns `cardSession`'s wrapper, so its
identity changed on every render and the deck's memo rebuilt with it, on every press of the
dial. Now memoised on the rows and on whether there is a page at all. **The comment that
claimed otherwise was mine and had gone stale**: it was true when the function returned the
session, and I did not revisit it when the countdown pass made it return the card.

**B — How to Play says what a place is worth.** The CHALLENGES bullet now names the payout,
in Czech too.

### And one that was not this item's

**The drilled-run bug is fixed here, separately.** `runOver` measured a spent drill against
`nextTargetId`, which `freshGame` deliberately keeps climbing so a restart cannot reuse an
id the display is still animating off — it resets `dealt` instead. So the second drilled run
of a sitting began already past the line and ended the instant its board first went clear:
nine cards became one. One word, `dealt`, and a test that fails without it — confirmed by
reverting the fix and watching it go red.

It shipped in `f5a974d` and belongs to the drill item, not this one, so it is **its own
commit**. `docs/work/2026-10-10-challenge-sessions` should record it.

## Build notes — sixth pass — the countdown, the figure, and the podium's pay

- **A countdown under the invitation's name.** `summaryInvite` now returns the whole
  `SessionCard` rather than the session inside it, because the two faces count towards
  different instants — a teased session to its open, a live one to its close — and the
  label says which: **NEXT UP** or **ON NOW**. The same split-flap board the challenge card
  and the score strip draw, in that challenge's own dark pair.
- **The off-podium figure is a rung smaller** — `READOUT.score` → `READOUT.best`. It is the
  reader's result, not the page's headline; at the same size the two competed for the eye.
- **A session podium now pays into the fortune, for real.** First is paid their score
  again, second half of it, third a fifth — weighted by the rung and **added on top** of
  the points the run already earned, because a fortune only ever grows and a share applied
  _to_ the score would have taken fortune off second and third the day it shipped.

  `session_podium_bonus` in SQL is what puts it there, folded into `player_profile`'s
  `sessionTotals` — the one place a session has ever reached a fortune. It reuses
  `session_board` rather than re-ranking, so the place that is paid is the same place the
  summary draws. The client's `sessionPodiumBonus` mirrors the shares so the printed figure
  and the payment cannot drift.

  **A fifth for third where a board pays a tenth**, and that is deliberate: a board window
  is one of six running every day, where a session is the only contest of its kind while it
  is on. Third on a board is a mention; third on a session is a place out of everyone.

  **Bounded by a watermark.** `session_podium_from()` is a literal in SQL — set once, never
  moved, changing it costs a migration and leaves a record — so nothing that closed before
  it pays anything and **no fortune already earned moves**. That is the precedent CLAUDE.md
  singles out as what kept fortunes still when the board podium arrived. A live session pays
  nothing either: its standings can still move, and a fortune reckoned from one would wobble.

  `my_session_summaries` gained `mine.difficulty`, since the page prices the place it prints
  and a point is worth what its rung says.

Driven end to end: a seeded session where the reader takes silver with 15 120 pays
`session_podium_bonus` = 7 560 on the server, `player_profile` reports base + bonus exactly,
and the page prints **+7 560 TO YOUR FORTUNE**. Six assertions pin the shares, the watermark,
the open window, the off-podium nought, and that the profile pays the points _and_ the
places.

## Build notes — fifth pass — the page, reworked

Asked for directly, after looking at it. Nine changes, two of which needed deciding first.

- **Both challenge names in the challenge's own colours.** `GradientText` over
  `challengeInk(gradientOf(id)[0..1])` — the same pair the challenge card draws its name
  from, so one challenge is one colour wherever it is written. `challengeInk` is what makes
  it safe: a challenge's bright stop is tuned to _be_ a colour, not to carry text, and that
  walks it down until it can. One `ChallengeName` component serves both names.
- **The ended challenge's name is bigger** — `TYPE.cardTitle` → `TYPE.screenTitle`.
- **Medals up a rung each** — lead `GLYPH['3xl']` → `['4xl']` (28 → 44), the other two
  `['xl']` → `['3xl']` (18 → 28). **Agreed rather than doubled**: true doubling wanted 56px
  and 36px, neither a role, and CLAUDE.md says a new size role is agreed before it is added.
  The existing rungs grow it ~1.6× without putting a gap-filler in a ladder the whole app
  shares.
- **Every figure in the seven-segment face.** `READOUT` roles with DSEG7, loaded by the card
  and handed down so the whole page turns over in one commit rather than a number at a time.
- **NEXT UP over two lines**, the label then the name. On one line the gradient word sat on
  the end of a dim sentence and the eye stopped at the label.
- **The reader's own place is marked** — first with a YOU, then, on a second look, with a
  `bg-card` pill behind the nickname instead. A name is already what the eye is scanning
  for; a word beside it adds a second thing to read to say what a tint says at a glance.
  The pill is always the wrapper and only sometimes painted, so a marked row and an
  unmarked one sit at the same height.
- **How many played**, as a `Plural` under the window line. Counted off the board, so it is
  players with a nickname — the same set the podium is drawn from.
- **An empty podium produces no page at all.** Filtered in `summaryOwed` beside the
  unknown-mode rule, so the marker still advances and the dialog never opens. Only reachable
  by a reader with no nickname, who is kept off the standings they played in — and a page
  saying only that nobody scored, to the one person who did, is worse than no page. Drops
  `EmptyPodium`; the gallery's NOBODY SCORED variant becomes **NO NICKNAME**, which is the
  case that can still be drawn.
- Acceptance criterion 7 and the spec's copy table moved with all of it. Three new strings,
  Czech written including the full CLDR plural set for `# PLAYERS`.

Driven: ASK THE SERVER against the seeded session draws FOUR KEYS in teal at the larger
size, `3 PLAYERS`, a 44px gold over ACE_9, 28px silver and bronze, every figure in DSEG7,
the reader's own bronze nickname on its pill, and NEXT UP above FOUR KEYS in gradient.

## Build notes — fourth pass — the dev door

**ASK THE SERVER**, a seventh entry in the sidebar's SESSION SUMMARY section — and an
`Action` rather than a `Variant`, which is the whole distinction. The six above it are
built from fixtures and answer _does it look right_. This one asks the real hook to fetch a
real summary and put the real dialog up, which answers _does it arrive_ — the half with no
mock, and the half that has actually broken twice: once on a flag gate that could never be
true, once on a watermark that could never match.

`hooks/use-summary-request.ts` is the channel, a counter store shaped exactly like
`use-tutorial-request.ts` beside it — the sidebar is mounted outside the phone frame and
the hook inside it, with no parent in common. Nothing writes to it in a production build;
the only caller is `dev/gallery.tsx`, reached through a `__DEV__` dynamic import.

It **ignores the watermark**, which is the point of a dev door: the summary worth looking
at again is precisely the one already told. `ask` gained a `forced` flag for it — two small
branches, both commented as the dev door. Dismissing still moves the watermark forward,
because the watermark only ever moves forward.

Driven: with the watermark already past the seeded session and nothing on screen, one press
put the dialog up carrying the **server's** rows — `🥇 ACE_9 18 400 / 🥈 KRISTYNA 15 120 /
🥉 DEV_A3BEC5 4 300` — rather than the fixtures' names, which is what says it went to the
database and not to a mock.

## Build notes — third pass (after the second verify)

**Criterion 1 — the flag gate.** `useSessionSummaries` asked `useFlag('challenges')` from a
place where that question has no answer: it is reached from `GameScreen`'s **body**, and
`FlagsProvider` is rendered in that component's own **JSX**, so the hook sits above its own
provider and read the default context — false, always. The feature was inert end to end.

Fixed by following the rule the file already kept and I had missed: **above the provider you
ask the set, below it you ask `useFlag`.** `index.tsx` resolves `shownFeatures` once in the
body — the same value it feeds the provider, preview included — and hands it to
`usePopupDeck`, which passes the two answers down. `useOpenSessions` now takes `canSee`
rather than reading it, so each caller asks where it can be answered: `useSessionCard` is
below the provider and passes `useFlag('challenges')`. `index.tsx` was already doing exactly
this one line below, with `features.has('admin')`.

**`useWeeklyRecap` was broken in the same line and is fixed in the same move.** It is reached
through the same `usePopupDeck` call and read `useFlag('recap')`, so the weekly recap could
never appear either. This is **not this item's feature** — it belongs to
`docs/work/2026-10-06-weekly-recap`, which is still `Stage: build` and has never been
verified. It is fixed here because leaving a line I had just proved dead, in a file I was
editing, was the worse option. **That item should be verified before anyone trusts it.**

**And a second bug, found only by running the fix: a summary was told on every launch,
forever.** `challenge_sessions.closes_at` is a `timestamptz` and carries microseconds; the
client's clock is milliseconds throughout, so the watermark it stores is that instant
_floored_. Handed back as `p_since`, the server's `closes_at > p_since` compared
`10:10:00.343313` against `10:10:00.343` — true — and returned the same session again. The
one promise this feature makes is that it speaks once.

Fixed on the server, which is where the mismatch is: `my_session_summaries` now both returns
and compares `date_trunc('milliseconds', closes_at)`, so the row the client holds is exactly
the row the function will measure it against. The migration is amended in place rather than
stacked, being unshipped. `supabase/tests/session_scores.sql` gained the assertion that
pins it — a summary read back with its own close as the watermark must not reappear.

**All of it driven, not argued.** Seeded a session closing at `10:10:00.343313` (microseconds
deliberately present), set the watermark two days back: the dialog appears on the intro —
`🥇 ACE_9 18 400 / 🥈 KRISTYNA 15 120 / 🥉 DEV_A3BEC5 4 300 / NEXT UP: FOUR KEYS` — and the
player, being bronze, correctly gets no second line. It waits while the app is on the
tutorial and arrives when the intro is reached. Dismissing moves the watermark to
`2026-10-20T10:10:00.343Z`, the session's own close rather than "now". Reloading does not
bring it back.

## Build notes — second pass (after the first verify)

Both failures verify found were the same mistake in two places: **state that outlives the
thing it describes.**

**Criterion 5 — the sticky red.** `BestScoresLine` held `shut` as a boolean. It lives inside
the game screen's unconditional `<Screen>`, so it is mounted for the life of the app and
never remounts between runs; once any window shut, the flag stayed set and the _next_
challenge run drew its countdown in the closing red from its first frame, hours early.

Fixed by storing **which** window shut rather than whether one did — `shutAt: number | null`
against `session.closesAt`. The answer is now derived, so a later window simply does not
match: there is no state to reset, no effect to order, and no way to reintroduce the bug by
adding another way for a run to end. The `onArrive` callback became an inline closure, which
is safe and always intended — `ChallengeCountdown` holds that prop in a ref precisely so a
caller may rebuild it each render — and that is what lets it capture the window it belongs
to instead of reaching through a second ref. The `useCallback`/`useRef` pair came out.

**Criterion 14 — the colliding gallery key.** `summary()` built its key from `label` and
`measure` but not from `invite`, so the two OFF THE PODIUM variants were one child to React:
both buttons lit at once and the invited one was unreachable. The key now carries all three
axes, and so does the label.

## Build notes — first pass

**Three files the spec did not list, all forced by exhaustiveness checks this repo keeps on
purpose.** Adding `sessionWon` / `sessionTaken` to `ANNOUNCEMENT_IDS` broke
`satisfies Record<AnnouncementId, …>` in `lib/record-medals.ts` (a session **place** has no
period, so both are null) and `components/game/announcement-effect.tsx` (both play nothing —
these arrive mid-run about a contest already over). Adding `SEEN_SUMMARY_KEY` broke
`lib/local-reset.test.ts`, which requires every storage key to be classified.

**`SEEN_SUMMARY_KEY` resets on a restore, where `SEEN_RECAP_KEY` is kept.** A recap is
impersonal, so showing it twice is noise; a summary is about a contest the player themselves
entered, so whether it has been told is a fact about _them_. Left in place it would mean the
previous player's telling about the restored player's sessions.

**`sessionLost` was renamed `sessionTaken`.** Every `*Lost` id in that file means a record
that was _yours_ and is not any more, and most players reading this line were never first at
all. The old name also collided with the rival-announcement suffix a test filters on.

**The announcement request lives in `hooks/use-session-summaries.ts`**, not in
`app/(tabs)/index.tsx` as the spec had it: the hook is the only thing that knows a window
shut while the app was open. It takes `runSessionId` so it stays quiet when the window shut
on the run being played.

**`EXPIRE` is handled in `playing` only** — `paused` ignores it deliberately. Both halves
are tested.

**One fix outside this work, agreed first:** a stale assertion in
`supabase/tests/session_scores.sql` expected `RACER_B` to lead a race after the block had
already improved `RACER_A` to a faster time. Corrected, with a comment saying why.

**Not mine:** `lib/challenge-session.ts` carries an uncommitted one-line change from before
this session (`STATUS_LABEL.live`). Left alone.

**Left undone, deliberately:** the two follow-ups under `## Follow-ups` in `spec.md`.

## Review

**Verdict: back to `build`. Three findings, one of them serious.**

### Review focus, one by one

1. **The shared open-sessions read, and its two consumers** — **clean.** `useSessionCard`
   keeps one effect keyed on `sessions`, whose identity is stable once the single module
   promise resolves, so it fires twice (empty, then rows) and never again. The only
   `setTimeout` among the three files is in `use-session-summaries.ts`, so there is no way
   for a consumer's wake to re-reckon the card. The frozen card stayed frozen.
2. **The watermark advancing past the summaries not told** — **clean.** `pendingMarker` is
   set from `owed.through` and the page from `owed.summary`, two independent values; the
   undrawable-newest and empty-podium cases are both pinned by tests.
3. **`EXPIRE` arriving when the run is not playing** — **clean.** The screen guards on
   `!windowShut || !isPlaying` and clears its timer in the effect's cleanup; the machine
   handles `EXPIRE` in `playing` only (confirmed by counting the handler across the three
   states: 1 / 0 / 0). Paused, menu, game-over and a double-send are all tested.
4. **A deck that is visible with nothing to say** — **clean.** `usePopupDeck.dismiss` calls
   all four sources, and `summaries.dismiss` empties its own page.
5. **Two reads of one session board disagreeing** — **REAL, and worse than the spec
   feared.** See finding A.
6. **The announcement firing for a session the player did not play** — **clean.**
   `tellTheBar` is reached only after `summaryOwed` returned a row, which exists only if the
   player scored.

### Findings

**A. A fortune can go _down_. (Serious — blocks ship.)**
`submit_session_score` accepts writes until `closes_at + 10 minutes` — the grace that stops
the clock robbing a player who started in time. `session_podium_bonus` starts paying at
`closes_at`. For those ten minutes the bonus is live _and_ the standings can still move, so
a rival posting inside the grace can push a player off a step and halve what they were
already being paid.

Demonstrated, not argued: a player first with 1000 was paid 1000; a rival then posted 2000
inside the grace; the same call returned **500**. CLAUDE.md's rule for a fortune is the
hardest one in the file — _it only ever grows_ — and this breaks it.

The fix is one predicate: pay only once the standings can no longer change, i.e.
`now() >= closes_at + interval '10 minutes'`, with the grace named rather than repeated as
a literal. It wants an assertion beside the five already in `session_scores.sql`.

**B. How to Play no longer tells the truth.** The CHALLENGES section still reads "Finish in
the top three and you get the medal for it … and the points still count towards your
fortune." The place now _pays_ — the score again, half, or a fifth — and the guide does not
say so. CLAUDE.md asks for this check at the end of every task and the cycle ends it here.

**C. `sessionPodiumBonus` has no colocated test.** `lib/winnings.test.ts` exists and does
not mention it. The SQL half is pinned by six assertions; the client mirror, which is what
the player actually reads, is pinned by nothing — and if the two drift the page prints a
figure the fortune never receives.

### Clean on the house pass

No mode name is read outside `modes/` in any new file. No ternary chain selects from a known
set — `SIZES` is a proper `as const satisfies` map. Every new string is extracted and the
Czech is Czech, not English left in place. No raw sizes or tracking in the new components;
the fortune ink measures **6.07:1** on the dialog's surface. The **summary** has its row in
CLAUDE.md's table.

### `/code-review high` — triaged

Eight findings. Six are this work's and join the list above; two are pre-existing and are
left alone, one of them loudly.

**Mine, and real:**

- **D. The game-over title rewrites itself.** `BestScoresLine` sits in the unconditional
  `<Screen>` and `session` stays non-null through game over, so the countdown keeps ticking
  there. A run that ended on _lives_ a few seconds before the close fires `onArrive` on the
  game-over screen, `windowShut` flips, and the title visibly changes to `TIME GONE` —
  claiming the run ended for a reason it did not. The `EXPIRE` send is guarded on
  `isPlaying`, so the run is safe; only the title lies. Guard the boundary itself, or freeze
  the title once the sequence has begun.
- **E. The page can print a bonus the server never paid.** `sessionPodiumBonus` has no
  watermark; SQL's `session_podium_bonus` pays only after `session_podium_from()`. A session
  that closed before that is still inside the 14-day lookback, so a podium finisher reads
  `+N TO YOUR FORTUNE` for points nothing added. Straight contradiction of criterion 8's
  "only for the three it pays". `summary.closesAt` is already on the type.
- **F. The wake races a write the server still accepts.** `SETTLE_MS` is 2 s; the run the
  window shut under submits at about `closes_at + 1 s` plus network. If that cut-short run
  was the player's only run on the session, the read at +2 s finds no row and criterion 5's
  "HOME leads to the intro with the summary up" quietly fails until the next launch. Same
  root as finding A — the ten-minute grace — and the two should be fixed together.
- **G. `invite` is a new object every render.** `summaryInvite` returns `cardSession`'s
  `{state, session}` wrapper, so the identity changes each render and `usePopupDeck`'s memo
  thrashes — the very cost the `summary === null` guard was added to avoid. **The comment I
  wrote there is now false**: it was true when the function returned the session, and I did
  not revisit it when the countdown pass made it return the card.
- **H. `player_profile` ranks one whole board per session played.**
  `session_podium_bonus` runs `session_board` once per `session_scores` row, so a regular
  who has played thirty sessions pays thirty full rankings on every profile open — theirs
  and anyone tapping them.
- **I. A circular import.** `lib/winnings.ts` now imports `fortuneOf` from
  `lib/player-profile.ts`, which already imports from `lib/winnings.ts`. It works only
  because nothing calls it at module-evaluation time.

**Pre-existing — not this item's, and left alone:**

- **Severe, and worth opening now: every drilled run after the first ends on its first
  press.** `runOver` (`machines/game.ts`) tests `context.nextTargetId >= drill`, but
  `freshGame` deliberately keeps `nextTargetId` climbing between runs so a restart cannot
  reuse an id the display is still animating off — it resets `dealt` instead. So on run two
  of any drilled challenge the guard is already satisfied and the run ends the moment the
  board clears. Verified directly: `runOver` reads `nextTargetId`, `freshGame` carries it
  forward (line 378) while resetting `dealt` (line 379), and **this diff does not touch any
  of it** — it shipped in `f5a974d`. The fix looks like one word (`dealt`), but it belongs
  to the drill item with its own test, not here.
- `lib/local-scores.ts` — `beats` falls back to comparing scores on a race when either side
  has no `timeMs`, so the device can keep a "best" the standings would not rank. Low, and
  the existing comment half-acknowledges it.

### Outstanding

**`simplify` was deliberately not run.** Nine fixes are about to reshape this code;
simplifying ahead of them is work done twice. It belongs in the next review pass.
