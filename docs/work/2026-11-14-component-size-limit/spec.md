# Every component under 300 lines

Slug: component-size-limit
Stage: shipped
Next: walk criteria 6–12 on a device, then /deploy
Track: full
Branch: refactor/component-size-limit
Started: 2026-11-14

## Problem

The game screen is one 2,167-line function — 31 `useState`, 24 `useEffect`, every concern
of a run, its openings, its popups and its overlays read off the same scope — so no change
to it can be made, reviewed or reasoned about locally, and a state update anywhere in it
re-runs all of it (the per-frame score count-up was one such cost, fixed 2026-11-14 by
`ScoreReadout`). Sixteen more component files are past the size where one reading holds them,
and nothing stops the next one growing: ESLint has no size rule.

The player sees none of this directly. What they get is the jank and the regressions a
file this size breeds; what the work owes them is **no visible change at all**.

## Appetite

**A week.** Decided inline: the user chose the scope (all offenders) and the counting
(code lines); the appetite follows from GameScreen alone being most of the work. If the
week runs short, the boundary that gives is the order below — GameScreen and the rule are
the point; the file-only splits at the tail are what slips.

## Shape

The rule, as the user set it: **a component is at most 300 lines of code** — comments and
blank lines not counted — **and owns one piece of logic and its markup.** Measured by
ESLint's own `max-lines-per-function` and `max-lines` with `skipComments` and
`skipBlankLines`, so the gate and this shape agree on every number.

Measured 2026-11-14, `app/` and `components/` (code lines; fn = one function over):

| File                                         | File | Worst fn |
| -------------------------------------------- | ---- | -------- |
| `app/(tabs)/index.tsx` — `GameScreen`        | 2720 | 2167     |
| `components/game/arcade-game.tsx`            | 779  | 570      |
| `components/overlays/how-to-play-overlay`    | 776  | 472, 437 |
| `components/overlays/menu-overlay`           | 540  | 469      |
| `components/game/dial-button`                | 505  | 403      |
| `components/overlays/player-profile-overlay` | 498  | 412, 354 |
| `components/game/openings/takeoff`           | 466  | —        |
| `components/game/openings/lever-pull`        | 462  | —        |
| `components/overlays/email-code-modal`       | 393  | —        |
| `components/game/dial`                       | 386  | —        |
| `components/game/best-scores-line`           | 365  | —        |
| `components/game/pie-countdown`              | 342  | —        |
| `components/overlays/game-over-overlay`      | 335  | —        |
| `components/overlays/admin-messages`         | 329  | —        |
| `components/game/siege-blow`                 | 325  | —        |
| `components/overlays/admin-stats`            | 321  | —        |
| `components/overlays/admin-knowledge`        | 309  | —        |

The other fifteen files on the first raw-line list are already under once comments are
not counted, and are not touched.

Three kinds of work, in the order the build takes them:

1. **The rule, as a warning.** Both rules at 300 over `app/` and `components/` in
   `eslint.config.mjs`, beside the typography rules that already scope to those two. The
   17 files above warn; nothing else does.
2. **File-only splits** (the nine with no fn column). Each already has small functions;
   its sub-components and module-level animated pieces move to their own files beside it.
   Mechanical — a move, not a rewrite.
3. **Function splits** — the five with one oversized component, then **GameScreen** last
   and with the most care. A function over the limit splits two ways: its **state and
   effects** into hooks that each own one concern, and its **markup** into sub-components
   that take only what they draw. For GameScreen the concerns are already visible as
   comment-headed blocks — the run and its machine, the opening, the tutorial lesson,
   announcements and records, the launch popups and their deck, the top bar, the target
   field, the dial area, the overlays layer — and `spec` names each one.
4. **The rule, as an error**, once every file is under. The work is not done until it is.

**Mode or engine?** Neither. No behaviour moves; nothing new asks a mode's name. Where
GameScreen reads `rules`/`traitsOf` today, the extracted piece receives what it reads.
No feature flag — a refactor ships to everyone or no one.

