import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { PrimaryButton } from '@/components/primary-button'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import type { AdminMessage } from '@/lib/admin/feedback'
import { cn } from '@/lib/cn'
import { MAX_FEEDBACK_LENGTH } from '@/lib/feedback-outcome'

// Writing the reply.
//
// A dialog rather than a field under the row: an answer is up to 800 characters and the
// row it belongs to is two lines in a list, so a field there would push every other
// message off the screen while it was being typed. `AdminDialog` is the window every
// dialog on these screens uses — a platform modal, raised from inside a scrolling pane.
//
// The draft opens on whatever answer the message already carries, because the second
// reason to open this is to correct the first answer. Re-writing one re-sends it: the
// trigger on the column clears `answer_seen_at`, which is deliberate and is why the
// button below says so.
export function AdminAnswerDialog({
  message,
  busy,
  onSend,
  onDismiss,
}: {
  message: AdminMessage
  busy: boolean
  // Answers whether the server took it, so a refusal keeps both the dialog and the draft
  // — retyping a paragraph is the one thing the writer must not be asked to do.
  onSend: (answer: string) => Promise<boolean>
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const [draft, setDraft] = useState(message.answer ?? '')
  const text = draft.trim()
  const again = message.answer !== null

  return (
    <AdminDialog
      title={again ? <Trans>REWRITE THE ANSWER</Trans> : <Trans>ANSWER</Trans>}
      onDismiss={onDismiss}
      // Held against the answer it opened on, not against empty: reopening an answer to
      // read it and tapping away throws nothing away.
      held={draft !== (message.answer ?? '')}
    >
      <View>
        {/* What is being answered, above the field. The list is behind a scrim by now,
            and an answer written without the question in front of you is how a reply
            comes to address the wrong half of a long message. */}
        <Text
          selectable={false}
          numberOfLines={4}
          className={cn(TYPE.value, 'mb-2.5 text-dim')}
        >
          {message.message}
        </Text>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          editable={!busy}
          maxLength={MAX_FEEDBACK_LENGTH}
          placeholder={t`Type the answer`}
          placeholderTextColor={DIM_INK}
          autoFocus
          className="h-28 w-full rounded-xl border border-muted bg-elevated p-2.5 font-mono leading-[18px] text-primary"
          // Mobile Safari zooms the page in on focus for any input under 16px, with no
          // CSS opt-out — the same exception the player's own feedback field makes.
          style={{
            textAlignVertical: 'top',
            fontSize: Platform.OS === 'web' ? 16 : 12,
          }}
        />

        {again && (
          // Said before the press rather than after it: a correction is delivered again,
          // which is the point of allowing one and also the cost of an idle edit.
          <Text selectable={false} className={cn(TYPE.hint, 'mt-1.5 text-dim')}>
            <Trans>Sending again — the player sees this reply once more.</Trans>
          </Text>
        )}

        <PrimaryButton
          id="admin.message_answer"
          className="mt-3"
          disabled={busy || text === ''}
          onPress={() => {
            void (async () => {
              if (await onSend(text)) onDismiss()
            })()
          }}
          label={again ? <Trans>SEND AGAIN</Trans> : <Trans>SEND</Trans>}
        />
      </View>
    </AdminDialog>
  )
}
