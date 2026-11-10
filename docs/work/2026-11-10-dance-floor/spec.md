# Dance floor (HABIT dressing)

Slug: dance-floor
Stage: verify
Next: /review dance-floor
Track: small
Branch: feat/dance-floor
Started: 2026-11-10

## The itch

HABIT is the challenge about learning one fixed route — its **drill** deals the same nine
targets every run — but it looks like Accuracy with a beam. The thing it teaches is
invisible. Found in the code: the rules are already right (`HABIT` in
`modes/challenges/catalog.ts`, `shot: 'chain'` draws a beam from the previous target to the
one just taken). What is missing is the dressing — an opening, a scheme, a target form and a
shot — the same shape as the dressing queue (see FOUR_KEYS' drawing board). Theme: a dance
floor, the route as choreography.

## The direction

Dressing only; no rule changes, so the board stays comparable.

- **Footprints (the shot).** On a hit, footprints (left/right alternating) appear from the
  previous target to the one just taken and **stay for the whole run**, so after the ninth
  hit the floor shows the whole choreography. Older prints fade so the dial stays readable.
- **Fiery slide on a strike.** When a hit is a strike (the streak shot), the footprints do
  not just appear — they slide to the next target on fire.
- **Background.** A dance-floor parquet scheme.
- **Opening: "5, 6, 7, 8".** Dark ballroom, a spotlight sweeps the floor, tiles light row by
  row, the count is given; the run waits in `ready` until BEGIN. `short` take (restart) only
  brings the lights up.
- **Dial buttons:** left at the default for now.
- **Interactive element on the target area:** parked, not decided.
- **Outro:** not asked for; not in scope unless shape brings it back.

## Directions considered

| Direction                        | Appetite    | Risk                                                   | Outcome                           |
| -------------------------------- | ----------- | ------------------------------------------------------ | --------------------------------- |
| Footprints persist all run       | evening–day | nine lines blur into targets and dial                  | **chosen** (+ fiery strike slide) |
| Footprints vanish, last leg only | evening     | loses the "learning a dance" feel                      | lost                              |
| Ghost of last run's route        | week        | needs stored route, a data model                       | lost                              |
| LED tile dial buttons            | day         | colours/contrast against design-guide                  | deferred — default for now        |
| Patent-leather sole buttons      | day         | kitsch, legibility                                     | lost                              |
| Brass plaque buttons             | evening     | forgettable                                            | lost                              |
| Intro "5, 6, 7, 8"               | day         | full take must not nag on a run played on repeat       | **chosen**                        |
| Outro: replay the choreography   | 1–2 days    | must not delay game over                               | not asked for                     |
| Outro: lights out on last print  | evening     | —                                                      | not asked for                     |
| Spotlight under the finger       | day         | must read as decoration, not fight the dial's gestures | parked                            |
| Metronome floor                  | 2 days      | player expects rhythm to mean something                | parked                            |
| Hold to show the route           | week        | breaks board comparability unless it costs the streak  | parked                            |

## Problem

HABIT asks the player to learn a fixed route, and nothing on the screen shows the route.
A strike draws a beam that is gone in under a second, and a hit that is not a strike draws
nothing at all — so the one thing being learnt leaves no trace.

## Appetite

**A day or two.** A new scheme, a new opening, a new shot kind that lives for a run rather
than for half a second. Fixed: if the fire slide or the opening will not land in that, the
fire slide is cut to a plain slide first and the opening's `full` take to the lights-up
`short` take; the footprints themselves stay.

## Shape

The player starts a HABIT run from the intro. The game screen shows a dark ballroom: a
spotlight sweeps the parquet, tiles light row by row, a count of "5, 6, 7, 8" is given and
the run waits in `ready` until BEGIN. A restart plays the `short` take — lights up, no count.

In the run, every hit leaves a pair of footprints from the target taken before it to the
one just taken, left and right alternating; the first hit of a run leaves from the sum row,
as the chain does today. They stay on the floor under the dial and the cards, and the oldest
fade so that nine legs never hide the keys. A hit that is a **strike** does not just
appear: the footprints slide to the target on fire. After the ninth hit the floor shows the
whole choreography, and game over comes as it does today.

Areas touched:

- **Modes** — HABIT's catalog entry gains `opening`, `scheme` and a new `ShotKind`
  (`steps`); the new kinds join `OpeningKind`, `SchemeKind` and `ShotKind` in `modes/types.ts`.
  Mode's business, not the engine's: the engine still asks `shot`, never `habit`.
- **The shot hook** — `useStrikeShots` fires only on strikes today (`hit.bonus`) and keeps the
  previous target as `chainFrom`. `steps` needs **every** hit, with the strike marking which
  slide is burning. This is the one place a shot kind changes what the hook listens to.
- **Drawing** — a persistent footprint layer in `components/game/` (not a `Shot`, whose
  slot ends on a timer); the fire reuses what `dial-flames` already draws if it can.
- **Scheme and opening** — a parquet entry in `SCHEMES` (`constants/colors.ts`) and a scene
  in `OPENINGS` (`opening-layer.tsx`), the same way FOUR_KEYS' drawing board was added.
- **Copy** — the count and any label; `pnpm i18n:extract` and Czech.
- **How to Play** — unchanged: no control, scoring or rule moves. Checked at the end anyway.

## In

- Parquet scheme; the dial keys left at the default.
- Footprints from target to target on every hit, kept for the run, oldest fading.
- A strike's footprints slide on fire.
- Opening "5, 6, 7, 8" with a `full` and a `short` take.

## Out

- Dial-button restyling (LED tiles and the rest) — deferred.
- The interactive element on the target area — parked.
- An outro; the game-over sequence stays as it is.
- Any change to scoring, lives, the drill or the streak rule — the board stays comparable.
- Showing the route ahead of time (hold to see it) — would touch comparability.
- A feature flag: none asked for, none added.

## Rabbit holes

- **Nine legs over the dial.** The footprints sit in the same area as the keys and cards. Way
  around: draw them under both, fade the oldest, keep them thin. If that is not enough, this
  is why the day might not hold.
- **The hook is shared.** `useStrikeShots` serves Sniper, Burst, Flame and chain for every
  mode. `steps` must not change what those fire on; the change is gated on the shot kind.
- **A drilled run draws nine card sizes**, which `ShotAim.radius` already carries per
  shot — the footprints must read it the same way rather than assume one size.
- **The run changes under them.** A new run must clear the floor (the same reset
  `chainFrom` gets on `runSeq`), and a restart's `short` take must not leave a ghost trail.
- **Working tree.** `opening-layer.tsx`, `colors.ts` and `use-scheme.tsx` are mid-edit for
  the drawing board; commit with `--only` and add to them, do not rewrite them.

## Tasks

- [x] `steps` shot kind: type, HABIT's `shot`, and the hook firing on every hit for it only.
- [x] Persistent footprint layer, fading the oldest, cleared on a new run.
- [x] Fire slide on a strike.
- [x] Parquet scheme.
- [x] "5, 6, 7, 8" opening, `full` and `short` takes.
- [x] Copy extracted and in Czech; tests for the hook change and the fade rule.

## Acceptance criteria

1. In a HABIT run every hit, strike or not, leaves footprints from the previous target to
   the one taken; the first leaves from the sum row.
2. Footprints stay until the run ends and the oldest fade; a new run starts with a clean floor.
3. A strike's footprints burn as they slide; a hit that is not a strike does not.
4. Sniper, Burst, Flame and chain fire exactly when they did before.
5. The opening plays in `ready` with the count, `BEGIN` starts the run; a restart plays the
   short take.
6. No change to HABIT's scoring, lives, drill or standings.
7. `pnpm check` and `pnpm i18n:verify` are green, and Czech is complete.

## Build notes

- **Landed as specced.** `steps` shot kind (`modes/types.ts`), HABIT on `steps` + `parquet` +
  `ballroom`; `useStrikeShots` returns `legs` — every hit for `steps` only, a strike marks the leg
  `burning`; `FootprintTrail` (`components/game/footprint-trail.tsx`) draws them under the cards;
  pure geometry and fade in `lib/footprints.ts`; `parquet`/`parquetBar` in `SCHEMES`; the
  opening in `components/game/openings/ballroom.tsx`.
- **Fire slide** is an ember under each print as the slide reaches it plus a running flame head,
  not a reuse of `dial-flames` (that one draws a flame behind a key, not along a line).
- **Count is numerals only** (5 6 7 8, DSEG7, `READOUT.scoreLarge`) — no copy, so no catalog
  change. `pnpm i18n:verify` is green.
- **HABIT now opens**, so its run is held `ready` until BEGIN: `machines/game.test.ts` drilled-run
  tests and the two opening lists in `challenges.test.ts` were updated for that.
- **No hook test.** `useStrikeShots` is React state with no test harness here; the geometry and fade
  (`lib/footprints.test.ts`) and HABIT's dressing are tested.
- **Not claimed:** nothing has been _seen_ running. Criteria 1–5 are drawing and need the app —
  that is `verify`'s. Particular things to look at: nine legs against the dial, the burn reading
  over the walnut floor, the count's legibility, and a `short` take on PLAY AGAIN.
- **Pre-existing:** `app/(tabs)/index.tsx` fails `sonarjs/cognitive-complexity` at HEAD already,
  and `.claude/worktrees/road-bandits` fails lint — neither is this item's.
- Dial keys, the interactive element and an outro: still out.

## Verification log

Verdict so far: **3 pass, 4 not yet run** (the player-visible ones, waiting on the app).

| #   | Criterion                                               | Result  | Evidence                                                                                                                                      |
| --- | ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every hit leaves footprints, first from the sum row     | PENDING | needs the app; `lib/footprints.test.ts` covers the geometry only                                                                              |
| 2   | Footprints stay, oldest fade, new run starts clean      | PENDING | fade rule tested (`legOpacity`); the reset on `runSeq` and the run-long persistence are only read, not seen                                   |
| 3   | A strike's leg burns; a plain hit's does not            | PENDING | needs the app                                                                                                                                 |
| 4   | Sniper, Burst, Flame and chain fire exactly as before   | PASS    | the diff of `use-strike-shots.ts` removes nothing but a type line and adds a `steps` branch that returns before them; full suite 2339 passing |
| 5   | Opening plays in `ready` with the count; short on retry | PENDING | `runRules('habit').opens` is true and `OPENINGS.ballroom` is exhaustive-typed; not seen playing                                               |
| 6   | No change to scoring, lives, drill or standings         | PASS    | the catalog diff for HABIT adds `opening`, `scheme`, `shot` and touches nothing under `rules`; drilled-run machine tests green after `BEGIN`  |
| 7   | `pnpm check` and `i18n:verify` green, Czech complete    | PASS*   | tests, `tsc`, `knip`, `i18n:verify` green; no new copy. *Lint fails at HEAD already (`index.tsx` complexity, a worktree) — not this item's    |

**Verify is paused on criteria 1, 2, 3 and 5.** HABIT's catalog window closed on 2 Nov, so it
is only playable through a booked session. One was inserted into the _local_ stack
(`challenge_sessions` `1859c055-f97f-4731-abb8-d0e5040c4e3e`, `challenge/habit`, `time`, open
until about 11:10 UTC on 11 Nov); `open_sessions_with_leaders()` returns it, but the web intro
on :8081 does not draw a card or a HABIT pill for the dev profile (admin, whose stack holds
`challenges`). Not diagnosed yet. Stage stays `build`.

## Amendment — the floor looks like the photo

The user's reference photo (honey oak, herringbone) replaced the first guess of a dark walnut ballroom.
`parquet` is now **light oak with dark-brown ink** (`PARQUET` in `constants/colors.ts`), and the
opening leaves the herringbone behind the run as its **remains** (`ParquetRemains`, planks from
`lib/herringbone.ts`, tiling tested). The count's numerals are dark ink, since gold would not read on
oak. In scope as before: still drawing only. Seen only as a standalone render of the same geometry —
not yet in the running app (criteria 1, 2, 3, 5 above).

## Amendment — name, count, floor

- **Name:** the player reads **CHA CHA** (code `CHA`); the slug stays `habit`, as GLIMPSE's reads STORM.
- **Count:** ONE, TWO, THREE, CHA, CHA (JEDNA, DVA, TŘI in Czech), four beats in 2.4 s (ONE, TWO, THREE a beat each, the two CHAs half a beat each), rising in and lifting away — one word at a time, large, in the middle of the targets' area, not
  all at once (`CountWord` in `ballroom.tsx`). The words 5-6-7-8 are gone. **New type role
  `TYPE.countIn` (84px) — needs agreeing**, since no existing role is large enough.
- **Footprints:** an asymmetric sole so left and right differ; bigger and further apart (`STRIDE` 40).
- **Intro background:** the herringbone floor stands under the opening from its first frame
  (`OPENING_REMAINS_FROM_START`, `remainsOf` in `hooks/use-opening.ts`), so the count is given on the
  same floor the run is played on.

## Amendment — the targets are dancers

New **target form** `dancers` (`modes/types.ts`, `TARGET_FORMS`): each target is a dancer seen from
above. The ordinary card is the head, number and ring on it; behind it `DancerFigure` draws shoulders
and two arms in a hold, turned a different way and dressed in a different colour per target
(`lib/dancers.ts`, from the target's sequence number, so the drill's nine look the same every run), and
swaying a few degrees while the run is live (`DancerTarget`). Drawing only. Rabbit hole to watch in
the app: nine figures at 1.7× a card's width on a phone — they may crowd each other behind the cards.

## Verification log — second pass (in the running web app)

Verdict: **7 pass, 0 fail.** The web build on :8081 against the local stack, a CHA CHA session booked
locally (and the `challenges` feature made visible locally), a full take, a restart, hits driven by
hand.

| #   | Criterion                                           | Result | Evidence                                                                                                                                                                    |
| --- | --------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every hit leaves footprints; the first from the sum | PASS   | hit 13 first: prints between the sum row and the card; hit 106 then 107: prints between those two cards                                                                     |
| 2   | They stay, oldest fade, a new run starts clean      | PASS   | both legs stayed on screen through the run; after RESTART RUN the floor had none. Fade (`legOpacity`) is tested, not seen with nine legs                                    |
| 3   | A strike's leg burns; a plain hit's does not        | PASS*  | 106 then 107 scored `+200 ×2`; a DOM poll counted one slide head and one lit ember in that window. *A plain hit not burning is by the code (`burning: hit.bonus`), not seen |
| 4   | Other shots fire as before                          | PASS   | diff read; full suite green                                                                                                                                                 |
| 5   | Opening in `ready` with the count; short on a retry | PASS   | full take: herringbone under the scene, ONE/TWO/… large mid-targets; RESTART RUN: lights only, no count                                                                     |
| 6   | No change to scoring, lives, drill, standings       | PASS   | catalog diff touches no `rules`; drilled-run tests green                                                                                                                    |
| 7   | `pnpm check` pieces and `i18n:verify` green         | PASS   | 2363 tests, `tsc`, `knip`, `i18n:verify`, lint on the touched files; Prettier flags only `replay-consent-overlay.tsx`, not this item's                                      |

**Seen, not in the criteria:** the dancers (`dancers` form) draw as heads with shoulders and arms and
overlap their neighbours slightly; the footprints are mostly hidden under the dancers, since the trail
lies under the cards. The prints are two pieces (sole and heel). Worth a look by eye.

**Left in the local stack as found:** the test session row deleted, `challenges` back to `hidden`.
Browser localStorage keys `nine.moved.v1` and `nine.dev.gallery.v1` were cleared during the walk.
