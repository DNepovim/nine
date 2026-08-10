import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { MenuButton } from '@/components/game/menu-button'
import { NewsCard } from '@/components/overlays/news-card'
import { PageDots } from '@/components/page-dots'
import { SPECTRUM } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'
import type { NewsItem } from '@/types/news'

// Thickness of the gradient edge. The gradient is a padded backdrop and the
// card sits on top of it, which is how you get a gradient border without
// borderImage — unsupported in React Native.
const BORDER = 2
const RADIUS = 26
const EXIT_MS = 160

// A dialog, not a screen: as tall as its content, capped so a long announcement
// scrolls rather than running off the display.
export function WhatsNewOverlay({
  items,
  onDismiss,
}: {
  items: readonly NewsItem[]
  onDismiss: () => void
}) {
  const [index, setIndex] = useState(0)
  const { height } = useWindowDimensions()
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'
  const fade = useSharedValue(1)
  const scale = useSharedValue(1)
  // Declared before the early return below — bailing out first would make these
  // conditional hooks and desync the hook order on a later render.
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const item = items[index]
  if (item === undefined) return null

  const isFirst = index === 0
  const isLast = index === items.length - 1

  // Shrink away rather than blinking out. onDismiss unmounts us, so it has to
  // wait for the animation to finish.
  const close = () => {
    fade.value = withTiming(0, { duration: EXIT_MS })
    scale.value = withTiming(
      0.92,
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet'
        if (finished) scheduleOnRN(onDismiss)
      },
    )
  }

  return (
    <Animated.View
      className="absolute inset-0 items-center justify-center px-4"
      style={[{ zIndex: 40, backgroundColor: 'rgba(10,10,18,0.55)' }, fadeStyle]}
    >
      <Animated.View style={[{ width: '90%', maxWidth: 460 }, cardStyle]}>
        <LinearGradient
          colors={[...SPECTRUM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ maxHeight: height * 0.85, borderRadius: RADIUS, padding: BORDER }}
        >
          <View
            className="bg-surface px-5 pb-5 pt-4"
            style={{ borderRadius: RADIUS - BORDER, flexShrink: 1 }}
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text
                selectable={false}
                className="font-mono text-[11px] font-bold tracking-[2px] text-dim"
              >
                WHAT’S NEW
              </Text>
              {/* The same 5-dot cross the pause screen closes with, unlabelled
                  — a dialog header already reads as one. */}
              <MenuButton
                visible
                paused
                showLabel={false}
                onToggle={close}
                color={dotColor}
              />
            </View>

            {/* flexShrink lets a long body scroll while a short one stays its own
                height — without it the ScrollView would claim the whole cap. */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingVertical: 8 }}
            >
              <NewsCard item={item} />
            </ScrollView>

            {items.length > 1 && (
              <PageDots
                total={items.length}
                current={index}
                color={item.accent}
                onSelect={setIndex}
              />
            )}

            <View className="mt-3 flex-row items-center justify-center gap-3">
              {items.length > 1 && (
                <Pressable
                  onPress={() => {
                    setIndex((current) => current - 1)
                  }}
                  disabled={isFirst}
                  className={cn(
                    'flex-row items-center gap-1 rounded-2xl bg-card px-4 py-3.5',
                    isFirst && 'opacity-[0.3]',
                  )}
                >
                  <Ionicons name="arrow-back" size={14} color="#aaa69e" />
                  <Text
                    selectable={false}
                    className="font-mono text-[12px] font-black tracking-[1.5px] text-dim"
                  >
                    BACK
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  if (isLast) close()
                  else setIndex((current) => current + 1)
                }}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-strong px-6 py-3.5"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
                >
                  {isLast ? 'LET’S GO' : 'NEXT'}
                </Text>
                <Ionicons
                  name={isLast ? 'play' : 'arrow-forward'}
                  size={14}
                  color="#d8d2f4"
                />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  )
}
