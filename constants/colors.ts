import type { TargetBand } from '@/types/game'

// Brand + value-tint palettes shared across the game UI.

// The screen background per theme. Anything that needs to hide what is behind it —
// the announcement sweep, the theme cross-fade — paints in these.
export const SURFACE = { light: '#F3EFE9', dark: '#0B0C14' } as const

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
// #FFD166 on the light surface is about 1.26:1 — invisible. So the mark that says a
// record is yours carries its own pair.
//
// The light stop is as yellow as the parchment surface allows. Yellow is a light hue by
// nature, so on #F3EFE9 it runs out of contrast long before it runs out of brightness:
// this goldenrod is about 2.9:1, and anything more vivid stops being a mark and starts
// being a smudge. Dark has no such problem and takes the vivid one.
export const GOLD_INK = { light: '#B8860B', dark: '#FFD24A' } as const

// Losing a record you held: the colour drained out. Kept to mid-tones with the app's
// faint violet cast — a true black-to-white ramp would put half its steps on the wrong
// side of one surface or the other, where these read on both.
export const GRAYSCALE = ['#5F5C6E', '#7A7688', '#95919F', '#B0ACB8'] as const

// The game's whole scale, blue through to the arcade amber — every mode's colour at
// once. All five are mid-tone, so unlike white they read on both themes.
export const GAME_SCALE = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B', '#FF8C00'] as const

// The countdown pie's track — the part revealed as the arc drains — tints by the
// target's hundreds band, so the band reads as area rather than as a digit you have
// to parse. The numeral sits directly on this, so these stay near the plain track's
// lightness: light theme carries the near-black `pie` ink, dark theme white. Band 0
// keeps the untinted track, which makes "no colour" the sub-100 signal.
export const TARGET_BAND_TRACK = {
  light: { 0: '#D4D0C8', 1: '#CFCBEE', 2: '#EBC7D2', 3: '#F2DCB4' },
  dark: { 0: '#2A2B44', 1: '#2E2A55', 2: '#4A2434', 3: '#4A3213' },
} as const satisfies Record<'light' | 'dark', Record<TargetBand, string>>

type Palette = { low: string; high: string }

// Dial buttons tint by value across an on-brand cool gradient: 0 → 8 rides the
// low → high ramp (light: pale lavender → periwinkle; dark: deep navy → app
// blue), then 9 wears the mode's dark CTA gradient (DARK_MODE_GRADIENT) with
// the digit in `peakText` — so the maximum reads as its own state, not one more
// step. The peak background lives with the modes; only its ink is here.
type DialPalette = Palette & {
  text: string
  peakText: string
  label: string
  peakLabel: string
}

// A very light wash of APP_RED (#E5534B lifted to ~86% lightness): warm enough
// to read as the brand red, light enough to sit on the dark gradient at ~10:1.
const PEAK_RED = '#FFC0B8'

export const DIAL_COLORS = {
  light: {
    low: '#ECEAF7',
    high: '#8296FF',
    text: '#1C1928',
    peakText: PEAK_RED,
    label: 'rgba(28,25,40,0.4)',
    peakLabel: 'rgba(255,192,184,0.55)',
  },
  dark: {
    low: '#1E2036',
    high: '#4C7EFF',
    text: '#C8C2E8',
    peakText: PEAK_RED,
    label: 'rgba(200,194,232,0.5)',
    peakLabel: 'rgba(255,192,184,0.55)',
  },
} as const satisfies Record<'light' | 'dark', DialPalette>

// The score above the dial transitions from the target numbers' background
// color (APP_BLUE, the pie fill) up to the standard text color.
export const SCORE_COLORS = {
  light: { low: APP_BLUE, high: '#1C1928' },
  dark: { low: APP_BLUE, high: '#D8D2F4' },
} as const satisfies Record<'light' | 'dark', Palette>

// The all-time record turns the whole game-over screen gold, which means every semantic
// token has to be re-bound for that subtree: GOLD_SCALE is a background palette, and in
// dark mode the app's inks are light-on-dark — laid straight onto gold they would be
// unreadable. Applied with `vars()` so the screen's existing classes re-ink themselves
// rather than every component growing a prop for one case.
//
// The scale supplies the surfaces; the inks are chosen against #FFD166: near-black for
// primary (about 10:1), a dark goldenrod for secondary (about 3.3:1, softer than primary
// without dropping out), and the light theme's darker green for the score, because the
// dark theme's brighter one falls to about 2:1 on gold.
// The gold screen's secondary ink, for the few places a colour is computed in JS
// instead of coming from a class — those cannot see the re-bound tokens.
export const GOLD_DIM_INK = '#8A6D1F'

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
  '--color-factor': '#8A6D1F',
  '--color-pie': '#1C1928',
} as const

// A mode's Extreme all-time screen is painted in that mode's own colours, darkened —
// DARK_MODE_GRADIENT rather than MODE_GRADIENT. The bright pair is the same mid-tone
// the title letters and the score are drawn in, so at full strength it would swallow
// them; the darkened pair is the app's existing answer to "this colour, carrying text".
//
// Its inks are light, and fixed rather than themed: the background is the same darkness
// whichever way the player has the app set.
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
