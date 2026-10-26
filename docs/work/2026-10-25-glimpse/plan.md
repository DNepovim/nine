# Glimpse — Plan

Spec: docs/work/2026-10-25-glimpse/spec.md

## Tasks

- [x] 1. `CLAUDE.md`: the **glimpse** row in the domain table, after **drill**
- [x] 2. `modes/types.ts`, `modes/rules.ts`: `spawn.glimpse`, null in the base, carried through `resolveRules`; `modes/rules.test.ts` covers criteria 1 and 4
- [x] 3. `components/game/pie-countdown.tsx`: `glimpse` prop and number opacity, hidden after the glimpse and revealed on `exit`; null schedules nothing
- [x] 4. `components/game/target-card.tsx`: pass `glimpse` through, 0 for a card restored mid-clock; `app/(tabs)/index.tsx` passes `rules.spawn.glimpse` (counted from arrival via `glimpseLeft` in `lib/target-clock.ts` instead of `startProgress < 1`, which hid live cards too; spec amended)
- [x] 5. `modes/challenges/catalog.ts`: GLIMPSE appended; `challenges.test.ts` covers criteria 2 and 3
- [x] 6. `pnpm i18n:extract`, Czech (`ZÁBLESK`, `Jeden pohled, pak zpaměti.`), `pnpm check` (full `pnpm check` left to verify; touched files lint, typecheck and `i18n:verify` clean)
- [x] 7. _(Reopened by verify, criterion 13.)_ `challenge-modal.tsx`: `nameRows` also splits on a soft hyphen; `catalog.ts`: label `GLIM­PSE`; Czech `ZÁ­BLESK`. The user chose the break over scaling the shared `GameOverTitle` or renaming

- [x] 8. _(Review.)_ `pie-countdown.tsx`: drive the glimpse off `running` like `progress`. Cancel on pause, resume with what's left (criterion 14). Fold in criterion 16 (count from the end of the card's entrance; export the 180 ms from `target-card.tsx` as a named constant rather than repeating it) and criterion 18 (less than `GLIMPSE_FADE_MS` left mounts hidden)
- [x] 9. _(Review.)_ Reveal on `dying` too (criterion 15). The card already has `dying`; the pie needs to hear it as a reveal, without the exit animations
- [x] 10. _(Review.)_ `components/gradient-text.tsx:42`: drop U+00AD from the letters before colouring (criterion 17). One line; its callers are the intro card, the summary card, the profile place row and the admin session cells, all of which then colour as before for every other name
- [x] 11. _(Review.)_ Tests: `modes/rules.test.ts` loops over `allModes()` and exempts only GLIMPSE; `challenges.test.ts` pins `CHALLENGES.map(id)` to the exact order instead of the tautological gradient check
- [x] 12. _(Review.)_ Comments and small things: the `nameRows` regex uses the `\u00AD` escape, not a literal invisible character; reword the three "null in every mode but one" comments (`index.tsx`, `pie-countdown.tsx`, `types.ts`) to say what null means; tone the band-tint claim down to what `ARC_MAX` allows (a sliver at arrival, growing as the ring drains) in `catalog.ts`, `types.ts` and CLAUDE.md

## Build notes

- **Review round (tasks 8–12).** The glimpse is now a shared value run down like `progress`,
  keyed on `active` rather than `running`, so it stops for a pause or blur whatever the card's
  clock. Not keyed on `running`, because a glimpse in a mode with no clock would never fade.
  The reveal moved out of the `exit` effect into its own `revealed` prop
  (`exit !== null || dying`) so a run's end is covered without playing an exit on a card that
  has none. `CARD_ENTER_MS` and `GLIMPSE_FADE_MS` moved to `constants/game.ts`, so
  `glimpseLeft` in `lib/` can add the entrance and floor the remainder without importing a
  component; `TargetCard`'s fade-in reads the same constant. `withDelay` is no longer used.
  `GradientText` drops U+00AD before colouring. The only other per-letter walks of a name are
  `GameOverTitle` (fed by `nameRows`, so no hyphen survives) and the nickname helpers, which
  never see a mode label.
- **Restored cards, amended.** The spec said a card with `startProgress < 1` gets a glimpse
  of 0. A live card's `startProgress` is `remainingFraction(t, now)`, a hair under 1, so
  that would have hidden every fresh number. Instead the glimpse is counted from the
  target's arrival: `glimpseLeft` in `lib/target-clock.ts` (with tests) hands the pie
  `glimpse − (1 − startProgress) × duration`, floored at 0. Spec's Data section and file
  table amended to match.
- **The race (review focus 1).** The `exit` effect assigns a fresh `withTiming(1)` to the
  number's opacity, which replaces the pending `withDelay` fade, so a card taken inside its
  first 500 ms can't be blanked on the way out.
