# Typography

One scale, in `constants/typography.ts`. A text style is a **role** — what the text is
for — and the numbers under it are that file's business and nobody else's.

```tsx
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

<Text className={TYPE.button}>PLAY GAME</Text>
<Text className={cn(TYPE.label, 'text-dim')}>BEST</Text>
```

**Colour is not part of a role.** A role carries size, weight, tracking and leading; the
ink comes from a theme token beside it. The same role is dim on one screen and on-strong
on the next, and folding the colour in would force a role per ink.

## Why it exists

The app had grown **139 distinct text styles across 112 files**. The drift was legible:
the label on a primary button was 13px in most places, 12px on the feedback and install
dialogs, and 11px on the three cards that ask for a nickname, an address and a motto.
Nothing chose those three sizes — each was typed next to whatever was already on screen,
and the button stopped being one thing.

## The roles

### The mono voice — `TYPE`

Ordered by altitude. The further down, the quieter.

| Role           | Size / weight / tracking | What it is                                                          |
| -------------- | ------------------------ | ------------------------------------------------------------------- |
| `screenTitle`  | 20 black 3px             | The heading at the top of a full screen. One per screen.            |
| `cardTitle`    | 17 black 2px             | The headline of a popup card — news, recap, winnings, install.      |
| `heading`      | 11 black 2px             | A heading inside a card: a dialog's header, a block heading in it.  |
| `sectionLabel` | 9 black 2px              | The label over a card of figures. `CardSection` draws it.           |
| `button`       | 13 black 2px             | The label on a primary button. Always with `text-on-strong`.        |
| `buttonSm`     | 11 black 1.5px           | A pressable that is not the screen's main ask: a tab, a mode cell.  |
| `quietAction`  | 10 bold 1.8px            | The quiet way out under the primary button — RESEND, LEAVE.         |
| `label`        | 10 bold 1px              | The ordinary small caps label: what names a figure, a row, a field. |
| `labelSm`      | 9 bold 1px               | The same label somewhere tight — a badge, a dense row.              |
| `rowLabel`     | 9 black 1px              | The label on a row that is one of many: a medal, a board, a toggle. |
| `caption`      | 8 bold 1px               | The smallest caps in the app. Only `kicker` goes under it.          |
| `kicker`       | 6 bold 0.3px, lower case | The qualifier over a label: "total" over RUNS, "avg" over ACC.      |
| `figure`       | 11 bold, no tracking     | The number a row exists to show. No tracking — digits are one word. |
| `value`        | 10 bold 0.5px            | A name or figure in a dense row. Carries words as often as numbers. |
| `hint`         | 9 bold 0.5px             | What a field says about itself: its hint, its error, its count.     |
| `prose`        | 12 medium / 19px lead    | Running text. Leading is part of the role.                          |
| `proseSm`      | 11 normal / 18px lead    | Prose where the card is tight — the curtain, a crash.               |

### The digital readout — `READOUT`

DSEG7, applied through `style={{ fontFamily: 'DSEG7' }}` because it is a bundled face
rather than a token. Its own scale: these are seven-segment digits standing in for a
scoreboard, and they size by what they are counting rather than by the text around them.

`score` (28) · `scoreLarge` (38) · `best` (17) · `row` (10, a score in a leaderboard row)

### Emoji at size — `GLYPH`

Not text and not in `TYPE`: an emoji has no weight and no tracking to set. What it has is a
size, and the sizes are not interchangeable — a medal needs more room than the numeral it
replaces, and the potato and the pig fill their box where a medal leaves a margin.

A ramp, **size only**: `3xs` (7) · `2xs` (9) · `xs` (10) · `sm` (11) · `md` (12) ·
`lg` (13) · `xl` (18) · `2xl` (20) · `3xl` (28) · `4xl` (44)

No leading, deliberately. A glyph's line height belongs to the row it sits in rather than
to the glyph: the same medal is on a tight profile row and a roomy dialog line, and a
leading baked into the ramp would fight whichever of the two it was not measured on.
Callers that need one pass it — `cn(GLYPH.sm, 'leading-[13px]')`.

## Rules

- **A `TextInput` takes no role, and must not be given a size.** Five fields in the app
  carry a family, a weight and a tracking but deliberately _no_ `text-[Npx]`: Mobile Safari
  zooms the whole page in on focus for any input under 16px, and it is the one web quirk
  with no CSS opt-out — only a bigger font. Leaving the size off lets the platform's own
  default apply, which clears the bar. Snapping such a field onto a role pins it at 11px
  and brings the zoom back. The fields are in the nickname, address and motto cards and the
  two admin search rows, and each says so in a comment at the line.
- **Tracking is a caps device.** Wide letter-spacing on an upper-case label is the app's
  voice; an unspaced upper-case label looks wrong here even when the size is right. On a
  sentence it reads as airy, which is why `prose` has no tracking at all.
- **No raw sizes.** ESLint reports `text-[Npx]` and `tracking-[Npx]` under `app/` and
  `components/`. If no role fits, the answer is a new role in `constants/typography.ts`,
  **agreed first** — not a fourth button size typed into a screen.
- **Overriding one field of a role** — `cn(TYPE.label, 'tracking-[2px]')` — is the thing
  this file exists to stop. It reads as a role but renders as a one-off. Either the role
  is wrong for the job, or the job wants a role of its own.

## The deliberate exceptions

Each is a one-off on purpose, and carries a comment saying which:

| Where                                                        | What                  | Why                                                       |
| ------------------------------------------------------------ | --------------------- | --------------------------------------------------------- |
| `game/announcement-bar.tsx`                                  | 9px, 0.3px tracking   | Sentence case, so the rival's nickname is the only shout. |
| `overlays/multiplayer-waiting.tsx`                           | 48px, 8px tracking    | The room code, read aloud off a screen across the room.   |
| `game/run-top-bar.tsx`                                       | 24px, 8px tracking    | The same code, in the bar.                                |
| `game/way-bud.tsx`, `village-arrival.tsx`, `arcade-dawn.tsx` | serif, `mapLabel`     | Arcade's map is lettering on a sheet, not a readout.      |
| `overlays/arcade-teaser.tsx`, `prose-sentence.tsx`           | 13px, serif           | A serif sets smaller than a mono at the same size.        |
| `markdown-block.tsx`                                         | size by heading level | Depth is data; the size is computed from it.              |

## Still to do

**18 sites** still carry a raw size, held back on purpose: each would change a size rather
than a tracking, and a size change wants an eye on the running app first.

- **2px:** `winnings-card:65`, `how-to-play:458` (22→20, `screenTitle`); `player-tile:169`,
  `how-to-play:131`, `tutorial-curtain:127` (15→17, `cardTitle`)
- **1px:** six admin and guide headings (16→17, 18→17); four 7→6 (`kicker`);
  `feedback-overlay:113` (16→17); `player-tile:205` (14→13)

Worth checking before snapping the 16px group — `admin-role:104`, `admin-person:177`,
`how-to-play:299`, `tutorial-stepper:68` are `font-black` with no tracking, which is
glyph-shaped. If they are chevrons or step numerals they belong in `GLYPH`.

The ESLint rules stay at `warn` until those land and the exception list below is the only
thing left; then they become `error`.
