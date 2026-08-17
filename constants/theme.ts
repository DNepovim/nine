// Platform-appropriate font families used across the app.

import { Platform } from 'react-native'

const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})

// Monospace family used across the game's numeric UI.
export const mono = Fonts.mono

// Lifting text off the gold game-over screen.
//
// Gold is a light background carrying a celebration: pale streaks and confetti cross
// the screen behind everything, and mode-coloured text — the title letters and the
// medal labels — sits on it at mid-tone contrast to begin with.
//
// The title takes a white halo rather than a dark drop shadow. Its letters are the
// mode's own hues, mid-tones every one, and a dark shadow under a mid-tone on a light
// background just thickens it into a smudge. White does the opposite: it separates the
// letter from the gold and from anything passing behind it, the way a sticker sits on
// a poster. No offset, because a halo has no direction.
export const ON_GOLD_TEXT_SHADOW = {
  textShadowColor: 'rgba(255, 255, 255, 0.9)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 10,
} as const

// The same halo at small-text size, for everything that meets the gold directly: the
// run stats, the leaderboard rows, the way out. Text on its own surface — the mode
// badges, the score in its card, the pill under the CTA — is already separated and
// takes none of this.
export const ON_GOLD_LABEL_SHADOW = {
  textShadowColor: 'rgba(255, 255, 255, 0.9)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 6,
} as const

// A glow behind a glyph rather than a shadow under one: no offset, and the radius does
// all the work. Used where something has to lift off a background it shares a hue with.
export const corona = (color: string, radius: number) => ({
  textShadowColor: color,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: radius,
})

// The crown on the all-time screen is a gold emoji on a gold background — without this
// it sinks into its own backdrop.
export const CROWN_CORONA = corona('rgba(255, 255, 255, 0.95)', 26)

// The score's own glow. Tighter than the crown's, because 28px digits carry less area
// than a 44px emoji and the same radius would smear them.
export const SCORE_CORONA_RADIUS = 20