- **Null path.** With no glimpse the opacity shared value starts at 1 and nothing is ever
  scheduled on it. The reveal branch is guarded on `glimpse !== null` too.
- **EVERYTHING fixture.** `challenges.test.ts`'s every-group challenge now bends
  `spawn.glimpse` (250) as well, since it is the shape a new challenge is copied from.
- **Game over** (`dying`) doesn't reveal a hidden number: there is no exit, the card just
  shrinks. Neither the spec nor the user asked for it; noted for verify.
- **Window:** `2026-10-24` for a day, in the past, as the skill directs. Sessions decide when
  it is actually on.
- **Dev data:** none needed. No table, column or row state.
- **Criterion 13 (second build).** The break is a soft hyphen in the label rather than a
  space, because the label is drawn on one line in about twenty other places (intro card, top
  bar, pause pill), where a space would show and U+00AD doesn't. `nameRows` splits on it. No
  change to `GameOverTitle`, so its four other callers draw exactly as before. The Czech
  breaks at its own syllable, ZÁ / BLESK. The character is invisible in an editor, so the
  catalog entry carries a comment saying it's there.

## Review

_(2026-10-26, second pass, after tasks 8–12 and their verify.)_ **Clean. Ready to ship.**

`/code-review high` raised 8 issues, triaged:

- **Fixed:** `glimpseLeft`'s floor hid every card of a glimpse shorter than the fade (a
  future challenge with, say, 120 ms would show nothing). The floor is now
  `min(GLIMPSE_FADE_MS, glimpse / 2)`, with a test.
- **Accepted, the user's call:** on the web build, find-in-page (Ctrl+F) matches a hidden numeral,
  because it's transparent, not removed. Recorded in the spec beside the screen-reader gap.
- **Noted, left:**
  - A pause in a card's first 180 ms gives back at most 180 ms, and one in the final fade loses at
    most 150 ms, once per card, and it can't be repeated.
  - The entrance spring settles after `CARD_ENTER_MS`; that's cosmetic.
  - `revealed` can't be derived inside the pie, because `active` can't tell a pause from a dying
    card.
  - The soft hyphen and the catalog window are as decided last round.

`simplify` (four reviewers: reuse, simplification, efficiency, altitude):

- **Applied:**
  - The soft-hyphen convention now lives in one place, `lib/label-rows.ts` (`SOFT_HYPHEN`,
    `labelRows`, with a test), used by the challenge dialog and `GradientText`. The dialog's private
    `nameRows` is gone.
  - `TargetCard` names the leaving condition once (`leaving`), used for both `revealed` and
    `active`.
  - The claims test checks the tiers GLIMPSE names, not a verbatim copy of the catalog's words.
- **Skipped:**
  - _Efficiency:_ nothing material. Two shared values per pie and early-returning effects, no
    per-frame work with the feature off.
  - _Simplification:_ the explicit null guard in the pie (it documents that a mode with no glimpse
    never runs the effect), and the repeated rule comments (house style).
  - _Altitude #1–2:_ drive the glimpse off the ring's `progress` instead of its own countdown. That
    would remove `glimpseLeft` and the second clock, but it's a rewrite of a mechanism verified
    three times, for identical behaviour. Below, as its own item.

Suite after simplify: i18n, lint (0 errors), Prettier (only the untracked `ranks/spec.md`), types,
Knip, 2005 tests. Smoke test in the app (session `…0003`): dialog GLIM / PSE, a fresh card shows and hides.

