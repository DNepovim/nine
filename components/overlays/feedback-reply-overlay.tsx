import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { MarkdownText } from '@/components/markdown-text'
import { ModalCard } from '@/components/overlays/modal-card'
import { useViewport } from '@/hooks/use-viewport'
import { sentOnLabel, type FeedbackQuote } from '@/lib/feedback-reply'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

// A message is capped at 800 characters, which is a screen of text on its own. Three
// lines is enough to recognise what you wrote without the quote outgrowing the answer to
// it — this is a reminder, not the content of the dialog.
const QUOTE_LINES = 3

// The player's own words, dated, above the answer.
//
// Not inside the ScrollView with the answer: the quote is what the answer is *about*, and
// a reader scrolling a long reply should not lose the question halfway down. Clamped
// instead, which is the price of keeping it fixed.
//
// Quiet on purpose. The whole block sits one step below the answer on `dim`, with a
// `muted` rule down the left instead of quote marks — `muted` is a hairline colour and
// carries no text here, which is what `global.css` says it is for. Date and message are
// told apart by the app's small-label voice rather than by ink: 10px bold and tracked
// against 11px italic. Nothing takes the mode colour either — the card's title and the
// answer's accent already carry it, and a third accented thing would make the quote
// compete with the reply for the eye.
function QuotedMessage({ quote, locale }: { quote: FeedbackQuote; locale: string }) {
  return (
    <View className="mb-4 border-l-2 border-muted pl-3">
      <Text
        selectable={false}
        className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {sentOnLabel(quote.sentAt, locale)}
      </Text>
      <Text
        selectable={false}
        numberOfLines={QUOTE_LINES}
        className="font-mono text-[11px] italic leading-4 text-dim"
      >
        {quote.message}
      </Text>
    </View>
  )
}

// The answer to something the player wrote, on the launch after it was written.
//
// It wears the mode colour and the chatbox mark for the same reason the FEEDBACK tab and
// the FEEDBACK dialog do — not because a reply belongs to a mode, but because those two
// are where this conversation started, and a reply that looked like a different part of
// the app would not read as the end of it.
//
// The message comes back over the wire with the answer and is quoted above it. It used to
// not: the dialog showed the answer alone and carried a TO SOMETHING YOU SENT label
// instead, which named the problem without solving it. A reply lands weeks after the
// message, on a launch the player did not connect to anything they wrote, and by then
// "something you sent" is a riddle. The label is gone because the quote says the same
// thing and says it exactly.
//
// The quote is still optional — `quote` is null against a database without the migration
// — so the label's absence must not leave a hole. It does not: the answer simply starts
// at the top of the card, which is where it started before any of this.
//
// Markdown, like an announcement body: a long answer is easier to read as a couple of
// bullets, and the renderer is already here.
export function FeedbackReplyOverlay({
  gameMode,
  answer,
  quote,
  onDismiss,
}: {
  gameMode: Mode
  answer: string
  quote: FeedbackQuote | null
  onDismiss: () => void
}) {
  const { height } = useViewport()
  const { i18n } = useLingui()
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
          {quote !== null && <QuotedMessage quote={quote} locale={i18n.locale} />}

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
