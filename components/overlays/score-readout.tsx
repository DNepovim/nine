import { Text, View } from 'react-native'

import { corona, SCORE_CORONA_RADIUS } from '@/constants/theme'

// The run's score. Same seven-segment digits at the same size wherever it appears —
// only what holds them changes.
//
// Framed by default: sunk into a card with a hairline round it, which is what gives the
// figure its weight on the pause screen without the digits having to be huge.
//
// Given a `glow` it drops the frame instead and lights up from behind. The game-over
// screen wears it that way: there the score is the headline rather than a readout on a
// paused board, and a card would box it in against a celebration playing behind the
// whole screen.
export function ScoreReadout({
  score,
  color,
  glow,
}: {
  score: number
  // The digits' own colour. Defaults to the score token — the green every other score
  // in the app wears.
  color?: string
  // Lights the number from behind and removes the frame. The two go together: the glow
  // is what separates the digits from the background once the card is gone.
  glow?: string
}) {
  const digits = (
    <Text
      selectable={false}
      className={
        color === undefined
          ? 'text-[28px] tracking-[2px] text-score'
          : 'text-[28px] tracking-[2px]'
      }
      style={[
        { fontFamily: 'DSEG7' },
        color === undefined ? null : { color },
        glow === undefined ? null : corona(glow, SCORE_CORONA_RADIUS),
      ]}
    >
      {score}
    </Text>
  )

  if (glow !== undefined) return <View className="mb-5">{digits}</View>

  return (
    <View className="mb-5 rounded-xl border border-muted bg-card px-7 py-2.5">
      {digits}
    </View>
  )
}