Areas: `eslint.config.mjs` (two rules); the game screen `app/(tabs)/index.tsx`; new
hooks under `hooks/` and new components under `components/game/` and
`components/overlays/` beside the files they leave; the sixteen component files above.
Copy, schema, machines, modes: untouched.

## In / Out / Rabbit holes

**In**

- `max-lines-per-function` and `max-lines`, 300, comments and blanks skipped, `app/` +
  `components/` — warning first, error at the end.
- All 17 files under both limits, GameScreen included.
- Every hook a split creates is itself under 300 code lines, though hooks are not
  linted (below).
- The code-guide skill and CLAUDE.md's Rules gain the one-line rule, so it is written
  where the next author reads.

**Out**

- **Hooks over the limit** — `hooks/use-arcade-run.ts` (943), `use-multiplayer-game.ts`
  (385), `use-achievements.ts` (335). The user's rule was about components; a follow-up
  item can widen the lint scope to `hooks/` once these are split.
- **Any behaviour, copy or style change.** A line that moves must do exactly what it did.
  A bug found on the way is noted in the build notes and fixed in its own commit, or left.
- **Renames.** `multiplayer-menu.tsx` and the other naming traps in CLAUDE.md stay as
  they are; a split names its _new_ files in domain words, never touches the old names.
- **One-component-per-file lint** (`react/no-multi-comp`) — the user asked for a size
  limit; a file may still hold a small component and its module-level animated pieces.
- **Further performance work.** Splitting will cut re-render scope as a side effect;
  measuring or chasing it is not this item.
- The 79 existing typography-rule warnings.

**Rabbit holes**

- **GameScreen's shared scope.** Its effects read each other's state freely; an effect
  moved into a hook may need four values from three other concerns. Way around: extract
  in dependency order (the leaves first — popups, announcements — the run last), and let a
  hook take the values it reads as arguments rather than inventing a context. A context
  is a new shared surface and needs the spec's say-so.
- **Effect order.** Effects run in declaration order; moving one into a hook declared
  elsewhere can reorder two that race (pause-on-blur vs. resume, the opening vs. the
  first spawn). Way around: keep each hook call where its effects sat, and test the races
  `spec` names by driving the app.
- **React Compiler memoisation.** Today the compiler caches JSX inside one component;
  a sub-component receiving a fresh object or inline closure each render re-renders where
  it did not. Not a correctness risk, but it can undo the score-readout win. Way around:
  pass primitives and the stable values the screen already has.
- **Reanimated.** Animated sub-components must stay at module level (CLAUDE.md), and a
  shared value passed down must be the same value, not re-created. A split that defines a
  component inside another reintroduces remounts.
- **i18n ids.** Lingui ids are derived from the message, so moving a `t`/`<Trans>` is
  safe — but an edit to the text on the way changes the id. `pnpm i18n:verify` is the gate;
  no copy changes.
- **Proving "no visible change".** The suite covers logic, not screens. Verify will need
  the running app across a scored run, the tutorial, an opening, pause, game over, an
  arcade run and multiplayer — which means Chrome, which is the user's to agree to.
  This is why the appetite might not hold.
- **The shared checkout.** Another session's push-every-board work is uncommitted in the
  same tree; every commit here goes with `--only` (memory: shared-checkout-commits).

## Contract

### Domain words

**Used:** screen (game, intro, pause, game over, options, how to play), run, board,
session, session board, opening, ready, scheme, target form, launch popup, lesson,
tutorial, achievement, medal, record, announcement. **Introduced: none** — this work names
files, not concepts, so `docs/domain.md` and CLAUDE.md's tables do not change.

**Collisions, kept apart:**

- **stage** is the Arcade fight's difficulty. The game screen's run layer is
  `GameLayer`, never "stage".
- **session** is a challenge's appearance. The hook that holds which session a run
  belongs to is `useRunSession` — about a _session_, correctly — and never an auth one.
