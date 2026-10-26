# Glimpse

Slug: glimpse
Stage: review
Next: /ship glimpse
Track: full
Branch: feat/glimpse
Started: 2026-10-25

## Problem

Every challenge so far bends the dial, the clock or the drill, and in all of them a
target says what it is for as long as it stands. There is no challenge yet about
**memory**: a number seen once and then held in your head while the route is planned
and dialled. And the engine can't make one. Nothing in `RunRules` says what a target card
draws, so a catalog entry asking for it would typecheck and play as ordinary
Accuracy Hard.

## Appetite

**An evening.** One rules field defaulted so every existing mode is untouched, a prop
on the card, the number's fade, the domain word in CLAUDE.md, and the catalog entry with
its Czech. No schema, no new screen, no new animation. If it doesn't fit, the reveal
gets plainer and the shape stays the same.

## Shape

### What the player meets

An admin books a session of GLIMPSE on the CHALLENGES screen: an ordinary booking,
nothing new on the form. The card appears on the intro in its generated colour, with
nine dots for the nine dial.

START. It is Accuracy Hard in every visible respect: the nine dial, a 16.5 s ring, arrivals
getting closer together, three targets at most, three hearts. A target arrives the way
every target does, and its number shows for **500 ms**, then fades out. The disc stays,
the ring keeps running down, and the **band tint stays**, so a hidden 247 still reads as
"200-something". The dial is never touched.

The player dials from memory. On a **hit**, the number comes back as the card leaves, so
the exit animation shows what was taken. On an **expiry** it comes back too: the player sees
what they missed as the heart goes. A low-accuracy hit costs no life, which is already every
challenge's default (`wastefulCostsLife: false`) and needs nothing written.

The streak is Accuracy's `optimal` and the shot its `sniper`, both inherited. An exact
route on a number you can no longer see is the thing worth multiplying. The game-over
screen draws from GLIMPSE's own claims.

### Areas

- **The rules** (`modes/`): one new field, the **glimpse**: how long a target's
  number shows after arrival, null for "always". Null everywhere today, so every mode
  answers exactly as it does now. Which group it lives in is spec's call: `spawn` is about
  arrivals rather than drawing, so it may want a small group of its own.
- **The game screen** (`app/(tabs)/index.tsx`): the one `TargetCard` call site passes the
  rule down, the same way it already passes `rules.clock.countsDown` as `clocked`.
- **The card** (`target-card.tsx` → `pie-countdown.tsx`): the number's opacity. Visible
  on arrival, faded out after the glimpse, back to full the moment `exit` is set (hit or
  expiry). The multiplayer `PieCountdown` gets no glimpse and does not change.
- **The catalog** (`modes/challenges/catalog.ts`): GLIMPSE, appended. Base `ACCURACY`,
  `fixedDifficulty: 'hard'`, the glimpse at 500, and claims. Nothing else.
- **The copy**: label, description and claims; `pnpm i18n:extract` and Czech.
- **CLAUDE.md**: a **glimpse** row in the domain table, written before the code.

**Mode's business or the engine's?** A rule. The card asks the rules how long a number
shows and never learns which mode is asking.

**Flag?** None. A challenge only reaches a player through a booked session, which is its
own gate. Until somebody books one, GLIMPSE is in no list anybody sees.

### Decisions already taken (from `/challenge`)

| Part           | Decision                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Name           | **GLIMPSE** (the working name was FLASH; it lost because "flash" is already the multiplayer hit-flash on the card's track)                     |
| Colour, mark   | Generated hue for catalog index 3; nine dots                                                                                                   |
| Streak / shot  | `optimal` / `sniper`, both inherited from Accuracy                                                                                             |
| Band tint      | Kept, as the one anchor memory gets                                                                                                            |
| Reveal         | On a hit **and** on an expiry                                                                                                                  |
| Claims (draft) | board `SAW IT` · `KEPT SIGHT` · `SHARP EYE`; medal `NEAR SIGHT` · `HALF SEEN`; strong `GOOD EYE` · `HELD IT`; cold `GONE BLANK` · `LOST SIGHT` |

## In / Out / Rabbit holes

### In

- The glimpse rule with a null default, and its CLAUDE.md row.
- The card hiding the number after the glimpse and revealing it on any exit.
- The GLIMPSE catalog entry, its copy, and the Czech.
- A test that every existing mode resolves with no glimpse, and that GLIMPSE resolves with 500.

### Out

- **A neutral disc.** The band tint stays; hiding it would be a second override on the
  track colour, and the decision was to keep the anchor.
- **A bespoke hide or reveal animation.** A plain opacity fade. The exit animation the card
  already plays carries the reveal.
- **Multiplayer.** Challenges don't run there; its `PieCountdown` is untouched.
- **A How to Play change.** The challenges chapter is deliberately vague about any one
  challenge's rules (see the `challenge` skill).
- **A difficulty-scaled glimpse.** The rung is pinned to Hard; one figure.

### Rabbit holes

- **The fail animation already owns the number's colour.** On expiry `PieCountdown`
  squashes the number and turns it white over red. The reveal has to bring the opacity
  back _under_ that animation rather than fighting it, or an expired card shows a blank red
  disc. Way round: opacity is its own shared value, separate from `numberStyle`'s
  colour and scale.
- **Arrival timing.** "500 ms after arrival" has to be measured from when the card
  mounts, not from the target's spawn in the machine. A card re-mounted mid-run (resume
  from pause, a remount on layout) must not flash its number again. Spec should say which
  clock it reads. If it can't be answered cheaply, the honest fallback is "from mount" and
  accepting a re-flash on remount.
