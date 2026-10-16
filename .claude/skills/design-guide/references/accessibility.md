# Accessibility

One rule, and it is the one this app keeps breaking: **a colour that carries meaning has
to be measured against the thing behind it, before it ships.** Everything below is in
service of that.

```bash
node scripts/contrast.js                      # every ink against every ground
node scripts/contrast.js '#4e4a43' '#f3efe9'  # one pair
```

## When to run it

Any change that puts a colour under text, or text on a colour:

- a new ink, token or gradient stop
- an existing one moved, however slightly
- text placed on a surface it has not been on before — a label on a card, a figure on a
  filled chip, a name on a gradient
- a scale reused as text, which is the mistake `GOLD_INK` and `ACHIEVEMENT_INK` exist to
  stop

A decorative mark — a particle, a hairline, a hachure — is exempt from the text bar, but
not from being visible: it still has to read on **both** `#f3efe9` and `#0b0c14`.

## The bars

| What                                                    | Ratio     |
| ------------------------------------------------------- | --------- |
| Ordinary text                                           | **4.5:1** |
| Large text — 18.5px+, or 14px bold                      | 3:1       |
| The part of an icon or control that carries the meaning | 3:1       |
| AAA, worth reaching on long prose and on dense screens  | 7:1       |

**This app holds 4.5:1 for every size, including the 9 and 10px labels.** A smaller size
is harder to read, not easier, so the one place the standard relaxes is the place this
app does not.

## Contrast is not the whole of it

Four more, in the order they come up here:

1. **Never say it with hue alone.** A difficulty, a mode, a band, a direction — if the
   colour is the only carrier, somebody is not getting it. The arrow beside a stats figure
   (`▲ ▼ ·`) is the pattern: the glyph says the direction and the colour is decoration.
   The target bands are the exception that proves it — they tint a number that is also
   printed in full.
2. **A screen of one weight has no hierarchy.** This is a readability problem that a
   contrast number will not catch: when every line on a screen is secondary ink, nothing
   is secondary _to_ anything. Figures take `text-primary`, the words about them take
   `text-dim`. The admin tables carry a `figure` tone for exactly this.
3. **Say it in text, not only in a mark.** Anything drawn rather than written — a chip, a
   dot, a bar — needs `aria-hidden` on the decoration and the meaning available as words
   nearby, or an accessible label of its own. `DialMark` is the worked example: it is
   `aria-hidden` and the challenge's name sits beside it.
4. **A touch target is 44pt.** Smaller paint is fine — `hitSlop` is how `PrimaryButton`
   and the dev screen's RUN already do it — but the target is not.

## What the table currently says

`node scripts/contrast.js` prints every ink against every ground it is drawn on. Two
things in it are worth knowing before you read it as a pass:

- **`score` on `card` is 4.29:1.** The digital score readout, below the bar on the one
  ground it shares with a card. Known, unfixed, and the first thing to look at when the
  score moves anywhere new.
- **The hexes in the script are a copy** of `constants/colors.ts` and `global.css`.
  A check that needed a bundler to run is a check nobody runs, so this is the trade: when
  a token moves, move it here too. The table is a list of claims to re-check, not the
  source of truth.

## Writing a contrast claim down

Every ink in `constants/colors.ts` carries its ratios in the comment above it, as this one
does:

```ts
// About 7.7:1 on the surface and 7.0:1 on the card above it — AAA on the first and a
// hair under it on the second, where the bar for ordinary text is 4.5:1.
export const DIM_INK = '#4E4A43'
```

Keep that habit. A number in the comment is what lets the next person tell a value that
was measured from a value that was typed next to whatever was already on screen — and it
is what makes a later move auditable rather than a matter of taste.
