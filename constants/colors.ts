// Brand + value-tint palettes shared across the game UI.

export const APP_BLUE = '#4C7EFF'
export const APP_RED = '#E5534B'

// The game's full spectrum, as seen on the splash and the app icon. Also the
// span of the mode gradients: trainee blue through to speed red.
export const SPECTRUM = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B'] as const

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
