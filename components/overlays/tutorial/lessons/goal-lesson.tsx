import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { PieCountdown } from '@/components/game/pie-countdown'
import { DialStage } from '@/components/overlays/tutorial/dial-stage'
import { LiveDialGrid } from '@/components/overlays/tutorial/live-dial-grid'
import { SumReadout } from '@/components/overlays/tutorial/sum-readout'
import {
  GOAL_HOW_DELAY_MS,
  GOAL_RING_MS,
  GOAL_TARGET,
  STEP_COLORS,
} from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { useSplash } from '@/hooks/use-splash'
import { dialCell, emptyCells, setCell, sumCells } from '@/lib/tutorial-grid'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[0] ?? '#4C7EFF'

// The real game screen, minus the HUD: one target ticking down, the board total,
// the dial. The player is invited to try — and five seconds isn't nearly enough
// for a three-digit target, which is exactly the question the tutorial answers.
// When the ring empties the screen reports itself done and moves on.
// No forward button here: the screen is a timed demonstration, and it ends itself
// the moment the target resolves — either way.
export function GoalLesson({ isDark, onComplete }: LessonProps) {
  const [cells, setCells] = useState<readonly number[]>(emptyCells)
  const dialSize = useGameDialSize()
  const howOpacity = useSharedValue(0)
  const hit = sumCells(cells) === GOAL_TARGET
  // The tutorial is mounted beneath the intro splash, so nothing here may start
  // ticking until that clears — otherwise the countdown expires unseen and the
  // screen advances before the player has laid eyes on it.
  const { done: splashDone } = useSplash()

  useEffect(() => {
    if (!splashDone) return
    const timer = setTimeout(() => {
      howOpacity.value = withTiming(1, { duration: 600 })
    }, GOAL_HOW_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [splashDone])

  // Practically nobody dials 137 inside five seconds — but if they do, that
  // answers the question just as well as the ring running out.
  useEffect(() => {
    if (hit) onComplete()
  }, [hit, onComplete])

  const howStyle = useAnimatedStyle(() => ({ opacity: howOpacity.value }))

  return (
    <View className="flex-1">
      <Text
        selectable={false}
        className="mt-5 text-center font-mono text-[15px] font-bold leading-[22px] text-primary"
      >
        {'The board must equal the target.\nThat’s the whole game.'}
      </Text>

      <DialStage
        above={
          <View className="items-center">
            {/* Keyed on the splash so the ring remounts — and only then starts
                counting — the moment the screen becomes visible. */}
            <PieCountdown
              key={String(splashDone)}
              value={GOAL_TARGET}
              isDark={isDark}
              active={splashDone && !hit}
              duration={GOAL_RING_MS}
              onComplete={onComplete}
            />
            <Animated.View style={howStyle}>
              <Text
                selectable={false}
                className="mt-4 text-center font-mono text-[19px] font-black tracking-[1px]"
                style={{ color: COLOR }}
              >
                {'But how?'}
              </Text>
            </Animated.View>
          </View>
        }
        readout={<SumReadout sum={sumCells(cells)} isDark={isDark} />}
        dialSize={dialSize}
      >
        <LiveDialGrid
          cells={cells}
          isDark={isDark}
          size={dialSize}
          showWeights={false}
          hintCell={null}
          hintGesture="tap"
          hintColor={COLOR}
          onDelta={(index, delta) => {
            setCells((current) => dialCell(current, index, delta))
          }}
          onSet={(index, value) => {
            setCells((current) => setCell(current, index, value))
          }}
        />
      </DialStage>
    </View>
  )
}
