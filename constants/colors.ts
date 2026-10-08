import type { TargetBand } from '@/types/game'

// Brand + value-tint palettes shared across the game UI.

// The screen background. Anything that needs to hide what is behind it — the
// announcement sweep, a curtain — paints in this.
export const SURFACE = '#F3EFE9'

export const APP_BLUE = '#4C7EFF'
export const APP_RED = '#E5534B'

// The violet mid-point of the spectrum. It is the manifest `theme_color` and the
// Android adaptive-icon background, so it is the app's own hue for the rare
// element that speaks for the app rather than for a mode.
export const APP_VIOLET = '#7273D2'

// The game's full spectrum, as seen on the splash and the app icon. Also the
// span of the mode gradients: trainee blue through to speed red.
export const SPECTRUM = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B'] as const

// Gold marks the three board records. Needs dark ink — white on it is about 1.5:1.
export const GOLD_SCALE = ['#FFD166', '#FF8C00', '#FFE8A3', '#F4A261'] as const

// Gold as *text*, which GOLD_SCALE cannot be: the scale is a background palette, and
// #FFD166 on the surface is about 1.26:1 — invisible. So the mark that says a record is
// yours carries its own ink.
//
// As yellow as the parchment surface allows. Yellow is a light hue by nature, so on
// #F3EFE9 it runs out of contrast long before it runs out of brightness: this goldenrod
// is about 2.9:1, and anything more vivid stops being a mark and starts being a smudge.
export const GOLD_INK = '#B8860B'

// The `--color-dim` token as JavaScript, for the places a colour is computed instead of
// classed: an icon's `color` prop, a text input's placeholder, a worklet interpolating
// between two inks. The value is the one in global.css and must move with it — before
// this existed the same hex was copied into a dozen components.
//
// It clears 4.5:1 on the surface *and* on the card above it: about 5.1:1 and 4.6:1. That
// is as light as this ink goes — the card is the tighter of the two backgrounds, and a
// step further drops it under the bar. Secondary text is still the app's quietest voice;
// it is no longer the one nobody can read.
export const DIM_INK = '#6A655C'

// The `--color-muted` token as JavaScript, for the same reason DIM_INK is: the dot menu
// takes its colour as a prop rather than as a class. Never text — this is the hairline
// weight, well under the contrast a word needs.
export const MUTED_INK = '#D4D0C8'

// The `--color-primary` token as JavaScript, and the same bargain as the two above: a
// framed digit takes its colour as a prop, because the box around it is already computing
// one. Primary text, so it is the darkest ink the app owns — identical to `--color-strong`,
// which is the same near-black doing the other job.
export const PRIMARY_INK = '#1C1928'

// Earning an achievement: the one hue the app had left. Modes own blue through amber,
// gold marks a board record you *currently hold*, teal means multiplayer and grey means a
// record just left you. An achievement is permanent and belongs to nobody else, so it
// takes the green nothing else does — gold is held, green is kept.
//
// A background palette like GOLD_SCALE, with the same limitation: needs dark ink, since
// white on #8DE86B is about 1.4:1.
export const ACHIEVEMENT_SCALE = ['#8DE86B', '#3FBF5F', '#C6F5A6', '#1E9448'] as const

// Dark ink for text sitting *on* ACHIEVEMENT_SCALE — about 7.8:1 on its darkest stop.
export const ACHIEVEMENT_BAR_INK = '#12210F'

// The achievement green as *text*, which ACHIEVEMENT_SCALE cannot be — same reason and
// same shape as GOLD_INK. The scale is tuned to carry ink, not to be it: #3FBF5F on the
// parchment surface is about 2.3:1. So the mark that says an achievement is earned
// carries its own ink: about 5.4:1 on #F3EFE9.
export const ACHIEVEMENT_INK = '#217A3D'

