import { Trans } from '@lingui/react/macro'
import { Pressable, Text, View } from 'react-native'

import { GameOverTitle } from '@/components/overlays/game-over-title'
import { RunScreen } from '@/components/overlays/run-screen'
import { ARCADE_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { TitleWords } from '@/lib/game-over-title'
import { arcadeStats } from '@/lib/run-stats'
import { darkGradientOf } from '@/modes'

// The end of an arcade run, on the same screen every run in the app ends on.
//
// Both rows fit the wordmark's 4×2 grid, which is what its colour ramp and entrance
// delays are indexed by — a longer word would run off the end of that ramp. And they say
// what happened rather than that it happened: the hero was dragged off the first
// crossroad and fell, which is the one way a run of this ends.
const TITLE = ['FELL', 'BACK'] as const satisfies TitleWords

export function ArcadeOver({
  depth,
  strikes,
  playedMs,
  onAgain,
  onHome,
}: {
  // The deepest crossroad the run reached, which is what it was worth.
  depth: number
  strikes: number
  playedMs: number
  onAgain: () => void
  onHome: () => void
}) {
  const { colorScheme } = useTheme()

  return (
    <RunScreen
      overRun
      head={
        // Wrapped for its gap to the score: on the game machine's screen a badge row
        // supplies one, and there is none here.
        <View className="mb-4">
          <GameOverTitle gameMode="arcade" words={TITLE} />
        </View>
      }
      score={{
        value: depth,
        color: ARCADE_INK[colorScheme],
        caption: <Trans>CROSSROADS DEEP</Trans>,
      }}
      stats={arcadeStats(strikes, playedMs)}
      gradient={darkGradientOf('arcade')}
      cta={{ label: <Trans>PLAY AGAIN</Trans>, onPress: onAgain }}
      exits={
        <Pressable onPress={onHome} hitSlop={10}>
          <Text
            selectable={false}
            className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
          >
            <Trans>HOME</Trans>
          </Text>
        </Pressable>
      }
    />
  )
}
