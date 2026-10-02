import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Pressable, Text, View } from 'react-native'

import { PauseMark } from '@/components/overlays/pause-mark'
import { RunScreen } from '@/components/overlays/run-screen'
import { ARCADE_INK, DIM_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { arcadeStats } from '@/lib/run-stats'
import { darkGradientOf } from '@/modes'

// An arcade run, stopped.
//
// The screen every run in the app stops on — `RunScreen` — with arcade's own four things
// in it: the mark, the depth where a score goes, the two figures a run of this leaves,
// and the one way back in over the one way out. What it leaves off is everything arcade
// does not have: no board, no high scores, no medals, no dial options.
//
// It used to be the whole screen copied out, and the copy had drifted — the depth was
// sitting in a framed card while every other run's score glowed. The shell owns that
// decision now, so there is nothing here to get wrong.
export function ArcadePaused({
  depth,
  strikes,
  playedMs,
  onContinue,
  onEnd,
}: {
  depth: number
  strikes: number
  playedMs: number
  onContinue: () => void
  onEnd: () => void
}) {
  const { colorScheme } = useTheme()

  return (
    <RunScreen
      overRun
      head={<PauseMark gameMode="arcade" />}
      // Depth where the game puts its score, because it is what the run is worth — and
      // captioned, because unlike a score it is not obvious what the number counts.
      score={{
        value: depth,
        color: ARCADE_INK[colorScheme],
        caption: <Trans>CROSSROADS DEEP</Trans>,
      }}
      stats={arcadeStats(strikes, playedMs)}
      gradient={darkGradientOf('arcade')}
      cta={{ label: <Trans>CONTINUE</Trans>, onPress: onContinue }}
      // The label says what this does, the icon says where it lands — the same pairing
      // the game's own pause screen ends a run with, because a player looking for the way
      // out of a run should meet it in the same clothes wherever they are.
      exits={
        <Pressable onPress={onEnd} hitSlop={10}>
          <View className="flex-row items-center gap-1">
            <Ionicons name="home-outline" size={10} color={DIM_INK[colorScheme]} />
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
            >
              <Trans>END RUN</Trans>
            </Text>
          </View>
        </Pressable>
      }
    />
  )
}
