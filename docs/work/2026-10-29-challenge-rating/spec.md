# Challenge rating

Slug: challenge-rating
Stage: review
Next: /ship challenge-rating
Track: full
Branch: feat/challenge-rating
Started: 2026-10-29

## Problem

A challenge is on the app for a day and gone, and we never learn whether the people who
played it liked it, so deciding which challenges come back is guesswork.

## Appetite

**A day or two.** A new table and one RPC, one new dialog, a handful of strings. Fixed:
if the dial picker below turns out to need the game dial's gesture machinery, the
picker gets simpler (a plain 3×3 grid of keys), and the appetite stays the same.
_Decided inline: the user picked the UI and did not set a budget. This is the smallest
appetite that covers a schema change._

## Shape

1. A **session** closes. A player who played it reaches the intro, and the launch popup
   opens on its **summary**, as it does today.
2. They close the popup (LET'S GO, the header close or the dots, whichever way they
   leave). The popup dismisses as a whole, as it does now.
3. Straight after, a second dialog opens over the intro. It shows the challenge's name
   in its own colours, then **HOW WAS THIS ONE?** and a small 3×3 dial with keys 1–9.
4. They press a key, which lights up in the challenge's gradient. Pressing another key
   moves the choice. A caption reads **1 = NOT FOR ME · 9 = MORE OF THIS**.
5. **SEND** writes their rating for that session and closes the dialog. **NOT NOW**
   closes it without writing anything.
6. Either way it does not come back for that session. The summary is told once, and
   the rating rides on that one telling, so no new device marker is needed.
7. Only a player who saw that summary is asked, which means only someone with a
   `session_scores` row on the session. The server checks for that row again on write.
8. The install prompt and the session-recording ask, which wait behind the popup today,
   now wait behind this dialog too.

Areas:

- **The summary hook** (`hooks/use-session-summaries.ts`, `use-popup-deck.ts`): keep
  the summary that was just dismissed, so the rating dialog knows which session it is
  asking about.
- **The game screen** (`app/(tabs)/index.tsx`): mount the dialog after the popup and
  slot it into the launch-ask queue.
- **A new dialog**: built on `ModalCard`, with `PrimaryButton` SEND and `LinkButton`
  NOT NOW, plus a 1–9 key picker.
- **Schema**: a new table (session × player → 1–9, one row each, RLS) and a write RPC
  that refuses a player with no score on that session.
- **Copy**: the title, caption, SEND and NOT NOW, all extracted and in Czech.
- **Feature key**: its own key in `constants/features.ts` (proposed: `ratings`), floor
  `nobody` until it ships, so it can be turned on separately from `challenges`.

Mode or engine: neither. Nothing here branches on a mode. The dialog reads the
challenge's name and gradient through `labelOf`/`gradientOf`, the same way
`SummaryCard` does.

## In / Out / Rabbit holes

**In**

- The rating dialog after the summary popup, the 1–9 picker, SEND and NOT NOW.
- One row per player per session, written once (a second SEND overwrites the first;
  in practice it cannot happen).
- The table, RPC and RLS, and the feature key.

**Out**

- **Any place to read the ratings in the app.** No admin planner column and no
  average on the challenge card. Ratings are read with SQL until a later item adds a
  view.
- **Free-text comments** beside the number. The feedback dialog already exists for that.
- **Asking anywhere else**: not on game over, not after every run, not on a session the
  player did not finish.
- **Re-asking.** NOT NOW is final for that session.
- Rating a **challenge** across its reruns. A rating belongs to one **session**, the
  same way its standings do. Rolling sessions up to a challenge is a query, not a
  schema decision for this item.
- **Rewards** for rating: no fortune and no achievement.

**Rabbit holes**

- **The game dial is not a picker.** `Dial`/`DialButton` run on shared values, swipes
  and commands, so embedding them would mean faking a run. Way around: a small picker
  that borrows the key's look (corners, ink, the challenge gradient on the lit key) and
  none of its gestures. `spec` must check `design-guide`'s component inventory first,
  so this extends an existing key rather than forking one.
- **Two dialogs back to back.** The summary dialog closes with an animation. Opening the
  rating on the same frame would flash two cards. It should mount after the popup has
  unmounted, which today is when `cards` empties (`visible` goes false).
- **The word.** CLAUDE.md says **fortune** is "never a rating", so "rating" is free as a
  word but sits right beside that warning. `spec` names it: keep **rating**, which is
  what the player reads, and add it to `docs/domain.md` with the fortune distinction,
  or pick a code word like **verdict**.
