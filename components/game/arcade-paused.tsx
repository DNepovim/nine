import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

import { ArcadeStats } from '@/components/game/arcade-stats'
import { PauseMark } from '@/components/overlays/pause-mark'
import { ScoreReadout } from '@/components/overlays/score-readout'
import { Screen } from '@/components/screen'
import { ARCADE_INK, DIM_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { darkGradientOf } from '@/modes'

// An arcade run, stopped.
//
// The same screen the rest of the app stops on, wearing the same clothes: the two glass
// bars where a game-over title would be, the run's own figures under them, then the CTA
// and the quiet way out below. What it leaves off is everything arcade does not have —
// no board, no high scores, no medals, no dial options.
//
// Not `PausedOverlay` itself. That screen is thirty props of the game machine's run: a
// score, a difficulty, lives, boards, medals, achievements, four dial corners and
// Trainee's sliders. Multiplayer has its own pause screen for exactly this reason — see
// multiplayer-menu.tsx — and this is arcade's.
const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

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
    <Screen overlay overRun>
      <View className="w-full items-center">
        <PauseMark gameMode="arcade" />

        {/* Depth where the game puts its score, in the readout the game puts it in — this
            is the number the run is worth, so it belongs in the place a player already
            looks for that. */}
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
            onPress={onContinue}
            className="w-full overflow-hidden rounded-2xl"
            style={shadow}
          >
            <LinearGradient
              colors={[...darkGradientOf('arcade')]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="items-center py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
              >
                <Trans>CONTINUE</Trans>
              </Text>
            </LinearGradient>
          </Pressable>

          {/* The label says what this does, the icon says where it lands — the same
              pairing the game's own pause screen ends a run with, because a player
              looking for the way out of a run should meet it in the same clothes
              wherever they are. */}
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
        </View>
      </View>
    </Screen>
  )
}
