---
name: design-guide
description: Use when choosing or changing a colour, gradient, font, size, spacing or component for anything the player sees in the Nine app — new UI, a celebration, a badge, a button, a dialog, a screen — or when reviewing whether a visual change fits. Owns the three colour scales, the type scale, the screen and dialog layouts, the component inventory, and the consistency sweep that runs before any shared style changes.
---

# Design guide (nine)

Nine has one visual system, and it is held in four files rather than in the screens that
use it:

| What                | Where                                              | Reference                     |
| ------------------- | -------------------------------------------------- | ----------------------------- |
| Colour              | `constants/colors.ts`, `global.css`                | this file, below              |
| Type                | `constants/typography.ts`                          | `references/typography.md`    |
| Screens and dialogs | `components/screen.tsx`, `overlays/modal-card.tsx` | `references/layout.md`        |
| What already exists | `components/`                                      | `references/components.md`    |
| Readable to anyone  | `scripts/contrast.js`                              | `references/accessibility.md` |

**Read the relevant reference before picking a value.** The scales below are the colour
half; type, layout and reuse each have a file of their own.

> **Every name is drawn in its own colour — no exceptions by omission.** Each time the
> app writes a player's **nickname**, a **mode's** name or a **challenge's** name, it is
> drawn in that thing's colour: `GradientName` for a player, `gradientOf(id)[0]` for a
> mode, and for a challenge **its gradient** — `GradientText` from
> `challengeInk(gradientOf(id)[0])` to `challengeInk(gradientOf(id)[1])`, as
> `ChallengeTitle` and the intro's card draw it. Never `text-primary`, never `text-dim`,
> and never a raw stop on a challenge — `[0]` is the near-black all of them share and
> reads as uncoloured. Check every new row, cell, title and sentence that names one of
> the three before calling the UI done. The full rule, and its two measured exceptions,
> is under **A named thing is drawn in its own colour**.

---

# The consistency sweep — do this first

A style in this app is almost never in one place. Changing one where you found it is how
the app came to have three sizes of the same primary button and two paddings for the same
CTA — each typed next to whatever was already on screen.

So: **a shared style is changed by sweeping it, not by editing the site in front of you.**

### When this applies

Any time you are about to change an existing visual value rather than add a new screen:

- a size, weight, tracking or leading
- a colour, gradient stop or ink
- a radius, padding or gap on a shape that repeats — a card, a pill, a button
- the shape or motion of a dialog, a screen or a row

It does **not** apply to a value that is genuinely local and used once — a one-off
illustration, a particle, an arcade mark. If you are unsure which it is, the sweep tells
you: a value used once comes back with one occurrence.

### The four steps

1. **Resolve the style to its owner.** Is it a role in `constants/typography.ts`, a scale
   in `constants/colors.ts`, a token in `global.css`, or a raw value typed into a screen?
   If it has an owner, the change belongs there, and the sweep is over everything that
   asks for it by name.

2. **Find every occurrence.** Grep the value _and_ the role that holds it:

   ```bash
   # a role and everything that asks for it
   grep -rn "TYPE.label" app components
   # the raw value, in case somewhere still spells it out
   grep -rn "text-\[10px\] font-bold tracking-\[1px\]" app components
   # a colour, both as token and as hex
   grep -rn "text-dim\|#6a655c" app components
   ```

3. **Report them to the user before changing anything.** List every file and line, say
   what each one is (a button label, a stat caption, a dialog heading), and say plainly
   which of them the change would alter. Then **ask whether to apply it.** A sweep that
   touches eleven screens is a decision the user makes, not one you make for them.

4. **Apply it in the owner, once.** Never by editing eleven call sites. If the eleven do
   not all want the change, that is the finding — report it, because it means the role is
   carrying two jobs and the answer is a second role, agreed first.

### What not to do

- **Don't change the value where you found it.** That is the drift, in one move.
- **Don't override one field of a role** — `cn(TYPE.label, 'text-[9px]')`. It reads as a
  role and renders as a one-off, which is worse than either.
- **Don't add a near-duplicate** because the existing one is 1px off what you want. Either
  the existing role is right, or it is wrong for everyone using it.