- **Accessibility.** A hidden number that a screen reader still reads out is the challenge
  undone for one group of players, and silence is unplayable for them. Out of this
  appetite to solve properly; spec should name what the label says and accept it.
- **The multiplayer hit-flash sharing the track.** Not hit, since multiplayer gets no glimpse,
  but it is why the field is not called flash.

## Contract

### Domain words

**Uses**, as CLAUDE.md defines them: **challenge**, **rules** (`RunRules`), **dial**,
**run**, **session**, **session board** (never shortened to "board"), **capability**,
**drill** (only to say what glimpse is _not_), **claim** (the end-screen wordmark, as the
`challenge` skill uses it). A target's on-screen thing is the **card** (`TargetCard`), and
the ring-and-disc drawing inside it is the **pie** (`PieCountdown`). The coloured disc under
the number is the **band tint**.

**Introduces**, as one word:

- **glimpse**: how long a target's number shows after its card arrives before it fades
  out, in ms, or null for a number that never hides. The number comes back the moment the
  card starts to leave, hit or lost. A rule, `spawn.glimpse` on `RunRules`. Null for every
  mode but GLIMPSE. **CLAUDE.md's domain table gains a row**, after **drill**.

**Collisions:**

- **flash**: the multiplayer hit-flash already owns the card's track colour
  (`backgroundColor` on `PieCountdown`, see the comment on `trackColor`). That is why the
  word is glimpse and not flash. Neither "flash" nor "blink" names anything here.
- **reveal**: not a new word. It names the moment `exit` is set and the number comes
  back, nothing more. No identifier is called `reveal`.
- **GLIMPSE** the challenge vs **glimpse** the rule: same word on purpose, the way HABIT
  is the challenge and **drill** is the mechanism. The mechanism is lower-case in prose;
  the challenge is its label.

### Placement

`spawn.glimpse` and not a new group. `spawn` already says how a target _arrives_ (how
often, how many, how far from the sum, from which list), and "shown for half a second on
arrival" is part of how this one arrives. A new group would add a key to `TargetRules`,
`RulesPatch`, `patchRules` and `resolveRules`, which is more surface than one number
needs. `patchRules` already spreads `spawn`, so the merge needs no change.

### Files

| Path                                  |          | Responsibility                                                                                           |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `modes/types.ts`                      | modified | `glimpse: number \| null` on `SpawnRules`, with its comment                                              |
| `modes/rules.ts`                      | modified | `glimpse: null` in `BASE_TARGET_RULES.spawn`; `RunRules.spawn.glimpse`; copied through in `resolveRules` |
| `components/game/pie-countdown.tsx`   | modified | `glimpse` prop; a number-opacity shared value, hidden after the glimpse and brought back on `exit`       |
| `components/game/target-card.tsx`     | modified | `glimpse` prop, passed to the pie as what is left of it (see Data)                                       |
| `lib/target-clock.ts` (+ test)        | modified | `glimpseLeft`: what a card still has to show, counted from its target's arrival                          |
| `app/(tabs)/index.tsx`                | modified | the one `TargetCard` call site passes `rules.spawn.glimpse`                                              |
| `modes/challenges/catalog.ts`         | modified | `GLIMPSE` appended to `CHALLENGES`, never inserted                                                       |
| `modes/rules.test.ts`                 | modified | glimpse defaults to null and a patch carries it through                                                  |
| `modes/challenges/challenges.test.ts` | modified | GLIMPSE resolves to what this spec says                                                                  |
| `locales/*.po`                        | modified | label and description, with Czech                                                                        |
| `CLAUDE.md`                           | modified | the **glimpse** row                                                                                      |

Nothing created. `components/game/multiplayer-game.tsx` renders its own `PieCountdown`
and is deliberately **not** touched: an omitted prop is a number that never hides.

