// How readable one colour is on another — the WCAG contrast ratio, from 1 (the same
// colour) to 21 (black on white). Six-digit hexes only, which is every colour this asks
// about: the mode stops and the schemes' grounds.
//
// One implementation for the app: the challenge palette walks a hue down to a readable ink
// with it, and `readableOn` asks it once of a colour already chosen.
const channel = (hex: string, at: number): number => {
  const c = parseInt(hex.slice(at, at + 2), 16) / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

export const contrastRatio = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

// 3:1 — WCAG's floor for large or bold text, which is what the run's title and the NINE
// wordmark are. Below it a colour is decoration, not something to read.
const LEGIBLE = 3

// `color` where it reads on `ground`, otherwise `fallback`. For a mode's own colour drawn
// on a **scheme** it was not tuned for: BLACKOUT's ink is black, and on the dark scheme its
// name would vanish, where the scheme's own text ink does not.
export const readableOn = (color: string, ground: string, fallback: string): string =>
  contrastRatio(color, ground) >= LEGIBLE ? color : fallback
