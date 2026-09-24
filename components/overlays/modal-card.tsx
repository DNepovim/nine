import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { MenuButton } from '@/components/game/menu-button'
import { SPECTRUM } from '@/constants/colors'
import { LAYER } from '@/constants/layers'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'

// The gradient is a padded backdrop with the card on top, which is how you get a
// gradient border without borderImage — unsupported in React Native.
const BORDER = 2
const RADIUS = 26

// Arriving: the card rises the last bit of the way into the middle as it fades up, so it
// reads as coming forward rather than being switched on. It leaves by shrinking instead —
// an entrance played backwards would look like a mistake.
const ENTER_MS = 260
const ENTER_OFFSET = 18
const EXIT_MS = 160

// Every dialog in the app: the scrim, the spectrum edge, the surface card, the header
// with its 5-dot close, and the way all of it arrives and leaves.
//
// One component because four screens had grown their own copy of it, and the copies had
// already drifted — the install dialog rose into place while the news and feedback ones
// simply appeared, which read as two different apps depending on which one you opened.
//
// `children` is a function rather than a node because a dialog usually has a second way
// out: a GOT IT button, a sent message, an install that closes behind itself. Handing the
// same `close` down means those paths play the exit animation instead of unmounting
// under it.
export function ModalCard({
  title,
  titleColor,
  icon,
  onDismiss,
  maxHeight,
  children,
}: {
  // Left off by a dialog whose subject names itself — the profile card, whose first
  // line is the player's own nickname. The header row keeps its height either way: the
  // close button is the taller of the two things in it.
  title?: ReactNode
  // A dialog that speaks for the run it was opened from wears that mode's colour here;
  // the rest sit back in dim, which is what makes the coloured one read as particular.
  titleColor?: string
  // Drawn before the title, for a dialog whose subject has a mark of its own.
  icon?: ReactNode
  // Called once the exit animation has finished, never at the moment it starts — this is
  // what unmounts the dialog, and unmounting it early is what the animation is for.
  onDismiss: () => void
  // A cap for a dialog whose content can run long, so it scrolls inside the card rather
  // than off the display. Left undefined by a dialog that is always short.
  maxHeight?: number
  children: (close: () => void) => ReactNode
}) {
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'
  const fade = useSharedValue(0)
  const scale = useSharedValue(1)
  const lift = useSharedValue(ENTER_OFFSET)
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }))

  useEffect(() => {
    fade.value = withTiming(1, { duration: ENTER_MS })
    lift.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) })
  }, [])

  const close = () => {
    fade.value = withTiming(0, { duration: EXIT_MS })
    scale.value = withTiming(
      0.92,
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet'
        if (finished === true) scheduleOnRN(onDismiss)
      },
    )
  }

  return (
    <Animated.View
      className="absolute inset-0 items-center justify-center px-4"
      style={[
        { zIndex: LAYER.dialog, backgroundColor: 'rgba(10,10,18,0.55)' },
        fadeStyle,
      ]}
    >
      <Animated.View style={[{ width: '90%', maxWidth: 460 }, cardStyle]}>
        <LinearGradient
          colors={[...SPECTRUM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: RADIUS, padding: BORDER, maxHeight }}
        >
          <View
            className="bg-surface px-5 pb-5 pt-4"
            style={{ borderRadius: RADIUS - BORDER, flexShrink: 1 }}
          >
            <View className="mb-1 flex-row items-center justify-between">
              {/* Kept even when empty: it is what holds the close button over on the
                  right, and `justify-between` with one child would put it on the left. */}
              <View className="flex-row items-center gap-1.5">
                {icon}
                {title !== undefined && (
                  <Text
                    selectable={false}
                    className={cn(
                      'font-mono text-[11px] font-bold tracking-[2px]',
                      titleColor === undefined && 'text-dim',
                    )}
                    style={titleColor === undefined ? undefined : { color: titleColor }}
                  >
                    {title}
                  </Text>
                )}
              </View>
              {/* The same 5-dot cross the pause screen closes with, unlabelled — a
                  dialog header already reads as one. */}
              <MenuButton showLabel={false} onToggle={close} color={dotColor} />
            </View>
            {children(close)}
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  )
}