- **Don't skip the report because the sweep came back small.** Two occurrences is still
  two screens the user may not expect to move.

---

# Reuse before creation

**Don't create a new dialog, button, card or row if one already exists. Abstract and
extend the one that does.** `references/components.md` is the inventory, and it names the
three times this repo has already paid for the lesson.

The short form:

- A dialog is `ModalCard`. A platform `Modal` is for one problem — a keyboard under the
  card — and `CardModal` is already it.
- A screen is `Screen` / `ScreenLayer`. A screen a run stops on is `RunScreen`.
- A primary button is `PrimaryButton`. A link — CLOSE, NOT NOW, RESEND, any quiet way
  out — is `LinkButton`: icon, `TYPE.quietAction`, dim ink, no underline. Never write
  either out by hand, and never copy one from a neighbouring file: the neighbour may be
  one of the drifted originals (see `references/components.md`).
- **Before drawing any pressable, open the inventory** and look for the job. A dialog
  built by copying the nearest similar dialog inherits whatever that dialog got wrong —
  that is how an underlined NOT NOW reached a new modal after the link rule existed.
- If something is close, give it a prop, and comment which caller asked for it.
- If two things genuinely differ, name the difference in a comment on both — that comment
  is what stops a third appearing between them.

---

# Colour

Every colour comes from one of **three scales**. Before picking a hex, decide which scale
the element belongs to — that decision is the design.

## The three scales

### 1. Game scale — the app's identity

Two exports in `constants/colors.ts`, same arc:

```
SPECTRUM     #4C7EFF  #7273D2  #c36282  #E5534B
GAME_SCALE   #4C7EFF  #7273D2  #c36282  #E5534B  #FF8C00
```

`SPECTRUM` is the four playable-mode stops — the arc on the splash and the app icon.
`GAME_SCALE` carries the arcade amber too, for anything that wants the whole range at
once, such as the personal-best celebration.

**Use it** when something represents the game as a whole rather than one mode: the
splash, the icon, the four best-score numbers in the top bar, the personal-best
confetti. Stepping through it by index keeps every colour evenly represented.

### 2. Mode scale — which mode you are in

A `gradient` on each mode's own definition in `modes/definitions/`, read by
`gradientOf(id)`. One two-stop pair per mode, and from accuracy on, **each mode's end
is the next mode's start** — so accuracy, speed and arcade chain into one continuous
spectrum. Preserve that when editing: it is why moving between those modes feels like
sliding along a scale rather than jumping between themes.

**Trainee is the deliberate exception**, and the only one: two shades of a single blue
rather than a step along the spectrum. It used to end on the violet accuracy starts
from, which made practice read as half an accuracy run — the one mode wearing the
colour of the mode after it. So it keeps its end stop to itself, and the chain begins
at accuracy. `modes/rules.test.ts` holds both halves of that.

**Trainee is the exception among the permanent modes. A challenge is a different shape
again** — not a link in the chain and not two shades of one hue, but a near-black and a
hue of its own:

- The **first stop is `PRIMARY_INK`**, the same for every challenge, and is what says
  _this is a challenge_ before the hue beside it has been read. No permanent mode starts
  dark. It is also the card's **ink**: `gradientOf(id)[0]` is what colours the name and
  the mark, so a challenge needs no separate `*_INK` beside its scale the way gold and
  the achievement green both do.
- The **second stop is derived from the challenge's place in the catalog**, stepping
  through 255–330° by the golden ratio. That arc is the one wide run of hue space nothing
  else owns — the mode chain holds blue through amber, 43° is the gold of a record you
  hold, 96–136° the green of an achievement you keep, 175° the teal of multiplayer. A
  challenge never picks a colour, and `modes/challenges/palette.test.ts` holds it off
  every hue above.