### Data and types

- `SpawnRules.glimpse: number | null` and `RunRules['spawn'].glimpse: number | null`.
  Partial on `RulesPatch` like every other `spawn` field already is.
- **No difficulty scaling.** The figure on the rules is the figure on screen. Unlike
  `clock.base`, `timeoutScale` is not applied.
- **The pie** gains `glimpse?: number | null` (default null). With a number:
  - The numeral starts at full opacity, holds for `glimpse` ms, then fades to 0 over a
    short fade (a constant beside `FAIL_COLOR_MS`, about 150 ms, named for what it does).
  - When `exit` becomes non-null, the numeral goes back to full opacity in the same
    short fade, and the existing hit or loss animation plays over it unchanged. Opacity is
    its **own** shared value, composed into `numberStyle`, and never a change to
    `numberColorStyle`, `numberScale` or `numberSquash`.
  - With null, the opacity is never animated and stays 1. Every existing render is
    unchanged.
- **Which clock the glimpse reads**: the target's own arrival, read back off the ring.
  `glimpseLeft(glimpse, startProgress, duration)` in `lib/target-clock.ts` gives the pie
  what is still left of it: `glimpse − (1 − startProgress) × duration`, floored at 0. A
  card drawn as its target is dealt loses the few ms between the deal and the draw. A card
  **restored from storage** long after its arrival gets 0 and mounts hidden. _(Amended in
  build: the spec first said "`startProgress < 1` → 0", but a live card's `startProgress`
  comes from `remainingFraction(t, now)` and is a hair under 1, so that rule would have hidden
  every fresh number.)_ Pausing does not unmount a card (it sets `frozen`), so a pause never
  re-flashes. The glimpse keeps running behind the pause screen, which covers the whole board
  (Out, per the shape).
- **No storage, no machine change, no schema.** No new context field, event or key. The
  machine still deals, hits and expires targets exactly as before; the glimpse is drawing
  only.
