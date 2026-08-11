---
name: design-guide
description: Use when choosing a colour, gradient, font or size for anything the player sees in the Nine app — new UI, a celebration, a badge, a button — or when reviewing whether a visual change fits. Owns the three colour scales, the theme tokens, typography and the contrast rules.
---

# Design guide (nine)

Every colour in the app comes from one of **three scales**. Before picking a hex,
decide which scale the element belongs to — that decision is the design.

## The three scales

### 1. Game scale — the app's identity

`SPECTRUM` in `constants/colors.ts`. Blue → purple → pink → red, the arc seen on
the splash and the app icon.

```
#4C7EFF  #7273D2  #c36282  #E5534B
```

`FULL_SPECTRUM` (module-private) extends it with the arcade amber `#FF8C00` for
the rare case that wants the whole arc at once.

**Use it** when something represents the game as a whole rather than one mode: the
splash, the icon, the four best-score numbers in the top bar, the personal-best
confetti. Stepping through it by index keeps every colour evenly represented.

### 2. Mode scale — which mode you are in

`MODE_GRADIENT` in `machines/modes.ts`. One two-stop gradient per mode, and **each
mode's end is the next mode's start**, so the four gradients chain into one
continuous spectrum. Preserve that when editing — it is why mode changes feel like
sliding along a scale rather than jumping between themes.

| Mode     | From      | To        |
| -------- | --------- | --------- |
| trainee  | `#4C7EFF` | `#7273D2` |
| accuracy | `#7273D2` | `#c36282` |
| speed    | `#c36282` | `#E5534B` |
| arcade   | `#E5534B` | `#FF8C00` |

**Use it** for anything that says "you are in this mode": the mode label, the NINE
title, the mode selector, a leaderboard accent. Difficulty is a _position along the
mode's own pair_ — `getDifficultyColor` lerps easy → extreme between the two stops,
so difficulty never introduces a new hue.

### 3. CTA scale — things you press

`DARK_MODE_GRADIENT` in `machines/modes.ts`. The same four hues darkened enough to
carry light text.

| Mode     | From      | To        |
| -------- | --------- | --------- |
| trainee  | `#102972` | `#27255a` |
| accuracy | `#27255a` | `#501b2e` |
| speed    | `#501b2e` | `#620b0c` |
| arcade   | `#620b0c` | `#7A3800` |

**Use it** for primary buttons (CONTINUE, PLAY) and for the dial's 9 key — anything
that should read as pressable and sit _under_ text. Pair with `text-on-strong`.

> **Naming trap:** `DARK_MODE_GRADIENT` has nothing to do with the dark _theme_. It
> is the darkened CTA scale and applies in both themes. Don't reach for it because a
> screen is in dark mode, and don't reach for `MODE_GRADIENT` for a button.

## Supporting palettes

These are not scales — they are single-purpose and live in `constants/colors.ts`.

| Palette                                      | For                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANNOUNCEMENT_COLORS` / `_GRADIENT` / `_INK` | Record celebrations. Game scale for a personal best, gold for the three board records. One map so particles, bar and ink cannot drift apart. |
| `DIAL_COLORS`                                | Dial key tint by value: `low` → `high` for 0–8, plus the ink for the 9 key.                                                                  |
| `SCORE_COLORS`                               | The score above the dial, tinting from `APP_BLUE` to the text colour.                                                                        |

## Theme tokens

Semantic tokens are defined in `global.css` — a `@theme` block for light, a
`.dark:root` block overriding it for dark. **Prefer a token over a hex** in
`className`: `bg-card`, `text-dim`, `border-muted`, `text-on-strong`.

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
`className` cannot express them.

The active scheme comes from `useTheme()` (`hooks/use-theme.tsx`), which starts in
light deliberately — reading the OS preference caused an inconsistent first paint
between static render and hydration.

## Contrast

Check text against **both ends** of a gradient before shipping it, and don't assume
white works:

- White on the CTA scale: fine, that is what it is for.
- White on gold (`#FFD166`) is about **1.5:1** — unreadable. Gold takes dark ink.
- Decorative marks (icons, particles, hairlines) can go lighter than text, but a
  streak or icon that carries meaning still needs to be visible on **both**
  surfaces — `#f3efe9` and `#0b0c14`. Mid-tone colours read on both; white and
  near-black each vanish on one.

That last rule is why celebrations use the game scale rather than white sparks.

## Typography

Everything numeric or label-like is monospace. `mono` from `constants/theme.ts`
resolves per platform; in `className` it is `font-mono`.

| Use                                   | Pattern                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Digital readouts (score, best scores) | `DSEG7` from `assets/fonts/DSEG7Classic-Bold.ttf`, loaded with `useFonts`, with `mono` as the fallback while it loads |
| Section headers, buttons              | `font-mono font-black` with wide `tracking-[2px]`–`tracking-[3px]`                                                    |
| Small labels                          | 8–10px, `font-bold`, `tracking-[1px]`, `text-dim`                                                                     |
| Body copy                             | 11–13px, normal weight                                                                                                |

Wide letter-spacing on upper-case labels is the app's voice — an unspaced
upper-case label looks wrong here even when the size is right.

## Motion

Covered by the `code-guide` skill for the mechanics (Reanimated, module-level
components). Design-wise:

- Entrances drop in and fade up together; hairlines fade **in place** — a 1px rule
  sliding reads as a glitch where numbers sliding reads as motion.
- Celebrations spread their element starts across the whole effect so they build
  rather than arrive as one batch.
- `Easing.out` for anything entering, `Easing.in` for anything leaving.
