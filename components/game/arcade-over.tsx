import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { GameOverTitle } from '@/components/overlays/game-over-title'
import { RunScreen } from '@/components/overlays/run-screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { ARCADE_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { TitleWords } from '@/lib/game-over-title'
import { arcadeStats } from '@/lib/run-stats'
import { darkGradientOf } from '@/modes'

// The end of an arcade run, on the same screen every run in the app ends on.
//
// Two words, and they say what happened rather than that it happened. Which two depends
// on *how* it happened, because a run of this now ends two ways and they are not the same
// ending: the hero dragged off the first crossroad goes down the stub into the mouth,
// which is a picture of running out of way; a hero overrun at a walled village dies on
// the ground it fought on, and the walls it could not get through are what beat it.
//
// Every row fits the wordmark's 4×2 grid, which is what its colour ramp and entrance
// delays are indexed by — a second row longer than four runs off the end of that ramp,
// and that holds for the Czech as much as for the English.

export function ArcadeOver({
  overrun,
  depth,
  strikes,
  taken,
  playedMs,
  onAgain,
  onHome,
}: {
  // Which of the two ends this was. True when the last heart went at the walls, false
  // when the hero fell — see where it is handed in, in arcade-game.tsx.
  overrun: boolean
  // The deepest crossroad the run reached, which is what it was worth.
  depth: number
  strikes: number
  // How many walled villages this run took. Beside the strikes because it is the
  // same kind of claim: not what the run was worth, but what it did.
  taken: number
  playedMs: number
  onAgain: () => void
  onHome: () => void
}) {
  const { colorScheme } = useTheme()
  const { t } = useLingui()
  const title: TitleWords = overrun ? [t`WALL`, t`HELD`] : [t`FELL`, t`BACK`]

  return (
    <RunScreen
      overRun
      head={
        // Wrapped for its gap to the score: on the game machine's screen a badge row
        // supplies one, and there is none here.
        <View className="mb-4">
          <GameOverTitle gameMode="arcade" words={title} />
        </View>
      }
      score={{
        value: depth,
        color: ARCADE_INK[colorScheme],
        caption: <Trans>CROSSROADS DEEP</Trans>,
      }}
      stats={arcadeStats(strikes, taken, playedMs)}
      gradient={darkGradientOf('arcade')}
      cta={{ label: <Trans>PLAY AGAIN</Trans>, onPress: onAgain }}
      exits={
        <TrackedPressable id="arcade_over.home" onPress={onHome} hitSlop={10}>
          <Text
            selectable={false}
            className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
          >
            <Trans>HOME</Trans>
          </Text>
        </TrackedPressable>
      }
    />
  )
}
