import { GAME_SCALE, GOLD_SCALE, GRAYSCALE } from '@/constants/colors'
import type { AnnouncementId } from '@/lib/announcements'
import { DARK_MODE_GRADIENT, type Mode } from '@/machines/modes'

// Which of the app's scales an announcement wears. See the design-guide skill.
type Scale = 'game' | 'gold' | 'cta' | 'gray'

const ANNOUNCEMENT_SCALE = {
  // Your own achievements: the game's own colours for a personal best, gold for the
  // three board records.
  record: 'game',
  today: 'gold',
  week: 'gold',
  ever: 'gold',
  // Opening a board is a board milestone like any other, so it wears the same gold as
  // the record for its period — same bar, same particles.
  todayFirst: 'gold',
  weekFirst: 'gold',
  // Someone else moved a board record. The dark CTA scale carries the weight of a
  // real event without the shine of a prize.
  todayRaised: 'cta',
  weekRaised: 'cta',
  everRaised: 'cta',
  // They took it from you: the colour drained out entirely.
  todayLost: 'gray',
  weekLost: 'gray',
  everLost: 'gray',
} as const satisfies Record<AnnouncementId, Scale>

export type AnnouncementStyle = {
  // The bar behind the message.
  from: string
  to: string
  ink: string
  // Particle colours for whatever celebration or effect the announcement plays.
  colors: readonly [string, ...string[]]
}

const WHITE = '#FFFFFF'
const DARK_INK = '#1C1928'
// The CTA scale's own text colour, as used on every primary button.
const ON_STRONG = '#D8D2F4'

// Everything an announcement needs to look right, resolved for the current mode.
//
// Only `cta` varies with the mode being played; the rest are fixed. The bar takes just
// the two darkest greys rather than the whole ramp — the pale end would drop white text
// to about 1.9:1 — while the implosion still falls in all four.
export function announcementStyle(id: AnnouncementId, mode: Mode): AnnouncementStyle {
  const scale = ANNOUNCEMENT_SCALE[id]
  const [ctaFrom, ctaTo] = DARK_MODE_GRADIENT[mode]

  switch (scale) {
    case 'game':
      return { from: GAME_SCALE[0], to: GAME_SCALE[3], ink: WHITE, colors: GAME_SCALE }
    case 'gold':
      return { from: GOLD_SCALE[1], to: GOLD_SCALE[0], ink: DARK_INK, colors: GOLD_SCALE }
    case 'cta':
      return { from: ctaFrom, to: ctaTo, ink: ON_STRONG, colors: GRAYSCALE }
    case 'gray':
      return { from: GRAYSCALE[0], to: GRAYSCALE[1], ink: WHITE, colors: GRAYSCALE }
  }
}
