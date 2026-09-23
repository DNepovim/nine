import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Pressable, ScrollView, Text } from 'react-native'

import { MarkdownText } from '@/components/markdown-text'
import { ModalCard } from '@/components/overlays/modal-card'
import { useViewport } from '@/hooks/use-viewport'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

// The answer to something the player wrote, on the launch after it was written.
//
// It wears the mode colour and the chatbox mark for the same reason the FEEDBACK tab and
// the FEEDBACK dialog do — not because a reply belongs to a mode, but because those two
// are where this conversation started, and a reply that looked like a different part of
// the app would not read as the end of it.
//
// Only the answer is shown. The message it answers is weeks old and never comes back over
// the wire (`my_feedback_replies` does not return it), so the answer has to stand on its
// own — which is a thing to remember while writing one, not a thing the dialog can fix.
//
// Markdown, like an announcement body: a long answer is easier to read as a couple of
// bullets, and the renderer is already here.
export function FeedbackReplyOverlay({
  gameMode,
  answer,
  onDismiss,
}: {
  gameMode: Mode
  answer: string
  onDismiss: () => void
}) {
  const { height } = useViewport()
  const modeColor = MODE_GRADIENT[gameMode][0]

  return (
    <ModalCard
      title={<Trans>A REPLY</Trans>}
      titleColor={modeColor}
      icon={<Ionicons name="chatbox-ellipses-outline" size={14} color={modeColor} />}
      onDismiss={onDismiss}
      maxHeight={height * 0.85}
    >
      {(close) => (
        <>
          <Text
            selectable={false}
            className="mb-3 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>TO SOMETHING YOU SENT</Trans>
          </Text>

          {/* flexShrink lets a long answer scroll while a short one keeps its own
              height — without it the ScrollView would claim the whole cap. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
          >
            <MarkdownText source={answer} accent={modeColor} />
          </ScrollView>

          <Pressable
            onPress={close}
            className="mt-5 items-center rounded-2xl bg-strong py-3.5"
          >
            <Text
              selectable={false}
              className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
            >
              <Trans>GOT IT</Trans>
            </Text>
          </Pressable>
        </>
      )}
    </ModalCard>
  )
}
