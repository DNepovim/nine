import type { StyleProp, TextStyle } from 'react-native'
import { Text } from 'react-native'

import { SOFT_HYPHEN } from '@/lib/label-rows'
import { lerpColor } from '@/modes'

// A run of text drawn in a gradient, a character at a time.
//
// React Native has no text gradient, so every gradient word in this app is a row of
// single-character `Text`s with a colour each. This is that walk, and the one place it
// lives: `GradientName` draws a player's nickname with it, and the challenge banner
// draws a challenge's name.
//
// A `Text` wrapping one `Text` per character rather than a `View` of them. A nested
// `Text` inherits size, weight and tracking from its parent, so a caller styles this
// exactly as it would style a plain string — and, unlike a row of views, it still sits
// inside a sentence and wraps with the line it belongs to.
//
// `Array.from` and not a spread or `.split('')`: it steps code points, so a word carrying
// an emoji or a combining mark keeps its characters whole instead of having a surrogate
// pair torn in half and its halves coloured separately.
//
// A **soft hyphen** is not a letter and is dropped before the walk. A challenge's name may
// carry one to say where it breaks (see lib/label-rows.ts); left in, it would take a colour
// step of its own and every letter after it would land a step further along the ramp than
// a name without one.
export function GradientText({
  text,
  from,
  to,
  className,
  style,
  numberOfLines,
}: {
  text: string
  // The two ends. Both have to be inks rather than scale stops — see `NAME_INK` and
  // `challengeInk`, which exist because a colour tuned to fill a shape does not carry a
  // word at 10 or 14 points.
  from: string
  to: string
  className?: string
  // For the caller's own runtime values — a shadow, a line height. Never a colour: the
  // per-character colour is set on the children and cannot be overridden from here,
  // which is the point.
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  const letters = Array.from(text).filter((char) => char !== SOFT_HYPHEN)
  // A one-character word has no distance to travel, so it wears the opening stop whole
  // rather than dividing by zero and rendering as NaN.
  const last = Math.max(1, letters.length - 1)

  return (
    <Text
      selectable={false}
      className={className}
      style={style}
      numberOfLines={numberOfLines}
    >
      {letters.map((char, index) => (
        <Text
          key={`${char}-${index}`}
          style={{ color: lerpColor(from, to, index / last) }}
        >
          {char}
        </Text>
      ))}
    </Text>
  )
}
