import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { isNonEmptyString, isOneOf } from 'narrowland'
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
import { cn } from '@/lib/cn'
import { MAX_FEEDBACK_LENGTH } from '@/lib/feedback-outcome'
import { submitFeedback } from '@/lib/feedback-submission'
import { MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

// The same dialog dress as the what's-new popup — gradient edge, surface card,
// dot-menu close — so the two read as one family of interruptions.
const BORDER = 2
const RADIUS = 26
const EXIT_MS = 160

// Where the send got to. The two failures are separate states rather than one `error`
// because they ask different things of the player: a lost connection is worth the same
// message again in a minute, a refusal is not.
type Status = 'idle' | 'sending' | 'sent' | 'offline' | 'refused'

const BUTTON_LABEL = {
  idle: 'SEND',
  sending: 'SENDING',
  sent: 'DONE',
  offline: 'TRY AGAIN',
  refused: 'TRY AGAIN',
} as const satisfies Record<Status, string>

// Both of these say the same thing first — nothing was sent — because that is the part
// the old dialog got wrong, and the part a player needs in order to know their message is
// still theirs to send.
const FAILURE_LINE = {
  offline:
    'No connection, so nothing was sent. The message is still here — try again once you are back.',
  refused: 'Something went wrong at our end and the message was not saved. Try again?',
} as const satisfies Record<'offline' | 'refused', string>

// A message from the player, sent with what they were looking at when they wrote it.
//
// The context is the point. "It froze" from an unknown board on an unknown build is a
// shrug; the same words next to Speed, Extreme, a score and a build id is something that
// can be looked into. All of it is already on screen — nothing is collected here that the
// player is not currently seeing.
//
// It writes a row and waits for the answer (`lib/feedback-submission.ts`). It used to
// fire a PostHog event, which cannot be awaited and cannot fail out loud, and so THANK
// YOU was printed whether or not anything left the device — including on native, where
// analytics is a no-op, and in any browser with an ad blocker, which is a good share of
// exactly the players who have something to report.
//
// No screenshot yet: capturing one means `react-native-view-shot` and somewhere to put
// the file, which is a Storage bucket and an upload path rather than a column.
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
  const modeColor = MODE_GRADIENT[gameMode][0]
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

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

  const canSend = isNonEmptyString(message.trim()) && status !== 'sending'
  const failureLine = isOneOf(status, ['offline', 'refused'])
    ? FAILURE_LINE[status]
    : null

  // `submitFeedback` answers with exactly the three states this can land in, so the
  // outcome of the write *is* what the dialog shows. There is no path from here to THANK
  // YOU that does not go through a row the server confirmed.
  const send = async () => {
    if (!canSend) return
    setStatus('sending')
    setStatus(await submitFeedback(message, gameMode, difficulty, score))
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
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="chatbox-outline" size={14} color={modeColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[11px] font-bold tracking-[2px]"
                  style={{ color: modeColor }}
                >
                  FEEDBACK
                </Text>
              </View>
              <MenuButton
                visible
                paused
                showLabel={false}
                onToggle={close}
                color={dotColor}
              />
            </View>

            {status === 'sent' ? (
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
                    {BUTTON_LABEL.sent}
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
                  editable={status !== 'sending'}
                  maxLength={MAX_FEEDBACK_LENGTH}
                  placeholder="Type here"
                  placeholderTextColor={colorScheme === 'dark' ? '#504e6e' : '#aaa69e'}
                  className="mb-4 h-32 w-full rounded-2xl border border-muted bg-card p-3 font-mono text-[12px] leading-[18px] text-primary"
                  style={{ textAlignVertical: 'top' }}
                />

                {failureLine !== null && (
                  <Text
                    selectable={false}
                    className="mb-3 font-mono text-[10px] font-bold leading-[16px] text-red-500"
                  >
                    {failureLine}
                  </Text>
                )}

                <Pressable
                  onPress={() => {
                    void send()
                  }}
                  disabled={!canSend}
                  className={cn(
                    'items-center rounded-2xl bg-strong py-3.5',
                    !canSend && 'opacity-[0.35]',
                  )}
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
                  >
                    {BUTTON_LABEL[status]}
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