- **Forced summaries from the dev sidebar** would also open the rating dialog. That is
  fine for testing, but SEND from a forced summary writes a real row. Acceptable,
  because the server only takes it from someone who played.
- **Migrations are not applied by CI**: the RPC has to be pushed before a build that
  calls it ships, or SEND fails silently. Call this out in `ship`.

## Contract

### Domain words

**Uses:** **session** (what is rated, never the **challenge** across reruns),
**summary** (the page the rating follows and is gated on), **challenge** (whose name and
gradient the dialog wears), **feature** (the key it hides behind).

**Introduces:**

- **rating**: one player's 1–9 answer to "how was this one?" for one **session** they
  played. Asked once, straight after that session's **summary**; NOT NOW is final. It
  shows nothing and pays nothing. Code: `session_ratings`, `rate_session`, `Rating`,
  `lib/session-rating.ts`, `hooks/use-session-rating.ts`. `docs/domain.md` gains a row
  and `CLAUDE.md` gets its one-line entry.

**Collisions:**

- **fortune** is "never a rating". That warning stays true: a rating is a player's
  opinion of a session, while fortune is points. The domain row says so.
- `WIN_RANKS` and a board's rank are unrelated words. "Rating" is not a standing and
  never orders anything.
- _Decided inline: keep "rating" as the code word too, since it is what the player
  reads. A separate code word (such as "verdict") would add another split like
  host/`admin`, with nothing gained._

### Files

