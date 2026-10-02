import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { PauseButton } from '@/components/game/pause-button'

// The row every live run is played under: what the run is on the left, the game's name in
// the middle, and the way to stop on the right.
//
// One component for every engine. It was two rows of the same three columns, and the two
// had already drifted — different wrappers, different fades, a wordmark centred by two
// different means. A run shows what it is and offers a way out of itself; neither is a
// thing an engine should have an opinion about.
export function RunTopBar({
  accent,
  title,
  subtitle = null,
  wordmark,
  onPause = null,
}: {
  // The run's own colour: the title takes it, and so does the pause button.
  accent: string
  // What the run is. The mode's name, or the submode's — see `runLabel`.
  title: ReactNode
  // Under it, dim: the rung a scored run is on, the place an arcade run is standing in.
  // Null where the run has nothing to add.
  subtitle?: ReactNode
  // NINE's own colour, which is the only thing about this row that differs by rung.
  wordmark: string
  // The way to stop, or null where there is nothing to stop — a run that is already
  // paused, over, or mid-movement with no beat to freeze.
  onPause?: (() => void) | null
}) {
  return (
    <View className="flex-row items-center">
      <View className="flex-1">
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px]"
          style={{ color: accent }}
        >
          {title}
        </Text>
        {/* Clipped rather than wrapped: a second line here would push the whole row
            down. */}
        {subtitle !== null && (
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            {subtitle}
          </Text>
        )}
      </View>
      {/* The game's name, the one string that is the same in every language. The tracking
          is added after every letter, the E included, so the word sits in a box 8px wider
          than itself on the right. Matching that on the left is what actually centres the
          letters between the two flex-1 columns; without it they hang 4px to the left. */}
      <Text
        selectable={false}
        className="pl-[8px] font-mono text-[24px] font-black tracking-[8px]"
        style={{ color: wordmark }}
      >
        NINE
      </Text>
      {/* The way out, balancing the title block on the left. The column keeps its width
          whether the button is there or not, so nothing else in the row moves — and the
          button fades rather than blinking, because in some runs it comes and goes
          between beats. */}
      <View className="flex-1 flex-row items-center justify-end">
        {onPause !== null && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)}>
            <PauseButton color={accent} onPress={onPause} />
          </Animated.View>
        )}
      </View>
    </View>
  )
}