- **The catalog entry**: `slug: 'glimpse'`, `base: ACCURACY`, `rules: { fixedDifficulty:
'hard', spawn: { glimpse: 500 } }`, plus label, description and claims. No `shot`, which
  inherits `sniper`. No `scoring`, which inherits the challenge default (`optimal`, 85/15).
  No `lives`, which inherits three with `wastefulCostsLife: false` and expiry costing a life.
  No `hue`, so index 3 generates one. No `code`, which inherits `ACC`.
  `from`/`until` a short window in the past, as the skill directs.

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Copy / i18n** | `GLIMPSE`, Czech `ZÁBLESK`, each with a soft hyphen (U+00AD) where the dialog breaks it: `GLIM­PSE`, `ZÁ­BLESK`. Description `One look, then from memory.`, Czech `Jeden pohled, pak zpaměti.` Claims are raw `TitleWords` strings, not Lingui messages, like every other challenge's: board `SAW IT` · `KEPT SIGHT` · `SHARP EYE`; medal `NEAR SIGHT` · `HALF SEEN`; strong `GOOD EYE` · `HELD IT`; cold `GONE BLANK` · `LOST SIGHT`. `pnpm i18n:extract`, then `pnpm i18n:verify`. |
| **How to Play** | **None.** This touches targets, but only for one challenge, and the challenges chapter is deliberately vague about any one challenge's rules.                                                                                                                                                                                                                                                                                                                                        |
| **Flag**        | **None.** A challenge reaches a player only through a booked session.                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Buttons**     | **None.** Nothing new is pressable.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Find-in-page on web, accepted** _(raised in review, the user's call)_: a hidden numeral is
transparent, not removed, so on the web build the browser's find (Ctrl+F) highlights the hidden
card. Kept as opacity only; the run's state is readable from dev tools on web in any case.

**Accessibility, accepted:** a numeral at opacity 0 is still in the tree, so a screen
reader would still read a hidden target. That is accepted for this appetite and recorded
here so `review` doesn't rediscover it as a bug. No `accessibilityLabel` is added or
changed.

## Acceptance criteria

1. `runRules(mode, 'hard').spawn.glimpse` is `null` for `accuracy`, `speed`, `trainee`,
   and for the challenges `four-keys`, `four-by-four` and `habit`. The tutorial's rules have
   it null too.
2. `runRules(challengeId('glimpse'), 'easy')` resolves to: `difficulty: 'hard'`,
   `usesDifficulty: false`, `spawn.glimpse: 500`, `spawn.maxTargets: 3`, `clock.base: 16500`,
   `clock.ramps: 'spawn'`, `scoring.streak: 'optimal'`, `scoring.weights: { acc: 0.85, spd:
0.15 }`, `lives.count: 3`, `lives.wasteful: null`, `lives.expiryCosts: true`,
   `capabilities.board: false`.
3. The GLIMPSE definition's `shot` is `'sniper'`, its claims are the ones listed above, and
   it is the **last** entry of `CHALLENGES`. FOUR KEYS, FOUR BY FOUR and HABIT keep their
   gradients.
4. A patch `{ spawn: { glimpse: 300 } }` laid over any mode comes out of `resolveRules` with
   `spawn.glimpse: 300`, and every other `spawn` field unchanged.
5. In a GLIMPSE run, a newly dealt card shows its number, and about half a second later the
   number has faded out. The disc keeps its band tint, the ring keeps running down, and the
   dial is untouched.
6. Hitting a hidden target brings its number back as the card leaves, visible through the
   ordinary hit exit (the number swelling out of the collapsing ring).
7. Letting a hidden target expire brings its number back, white on the red disc, through
   the ordinary loss exit. A heart is lost.
8. A low-accuracy hit in a GLIMPSE run costs no heart.
9. Pausing and resuming a GLIMPSE run doesn't flash any card's number again. A run restored
   mid-clock from storage brings its cards back hidden.
10. An Accuracy run, a Speed run, the tutorial and a multiplayer game look exactly as they
    did: every number is visible for the card's whole life.
11. `pnpm check` is green, `pnpm i18n:verify` included, with `ZÁBLESK` and the Czech
    description in `locales/cs`.
12. CLAUDE.md's domain table has a **glimpse** row naming `spawn.glimpse`.
13. _(Added in verify; amended in build at the user's call.)_ The challenge dialog draws the
    name over two rows, broken where the label says: **GLIM / PSE** in English and **ZÁ / BLESK**
    in Czech, with no other letter wrapping, at 375, 390 and 430 px wide. Everywhere the name is
    drawn on one line (the intro's card, the top bar, the pause pill) it reads GLIMPSE / ZÁBLESK
    with no visible break mark.
14. _(Added in review; the user's call, overturning the shape's Out.)_ The glimpse **freezes
    with the ring**: pausing (or the app losing focus) inside a target's glimpse stops it, and
    CONTINUE shows the number for whatever was left. Pause about 100 ms after an arrival and
    the number is visible for roughly another 400 ms after CONTINUE.
15. _(Added in review; the user's call.)_ When a GLIMPSE run ends, every card still on the
    board shows its number as it shrinks away, not only the one that cost the last heart.
16. _(Added in review.)_ The glimpse counts from the card being fully in, not from its mount.
    The 180 ms entrance doesn't spend it, so the number is fully readable for about 500 ms.
17. _(Added in review.)_ The soft hyphen takes no colour step anywhere a name is drawn letter by
    letter (`GradientText`). GLIMPSE on the intro card ramps across seven letters, like any
    seven-letter name, and ZÁBLESK across seven.
18. _(Added in review.)_ A card restored with less of its glimpse left than the fade itself
    (150 ms) mounts hidden, rather than showing the number at full strength and fading it.

## Tests

- **`modes/rules.test.ts`**, extended in the drill-and-measure `describe` (or a sibling
  beside it): every shipped mode resolves `spawn.glimpse` to null (criterion 1); a patch's
  glimpse is carried through to the run and leaves the other spawn fields alone (4).
- **`modes/challenges/challenges.test.ts`**: GLIMPSE resolves to the figures in criterion 2
  whatever rung is asked for; its shot and claims (3); it is last in `CHALLENGES`. The
  catalog-wide reachability test already covers the nine dial and needs nothing new.
- **No UI test.** The fade is a reanimated timing in the pie, and criteria 5–10 are walked
  in the running app by `verify`.

## Review focus

- **The reveal racing the fade** (task 3). If the card leaves inside its first 500 ms, the
  pending hide must not land after the reveal and blank a leaving card. The `exit` effect has
  to cancel or override the pending fade, not just start a second animation on the same value.
- **Opacity composed, not replaced** (task 3). `numberStyle` carries the hit's swell and the
  loss's squash. Adding opacity there, or as a sibling style, must not drop either transform,
  and must not stop `numberColorStyle` applying when `failed`.
- **The null path untouched** (task 3). With no glimpse, nothing should be scheduled at all.
  A `withDelay` armed with an infinite or zero delay on every card of every mode is a cost and
  a hidden way to break criterion 10.
- **Restored cards** (task 4). The `startProgress < 1` rule has to live in one place, the
  card, and not be repeated at the call site. Check that a target dealt live always arrives
  with `startProgress` exactly 1, or the rule hides fresh numbers too.
- **Append, never insert** (task 5). GLIMPSE goes at the end of the `.map` list, or every
  challenge after it is recoloured. Criterion 3 checks the other three gradients.
