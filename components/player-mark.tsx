import { useId } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { PHOENIX_MARK, type PlayerMark } from '@/lib/champions'

// The phoenix's own fire: the bottom of a flame, its middle and its tip. Not the game
// scale — a mark is drawn the way the emoji beside it is, in its own colours.
const EMBER = '#E5341F'
const FLAME = '#FF8C00'
const TIP = '#FFD23F'
const PLUME = '#FFB020'
const BEAK = '#C2410C'
const EYE = '#2B1A12'

// The **phoenix** drawn rather than typed.
//
// The phoenix emoji is a joined pair — a bird and a fire — that only fonts from 2023 on
// know as one glyph. Everywhere older, which is a lot of phones still, it falls apart into
// 🐦🔥: two emoji where every other mark is one, and a pair that reads as a bird standing
// next to a fire rather than as a bird made of it. Drawing it is what makes it the same
// mark on every device. The other three marks are single code points every font has, so
// they stay text.
//
// Sized by the box it stands in, square, so it drops in wherever an emoji of `size` did.
function PhoenixGlyph({ size }: { size: number }) {
  // Gradient ids are document-wide on the web, and a board draws a phoenix per row.
  const id = useId()
  const fire = `phoenix-fire-${id}`
  const body = `phoenix-body-${id}`
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={fire} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={EMBER} />
          <Stop offset="0.55" stopColor={FLAME} />
          <Stop offset="1" stopColor={TIP} />
        </LinearGradient>
        <LinearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={PLUME} />
          <Stop offset="1" stopColor={EMBER} />
        </LinearGradient>
      </Defs>
      {/* The wings, as flame tongues sweeping up and out — one, then its mirror. */}
      <Path
        fill={`url(#${fire})`}
        d="M11 12.5C8.5 12 5.5 10.5 3.5 7.5C4.8 8.2 6 8.4 6.8 8.2C5.2 6.8 4.4 4.8 4.6 2.5C6 4.6 7.4 5.6 8.6 6C8 4.6 8.1 3 8.8 1.5C9.6 4.2 11 6.6 12 8.5Z"
      />
      <Path
        fill={`url(#${fire})`}
        d="M13 12.5C15.5 12 18.5 10.5 20.5 7.5C19.2 8.2 18 8.4 17.2 8.2C18.8 6.8 19.6 4.8 19.4 2.5C18 4.6 16.6 5.6 15.4 6C16 4.6 15.9 3 15.2 1.5C14.4 4.2 13 6.6 12 8.5Z"
      />
      {/* The tail: three tongues. */}
      <Path
        fill={`url(#${fire})`}
        d="M10.6 16C9.6 18.2 8.4 19.8 6.8 21C8.6 20.8 9.8 20.2 10.6 19.4C10.6 20.8 11.2 22 12 23C12.8 22 13.4 20.8 13.4 19.4C14.2 20.2 15.4 20.8 17.2 21C15.6 19.8 14.4 18.2 13.4 16Z"
      />
      <Path
        fill={`url(#${body})`}
        d="M12 8.2C13.6 8.2 14.4 9.6 14.2 11.6C14 14 13.2 16.4 12 17.4C10.8 16.4 10 14 9.8 11.6C9.6 9.6 10.4 8.2 12 8.2Z"
      />
      <Circle cx="12" cy="7.4" r="1.9" fill={PLUME} />
      <Path
        fill={TIP}
        d="M11.2 5.8C11 4.6 11.4 3.6 12.2 3C12 3.9 12.4 4.6 13 5.2C12.6 5.4 12 5.6 11.2 5.8Z"
      />
      <Path fill={BEAK} d="M13.7 7L15.3 7.6L13.7 8.1Z" />
      <Circle cx="12.7" cy="7" r="0.38" fill={EYE} />
    </Svg>
  )
}

// One mark, the way every renderer draws it: the phoenix drawn, the rest as text.
//
// `inline` is for a mark inside a sentence or a name — a nested `Text` inherits the line's
// size, and the phoenix rides along as an inline view. Otherwise it stands on its own at
// `size`, with the line height a glyph needs so the emoji is not clipped.
export function MarkGlyph({
  mark,
  size,
  inline = false,
  className,
}: {
  mark: PlayerMark
  size: number
  inline?: boolean
  // Passed to the emoji's text or the phoenix's box — the intro's float animation.
  className?: string
}) {
  if (mark === PHOENIX_MARK) {
    return (
      <View
        className={className}
        style={inline ? { width: size, height: size } : undefined}
      >
        <PhoenixGlyph size={size} />
      </View>
    )
  }
  if (inline) return <Text>{mark}</Text>
  return (
    <Text
      selectable={false}
      className={className}
      style={{ fontSize: size, lineHeight: size + 4 }}
    >
      {mark}
    </Text>
  )
}

// A player's marks in front of their name inside a line of text, then a space — the
// shape `TakerName`, `WinnerName` and a multiplayer tile all write. Empty where they
// wear none.
export function InlineMarks({
  marks,
  size,
}: {
  marks: readonly PlayerMark[]
  size: number
}) {
  return marks.map((mark) => (
    <Text key={mark}>
      <MarkGlyph mark={mark} size={size} inline />{' '}
    </Text>
  ))
}

// A player's marks as a row of their own, outside any text — a board row, the head of
// the comparison table.
export function MarkRow({
  marks,
  size,
  gap = 3,
}: {
  marks: readonly PlayerMark[]
  size: number
  gap?: number
}) {
  return (
    <View className="flex-row items-center" style={{ gap }}>
      {marks.map((mark) => (
        <MarkGlyph key={mark} mark={mark} size={size} />
      ))}
    </View>
  )
}
