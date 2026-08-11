import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { MenuButton } from '@/components/game/menu-button'
import { InstallSteps } from '@/components/overlays/install-steps'
import { APP_VIOLET, SPECTRUM } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { InstallableTarget } from '@/types/install'

type IoniconName = keyof typeof Ionicons.glyphMap

// The what's-new shell: the gradient is a padded backdrop with the card on top,
// which is how you get a gradient border without borderImage — unsupported in
// React Native.
const BORDER = 2
const RADIUS = 26
const EXIT_MS = 160

const CTA_LABEL = {
  prompt: 'INSTALL',
  instructions: 'GOT IT',
} as const satisfies Record<InstallableTarget, string>

const CTA_ICON = {
  prompt: 'download-outline',
  instructions: 'checkmark',
} as const satisfies Record<InstallableTarget, IoniconName>

// Offers the home screen to a player who arrived in a mobile browser. Two
// bodies: a real install button where the browser gives us one, Safari's manual
// steps where it doesn't. `InstallableTarget` excludes 'none', so this can't be
// rendered with nothing to say.
export function InstallOverlay({
  target,
  onInstall,
  onDismiss,
}: {
  target: InstallableTarget
  onInstall: () => void
  onDismiss: () => void
}) {
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'
  const fade = useSharedValue(1)
  const scale = useSharedValue(1)
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  // Shrink away rather than blinking out. onDismiss unmounts us, so it waits
  // for the animation to finish.
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
          style={{ borderRadius: RADIUS, padding: BORDER }}
        >
          <View
            className="bg-surface px-5 pb-5 pt-4"
            style={{ borderRadius: RADIUS - BORDER }}
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text
                selectable={false}
                className="font-mono text-[11px] font-bold tracking-[2px] text-dim"
              >
                INSTALL
              </Text>
              <MenuButton
                visible
                paused
                showLabel={false}
                onToggle={close}
                color={dotColor}
              />
            </View>

            <View className="items-center pt-2">
              <View
                className="h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${APP_VIOLET}26` }}
              >
                <Ionicons name="phone-portrait-outline" size={30} color={APP_VIOLET} />
              </View>

              <Text
                selectable={false}
                className="mt-4 text-center font-mono text-[17px] font-black tracking-[2px]"
                style={{ color: APP_VIOLET }}
              >
                ADD TO HOME SCREEN
              </Text>

              <Text
                selectable={false}
                className="mt-2 text-center font-mono text-[12px] leading-[18px] text-dim"
              >
                Full screen, no browser bar, and it keeps working offline.
              </Text>
            </View>

            {target === 'instructions' && <InstallSteps />}

            <View className="mt-4 flex-row items-center justify-center">
              <Pressable
                onPress={() => {
                  // No exit animation on the install path: prompt() has to stay
                  // in the press to keep its user activation, and the browser's
                  // own dialog covers the card the moment it opens.
                  if (target === 'prompt') onInstall()
                  else close()
                }}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-strong px-6 py-3.5"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
                >
                  {CTA_LABEL[target]}
                </Text>
                <Ionicons name={CTA_ICON[target]} size={14} color="#d8d2f4" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  )
}