- **RunScreen** already exists (a run's last screen). Nothing new is called `RunScreen*`
  or `*Screen` unless it is one of CLAUDE.md's screens.

### Files

The code-guide already requires **one named component per file**; every split honours it.
Names are by concern; `build` may split a planned file further (never merge two) if one
still runs past 300, and records it in the build notes.

**GameScreen — created** (logic hooks in `hooks/`, each taking one argument object):

| Path                                | Holds (from `app/(tabs)/index.tsx`, ~lines)                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-run-control.ts`          | pause asked for / resume beat / pause-on-blur, persisted stats·mode·difficulty, saved-run restore and its positions (857–985)                                                      |
| `hooks/use-run-session.ts`          | the run's session, its close time, window shut, mode before it, places asked, and their effects (998–1090)                                                                         |
| `hooks/use-screen-dialogs.ts`       | `menuOverlay`, `titleDialog`, feedback + bookmark, share invite, challenge card, vote dialogs, nickname modal, arcade open, and the overlay-opened analytics (986–1117, 1243–1262) |
| `hooks/use-launch-asks.ts`          | welcome, what's new deck, push consent, next vote, session ask, feedback replies, account email, and the order they wait on each other (1175–1260, 2165–2265)                      |
| `hooks/use-run-boards.ts`           | board, session board and medals, champions, leaders, rival, local scores, session targets, my medals, lost medals, medal history (1264–1330, 1392–1403)                            |
| `hooks/use-run-announcements.ts`    | achievement queue, announcements, achievements, step-up and its latch, trainee coach (1330–1555)                                                                                   |
| `hooks/use-run-ending.ts`           | the game-over effects, run medals/screen/podium/title roll, counted-run guard, `endRunEarly` (1560–1780)                                                                           |
| `hooks/use-play-field.ts`           | segments, sum and held sum, drill, drift ticks, spawner, floats and float stats, displayed targets, lesson, taught offer, shot aiming, strike shots, persisted run (1783–2060)     |
| `hooks/use-multiplayer-screens.ts`  | room, game, pending action and the create/join/start handlers, leave-on-unmount, finished latch (2087–2160, 2269–2300)                                                             |
| `lib/intro-standing.ts` (+ test)    | `MENU_DIALOGS`, `isMenuScreen`, `introStanding`, `welcomeStanding`                                                                                                                 |
| `lib/launch-asks.ts` (+ test)       | `mayAskForEmail`, `mayOpenSessionAsk`, `accountNoticeFor`                                                                                                                          |
| `lib/feedback-bookmark.ts` (+ test) | `feedbackGameState`, `showFeedbackBookmark`                                                                                                                                        |
| `lib/board-targets.ts` (+ test)     | `RANKED_OF`, `NO_BOARD_TARGETS`, `boardTargetsOf`                                                                                                                                  |
| `lib/announcements.ts` (modified)   | gains `announcementsReady` beside the rest of its family                                                                                                                           |

**GameScreen — created** (markup, `components/game/` unless an overlay):

| Path                                                              | Draws (~lines)                                                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/game/screen-providers.tsx`                            | the provider stack: flags, locale gate, champions, profile, board, wash, status bar (2318–2342)                                                |
| `components/game/run-celebrations.tsx`                            | announcement effect, trainee confetti, step-up toast, taught modal (2343–2404)                                                                 |
| `components/game/game-layer.tsx`                                  | the run under its scheme: opening under/remains/over, arrival stage of the run (2405–3061)                                                     |
| `components/game/run-bar.tsx`, `target-area.tsx`, `dial-area.tsx` | `GameLayer`'s three bands — the bar above the dial with its score cluster and figures, the targets, the dial with its sum row — each under 300 |
| `components/game/run-overlays.tsx`                                | life-loss flash, game-over sequence, step-up overlay, pause, achievement detail (3062–3255)                                                    |
| `components/overlays/menu-screens.tsx`                            | options, news, how to play, join room, admin, share, votes, challenge modal, intro menu (3256–3416, 3542–3634)                                 |
| `components/overlays/launch-asks-layer.tsx`                       | tutorial offer, feedback reply, what's new, session dialog, install, replay and push consent (3417–3541)                                       |
| `components/overlays/title-dialogs.tsx`                           | bookmark, medals, achievements, feedback, nickname (3635–3737)                                                                                 |
| `components/game/multiplayer-screens.tsx`                         | waiting room, multiplayer game, its pause, its results (3738–end)                                                                              |

**Modified:** `app/(tabs)/index.tsx` — `GameScreen` calls the hooks and renders the layers,
under 300 code lines, the file under 300 too.

**The other sixteen** (all modified; created files sit beside them):

| File                                                                               | Split                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/game/arcade-game.tsx`                                                  | `ArcadeGame` (570) → a `use-arcade-game-*` hook for its frame loop/effects + map, hero and HUD pieces as their own files                                                                          |
| `components/overlays/how-to-play-overlay.tsx`                                      | one component per guide section (`how-to-play-<section>.tsx`), plus `SectionHeader`, `Contents`, `TryItButton`, `WeightGrid` to their own files                                                   |
| `components/overlays/menu-overlay.tsx`                                             | `MenuOverlay` (469) → the Alone panel, the With friends panel, the mode/difficulty pickers, and their state hook                                                                                  |
| `components/game/dial-button.tsx`                                                  | `DialButton` (403) → its gesture into a hook, its face/badges into sub-components                                                                                                                 |
| `components/overlays/player-profile-overlay.tsx`                                   | `PlayerProfileOverlay` (412) → the profile's sections as components, the mode list as one                                                                                                         |
| `components/game/openings/takeoff.tsx`, `lever-pull.tsx`                           | each module-level piece (`Standing`, `Passer`, `Ground`, `Explosion`, `PlaneOver`; `BulbSet`, `Runner`, `Marquee`, `LeverOver`) to its own file under `openings/takeoff/`, `openings/lever-pull/` |
| `components/overlays/email-code-modal.tsx`                                         | `FieldNote` to its own file; `EmailCodeModal`'s code-entry state to a hook                                                                                                                        |
| `components/game/dial.tsx`                                                         | the cell map (514) to a `DialCell`; pure helpers to `lib/`                                                                                                                                        |
| `components/game/best-scores-line.tsx`, `pie-countdown.tsx`                        | helpers and sub-pieces out until file and function are under                                                                                                                                      |
| `components/overlays/game-over-overlay.tsx`                                        | its stat and score blocks as components                                                                                                                                                           |
| `components/overlays/admin-messages.tsx`, `admin-stats.tsx`, `admin-knowledge.tsx` | `AnswerDialog`, `FortunePage`, `MechanicsPage` to own files; the table-row builder to `lib/admin/`                                                                                                |
| `components/game/siege-blow.tsx`                                                   | `Mote`, `Shot`, `Falling` to own files                                                                                                                                                            |

**Modified, config and docs:** `eslint.config.mjs` (the two rules, in the existing
`app/**` + `components/**` block); `.claude/skills/code-guide/SKILL.md` Components gains
the 300-line rule; CLAUDE.md Rules gains one bullet.

### Data and types

None. No storage key, no machine context, no event, no schema. Hooks return plain objects
of what their callers read; no new React context (Rabbit holes — a context would be a new
shared surface). `state`/`send` pass down as props.

### Gates

| Gate            | Answer                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | **None new.** Strings move with their `t`/`<Trans>` unchanged; no msgid is added or removed. `pnpm i18n:extract` then `pnpm i18n:verify` green. |
| **How to Play** | **No.** Gameplay is untouched. The guide's file is split, its words are not.                                                                    |
| **Flag**        | **None.**                                                                                                                                       |
| **Buttons**     | **None new.** Existing `ButtonId`s move with their pressables.                                                                                  |

## Acceptance criteria

1. `eslint.config.mjs` sets `max-lines` and `max-lines-per-function` to `error`, `max: 300`,
   `skipComments` and `skipBlankLines`, over `app/**` and `components/**`; `pnpm lint`
   reports none of either.
2. Every hook and `lib/` file this work creates is under 300 code lines by the same
   measure (`npx eslint <file> --rule` with both rules), though `hooks/` is not linted for it.
3. No file under `app/` or `components/` defines a component inside another component, and
   every file this work creates holds one named component (module-level animated pieces
   included in that count only if they are named components).
4. `pnpm check` is green, `pnpm i18n:verify` included, and `git diff locales/` adds and
   removes no `msgid`.
5. `pnpm test` passes every test that passed before, plus the new tests below.
6. **A scored run** (Accuracy, Easy): the score counts up on a hit with floating points and
   stat, the multiplier shows from a streak, a lost life flashes red, pause → CONTINUE
   resumes after the beat, END RUN plays the game-over sequence, PLAY AGAIN deals a fresh
   run. Same as on `main` before the work.
7. **The tutorial**, from HOW TO PLAY's way in or the welcome: the lesson steps play, the
   taught offer appears at its end.
8. **A challenge with an opening**: the opening plays, BEGIN starts the run, its remains
   stay drawn, the scheme is the challenge's.
9. **An ADVENTURE run** opens from the intro, the hero moves, pause and game over work.
10. **Intro dialogs**: options, how to play, medals, achievements, feedback and nickname
    each open and close; the feedback bookmark is shown everywhere but a live run.
11. **Restore**: closing the app mid-run and reopening it puts the run back paused with its
    targets where they were.
12. **Multiplayer**: CREATE GAME shows the waiting room with a code; the host starts; the
    run ends on the results screen.

**Decided by the user, 2026-11-14:** contract accepted as written. Criteria 6–12 are
walked **by the user on a device** — verify does not drive Chrome; it runs 1–5 and hands
6–12 over as a checklist. Build commits each task on its own (`git commit --only`).

## Tests

- `lib/intro-standing.test.ts` — `introStanding` and `welcomeStanding` for intro vs. a
  menu screen vs. a dialog over the intro; `isMenuScreen` over `MENU_DIALOGS`.
- `lib/launch-asks.test.ts` — `mayAskForEmail` and `mayOpenSessionAsk` hold back while a
  launch popup or consent is up and let through when clear; `accountNoticeFor` for moved,
  pending and neither.
- `lib/feedback-bookmark.test.ts` — `showFeedbackBookmark` hides in a live run and shows on
  pause, game over and the intro.
- `lib/board-targets.test.ts` — `boardTargetsOf` for a ranked mode, an unboarded one and
  a session run.
- `lib/announcements.test.ts` — extended for `announcementsReady`.

These are written **against today's code first** and moved with it, so they pin the
behaviour before it moves rather than describe it after.

## Review focus

- **Effect order across hooks** (GameScreen tasks): pause-on-blur vs. the resume beat, the
  saved-run restore vs. the first spawn, game-over latch vs. counted-run — hook calls must
  sit in the order their effects did.
- **Fresh identities per render** (every split): a sub-component handed an inline object
  or closure that the compiler cached before. Check the score readout still re-renders
  alone during the count-up.
- **Module level** (openings, siege-blow, arcade-game, dial-button): no animated piece
  defined inside a component, no shared value re-created by the move.
- **Refs that crossed a boundary** (GameScreen): `hitsRef`, `prevIsGameOverRef`,
  `countedRunRef`, `multiLeaveRef`, `boardSize`, `sumRowRect` — each must live in the one
  hook that writes it, with readers given a function, not a copy.
- **Lingui** (how-to-play, menu-overlay): `useLingui` called in every component that
  calls `t`; no message re-worded on the way.