| Path                                                     | New / changed | Responsibility                                                                                                                           |
| -------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261029000000_session_ratings.sql` | new           | The table, RLS, `rate_session`, and the `ratings` feature row                                                                            |
| `supabase/tests/session_ratings.sql`                     | new           | pgTAP: write once, overwrite, refuse a non-player, refuse out of range                                                                   |
| `lib/session-rating.ts`                                  | new           | `Rating`, `isRating`, and `rateSession(sessionId, rating)` calling the RPC, shaped like `lib/session-summaries.ts`                       |
| `lib/session-rating.test.ts`                             | new           | `isRating` bounds                                                                                                                        |
| `hooks/use-session-rating.ts`                            | new           | Holds the session being asked about; `send` (write and close) and `dismiss` (close)                                                      |
| `components/overlays/rating-overlay.tsx`                 | new           | The dialog: `ModalCard` with the challenge's `edge`, its name, the title, the keypad, the caption, SEND and NOT NOW                      |
| `components/overlays/code-keyboard.tsx`                  | changed       | Takes `id`, `onKey(n)` and an optional `lit` key drawn in full gradient. The rating dialog is the caller that asked for this; comment it |
| `components/overlays/game-code-input.tsx`                | changed       | Adapts to `onKey` (the four-digit cap moves here) and passes `id="join_room.key"`                                                        |
| `hooks/use-session-summaries.ts`                         | changed       | `dismiss` keeps the summary it cleared as `told`, until it is taken                                                                      |
| `hooks/use-popup-deck.ts`                                | changed       | Passes `told` through                                                                                                                    |
| `app/(tabs)/index.tsx`                                   | changed       | Mounts `RatingOverlay` after the popup; the install prompt and the replay ask also wait on it                                            |
| `constants/features.ts`                                  | changed       | `'ratings'`, with its comment                                                                                                            |
| `constants/buttons.ts`                                   | changed       | `rating.key`, `rating.send`, `rating.dismiss`                                                                                            |
| `locales/*.po`                                           | changed       | The new strings and their Czech                                                                                                          |
| `docs/domain.md`, `CLAUDE.md`                            | changed       | **rating**                                                                                                                               |

`code-guide` check: there is no new dialog or button shell, and the keypad is
extended rather than copied. `CodeKeyboard`'s raw `text-[24px]` is an older call site.
Moving it onto a `TYPE`/`READOUT` role is a sweep the user decides on, so it is not
changed here (see Review focus).

### Data and types

```ts
type Rating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
// use-session-summaries: return gains
told: SessionSummary | null   // the summary just dismissed, cleared by take()
take: () => void
// use-session-rating
{ asking: SessionSummary | null, send: (r: Rating) => void, dismiss: () => void }
```

Schema, `…_session_ratings.sql`:

- `session_ratings (session_id uuid → challenge_sessions on delete cascade, user_id uuid
→ profiles on delete cascade, rating smallint not null check (rating between 1 and 9),
rated_at timestamptz not null default now(), primary key (session_id, user_id))`.
- RLS on, with **no** select/insert policies for `anon` or `authenticated`. All writes go
  through the RPC, and reads are SQL for now (Out).
- `rate_session(p_session uuid, p_rating int) returns void`, `security definer`,
  `search_path = ''`. It raises if `p_rating` is outside 1–9, or if there is no
  `session_scores` row for `(p_session, auth.uid())`. Otherwise it upserts on the primary
  key, setting `rating` and `rated_at`. Execute is granted to `authenticated` only.
- `insert into features (key, active, note, visibility) values ('ratings', true, …,
'hidden')`, plus `role_features` for tester, developer and admin, following
  `…_czech_feature.sql`. Hidden is the `nobody` floor. Making it private opens it to
  those stacks.
- No existing rows are affected, because the table is new.
- **Order:** the client can run against the old schema. The dialog is behind a feature
  key that does not exist there, so it reaches nobody. If it is somehow reached, a failed
  `rate_session` just closes the dialog. The push still has to land before the feature is
  made private (see memory: migrations are not applied by CI).

No device storage. The rating is offered on the one telling of the summary, and that
summary's marker already guarantees the telling happens once.

### Copy and gates

| Gate            | Answer                                                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | `HOW WAS THIS ONE?`, `1 = NOT FOR ME`, `9 = MORE OF THIS`, `SEND`, `NOT NOW`. Reuse existing message ids for SEND and NOT NOW if Lingui already has them. Czech for all; `pnpm i18n:verify` green. |
| **How to Play** | None. It touches no controls, targets, timers, modes, difficulty, scoring, streaks or lives.                                                                                                       |
| **Flag**        | `ratings`, floor `nobody` (visibility `hidden`). Also requires `challenges`, since without it no summary is ever told.                                                                             |
| **Buttons**     | `rating.key`, `rating.send`, `rating.dismiss` in `constants/buttons.ts`.                                                                                                                           |

## Acceptance criteria

1. With `challenges` and `ratings` held, closing the launch popup that carried a
   **summary** opens the rating dialog over the intro once the popup has finished
   leaving, with no overlap of the two cards.
2. The dialog shows the session's challenge name in its gradient, `HOW WAS THIS ONE?`, a
   3×3 keypad 1–9, and the caption `1 = NOT FOR ME` / `9 = MORE OF THIS`. Its edge wears
   the challenge's pair.
3. SEND is disabled until a key is pressed. Pressing a key lights that key in the
   challenge's gradient, and pressing another moves the light.
4. SEND writes one `session_ratings` row `(session, me, n)` and closes the dialog.
   NOT NOW closes it and writes nothing.
5. After either, the dialog does not return on this launch or the next one for that
   session.
6. A popup with no summary on it (news, winnings or recap only) opens no rating dialog
   when closed.
7. Without `ratings` held, closing a summary popup opens nothing. The app behaves exactly
   as it does today.
8. The install prompt and the session-recording ask never appear while the rating dialog
   is up, and get their turn after it closes.
9. `rate_session` refuses a caller with no `session_scores` row on that session, and
   refuses a rating of 0 or 10. A second call from the same player overwrites the first
   and leaves one row.
10. Join-room code entry works as before: four digits, the same look, and `join_room.key`
    still tracked.
11. A failed `rate_session` (offline) closes the dialog without an error on screen and
    without crashing.
12. `pnpm check` is green, Czech included, and the pgTAP suite passes locally.

## Tests

- `lib/session-rating.test.ts`: `isRating` accepts 1–9 and rejects 0, 10, 4.5 and NaN.
- `supabase/tests/session_ratings.sql`: covers criterion 9 (a non-player is refused,
  out-of-range values are refused, upserting twice leaves one row with the second value)
  and that `anon` cannot execute the function.
- UI: none. Criteria 1–8, 10 and 11 are walked in the running app by `verify`.

## Review focus

- **Task 4/5: the told-summary handoff.** `told` must be set only by a real dismiss of
  a deck that held a summary. It must not be set by the forced dev path re-running,
  must not re-set after `take()`, and must not depend on a `cards` identity that changes
  every render (the memo note in `use-session-summaries.ts` explains why).
- **Task 6: the exit animation.** The rating mounts on `!whatsNew.visible`. Check that it
  is not briefly up together with the popup, and that it does not mount under
  `feedbackReplies.reply`.
- **Task 6: the launch-ask queue.** Both the install and replay conditions gain
  `!rating.visible`. If one is missed, two dialogs stack.
- **Task 3: `CodeKeyboard`'s new API.** The four-digit cap moved into the caller. Make
  sure join-room cannot take a fifth digit.
- **Task 1: RLS.** No select policy exists, so nobody can read others' ratings from the
  client. `security definer` has `search_path` set.
