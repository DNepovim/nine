import { useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { CornerBadge } from '@/components/overlays/corner-badge'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import {
  ARCADE_TEASER,
  descriptionOf,
  gradientOf,
  labelOf,
  MODE_ORDER,
  type ModeId,
} from '@/modes'

const MODE_ITEMS: ModeId[] = [...MODE_ORDER, 'arcade']

export function ModeSelector({
  focused,
  onSelect,
  gradPhase,
  items = MODE_ITEMS,
  // Overrides a mode's own pair per key — multiplayer's waiting room and results pass
  // their own accuracy/speed pair here rather than the singleplayer one, leaving every
  // other mode (never in a multiplayer item list) on its own.
  gradient,
  // Which stop of the (possibly overridden) pair labels an inactive tab. 0 for
  // singleplayer, where each mode's own start stop already tells the tabs apart.
  // Multiplayer's pair shares its start stop across both modes, so it passes 1 —
  // the dominant stop borrowed from singleplayer — to keep the tabs distinguishable
  // before either is tapped.
  accentIndex = 0,
  // What a pill's corner says, by mode. Arcade is the one that has one today — SOON for
  // a player, who cannot press it into anything, and DEV for whoever holds the flag that
  // makes it playable (see constants/features.ts) — and a challenge, which is only on the
  // app for a day, is the obvious next one.
  badges = { arcade: ARCADE_TEASER.tag },
}: {
  focused: ModeId
  onSelect: (m: ModeId) => void
  gradPhase: SharedValue<number>
  items?: ModeId[]
  gradient?: Partial<Record<string, readonly [string, string]>>
  accentIndex?: 0 | 1
  badges?: Partial<Record<string, string>>
}) {
  const { t } = useLingui()
  const pillColors = (f: ModeId): [string, string] =>
    (gradient?.[f] ?? gradientOf(f)) as [string, string]

  const tabLayouts = useRef<{ x: number; width: number }[]>([])
  const bgLeft = useSharedValue(-999)
  const bgRight = useSharedValue(-999)
  const [fromColors, setFromColors] = useState<[string, string]>(() =>
    pillColors(focused),
  )
  const [toColors, setToColors] = useState<[string, string]>(() => pillColors(focused))
  const prevFocusedRef = useRef<ModeId>(focused)
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
          const badge = badges[m]
          return (
            <TrackedPressable
              id="menu.mode"
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
              // Tighter than the text wants on its own — the pill behind the tabs takes
              // its height from this padding, and a shorter pill leaves the intro's stack
              // of rows room to breathe. hitSlop puts back the touch the padding no
              // longer provides.
              className="px-2 py-1"
              hitSlop={{ top: 6, bottom: 6 }}
              // A pill wearing a corner badge is dimmed while it is not the focused one,
              // which is what says it is not quite an ordinary choice yet.
              style={!isActive && badge !== undefined ? { opacity: 0.6 } : undefined}
            >
              <Text
                selectable={false}
                className={TYPE.buttonSm}
                style={{ color: isActive ? '#FFFFFF' : pillColors(m)[accentIndex] }}
              >
                {t(labelOf(m))}
              </Text>
              {badge !== undefined && <CornerBadge label={badge} />}
            </TrackedPressable>
          )
        })}
      </View>
      <Text
        selectable={false}
        className={cn(TYPE.value, 'mt-2 px-8 text-center text-dim leading-4')}
      >
        {t(descriptionOf(focused))}
      </Text>
    </View>
  )
}
