import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { MODE_GRADIENT, type Mode } from '@/machines/game'

export type PlayMode = 'alone' | 'friends'

const PLAY_MODES: { key: PlayMode; label: string }[] = [
  { key: 'alone', label: 'ALONE' },
  { key: 'friends', label: 'WITH FRIENDS' },
]

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

export function PlayModeTab({
  playMode,
  gameMode,
  gradPhase,
  onSelect,
}: {
  playMode: PlayMode
  gameMode: Mode
  gradPhase: SharedValue<number>
  onSelect: (pm: PlayMode) => void
}) {
  const [layouts, setLayouts] = useState<({ x: number; width: number } | null)[]>(() =>
    PLAY_MODES.map(() => null),
  )
  const bgLeft = useSharedValue(-999)
  const bgRight = useSharedValue(-999)
  const sel0 = useSharedValue(playMode === 'alone' ? 1 : 0)
  const sel1 = useSharedValue(playMode === 'friends' ? 1 : 0)

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bgLeft.value }],
    width: Math.max(0, bgRight.value - bgLeft.value),
  }))
  const innerGradStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(gradPhase.value * Math.PI * 2) * 12 }],
  }))
  const textStyle0 = useAnimatedStyle(() => ({
    color: lerpHex('#aaa69e', '#FFFFFF', sel0.value),
  }))
  const textStyle1 = useAnimatedStyle(() => ({
    color: lerpHex('#aaa69e', '#FFFFFF', sel1.value),
  }))

  useEffect(() => {
    const index = PLAY_MODES.findIndex((p) => p.key === playMode)
    const layout = layouts[index]
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
  }, [playMode, layouts, bgLeft, bgRight])

  useEffect(() => {
    const t = { duration: 200 }
    sel0.value = withTiming(playMode === 'alone' ? 1 : 0, t)
    sel1.value = withTiming(playMode === 'friends' ? 1 : 0, t)
  }, [playMode, sel0, sel1])

  return (
    <View className="mb-3 items-center">
      <View className="flex-row rounded-md bg-card">
        <Animated.View
          pointerEvents="none"
          className="absolute top-0 bottom-0 rounded-[6px] overflow-hidden"
          style={bgStyle}
        >
          <Animated.View
            className="absolute top-0 bottom-0 -left-4 -right-4"
            style={innerGradStyle}
          >
            <LinearGradient
              colors={[...MODE_GRADIENT[gameMode]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="flex-1"
            />
          </Animated.View>
        </Animated.View>

        {PLAY_MODES.map(({ key, label }, i) => (
          <Pressable
            key={key}
            onPress={() => {
              onSelect(key)
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
              style={i === 0 ? textStyle0 : textStyle1}
            >
              {label}
            </Animated.Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
