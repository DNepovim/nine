import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { isNonEmptyString, isOneOf } from 'narrowland'
import { useState } from 'react'
import { Platform, Pressable, Text, TextInput } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { DIM_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'
import { MAX_FEEDBACK_LENGTH } from '@/lib/feedback-outcome'
import { submitFeedback } from '@/lib/feedback-submission'
import { MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

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
  gameState,
  onClose,
}: {
  gameMode: Mode
  difficulty: Difficulty
  score: number
  // The paused run behind this dialog, from `gameSnapshot` — see lib/feedback-state.ts.
  // Null everywhere else, and the dialog says which of the two it is holding. Opaque
  // here: it is carried to the row, never read.
  gameState: unknown
  onClose: () => void
}) {
  // `t` rather than <Trans>: a TextInput placeholder takes a string, not a node.
  const { t } = useLingui()
  const { colorScheme } = useTheme()
  const modeColor = MODE_GRADIENT[gameMode][0]
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

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
    setStatus(
      await submitFeedback({
        message,
        mode: gameMode,
        difficulty,
        score,
        gameState,
      }),
    )
  }

  return (
    <ModalCard
      title={<Trans>FEEDBACK</Trans>}
      titleColor={modeColor}
      icon={<Ionicons name="chatbox-outline" size={14} color={modeColor} />}
      onDismiss={onClose}
    >
      {(close) => (
        <>
          {status === 'sent' ? (
            <>
              <Text
                selectable={false}
                className="mb-2 font-mono text-[16px] font-black tracking-[2px] text-primary"
              >
                <Trans>THANK YOU</Trans>
              </Text>
              <Text
                selectable={false}
                className="mb-6 font-mono text-[12px] leading-[19px] text-dim"
              >
                <Trans>
                  It went straight to the person who makes this. No reply to expect — but
                  it is read.
                </Trans>
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
              {/* What goes with the message, said plainly — and it changes with where
                    the dialog was opened from, because from the pause screen the run
                    itself goes too. A line that named only the three would be describing
                    a smaller thing than is actually sent. */}
              <Text
                selectable={false}
                className="mb-4 font-mono text-[11px] leading-[18px] text-dim"
              >
                {gameState === null ? (
                  <Trans>
                    Anything at all — what broke, what annoyed you, what you wish it did.
                    The mode, difficulty and score you are on go with it.
                  </Trans>
                ) : (
                  <Trans>
                    Anything at all — what broke, what annoyed you, what you wish it did.
                    The mode, difficulty and score you are on go with it, and so does the
                    run you have paused.
                  </Trans>
                )}
              </Text>

              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                editable={status !== 'sending'}
                maxLength={MAX_FEEDBACK_LENGTH}
                placeholder={t`Type here`}
                placeholderTextColor={DIM_INK[colorScheme]}
                className="mb-4 h-32 w-full rounded-2xl border border-muted bg-card p-3 font-mono leading-[18px] text-primary"
                // Mobile Safari zooms the whole page in on focus for any input under
                // 16px — the one web quirk with no CSS opt-out, only a bigger font.
                // Native has no such behaviour, so it keeps the smaller size the rest
                // of the sheet uses.
                style={{
                  textAlignVertical: 'top',
                  fontSize: Platform.OS === 'web' ? 16 : 12,
                }}
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
        </>
      )}
    </ModalCard>
  )
}
