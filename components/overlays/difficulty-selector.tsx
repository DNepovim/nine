import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
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
  const tabLayouts = useRef<{ x: number; width: number }[]>([])
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

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bgLeft.value }],
    width: Math.max(0, bgRight.value - bgLeft.value),
  }))

  const innerGradStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(gradPhase.value * Math.PI * 2) * 12 }],
  }))

  const fromGradStyle = useAnimatedStyle(() => ({ opacity: 1 - colorFade.value }))
  const toGradStyle = useAnimatedStyle(() => ({ opacity: colorFade.value }))

  useEffect(() => {
    const index = DIFFICULTY_ORDER.findIndex((d) => d === difficulty)
    const layout = tabLayouts.current[index]
    if (!layout) return
    const newLeft = layout.x
    const newRight = layout.x + layout.width
    const spring = { damping: 40, stiffness: 300 }
    if (bgLeft.value < -900) {
      bgLeft.value = newLeft
      bgRight.value = newRight
      return
    }
    if (newLeft >= bgLeft.value) {
      bgRight.value = withSpring(newRight, spring)
      bgLeft.value = withDelay(60, withSpring(newLeft, spring))
    } else {
      bgLeft.value = withSpring(newLeft, spring)
      bgRight.value = withDelay(60, withSpring(newRight, spring))
    }
  }, [difficulty, bgLeft, bgRight])

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
      {/* bg-card wraps all segments; pill slides inside; overflow-hidden clips the pill */}
      <View className="flex-row overflow-hidden rounded-md bg-card">
        {/* Sliding pill — behind buttons in z-order */}
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
          {/* From layer: previous colors, fades out */}
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
          {/* To layer: current colors, fades in */}
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

        {DIFFICULTY_ORDER.map((d, i) => {
          const selected = d === difficulty
          return (
            <Pressable
              key={d}
              onPress={() => {
                onSetDifficulty(d)
              }}
              onLayout={(e) => {
                tabLayouts.current[i] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                }
                if (selected) {
                  bgLeft.value = e.nativeEvent.layout.x
                  bgRight.value = e.nativeEvent.layout.x + e.nativeEvent.layout.width
                }
              }}
              className="px-2 py-1"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px]"
                style={{
                  color: selected ? '#FFFFFF' : getDifficultyColor(gameMode, d),
                }}
              >
                {DIFFICULTIES[d].label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
