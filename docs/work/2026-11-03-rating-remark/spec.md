# A rating with words, and a challenge's own page in the lab

Slug: rating-remark
Stage: shipped
Next: /deploy (push both migrations first)
Track: full
Branch: feat/rating-remark
Started: 2026-11-03

## Problem

A **rating** is one number with nothing behind it. A player who wants to say _why_ a
challenge was a 2 has nowhere to say it, and the admin sees a lab row that reads "RATED 6.2
· 9 RATINGS" and nothing they could act on. The lab can't answer the questions that decide
which challenge to queue next: how often has this one run, how many came, and what did
they say? Tapping a row deals a run, which is the one thing the admin wasn't asking for.

## Appetite

**A day or two.** One column on an existing table, two small RPCs, a second step on an
existing dialog and one new admin screen built from the parts the admin screens already
use. No How to Play change: this isn't gameplay.

decided inline: the brief is precise, and every piece reuses a shipped one.

## Shape

**The player, after a session's summary:**

1. The rating dialog opens as now: HOW DO YOU LIKE THE CHALLENGE?, the keypad of nine,
   NOT NOW.
2. Tapping a key **saves the rating immediately**, as today, and the card turns to a
   second step rather than closing: ANYTHING TO ADD?, a text area, SEND and NOT NOW.
3. SEND saves the **remark** onto the same row (player × session). NOT NOW closes, and
   the rating already stands.
4. Both are optional. On step one, NOT NOW still closes everything, and a new SKIP goes
   to step two without a number, so a player can leave words and no figure.

**The admin, in CHALLENGES LAB:**

5. Tapping a row opens the **challenge's page** instead of dealing a run: its mark and
   name in its own colours, the rating (average and count), the session count, and two
   lists.
6. **Remarks**: each one's text, the figure given beside it (if any), the session date,
   newest first.
7. **Sessions**: one line per session, newest first, with the date, the winning figure
   by the session's **measure** (score, time or hits) and the attendee count (players
   with a `session_scores` row).
8. A **PLAY** button on the page deals the challenge, which is what tapping the row used
   to do, so the run dialog is still one tap away.

Areas:

- **Schema**: `session_ratings` gains `remark text` (bounded length), and `rating`
  becomes nullable (a row may be words only, but never empty). `rate_session` accepts a
  null rating; a new `remark_session` writes the text. Same guards (scored on it, closed).
  `challenge_ratings` averages and counts non-null figures only. New admin reads:
  the remarks for one challenge, and its session log.
- **Rating dialog** (`rating-overlay.tsx`, `use-session-rating.ts`, `lib/session-ratings.ts`):
  a second step and a SKIP.
- **Lab** (`dev-overlay.tsx`): the row opens the page, and **a new screen**
  (`AdminScreen` + `AdminTable`, like the planner) holds the page with PLAY.
- **Copy**: the step-two prompt, SEND, SKIP, the page's captions and its empty states.
  Czech for all.

Not a mode's business: the measure comes off the session row as the session board
already does. No flag: the lab already sits behind `challengeLab`, and remarks are read
through admin-only RPCs.

## In / Out / Rabbit holes

**In**: a two-step dialog with SKIP; `remark` on the rating row; nullable rating; the
challenge page with rating, remarks, session count and session log; PLAY on the page.

**Out**

- Answering a remark, or showing it to anybody but an admin. It is not a MESSAGE and does
  not go to the MESSAGES screen.
- Editing or deleting a remark once sent (a second SEND replaces it, as a second rating
  does).
- Opening a session's full standings from the log. The line is the summary; the standings
  belong to the session board.
- Remarks or ratings on anything but a closed session the player scored on.
- A tester seeing ratings or remarks. Today a tester's lab shows neither, and the page
  hides both sections for them. The session log is public data and shows for both.
- Charts, filters, sorting.

**Rabbit holes**

- **The word.** "Feedback" and "message" already mean what players send through TELL
  US. Calling this feedback would put two things under one word on two admin screens.
  It is a **remark**: a rating's written half. A new row in `docs/domain.md`.
- **Nullable `rating` on a shipped column.** Everything that reads it must survive a
  null: `challenge_ratings` (avg and count ignore or filter it) and anything in
  `supabase/tests/session_ratings.sql`. A check keeps a row from being empty
  (`rating is not null or remark is not null`).
- **The keyboard over the text area.** CLAUDE.md says a dialog with a keyboard under it is
  `CardModal`, not `ModalCard`. The rating dialog is a `ModalCard`. Step two may need the
  `CardModal` behaviour (or its `held` handling), so spec must settle whether the dialog
  switches components between steps or one already covers both.
- **"Best score" across measures.** A race's winning figure is a time and NO SLIP's is
  hits. The log shows the session board's own headline figure via the measure, not a raw
  `max(best_score)`, or a race reads wrong.