A challenge may name a **hue** — `hue: TURQUOISE` on its spec — where the generated one
will not do; `four-keys` does. A hue and not a pair of hexes, so the shared near-black and
both saturations stay the palette's. Leaving the arc has a cost, and `modes/challenges/
palette.ts` records it beside each named hue: turquoise is the multiplayer family one
degree over, and its bright stop is too pale to carry a word, so the edge and the name are
two shades of it — the same bargain `GOLD_SCALE` and `GOLD_INK` strike.

| Mode     | From      | To        |
| -------- | --------- | --------- |
| trainee  | `#4C7EFF` | `#2E54B9` |
| accuracy | `#7273D2` | `#c36282` |
| speed    | `#c36282` | `#E5534B` |
| arcade   | `#E5534B` | `#FF8C00` |

**Use it** for anything that says "you are in this mode": the mode label, the NINE
title, the mode selector, a leaderboard accent. Difficulty is a _position along the
mode's own pair_ — `getDifficultyColor` lerps easy → extreme between the two stops,
so difficulty never introduces a new hue.

### 3. CTA scale — things you press

A `darkGradient` beside each mode's own `gradient`, read by `darkGradientOf(id)`. The
same four pairs darkened enough to carry light text — and chaining the same way, with
trainee the same exception.

| Mode     | From      | To        |
| -------- | --------- | --------- |
| trainee  | `#102972` | `#0B1C4C` |
| accuracy | `#27255a` | `#501b2e` |
| speed    | `#501b2e` | `#620b0c` |
| arcade   | `#620b0c` | `#7A3800` |

**Use it** for primary buttons (CONTINUE, PLAY) and for the dial's 9 key — anything
that should read as pressable and sit _under_ text. Pair with `text-on-strong`.

> **Naming trap:** `DARK_MODE_GRADIENT` is not a dark _theme_ — the app has one colour
> scheme and no switch. It is the darkened CTA scale, the answer to "this mode's colour,
> carrying text". Don't reach for `MODE_GRADIENT` for a button.

## A named thing is drawn in its own colour

Three nouns in this app carry a colour of their own, and each is drawn in it **every time
the app writes it**: a player's **nickname**, a **mode's** name, a **challenge's** name.
The ordinary text ink is the one thing none of them takes. A name in `text-primary` is
not a neutral choice — it is the name having lost the thing that identifies it.

| The name of…     | Is drawn in                                        | Through                                     |
| ---------------- | -------------------------------------------------- | ------------------------------------------- |
| a player         | the gradient their own lifetime averages earn them | `GradientName`, always                      |
| a permanent mode | its own first stop — `gradientOf(id)[0]`           | a `color` style, or `GradientText` for both |
| a challenge      | its gradient — both stops through `challengeInk`   | `GradientText`, always                      |

For a mode, one ink or the pair is a question of room: a row label or a pill takes the
single opening ink, and a card title with a word's worth of width to travel across takes
`GradientText`. A challenge has no such choice — its name is its gradient in a row label
as much as in a title, the way `ChallengeTitle` draws it on the planner and the lab.
Either way the colour comes from the thing named, never from the surface it sits on.

### A nickname

A player's nickname is drawn in the gradient their own lifetime averages earn them, which
makes one person one colour everywhere the app writes their name. **Always
`GradientName`** — see `references/components.md`, which has the rule, the two measured
exceptions, and what to do when the data you are holding has no averages on it.

`NAME_INK` is the pair it interpolates, and it is its own ink rather than two mode stops
for the reason `GOLD_INK` and `ACHIEVEMENT_INK` are: a scale tuned to _be_ a colour does
not carry text at 10px.

### A mode's name

`gradientOf(id)[0]` — the same opening stop the selector gave the option that was picked,
so the name on the medal, the row and the header all agree with the pill that started the
run. `medals-overlay.tsx` and `multiplayer-game.tsx` are the plain shape of it.

### A challenge's name

A challenge **cannot take stop `[0]` the way a mode does.** That stop is the near-black
every challenge shares, so a name drawn in it would come out in very nearly the colour
text is already drawn in — a name that looked switched off — and come out identical on
every challenge, leaving the one element that says _which_ challenge this is saying
nothing. So the name runs **to** the challenge's own stop, and both ends are lifted to a
lightness that carries a word.

