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
  ARCADE_TEASER,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
  MODE_ORDER,
  MODES,
  type Mode,
} from '@/machines/game'

const MODE_ITEMS = [...MODE_ORDER, 'arcade'] as (Mode | 'arcade')[]

function pillColors(f: Mode | 'arcade'): [string, string] {
  return MODE_GRADIENT[f] as [string, string]
}

export function ModeSelector({
  focused,
  onSelect,
  gradPhase,
  items = MODE_ITEMS,
}: {
  focused: Mode | 'arcade'
  onSelect: (m: Mode | 'arcade') => void
  gradPhase: SharedValue<number>
  items?: (Mode | 'arcade')[]
}) {
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
    <View className="mb-3 items-center" style={{ paddingTop: 8 }}>
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
                  style={{ color: isActive ? '#FFFFFF' : MODE_GRADIENT.arcade[0] }}
                >
                  {ARCADE_TEASER.label}
                </Text>
                {/* SOON badge — top-right corner */}
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: '#E5534B',
                    borderRadius: 5,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    selectable={false}
                    style={{
                      color: '#FFFFFF',
                      fontSize: 7,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    {ARCADE_TEASER.tag}
                  </Text>
                </View>
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
                style={{ color: isActive ? '#FFFFFF' : MODE_GRADIENT[m][0] }}
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