// A player's nickname, which is drawn in a gradient from Accuracy's hue to Speed's with
// each end faded by that player's lifetime average in the factor — see
// lib/name-gradient.ts for the colour, and the profile modal for where it explains
// itself.
//
// Its own pair for the same reason GOLD_INK and ACHIEVEMENT_INK are their own inks: the
// mode scale is tuned to *be* a colour, not to carry text at 10px. `gradientOf('speed')[1]`
// on the card is about 2.9:1, under the 4.5:1 the app's own `text-dim` holds.
//
// So these are the two mode stops taken 23% toward black. Both hues move by the same
// amount, which is what keeps the gradient between them even — shifting one stop alone
// would put a bend in the middle of every name.
//
// Only the hues themselves are tuned, because `desaturate` fades toward a grey of equal
// relative luminance and contrast is a function of luminance alone: a name at a blank
// career has the same contrast as one at a perfect career. The worst case across both
// surfaces is about 4.53:1, and `name-gradient.test.ts` holds every saturation to it.
//
// The ordering matches `nameStops`: accuracy first, speed second.
export const NAME_INK = ['#5859a2', '#b0403a'] as const satisfies readonly [
  string,
  string,
]

// Losing a record you held: the colour drained out. Kept to mid-tones with the app's
// faint violet cast.
export const GRAYSCALE = ['#5F5C6E', '#7A7688', '#95919F', '#B0ACB8'] as const

// The map an arcade run is drawn on: three weights of one ink.
//
// Its own named palette and deliberately *not* `GRAYSCALE` — those four greys mean a record
// that was taken off you, and a map drawn in the colour of loss would be saying something it
// does not mean.
//
// Most-present to least-present, so the ramp runs dark to light on the parchment surface.
// `line` carries outlines and buildings, `hatch` the hachures and shading, `faint` the
// graticule. The knockout a mark fills itself with before it is inked is the `surface`
// token itself, so it is invisible by construction.
export const MAP_INK = { line: '#6A655C', hatch: '#8E8A80', faint: '#BDB8AC' } as const

// Arcade's amber as *text*, which `gradientOf('arcade')` cannot be — same reason and same
// shape as GOLD_INK. #FF8C00 on the parchment surface is about 2:1: a fine stroke, a fine
// fill, and an invisible label. So the one place arcade's colour has to *be* the text —
// the ARCADE label on its own screen, and the depth under it — carries its own ink, the
// amber taken down toward brown: about 5.3:1 on #F3EFE9. That is as yellow as this
// surface allows before a label stops being a colour and starts being a smudge.
export const ARCADE_INK = '#9A4F06'

// The game's whole scale, blue through to the arcade amber — every mode's colour at
// once.
export const GAME_SCALE = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B', '#FF8C00'] as const

// The countdown pie's track — the part revealed as the arc drains — tints by the
// target's hundreds band, so the band reads as area rather than as a digit you have
// to parse. The numeral sits directly on this, so these stay near the plain track's
// lightness. Band 0 keeps the untinted track, which makes "no colour" the sub-100 signal.
// The countdown numeral's ink as a value, for the one place that has to animate away
// from it: a lost target's number crossfades to white. Mirrors `--color-pie` in
// global.css — the token still paints it everywhere else, and the two are one colour.
export const PIE_INK = '#171421'

export const TARGET_BAND_TRACK = {
  0: MUTED_INK,
  1: '#CFCBEE',
  2: '#EBC7D2',
  3: '#F2DCB4',
} as const satisfies Record<TargetBand, string>

type Palette = { low: string; high: string }

// Dial buttons tint by value across an on-brand cool gradient: 0 → 8 rides the
// low → high ramp (pale lavender → periwinkle), then 9 wears the mode's dark CTA
// gradient (DARK_MODE_GRADIENT) with the digit in `peakText` — so the maximum reads
// as its own state, not one more step. The peak background lives with the modes; only
// its ink is here.
//
// Trainee's weight and max badges reuse `low` + `text` as a fixed chip rather
// than inking text straight onto the ramp: that was tried first and measured as
// low as ~1.5:1 contrast, because a translucent hint and the animated fill it
// sat on faded in and out of contrast together. `low` + `text` is the one pairing
// already proven to read well on its own — DialButton just holds it still while
// everything around it keeps animating.
type DialPalette = Palette & {
  text: string
  peakText: string
}

