import { Text, type TextStyle } from 'react-native'

import { READOUT } from '@/constants/typography'
import { useDisplayScore } from '@/hooks/use-display-score'
import { cn } from '@/lib/cn'

// The score in the top bar, counting up to the machine's figure as a hit's points land.
// Not `ScoreReadout`, the framed figure the pause and game-over screens draw — this one
// lives in the bar and its job is the count.
//
// Its own component for the reason `RunStopwatch` is: the count-up redraws every frame
// for as long as it runs, and it runs on every hit — the very moment the confetti, the
// floating points and the next target are all asking for frames. Held in the game screen,
// each of those frames re-ran the whole screen; held here, only this figure redraws.
export function BarScore({
  score,
  digitFont,
  glow,
}: {
  score: number
  // The seven-segment face, or `mono` until it loads — resolved by the screen.
  digitFont: string
  // The bar's glow under the current scheme, shared with the multiplier beside it.
  glow: TextStyle
}) {
  const displayScore = useDisplayScore(score)
  return (
    <Text
      selectable={false}
      className={cn(READOUT.best, 'text-score')}
      style={[{ fontFamily: digitFont }, glow]}
    >
      {displayScore}
    </Text>
  )
}