The name is always drawn as the pair: `GradientText` from
`challengeInk(gradientOf(id)[0])` to `challengeInk(gradientOf(id)[1])` — in a row label
as much as in a title. The single lifted hue, `challengeInk(gradientOf(id)[1])`, is for
what is not the name: an accent, a border, a legend. `challenge-card.tsx` and
`ChallengeTitle` are the reference implementations, and the same formula appears as
`scoreInkOf` in `modes/palette.ts` and `accentFor` in `app/(tabs)/index.tsx`.
If you need it a fourth time, that is the sweep telling you it wants a home.

### The two exceptions, and they already recur

Both are the same bargain `GradientName` strikes on the multiplayer tile — the name is
not losing its colour, the surface has taken it.

- **A name on a saturated gradient keeps `text-on-strong`.** The themed ink measures
  around 1.0–1.3:1 against the mode's own fill, so it is unreadable, not subtle. The
  how-to-play header and the active mode-selector pill both sit on the mode's gradient
  and both keep white. Measure it, and say so at the call site.
- **A record taken off you drains to `GRAYSCALE`.** `medals-overlay.tsx` when `drained`,
  and `lost-medal-line.tsx` throughout. Here the colour _leaving_ is the message, which
  is the whole reason `GRAYSCALE` exists — so this is the rule holding, not bending.

### A name inside a translated sentence

A name interpolated as a bare string — `const modeName = t(labelOf(mode))`, dropped into
a translated line — cannot carry a colour, because by the time the sentence has it, it is
characters and not a component. Colouring it means making it a child instead:

```tsx
<Trans>
  <GradientText text={t(labelOf(session.modeId))} from={inkFrom} to={ink} /> challenge
  starts in
</Trans>
```

`challenge-card.tsx` does exactly this, and keeps the translator's freedom to put the name
where their own grammar wants it. **Four places still interpolate flat** —
`step-up-toast.tsx`, `tutorial-done-modal.tsx`, `game-over-overlay.tsx` and
`menu-overlay.tsx` — and each is a name losing its colour on one screen out of nine. They
are the outstanding work on this rule, not a precedent to copy.

Admin screens are out of scope: nothing there is a surface the player sees.

## Supporting palettes

These are not scales — they are single-purpose and live in `constants/colors.ts`.

| Palette             | For                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GOLD_SCALE`        | The three board records you hold. Needs dark ink — white on it is about 1.5:1.                                     |
| `ACHIEVEMENT_SCALE` | An achievement earned. Green, and green only: gold is a record you _hold_, this is one you _keep_. Needs dark ink. |
| `GRAYSCALE`         | A record taken off you: the colour drained out. Mid-tones only, so it reads on surface and card alike.             |
| `DIAL_COLORS`       | Dial key tint by value: `low` → `high` for 0–8, plus the ink for the 9 key.                                        |
| `SCORE_COLORS`      | The score above the dial, tinting from `APP_BLUE` to the text colour.                                              |

Two of these are background palettes and cannot carry text on the app's own surfaces, so
each has a separate ink beside it for the case where the colour _is_ the text: `GOLD_INK`
beside `GOLD_SCALE`, `ACHIEVEMENT_INK` beside `ACHIEVEMENT_SCALE`. Reaching into the scale
for a text colour is the mistake both exist to stop.

An announcement never picks these itself. `announcementStyle(id, mode)` in
`lib/announcement-style.ts` maps each announcement to a scale and resolves its bar
gradient, ink and particle colours together, so they cannot drift apart:

| Announcement                      | Bar         | Particles   |
| --------------------------------- | ----------- | ----------- |
| Your personal best                | game scale  | game scale  |
| Your day / week / all-time record | gold        | gold        |
| An achievement earned             | achievement | achievement |
| A rival raised a record           | CTA scale   | — no effect |
| A rival took yours                | greyscale   | greyscale   |

The bar takes only the two darkest greys, not the whole ramp — the pale end would drop
white text to about 1.9:1 — while the implosion falls in all four.

## Theme tokens

Semantic tokens are defined in `global.css` as a single `@theme` block — the app has one
colour scheme, and `userInterfaceStyle: "light"` in `app.json` pins the platform to it.
**Prefer a token over a hex** in `className`: `bg-card`, `text-dim`, `border-muted`,
`text-on-strong`.

| Token                     | Role                                                  |
| ------------------------- | ----------------------------------------------------- |
| `surface`                 | screen background                                     |
| `card`                    | raised cards, pills, toggle track                     |
| `strong` / `on-strong`    | primary button background / its text                  |
| `elevated`                | empty hearts, toggle knob                             |
| `muted`                   | hairlines, faint labels, pie track                    |
| `dim`                     | secondary text                                        |
| `primary`                 | primary text                                          |
| `score`                   | the digital score readout                             |
| `dial` / `factor` / `pie` | dial numerals / dial weight hint / countdown numerals |

Reach for a raw hex only when the value is computed at runtime (an interpolated
colour, a gradient stop, a particle) — those go in the `style` prop, since
`className` cannot express them. Two tokens are mirrored in `constants/colors.ts` for
exactly that case and must move with their definitions: `DIM_INK` is `--color-dim`,
`MUTED_INK` is `--color-muted`. Copying either hex into a component is the mistake they
exist to stop.

## Contrast

**Measure it — don't look at it.** `node scripts/contrast.js` prints every ink in the app
against every ground it is drawn on, and `node scripts/contrast.js '#4e4a43' '#f3efe9'`
answers for one pair. Run it whenever you add or move a colour that sits under text, and
put the ratio in the comment above the value the way every ink in `constants/colors.ts`
already does. **`references/accessibility.md` is the pass in full** — the bars, the four
things contrast does not catch, and what the table currently admits to.

Check text against **both ends** of a gradient before shipping it, and don't assume
white works:

- White on the CTA scale: fine, that is what it is for.
- White on gold (`#FFD166`) is about **1.5:1** — unreadable. Gold takes dark ink.
- Same for the achievement green: white on `#8DE86B` is about **1.4:1**. Both bright
  palettes carry near-black, and both hand their text case to a separate `*_INK` pair.