**Worth its own work item (adds to the first pass's):**

- Fold the glimpse into the ring's own clock: hide once `progress` falls below
  `1 − (glimpse + entrance) / duration`. Pause and restore then come for free, and two timers no
  longer have to agree. Pure refactor with an existing verification script.

_(First pass.)_ _(2026-10-26, first pass.)_ `/code-review high` raised 10 issues. The spec's five review-focus items
were each checked against the code: race, composition, null path, restored cards and append all
hold (the line, the guard and the test are named in the session). House pass: domain words fine
(glimpse row present), no mode branching, no new value selection, Czech read as Czech, How to Play's
challenges chapter is generic ("something changed … different every time") and stays true, no
colour or type change.

**Reopened as build tasks 8–12** (criteria 14–18):

- Glimpse runs through pause → **freeze with the ring** (user's call; the shape had it Out on a
  premise that missed a pause just after arrival).
- Cards dying at game over leave blank → **reveal** (user's call).
- The card's 180 ms entrance eats a third of the glimpse.
- `GradientText` colours the soft hyphen as a letter, so GLIMPSE's ramp is off by a step.
- A restored card with a sliver of glimpse left flashes the number at full strength.
- Test gaps: a hand-listed mode set, and a gradient check that passes in any order.
- Comment accuracy: the band-tint claim, "every mode but one", and the invisible regex character.

**Kept as decided:**

- _Soft hyphen is the wrong level_ (the reviewer would scale the word or add an untranslated
  `rows` field). The user chose the GLIM / PSE break. If the character is stripped, the msgid
  changes and `i18n:verify` fails loudly.
- _Window in the past, out of date order._ That's the `challenge` skill's own instruction, and the
  list is append-only by design.

**Worth its own work item later:**

- `usePersistedMode.playableNow` checks the **catalog window** with `isOpenMode`, not whether a
  session is open, so a challenge picked during a booked session is reset to the default mode on
  restart. True of every challenge in the catalog, not just GLIMPSE.
- `simplify` hasn't run yet. It runs on the next review pass, after the reopened tasks land.

## Verification log

**Verdict (2026-10-26, third pass, after the review round): 18 of 18 PASS.** Criterion 10's
multiplayer surface is still not driven (two players needed); its code is untouched. Ready for
`/review glimpse`.

Suite: `i18n:verify`, `i18n:compile`, lint (0 errors), types, Knip, 2000 tests green. Prettier fails
only on the untracked `docs/work/2026-10-23-ranks/spec.md`. App: same harness, session `…0002`, read
off recorded video frame by frame. The Czech check used a local `czech` override, deleted afterwards.

| #         | Criterion                                   | Result | Evidence                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14        | Glimpse freezes with the ring               | PASS   | 33 mounted 15.28 s, paused 15.48 s, CONTINUE 17.53 s. The number stayed up until about 18.55 s, then faded by 18.7 s. The ring itself doesn't move again until about 18.3 s (the app holds the board briefly after CONTINUE), and the glimpse waits with it, so the player got the remainder rather than losing it behind the pause screen |
| 15        | Every card shows its number at game over    | PASS   | last heart on 152 (white on red) at 45.7 s. The other card, still hidden, showed **13** through the whole shrink, gone by 46.08 s. Then GLIMPSE's own claim, LOST SIGHT                                                                                                                                                                    |
| 16        | Counted from the card being fully in        | PASS   | 120 mounted about 23.65 s (faint), full by 23.8–23.95 s, fade starts about 24.25 s, gone by 24.4 s: about 650 ms from mount (500 + 180 expected) and about half a second fully readable                                                                                                                                                    |
| 17        | Soft hyphen takes no colour step            | PASS   | DOM of the intro card: G-L-I-M-P-S-E, seven spans, colours in even steps of about 27 per channel, no span for U+00AD. Czech: Z-Á-B-L-E-S-K, the same seven steps                                                                                                                                                                           |
| 18        | Under-the-fade remainder mounts hidden      | PASS   | `lib/target-clock.test.ts` (495 of 500 gone → 0; exactly the fade still shown). A pie handed 0 mounts hidden, as seen on the restored card in the first pass                                                                                                                                                                               |
| 6         | _(regression, the reveal moved)_ Hit reveal | PASS   | 198 fades back in at 22.24 s, swells out of the collapsing ring, gone by 22.73 s                                                                                                                                                                                                                                                           |
| 7         | _(regression)_ Expiry reveal                | PASS   | 152 above                                                                                                                                                                                                                                                                                                                                  |
| 1–5, 8–13 | as before                                   | PASS   | tests green; nothing on those paths changed this round beyond the reveal re-checked above                                                                                                                                                                                                                                                  |

### Second pass (2026-10-26)

**Verdict (2026-10-26, second pass): 13 of 13 PASS.** Criterion 10's multiplayer surface still not
driven (needs two players in a room); its code is untouched. Ready for `/review glimpse`.

Suite: `i18n:verify` (899), `i18n:compile`, lint (0 errors, nothing in changed files), types, Knip,
1999 tests green. Prettier fails only on the untracked `docs/work/2026-10-23-ranks/spec.md`, which
isn't this work. App: same harness, a fresh local session `5e55911a-…0002`. For the Czech pass, a
local-only `user_features` override gave the dev profile `czech`; it was deleted afterwards.

| #    | Criterion                                                              | Result | Evidence                                                                                                                                                                                                                        |
| ---- | ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4  | Rules and catalog                                                      | PASS   | `modes/rules.test.ts`, `challenges.test.ts` green                                                                                                                                                                               |
| 5    | Number shows, then fades                                               | PASS   | re-run in both locales: 243 (EN) and 294 (CS) visible about 0.3 s, hidden by about 0.6 s, tint and ring stay                                                                                                                    |
| 6–10 | Reveal on hit and expiry, wasteful hit, pause and restore, other modes | PASS   | first pass below. Code since then changed only the label and `nameRows`, neither on these paths                                                                                                                                 |
| 11   | Suite green, Czech present                                             | PASS   | above; `ZÁ­BLESK` and `Jeden pohled, pak zpaměti.` read as Czech                                                                                                                                                                |
| 12   | CLAUDE.md row                                                          | PASS   | unchanged                                                                                                                                                                                                                       |
| 13   | Name breaks where the label says, nowhere else                         | PASS   | dialog **GLIM / PSE** and **ZÁ / BLESK** at 375, 390 and 430 px, letters full size. One-line surfaces with no visible mark: intro card, top bar (`GLIMPSE · challenge` / `ZÁBLESK · výzva`), pause pill, closed-session summary |

### First pass (2026-10-25)

**Verdict (2026-10-25): 12 of 13 PASS, 1 FAIL (13, found in verify), 0 SKIPPED.** Criterion 10's
multiplayer surface wasn't driven (it needs two players in a room); the rest of 10 was. Hand back to
`/build glimpse` for criterion 13.

Suite: `i18n:verify`, `i18n:compile`, lint (0 errors), types, Knip, 1999 tests green. Prettier fails only
on `docs/work/2026-10-23-ranks/spec.md`, which is untracked and not this work. Our own spec was
reformatted.

App: Expo web on :8081 (restarted with `--clear` at the user's say-so), headless Chromium via Playwright,
a GLIMPSE session `5e55911a-…0001` booked in the **local** DB for three hours. Hit and expiry were read off
a recorded video, frame by frame.

| #   | Criterion                                                              | Result                        | Evidence                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No glimpse on any other mode or the tutorial                           | PASS                          | `modes/rules.test.ts` › the glimpse                                                                                                                                                                                             |
| 2   | GLIMPSE resolves to Accuracy Hard + 500                                | PASS                          | `challenges.test.ts` › glimpse, every rung                                                                                                                                                                                      |
| 3   | Sniper, claims, appended, others keep colours                          | PASS                          | `challenges.test.ts`; intro card wears its own magenta, nine dots                                                                                                                                                               |
| 4   | A patch's glimpse carries through                                      | PASS                          | `modes/rules.test.ts`                                                                                                                                                                                                           |
| 5   | Number shows, then fades about 0.5 s later; tint, ring, dial untouched | PASS                          | burst: 105 visible at 0.37/0.55 s, gone by 0.73 s, band-tinted disc and ring stay. Seen again on 63 and 267                                                                                                                     |
| 6   | Hit brings the number back through the hit exit                        | PASS                          | video 21.27–21.7 s: 107 fades in, swells out of the collapsing ring, leaves                                                                                                                                                     |
| 7   | Expiry brings it back white on red; a heart goes                       | PASS                          | video 28.75–29.1 s: 224 white on the red disc, squashed; hearts 3 → 2                                                                                                                                                           |
| 8   | Wasteful hit costs no heart                                            | PASS                          | 67-press hit on 207: +3, THE LONG WAY, hearts stay 3                                                                                                                                                                            |
| 9   | No re-flash on pause; restored run comes back hidden                   | PASS                          | in-session MENU → CONTINUE: no flash. Reload mid-clock with 255 hidden → CONTINUE: card back with band tint, no number in any frame                                                                                             |
| 10  | Accuracy, Speed, tutorial, multiplayer unchanged                       | PASS (multiplayer not driven) | Accuracy 151 and Speed 277 still showing 2 s in; tutorial 204 showing 3.5 s in. Multiplayer's `PieCountdown` is untouched in the diff and gets no `glimpse`                                                                     |
| 11  | `pnpm check` green, Czech present                                      | PASS                          | see Suite above; ZÁBLESK and the description in `locales/cs`                                                                                                                                                                    |
| 12  | CLAUDE.md has a glimpse row                                            | PASS                          | row after **drill**                                                                                                                                                                                                             |
| 13  | _(new)_ The challenge's name draws whole in its dialog at phone widths | **FAIL**                      | GLIMPSE wraps to `GLIMPS / E` at 375, 390 and 400 px; fits at 430. `challenge-modal.tsx:141` draws the label through `GameOverTitle` with `nameRows(…)`, and a 7-letter single word overflows the row. ZÁBLESK is 7 letters too |

**Reopens for build:** criterion 13 only. Two ways out, and the choice is the user's:
(a) let `nameRows` / `GameOverTitle` scale a single long word to fit. That's a shared component also used by
the game-over screen, so the design-guide sweep rule applies (list the callers, ask first). Or
(b) a shorter name, which is a `/challenge` decision and changes CLAUDE.md, the catalog and the Czech.

**Seen, not a criterion:** on a game over the numbers still hidden stay hidden as the cards shrink (no
exit, so no reveal). It's in the build notes and nobody asked for a reveal there. The driver lost the
first tap after a restart twice; a hit taken 6 s into a run lost none, so that's the harness, not GLIMPSE.
