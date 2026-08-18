import { LinearGradient } from 'expo-linear-gradient'
import { isNonEmptyString } from 'narrowland'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { MenuButton } from '@/components/game/menu-button'
import { SPECTRUM } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { track } from '@/lib/analytics'
import { BUILD_ID } from '@/lib/analytics-events'
import type { Difficulty, Mode } from '@/machines/game'

// The same dialog dress as the what's-new popup — gradient edge, surface card,
// dot-menu close — so the two read as one family of interruptions.
const BORDER = 2
const RADIUS = 26
const EXIT_MS = 160

const MAX_LENGTH = 800

// A message from the player, sent with what they were looking at when they wrote it.
//
// The context is the point. "It froze" from an unknown board on an unknown build is a
// shrug; the same words next to Speed, Extreme, a score and a build id is something that
// can be looked into. All of it is already on screen — nothing is collected here that the
// player is not currently seeing.
//
// No screenshot yet: capturing one means `react-native-view-shot` and somewhere to put
// the file, which is a Storage bucket and an upload path rather than an event property.
export function FeedbackOverlay({
  gameMode,
  difficulty,
  score,
  onClose,
}: {
  gameMode: Mode
  difficulty: Difficulty
  score: number
  onClose: () => void
}) {
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const fade = useSharedValue(1)
  const scale = useSharedValue(1)
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  // Shrink away rather than blinking out — the same exit as the what's-new dialog.
  // onClose unmounts us, so it has to wait for the animation to finish.
  const close = () => {
    fade.value = withTiming(0, { duration: EXIT_MS })
    scale.value = withTiming(
      0.92,
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet'
        if (finished) scheduleOnRN(onClose)
      },
    )
  }

  const send = () => {
    if (!isNonEmptyString(message.trim())) return
    track('feedback_submitted', {
      message: message.trim().slice(0, MAX_LENGTH),
      mode: gameMode,
      difficulty,
      score,
      build: BUILD_ID,
    })
    setSent(true)
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
            <View className="mb-3 flex-row items-center justify-between">
              <Text
                selectable={false}
                className="font-mono text-[11px] font-bold tracking-[2px] text-dim"
              >
                FEEDBACK
              </Text>
              <MenuButton
                visible
                paused
                showLabel={false}
                onToggle={close}
                color={dotColor}
              />
            </View>

            {sent ? (
              <>
                <Text
                  selectable={false}
                  className="mb-2 font-mono text-[16px] font-black tracking-[2px] text-primary"
                >
                  THANK YOU
                </Text>
                <Text
                  selectable={false}
                  className="mb-6 font-mono text-[12px] leading-[19px] text-dim"
                >
                  It went straight to the person who makes this. No reply to expect — but
                  it is read.
                </Text>
                <Pressable
                  onPress={close}
                  className="items-center rounded-2xl bg-strong py-3.5"
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
                  >
                    DONE
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text
                  selectable={false}
                  className="mb-4 font-mono text-[11px] leading-[18px] text-dim"
                >
                  Anything at all — what broke, what annoyed you, what you wish it did.
                  The mode, difficulty and score you are on go with it.
                </Text>

                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={MAX_LENGTH}
                  placeholder="Type here"
                  placeholderTextColor={colorScheme === 'dark' ? '#504e6e' : '#aaa69e'}
                  className="mb-4 h-32 w-full rounded-2xl border border-muted bg-card p-3 font-mono text-[12px] leading-[18px] text-primary"
                  style={{ textAlignVertical: 'top' }}
                />

                <Pressable
                  onPress={send}
                  disabled={!isNonEmptyString(message.trim())}
                  className="items-center rounded-2xl bg-strong py-3.5"
                  style={{ opacity: isNonEmptyString(message.trim()) ? 1 : 0.35 }}
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
                  >
                    SEND
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  )
}