- Decorative marks (icons, particles, hairlines) can go lighter than text, but a
  streak or icon that carries meaning still needs to be visible on **both**
  surfaces — `#f3efe9` and `#0b0c14`. Mid-tone colours read on both; white and
  near-black each vanish on one.

That last rule is why celebrations use the game scale rather than white sparks.

# Typography

The scale is `constants/typography.ts` and the guide is **`references/typography.md`**.
In short: a text style is a role — `TYPE.button`, `TYPE.label`, `TYPE.prose` — and no
screen picks a size, a weight or a tracking of its own. ESLint reports raw `text-[Npx]`
and `tracking-[Npx]` under `app/` and `components/`.

Wide letter-spacing on upper-case labels is the app's voice; on prose it reads as airy,
which is why `prose` has no tracking and the announcement bar drops to 0.3px.

# Layout

Screens and dialogs are **`references/layout.md`**. In short: a screen is `Screen` /
`ScreenLayer`, a dialog is `ModalCard`, a run's last screen is `RunScreen`, and none of
them lays out its own padding, stacking or entrance.

# Motion

Covered by the `code-guide` skill for the mechanics (Reanimated, module-level
components). Design-wise:

- **Nothing appears or disappears without animating.** This app has no hard cuts: a view
  that pops into existence, or vanishes between two frames, reads as a bug rather than as a
  change. Whenever you write a conditional render, decide its entrance and its exit in the
  same breath — `entering` / `exiting` on an `Animated.View` (`FadeIn`, `FadeInDown`,
  `FadeOut`, `SlideInUp`) is how the rest of the app does it, and the exit needs the view
  being unmounted to be the animated one, not a wrapper around it. The same goes for
  anything changing **in place**: a colour, a number, a size, a position all move through
  `withTiming` or `withSpring` rather than being assigned. If something genuinely must not
  animate, that is a decision worth a comment saying why.
- Entrances drop in and fade up together; hairlines fade **in place** — a 1px rule
  sliding reads as a glitch where numbers sliding reads as motion.
- Celebrations spread their element starts across the whole effect so they build
  rather than arrive as one batch.
- `Easing.out` for anything entering, `Easing.in` for anything leaving.
