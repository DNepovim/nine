import type { StyleProp, TextStyle } from 'react-native'
import { Text } from 'react-native'

import { useTheme } from '@/hooks/use-theme'
import { nameColors } from '@/lib/name-gradient'

// One player's nickname, drawn in the gradient their own averages earn them. Every place
// the app writes a name on its own surface uses this, so a player is the same colour on a
// leaderboard row, the winners stripe, the intro greeting and their own profile.
//
// Two places deliberately do not: a multiplayer tile and the live corner, where the name
// sits on a saturated gradient card and the themed name ink measures about 1.0–1.3:1
// against it. Those keep white. See player-tile.tsx.
//
// A `Text` wrapping one `Text` per character rather than a `View` of them: a nested
// `Text` inherits the size, weight and tracking from its parent, so every caller keeps
// styling the name exactly as it did when the name was a single string — and, unlike a
// row of views, it still sits inside a sentence and wraps with the line it belongs to.
// That matters for the winners stripe, where the name is a fragment of translated copy.
export function GradientName({
  nickname,
  // The player's lifetime averages, as percentages. Null where the server has counted no
  // hits for them, which `nameColors` reads as zero — see `saturationFor`.
  avgAccuracy,
  avgSpeed,
  className,
  // For the caller's own runtime values only — the gold screen's label shadow, a row's
  // accent. The per-character colour is set on the children and cannot be overridden
  // from here, which is the point: a name's colour is the player's, not the screen's.
  style,
  numberOfLines,
}: {
  nickname: string
  avgAccuracy: number | null
  avgSpeed: number | null
  className?: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  // The two stops are themed — the mode hues are tuned to be a colour, not to carry text
  // at 10px, so each theme has its own pair. See NAME_INK.
  const { colorScheme } = useTheme()
  const letters = nameColors(nickname, { avgAccuracy, avgSpeed }, colorScheme)
  return (
    <Text
      selectable={false}
      className={className}
      style={style}
      numberOfLines={numberOfLines}
    >
      {letters.map(({ char, color }, index) => (
        <Text key={`${char}-${index}`} style={{ color }}>
          {char}
        </Text>
      ))}
    </Text>
  )
}
