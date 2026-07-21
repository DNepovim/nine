// Brand + value-tint palettes shared across the game UI.

export const APP_BLUE = '#4C7EFF'
export const APP_RED = '#E5534B'

// Five-stop blue→red spectrum sampled from the countdown pie (APP_BLUE → APP_RED).
export const SPECTRUM = ['#7273D2', '#8874cc', '#9969A5', '#c36282', '#E5534B'] as const

type Palette = { low: string; high: string }

// Dial buttons tint by value (0 → 9) across an on-brand cool gradient.
// Light: pale lavender → periwinkle blue. Dark: deep navy → app blue.
export const DIAL_COLORS = {
  light: { low: '#ECEAF7', high: '#8296FF' },
  dark: { low: '#1E2036', high: '#4C7EFF' },
} as const satisfies Record<'light' | 'dark', Palette>

// The score above the dial transitions from the target numbers' background
// color (APP_BLUE, the pie fill) up to the standard text color.
export const SCORE_COLORS = {
  light: { low: APP_BLUE, high: '#1C1928' },
  dark: { low: APP_BLUE, high: '#D8D2F4' },
} as const satisfies Record<'light' | 'dark', Palette>
