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

import { CornerBadge } from '@/components/overlays/corner-badge'
import {
  ARCADE_TEASER,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
  MODE_ORDER,
  MODES,
  type Mode,
} from '@/machines/game'

const MODE_ITEMS = [...MODE_ORDER, 'arcade'] as (Mode | 'arcade')[]

export function ModeSelector({
  focused,
  onSelect,
  gradPhase,
  items = MODE_ITEMS,
  // Overrides MODE_GRADIENT per key — multiplayer's waiting room and results pass
  // their own accuracy/speed pair here rather than the singleplayer one, leaving
  // trainee/arcade (never in a multiplayer item list) on the default.
  gradient,
  // Which stop of the (possibly overridden) pair labels an inactive tab. 0 for
  // singleplayer, where each mode's own start stop already tells the tabs apart.
  // Multiplayer's pair shares its start stop across both modes, so it passes 1 —
  // the dominant stop borrowed from singleplayer — to keep the tabs distinguishable
  // before either is tapped.
  accentIndex = 0,
}: {
  focused: Mode | 'arcade'
  onSelect: (m: Mode | 'arcade') => void
  gradPhase: SharedValue<number>
  items?: (Mode | 'arcade')[]
  gradient?: Partial<Record<Mode | 'arcade', readonly [string, string]>>
  accentIndex?: 0 | 1
}) {
  const source = { ...MODE_GRADIENT, ...gradient }
  const pillColors = (f: Mode | 'arcade'): [string, string] =>
    source[f] as [string, string]

  const tabLayouts = useRef<{ x: number; width: number }[]>([])
  const bgLeft = useSharedValue(-999)
  const bgRight = useSharedValue(-999)
  const [fromColors, setFromColors] = useState<[string, string]>(() =>
    pillColors(focused),
  )
  const [toColors, setToColors] = useState<[string, string]>(() => pillColors(focused))
  const prevFocusedRef = useRef<Mode | 'arcade'>(focused)
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
    const index = items.findIndex((m) => m === focused)
    const layout = tabLayouts.current[index]
    if (layout) {
      const newLeft = layout.x
      const newRight = layout.x + layout.width
      const spring = { damping: 40, stiffness: 300 }
      if (bgLeft.value < -900) {
        bgLeft.value = newLeft
        bgRight.value = newRight
      } else if (newLeft >= bgLeft.value) {
        bgRight.value = withSpring(newRight, spring)
        bgLeft.value = withDelay(60, withSpring(newLeft, spring))
      } else {
        bgLeft.value = withSpring(newLeft, spring)
        bgRight.value = withDelay(60, withSpring(newRight, spring))
      }
    }

    if (prevFocusedRef.current !== focused) {
      const prevFocused = prevFocusedRef.current
      prevFocusedRef.current = focused
      setFromColors(pillColors(prevFocused))
      setToColors(pillColors(focused))
      colorFade.value = 0
      colorFade.value = withTiming(1, { duration: 350 })
    }
  }, [focused, items, bgLeft, bgRight, colorFade])

  return (
    <View className="mb-1 items-center" style={{ paddingTop: 8 }}>
      <View className="flex-row">
        {/* Sliding pill — behind buttons in z-order */}
        <Animated.View
          pointerEvents="none"
          style={[
            bgStyle,
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: 12,
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

        {items.map((m, i) => {
          const isActive = m === focused
          if (m === 'arcade') {
            return (
              <Pressable
                key="arcade"
                onPress={() => {
                  onSelect('arcade')
                }}
                onLayout={(e) => {
                  tabLayouts.current[i] = {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  }
                  if (isActive) {
                    bgLeft.value = e.nativeEvent.layout.x
                    bgRight.value = e.nativeEvent.layout.x + e.nativeEvent.layout.width
                  }
                }}
                className="px-3.5 py-2"
                style={!isActive ? { opacity: 0.6 } : undefined}
              >
                <Text
                  selectable={false}
                  className="font-mono text-[11px] font-black tracking-[1.5px]"
                  style={{ color: isActive ? '#FFFFFF' : source.arcade[0] }}
                >
                  {ARCADE_TEASER.label}
                </Text>
                <CornerBadge label={ARCADE_TEASER.tag} />
              </Pressable>
            )
          }
          return (
            <Pressable
              key={m}
              onPress={() => {
                onSelect(m)
              }}
              onLayout={(e) => {
                tabLayouts.current[i] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                }
                if (isActive) {
                  bgLeft.value = e.nativeEvent.layout.x
                  bgRight.value = e.nativeEvent.layout.x + e.nativeEvent.layout.width
                }
              }}
              className="px-3.5 py-2"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px]"
                style={{ color: isActive ? '#FFFFFF' : source[m][accentIndex] }}
              >
                {MODES[m].label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Text
        selectable={false}
        className="mt-3 px-8 text-center font-mono text-[10px] font-bold text-dim leading-5"
      >
        {MODE_DESCRIPTIONS[focused]}
      </Text>
    </View>
  )
}