// A very light wash of APP_RED (#E5534B lifted to ~86% lightness): warm enough
// to read as the brand red, light enough to sit on the dark gradient at ~10:1.
const PEAK_RED = '#FFC0B8'

export const DIAL_COLORS = {
  low: '#ECEAF7',
  high: '#8296FF',
  text: '#1C1928',
  peakText: PEAK_RED,
} as const satisfies DialPalette

// The score above the dial transitions from the target numbers' background
// color (APP_BLUE, the pie fill) up to the standard text color.
export const SCORE_COLORS = { low: APP_BLUE, high: '#1C1928' } as const satisfies Palette

// The all-time record turns the whole game-over screen gold, which means every semantic
// token has to be re-bound for that subtree: GOLD_SCALE is a background palette, and the
// app's own tokens are tuned for the parchment surface — laid straight onto gold the
// quieter ones stop separating. Applied with `vars()` so the screen's existing classes
// re-ink themselves rather than every component growing a prop for one case.
//
// The scale supplies the surfaces; the inks are chosen against #FFD166: near-black for
// primary (about 12:1), a dark goldenrod for secondary (about 4.6:1 — still clearly
// softer than primary, and no longer the 3.4:1 it was, which is a line you could see was
// there and not quite read).
// The gold screen's secondary ink, for the few places a colour is computed in JS
// instead of coming from a class — those cannot see the re-bound tokens.
export const GOLD_DIM_INK = '#715919'

export const GOLD_SCREEN_TOKENS = {
  '--color-surface': GOLD_SCALE[0],
  '--color-card': GOLD_SCALE[2],
  '--color-elevated': '#FFF6DC',
  '--color-muted': '#E0A94A',
  '--color-dim': GOLD_DIM_INK,
  '--color-primary': '#1C1928',
  '--color-strong': '#1C1928',
  '--color-on-strong': '#FFE8A3',
  '--color-score': '#147A32',
  '--color-dial': '#1C1928',
  '--color-factor': GOLD_DIM_INK,
  '--color-pie': '#1C1928',
} as const

// A mode's Extreme all-time screen is painted in that mode's own colours, darkened —
// DARK_MODE_GRADIENT rather than MODE_GRADIENT. The bright pair is the same mid-tone
// the title letters and the score are drawn in, so at full strength it would swallow
// them; the darkened pair is the app's existing answer to "this colour, carrying text".
//
// Its inks are light, against a background that is dark whatever else is on screen.
export const MODE_SCREEN_TOKENS = {
  '--color-surface': 'transparent',
  '--color-card': 'rgba(255, 255, 255, 0.12)',
  '--color-elevated': 'rgba(255, 255, 255, 0.18)',
  '--color-muted': 'rgba(255, 255, 255, 0.25)',
  '--color-dim': 'rgba(255, 255, 255, 0.7)',
  '--color-primary': '#FFFFFF',
  '--color-strong': 'rgba(0, 0, 0, 0.35)',
  '--color-on-strong': '#FFFFFF',
  '--color-score': '#FFFFFF',
  '--color-dial': '#FFFFFF',
  '--color-factor': 'rgba(255, 255, 255, 0.6)',
  '--color-pie': '#FFFFFF',
} as const

// Particles for the all-time celebration once it is playing over gold. The gold scale
// itself would disappear into its own background, so this is the pale end of it plus
// white — decoration is allowed to sit lighter than text.
export const PALE_GOLD = ['#FFF6DC', '#FFFFFF', '#FFE8A3', '#FFEFC2'] as const
