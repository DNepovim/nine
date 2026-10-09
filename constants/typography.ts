// Every size, weight and tracking the player reads, as one scale.
//
// This exists because the app had grown 139 distinct text styles across 112 files, and
// the drift had become legible: the label on a primary button was 13px in most places,
// 12px on the feedback and install dialogs, and 11px on the three cards that ask for a
// nickname, an address and a motto. Nothing chose those three sizes — each was typed next
// to whatever was already on screen, and the button stopped being one thing.
//
// So a text style is a **role** now, not a triplet. A role says what the text is for; the
// numbers under it are this file's business and nowhere else's. Two things follow from
// that, and both are the point:
//
//   - Changing how a role looks changes it everywhere at once, which is what makes the
//     app read as one document rather than as the order its screens were written in.
//   - A style that fits no role is a question, not a licence to type a fourth button
//     size. See the `design-guide` skill: the answer is a new role here, agreed first.
//
// **Colour is not in here.** A role carries size, weight, tracking and leading; the ink
// comes from a theme token beside it — `cn(TYPE.button, 'text-on-strong')`. That split is
// deliberate: the same role is dim on one screen and on-strong on the next, and folding
// the colour in would have forced a role per ink.

// The mono voice — everything the player reads that is not a readout or a glyph.
//
// Ordered by altitude rather than alphabetically: the further down, the quieter.
export const TYPE = {
  // The heading at the top of a full screen — options, the archive, the admin screens,
  // the crash page. One per screen, and the biggest thing on it.
  screenTitle: 'font-mono text-[20px] font-black tracking-[3px]',

  // The headline of a popup card — the launch dialogs, a news release, the recap, the
  // winnings. Between a screen title and a heading because a popup card is the whole of
  // what is on screen when it is up, but it is still a card rather than a screen.
  cardTitle: 'font-mono text-[17px] font-black tracking-[2px]',

  // A heading inside a card: a dialog's own header (drawn by `ModalCard`), and the block
  // headings in its content. Much smaller than a screen title on purpose — a dialog is
  // already framed by its card and its scrim, so the heading does not also have to
  // announce itself.
  heading: 'font-mono text-[11px] font-black tracking-[2px]',

  // One named block inside a dialog or a screen — the label over a card of figures.
  // `CardSection` draws it; reach for it directly only when there is no card under it.
  sectionLabel: 'font-mono text-[9px] font-black tracking-[2px]',

  // The label on a primary button: the thing on `bg-strong` that the screen is asking
  // you to press. Always paired with `text-on-strong`.
  //
  // This is the role the three sizes collapsed into. If a button's label is too long for
  // its card at this size, the fix is the copy or the card, not a fourth size.
  button: 'font-mono text-[13px] font-black tracking-[2px]',

  // A pressable that is not the screen's main ask: a tab, a mode or difficulty cell, a
  // row that opens something. Reads as pressable without competing with the CTA.
  buttonSm: 'font-mono text-[11px] font-black tracking-[1.5px]',

  // The quiet way out, under the primary button — RESEND, LEAVE, the underlined dim one.
  // Deliberately the lightest thing that is still a button: it has to be findable without
  // being offered.
  quietAction: 'font-mono text-[10px] font-bold tracking-[1.8px]',

  // The ordinary small caps label: what names a figure, a row, a field.
  label: 'font-mono text-[10px] font-bold tracking-[1px]',

  // The same label where it has to sit inside something tight — a badge, a dense row.
  labelSm: 'font-mono text-[9px] font-bold tracking-[1px]',

  // The label on a row that is one of many: a medal row, an achievement's progress, a
  // board in a comparison. Black at a size `labelSm` carries bold, because a column of
  // these is scanned down rather than read across, and the weight is what lets the eye
  // find the start of each row without a rule between them.
  rowLabel: 'font-mono text-[9px] font-black tracking-[1px]',

  // The smallest caps in the app: the caption under a stat, the note under a tile. Only
  // `kicker` goes under it, and only because it is not caps — see the note there.
  caption: 'font-mono text-[8px] font-bold tracking-[1px]',

  // The qualifier over a label rather than a label itself: "total" over RUNS, "avg" over
  // ACC on a profile's lifetime row. It says what kind of figure the cell holds, and the
  // eye is meant to land on the label and pick this up on the way past.
  //
  // The one role under `caption`, which is as small as the house's caps go. It gets away
  // with it by not being caps: a lower-case word has no cap height to be read by, so at
  // this size it is read as the shape of a word already known rather than letter by
  // letter — which is all a qualifier has to be. The case is part of the role, so the
  // caller passes the word upper case like every other label and this lowers it, keeping
  // one catalog entry per word.
  //
  // Tracking drops with the case, to the announcement bar's 0.3px: wide letter-spacing is
  // a caps device, and at 1px a lower-case word reads as airy rather than quiet.
  kicker: 'font-mono text-[6px] font-bold lowercase tracking-[0.3px]',

  // The figure a row exists to show: the right-hand number in a comparison, a board's
  // score. No tracking at all — a number is read as one quantity, and space between its
  // digits is what makes a reader count them instead.
  figure: 'font-mono text-[11px] font-bold',

  // The figure a card *is about* rather than one inside a row: the reward the winnings
  // page is offering. Headline-sized, because it is the thing the page is for, and black
  // because at this size bold reads as light.
  //
  // Not `cardTitle`, which is the role a card's *words* take. A heading carries 2px of
  // tracking and a number must carry none, for the reason `figure` above gives — so the
  // two could never have been one role however close their sizes came.
  //
  // There is a family of raw large-mono values in the app this role does not yet own: a
  // profile score's suffix, the admin headers, the top bar's clock. Sweeping those onto
  // roles is its own job — see the design-guide skill's sweep — and this is deliberately
  // not that change.
  figureLarge: 'font-mono text-[22px] font-black',

  // A figure or a name *in* a row rather than the label naming it, where the row is dense
  // enough that `figure` would crowd it. Narrow tracking rather than none, because this
  // one carries words as often as numbers — a nickname with 1px between its letters stops
  // looking like a word.
  value: 'font-mono text-[10px] font-bold tracking-[0.5px]',

  // What a field says about itself: the hint under it, the error over it, the character
  // count beside it. Takes its colour from the case — dim normally, red on a refusal.
  hint: 'font-mono text-[9px] font-bold tracking-[0.5px]',

  // Running text: a paragraph in a dialog, a guide step, an announcement body. Leading is
  // part of the role here — prose is the one place in the app with more than one line of
  // the same thing, so the gap between those lines is as much the style as the size is.
  //
  // Tracking is absent rather than set to zero, and that is the house rule from the
  // `design-guide` skill: wide letter-spacing is a caps device. On a sentence it reads as
  // airy, which is why the announcement bar drops to 0.3px and prose drops it entirely.
  prose: 'font-mono text-[12px] font-medium leading-[19px]',

  // Prose where the card is tight — the curtain, a crash, a long helper paragraph.
  proseSm: 'font-mono text-[11px] leading-[18px]',
} as const

