import { Text, View } from 'react-native'

// The run's score, framed like the readout it is: seven-segment digits sunk into a
// card with a hairline round it, rather than a loose number floating on the screen.
// The frame is what gives the figure its weight, so the digits themselves no longer
// have to be huge to read as the headline.
//
// Shared by the pause and game over screens — the same run stopped, so the same
// object, whichever way it stopped.
export function ScoreReadout({ score }: { score: number }) {
  return (
    <View className="mb-5 rounded-xl border border-muted bg-card px-7 py-2.5">
      <Text
        selectable={false}
        className="text-[28px] tracking-[2px] text-score"
        style={{ fontFamily: 'DSEG7' }}
      >
        {score}
      </Text>
    </View>
  )
}