- **The step-one write still in flight when SEND fires.** Both are upserts on one row, so
  order doesn't matter as long as `remark_session` doesn't need the rating row to exist
  first. It upserts too.

## Contract

### Domain words

Uses: **rating**, **session**, **summary**, **session board**, **measure**, **challenge**.
The lab is the CHALLENGES LAB (`DevOverlay`), not a mode.

Introduces (each gains a row in `docs/domain.md` and a one-liner in `CLAUDE.md`):

- **remark**: the written half of a **rating**. Free text, at most 500 characters, on the
  same row as the figure (player × session), and allowed without one. Asked on the
  rating dialog's second step and read only by an admin, on the challenge's page in the
  lab. `session_ratings.remark`, `remark_session`, `challenge_remarks`, `lib/remark.ts`.
  **Not feedback or a message**: those are what players send through TELL US
  (`feedback` table, MESSAGES screen). A remark is never answered.
- **challenge page**: the lab's screen for one challenge, with its rating, remarks,
  session count and session log, plus PLAY. `ChallengePage`. A screen word only, so no
  domain row; it is named here so nobody calls it "challenge detail" or "card" (the
  **challenge card** is the intro's).

Collision: "remark" is unused in the repo. "feedback" stays the TELL US word.

### Files

| Path                                                   | C/M | Responsibility                                                                                                                  |
| ------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261103010000_rating_remark.sql` | C   | `remark` column + checks, `remark_session`, `challenge_ratings` over figures only, `challenge_remarks`, `challenge_session_log` |
| `lib/remark.ts` (+ `.test.ts`)                         | C   | `MAX_REMARK_LENGTH`, `remarkOf(text)`: trimmed text or null when blank                                                          |
| `lib/admin/challenge-page.ts`                          | C   | `listChallengeRemarks(modeId)`, `listSessionLog(modeId)`                                                                        |
| `components/overlays/text-area.tsx`                    | C   | the multiline field lifted out of `feedback-overlay.tsx`, shared by it and step two                                             |
| `components/overlays/rating-line.tsx`                  | C   | `RatingLine` moved out of `dev-overlay.tsx`, since the row and the page both draw it                                            |
| `components/overlays/challenge-page.tsx`               | C   | `ChallengePage`: header, rating, counts, REMARKS, SESSIONS, PLAY, BACK                                                          |
| `lib/session-ratings.ts`                               | M   | `remarkSession(sessionId, text)` beside `rateSession`                                                                           |
| `hooks/use-session-rating.ts`                          | M   | exposes `remark(text)` beside `send(rating)`                                                                                    |
| `components/overlays/rating-overlay.tsx`               | M   | two steps in one `ModalCard` (`avoidKeyboard`, `held` once typed); SKIP on step one                                             |
| `components/overlays/feedback-overlay.tsx`             | M   | uses `TextArea`                                                                                                                 |
| `components/overlays/dev-overlay.tsx`                  | M   | the row opens `ChallengePage` (state here, as the planner holds its form); PLAY deals the run                                   |
| `app/(tabs)/index.tsx`                                 | M   | wires `remark` from the hook into `RatingOverlay`                                                                               |
| `constants/buttons.ts`                                 | M   | `rating.skip`, `rating.send`, `dev.challenge` (the row); `dev.run` becomes PLAY on the page                                     |
| `supabase/tests/session_ratings.sql`                   | M   | remark writes, guards, words-only rows, `challenge_ratings` ignores words-only rows, the two reads                              |
| `supabase/dev-fixtures.sql`                            | M   | ratings with and without remarks, and one remark-only row, on the closed fixture sessions                                       |
| `docs/domain.md`, `CLAUDE.md`, `components.md`         | M   | **remark**; `TextArea` in the inventory                                                                                         |

### Data

Migration `20261103010000_rating_remark.sql`:

- `session_ratings.rating` **drops not null**; adds `remark text` with
  `check (remark is null or char_length(remark) between 1 and 500)` and
  `check (rating is not null or remark is not null)`. Shipped rows all have a rating, so
  both checks hold on the day it lands.
- `rate_session` is **unchanged**: a key still writes 1–9, and its upsert leaves `remark`
  alone.
- `remark_session(p_session uuid, p_remark text)`: the same three guards as
  `rate_session` (signed in, scored on it, closed), trims, refuses blank or more than
  500, then upserts the remark onto the row (inserting a words-only row if no figure was
  given). Granted to `authenticated`, revoked from `public, anon`.
- `challenge_ratings()` counts and averages **non-null figures only**, so a challenge
  with only remarks returns no row rather than `0 ratings, average null`.
- `challenge_remarks(p_mode_id text)`: admin only. Returns `opens_at` (of the session),
  `nickname`, `rating` (nullable), `remark`, `rated_at`, for rows with a remark, newest
  session first.
- `challenge_session_log(p_mode_id text)`: any signed-in caller (sessions and scores are
  already public). One row per session of that challenge that has opened: `id`,
  `opens_at`, `closes_at`, `measure`, `players` (count of `session_scores`), and the
  winner's `best_score`, `hits`, `time_ms` taken from `session_board(id)` rank 1 (null
  with nobody). Newest first.

Types (shapes only):

```ts
type ChallengeRemark = {
  opensAt: number
  nickname: string | null
  rating: Rating | null
  remark: string
}
type SessionLogRow = {
  id: string
  opensAt: number
  measure: Measure
  players: number
  best: SessionFigures | null
}
```

Order: **push the migration before the app ships**. The new client calls
`remark_session` and the two reads. An old client keeps working against the new schema
(`rate_session` is unchanged).

### Gates

| Gate        | Answer                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Copy / i18n | Step two: `ANYTHING TO ADD?`, placeholder `What made it good or bad?`, `SEND`, `NOT NOW` (exists). Step one: `SKIP`. Page: `REMARKS`, `SESSIONS`, `No remarks yet.`, `No sessions yet.`, `{n} SESSIONS` (plural; exists from the queue), `{n} PLAYERS` (plural; exists), `PLAY`, `BACK` (exists), `NOBODY PLAYED`. Czech for each new one. |
| How to Play | No: not gameplay.                                                                                                                                                                                                                                                                                                                          |
| Flag        | None. The lab is already behind `challengeLab`; remarks are admin-only by RPC.                                                                                                                                                                                                                                                             |
| Buttons     | `rating.skip`, `rating.send`, `dev.challenge`.                                                                                                                                                                                                                                                                                             |

Decided inline: the remark is fire-and-forget like the figure. The dialog closes on SEND
whether or not the write lands, matching `rateSession`; a lost remark costs one opinion.

## Acceptance criteria

1. On the rating dialog, tapping a key writes the figure at once (a row exists with that
   rating before anything else is pressed) and the card shows step two (ANYTHING TO
   ADD?, a text area, SEND, NOT NOW) instead of closing.
2. Typing text and pressing SEND stores it as `remark` on the same `session_ratings` row,
   and the dialog closes. NOT NOW on step two closes with the figure kept and no remark.
3. SKIP on step one goes to step two with no figure written. SEND there creates a
   words-only row (`rating` null, `remark` set). NOT NOW on step one still closes with
   nothing written.
4. SEND is disabled while the text area is blank or whitespace. The field stops at 500
   characters. A tap on the scrim doesn't throw away typed text.
5. `remark_session` refuses: signed-out, no score on the session, a session still open,
   blank text, over 500. `challenge_ratings` ignores words-only rows in both count and
   average.
6. In CHALLENGES LAB, tapping a challenge opens its page (not the run dialog): its mark
   and name in its colours, `RATED x · n RATINGS` (admin, when rated), `n SESSIONS`, a
   REMARKS list and a SESSIONS list.
7. REMARKS lists each remark of that challenge, newest session first, with the figure if one
   was given (as `n/9`) and the session date, and never the writer's name (amended in
   review: `…_challenge_ratings.sql` promised "never who said what"). With none it says `No remarks
yet.` A tester sees neither the rating line nor REMARKS.
8. SESSIONS lists every session of that challenge that has closed (amended in review: a
   live session's leader is not a winner), newest first, with
   its date, the winner's figure printed by `sessionFigure` for the session's measure
   (a race shows a time), and the player count. A session with no scores shows `NOBODY
PLAYED`.
9. PLAY on the page opens the same run dialog that tapping the row used to open, with the
   same session. BACK returns to the lab list.
10. The TELL US dialog's text field looks and behaves as before (it is now `TextArea`).
11. `pnpm db:test` session files and `pnpm check` are green, Czech included.

## Tests

- `lib/remark.test.ts`: `remarkOf` trims, returns null for blank or whitespace, and keeps
  inner newlines. `MAX_REMARK_LENGTH` is 500.
- `supabase/tests/session_ratings.sql`: remark after rating keeps the figure; a rating
  after a remark keeps the remark; words-only insert; each refusal in AC5;
  `challenge_ratings` with a words-only row; `challenge_remarks` admin guard and order;
  `challenge_session_log` players count, winner by measure (a time session), and no
  scores.

## Review focus

1. `rate_session`'s upsert must not null out an existing remark, and `remark_session`'s
   must not null out the figure. Both are `on conflict do update` on one row (task 1).
2. `challenge_ratings` filters null figures, or the lab's average goes null or the count
   inflates for words-only rows (task 1).
3. The `sent` guard on step one must not block step two's SEND, and a second SEND during
   the exit animation must not write twice (task 4).
4. `ChallengePage`'s PLAY hands over the same `OpenSession` the row used to, built with
   `asOpenSession`, so the run dialog still knows the live session (task 6).
5. The session log's winner comes from `session_board` rank 1, not `max(best_score)`, or
   races and NO SLIP print the wrong figure (task 1).