// The digital readout — DSEG7, loaded in `app/_layout.tsx` and applied through the
// `style` prop rather than a class, since it is a bundled face rather than a token.
//
// Its own scale because it is not the mono voice: these are seven-segment digits standing
// in for a scoreboard, and they size by what they are counting rather than by the altitude
// of the text around them. Pair each with `fontFamily: DSEG7`.
export const READOUT = {
  // The live score over the dial, and the one on the game-over card.
  score: 'text-[28px] tracking-[2px]',
  // The same number where it is the whole subject of its card — a profile's total.
  scoreLarge: 'text-[38px] tracking-[2px]',
  // The four best scores in the top bar, which have to fit a row of four.
  best: 'text-[17px] tracking-[1px]',
  // A score in a leaderboard row, where the digits are a column to be compared down
  // rather than a number to be read once.
  row: 'text-[10px] tracking-[1px]',
} as const

// Emoji drawn at size — a medal, a rank mark, an achievement's tick, the sign-off on the
// tutorial.
//
// Not text and not in `TYPE`: an emoji has no weight and no tracking to set, and giving it
// a mono family does nothing. What it has instead is a size, and the sizes are not
// interchangeable — a medal needs more room than the numeral it replaces, and the potato
// and the pig fill their box where a medal leaves a margin, so they take a notch less to
// weigh the same.
//
// **Size only, no leading.** A glyph's line height belongs to the row it sits in rather
// than to the glyph: the same medal is on a tight profile row and a roomy dialog line, and
// a leading baked in here would fight whichever of the two it was not measured on. Callers
// that need one pass it — `cn(GLYPH.sm, 'leading-[13px]')`.
export const GLYPH = {
  '3xs': 'text-[7px]',
  '2xs': 'text-[9px]',
  xs: 'text-[10px]',
  sm: 'text-[11px]',
  md: 'text-[12px]',
  lg: 'text-[13px]',
  xl: 'text-[18px]',
  '2xl': 'text-[20px]',
  '3xl': 'text-[28px]',
  '4xl': 'text-[44px]',
} as const
