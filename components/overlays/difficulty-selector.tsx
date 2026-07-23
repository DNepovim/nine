import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getDifficultyColor,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

// Worklet-safe hex color lerp (mirrors the one in animated-letter.tsx)
function lerpHex(a: string, b: string, t: number): string {
  'worklet'
  const r1 = parseInt(a.slice(1, 3), 16)
  const g1 = parseInt(a.slice(3, 5), 16)
  const b1 = parseInt(a.slice(5, 7), 16)
  const r2 = parseInt(b.slice(1, 3), 16)
  const g2 = parseInt(b.slice(3, 5), 16)
  const b2 = parseInt(b.slice(5, 7), 16)
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return '#' + h(r1 + (r2 - r1) * t) + h(g1 + (g2 - g1) * t) + h(b1 + (b2 - b1) * t)
}

export function DifficultySelector({
  gameMode,
  difficulty,
  onSetDifficulty,
  gradPhase,
}: {
  gameMode: Mode
  difficulty: Difficulty
  onSetDifficulty: (d: Difficulty) => void
  gradPhase: SharedValue<number>
}) {
  // State (not ref) so the pill-position effect re-runs when layouts arrive.
  const [layouts, setLayouts] = useState<({ x: number; width: number } | null)[]>(() =>
    DIFFICULTY_ORDER.map(() => null),
  )

  const bgLeft = useSharedValue(-999)
  const bgRight = useSharedValue(-999)

  const [fromColors, setFromColors] = useState<[string, string]>(
    () => MODE_GRADIENT[gameMode] as [string, string],
  )
  const [toColors, setToColors] = useState<[string, string]>(
    () => MODE_GRADIENT[gameMode] as [string, string],
  )
  const prevGameModeRef = useRef<Mode>(gameMode)
  const colorFade = useSharedValue(1)

  // Per-item selection progress (0 = unselected, 1 = selected)
  const sel0 = useSharedValue(difficulty === 'easy' ? 1 : 0)
  const sel1 = useSharedValue(difficulty === 'hard' ? 1 : 0)
  const sel2 = useSharedValue(difficulty === 'extreme' ? 1 : 0)

  // Non-selected colors for each item — shared values so worklets stay reactive
  const nsColor0 = useSharedValue(getDifficultyColor(gameMode, 'easy'))
  const nsColor1 = useSharedValue(getDifficultyColor(gameMode, 'hard'))
  const nsColor2 = useSharedValue(getDifficultyColor(gameMode, 'extreme'))

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bgLeft.value }],
    width: Math.max(0, bgRight.value - bgLeft.value),
  }))

  const innerGradStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(gradPhase.value * Math.PI * 2) * 12 }],
  }))

  const fromGradStyle = useAnimatedStyle(() => ({ opacity: 1 - colorFade.value }))
  const toGradStyle = useAnimatedStyle(() => ({ opacity: colorFade.value }))

  const textStyle0 = useAnimatedStyle(() => ({
    color: lerpHex(nsColor0.value, '#FFFFFF', sel0.value),
  }))
  const textStyle1 = useAnimatedStyle(() => ({
    color: lerpHex(nsColor1.value, '#FFFFFF', sel1.value),
  }))
  const textStyle2 = useAnimatedStyle(() => ({
    color: lerpHex(nsColor2.value, '#FFFFFF', sel2.value),
  }))
  const textStyles = [textStyle0, textStyle1, textStyle2]

  // Pill position — runs when difficulty changes OR when a layout is measured for the first time.
  useEffect(() => {
    const index = DIFFICULTY_ORDER.findIndex((d) => d === difficulty)
    const layout = layouts[index]
    if (!layout) return
    const newLeft = layout.x
    const newRight = layout.x + layout.width
    const spring = { damping: 40, stiffness: 300 }
    if (bgLeft.value < -900) {
      // Initial placement: snap with no animation
      bgLeft.value = newLeft
      bgRight.value = newRight
      return
    }
    if (newLeft >= bgLeft.value) {
      // Moving right: trailing edge leads
      bgRight.value = withSpring(newRight, spring)
      bgLeft.value = withDelay(60, withSpring(newLeft, spring))
    } else {
      // Moving left: leading edge leads
      bgLeft.value = withSpring(newLeft, spring)
      bgRight.value = withDelay(60, withSpring(newRight, spring))
    }
  }, [difficulty, layouts, bgLeft, bgRight])

  // Text color transition when selection changes
  useEffect(() => {
    const t = { duration: 200 }
    sel0.value = withTiming(difficulty === 'easy' ? 1 : 0, t)
    sel1.value = withTiming(difficulty === 'hard' ? 1 : 0, t)
    sel2.value = withTiming(difficulty === 'extreme' ? 1 : 0, t)
  }, [difficulty, sel0, sel1, sel2])

  // Non-selected color update when game mode changes
  useEffect(() => {
    nsColor0.value = getDifficultyColor(gameMode, 'easy')
    nsColor1.value = getDifficultyColor(gameMode, 'hard')
    nsColor2.value = getDifficultyColor(gameMode, 'extreme')
  }, [gameMode, nsColor0, nsColor1, nsColor2])

  // Gradient fade on mode switch
  useEffect(() => {
    if (prevGameModeRef.current === gameMode) return
    const prevMode = prevGameModeRef.current
    prevGameModeRef.current = gameMode
    setFromColors(MODE_GRADIENT[prevMode] as [string, string])
    setToColors(MODE_GRADIENT[gameMode] as [string, string])
    colorFade.value = 0
    colorFade.value = withTiming(1, { duration: 350 })
  }, [gameMode, colorFade])

  return (
    <View className="mb-6 items-center">
      <View className="flex-row overflow-hidden rounded-md bg-card">
        {/* Sliding pill */}
        <Animated.View
          pointerEvents="none"
          style={[
            bgStyle,
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: 6,
              overflow: 'hidden',
            },
          ]}
        >
          {/* From layer: previous mode colors, fades out */}
          <Animated.View
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: -16, right: -16 },
              innerGradStyle,
              fromGradStyle,
            ]}
          >
            <LinearGradient
              colors={fromColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
          {/* To layer: current mode colors, fades in */}
          <Animated.View
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: -16, right: -16 },
              innerGradStyle,
              toGradStyle,
            ]}
          >
            <LinearGradient
              colors={toColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </Animated.View>

        {DIFFICULTY_ORDER.map((d, i) => (
          <Pressable
            key={d}
            onPress={() => {
              onSetDifficulty(d)
            }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout
              setLayouts((prev) => {
                const next = [...prev]
                next[i] = { x, width }
                return next
              })
            }}
            className="px-2 py-1"
          >
            <Animated.Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px]"
              style={textStyles[i]}
            >
              {DIFFICULTIES[d].label}
            </Animated.Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
