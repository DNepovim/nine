import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { ARCADE_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { DARK_MODE_GRADIENT } from '@/machines/game'

// The end of an arcade run: how deep it got, and the two ways out.
//
// Deliberately not the game's own game-over screen. That one carries a score, a board, a
// best, the medals it moved and the challenge to send a friend — and an arcade run has none
// of those while it is behind the flag. What it has is a depth.
export function ArcadeOver({
  depth,
  onAgain,
  onHome,
}: {
  depth: number
  onAgain: () => void
  onHome: () => void
}) {
  const { colorScheme } = useTheme()

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      className="absolute inset-0 items-center justify-center gap-8 bg-surface px-6"
    >
      <View className="items-center gap-2">
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black tracking-[2.5px] text-dim"
        >
          <Trans>FELL INTO THE MOUTH</Trans>
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[64px] font-black"
          style={{ color: ARCADE_INK[colorScheme] }}
        >
          {depth}
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[1.5px] text-dim"
        >
          <Trans>CROSSROADS DEEP</Trans>
        </Text>
      </View>

      <View className="items-center gap-5">
        <Pressable onPress={onAgain} className="w-56 overflow-hidden rounded-2xl">
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
        <Pressable onPress={onHome} hitSlop={12}>
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[2px] text-dim"
          >
            <Trans>HOME</Trans>
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}
