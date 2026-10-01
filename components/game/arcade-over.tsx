import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

import { ArcadeStats } from '@/components/game/arcade-stats'
import { GameOverTitle } from '@/components/overlays/game-over-title'
import { ScoreReadout } from '@/components/overlays/score-readout'
import { Screen } from '@/components/screen'
import { ARCADE_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { TitleWords } from '@/lib/game-over-title'
import { DARK_MODE_GRADIENT } from '@/machines/game'

// The end of an arcade run, on the screen the game ends on: the wordmark, the number the
// run was worth, its figures, then PLAY AGAIN and the way home.
//
// Both rows fit the wordmark's 4×2 grid, which is what its colour ramp and entrance delays
// are indexed by — a longer word would run off the end of that ramp. And they say what
// happened rather than that it happened: the hero was dragged off the first crossroad and
// fell, which is the one way a run of this ends.
const TITLE = ['FELL', 'BACK'] as const satisfies TitleWords

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

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
    <Screen overlay overRun>
      <View className="w-full items-center">
        <View className="mb-4">
          <GameOverTitle gameMode="arcade" words={TITLE} />
        </View>

        <View className="mb-5 items-center gap-1.5">
          <ScoreReadout score={depth} color={ARCADE_INK[colorScheme]} />
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1.5px] text-dim"
          >
            <Trans>CROSSROADS DEEP</Trans>
          </Text>
        </View>

        <ArcadeStats strikes={strikes} playedMs={playedMs} />

        <View className="w-56 items-center gap-6">
          <Pressable
            onPress={onAgain}
            className="w-full overflow-hidden rounded-2xl"
            style={shadow}
          >
            <LinearGradient
              colors={[...DARK_MODE_GRADIENT.arcade]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="items-center py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
              >
                <Trans>PLAY AGAIN</Trans>
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onHome} hitSlop={10}>
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
            >
              <Trans>HOME</Trans>
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
