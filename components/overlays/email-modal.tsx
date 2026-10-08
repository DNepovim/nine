import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useOnline } from '@/hooks/use-online'
import {
  addressProblem,
  EMAIL_PROBLEM_LINES,
  type EmailProblem,
} from '@/lib/account-email'
import { cn } from '@/lib/cn'

// One field, and it does not ask the player what they mean by it.
//
// There used to be two of these — one for putting an address on this profile, one for
// fetching a profile back from an address — and the player had to know which they wanted
// before they had typed anything. They are the same act: *this is me*. Which of the two it
// turns out to be is the server's answer, not a question, and it is answered on the card
// after this one.
export function EmailModal({
  // What the field starts with: empty, or the address the player is coming back to fix.
  // Read once, as the initial value — this card owns what is typed in it from then on.
  typed,
  // Resolves once the request has landed. The parent is what moves on to the code card —
  // this one only ever reports what happened.
  onSend,
  onDismiss,
}: {
  typed: string
  onSend: (address: string) => Promise<{ error: EmailProblem | null }>
  onDismiss: () => void
}) {
  // `t` rather than <Trans>: a placeholder takes a string, not a node, and so does a line
  // read out of a value map.
  const { t } = useLingui()
  const online = useOnline()
  const [value, setValue] = useState(typed)
  const [problem, setProblem] = useState<EmailProblem | null>(null)
  const [sending, setSending] = useState(false)

  // Nothing here can be done offline — an address is checked and a code is sent by the
  // server, both of them — so SEND dims and the line underneath says why, rather than
  // letting a player type an address and meet a failure at the end of it. The same trade
  // the nickname card makes, for the same reason. Dismissing always works.
  const canSend = online && !sending

  const handleSend = async () => {
    if (!canSend) return
    const local = addressProblem(value)
    if (local !== null) {
      setProblem(local)
      return
    }
    setSending(true)
    const res = await onSend(value)
    setSending(false)
    setProblem(res.error)
  }

  return (
    <>
      {/* The question this answers is the dialog's own title — see `EmailDialog`. */}
      <Text
        selectable={false}
        className={cn(TYPE.hint, 'mb-4 mt-2 leading-[15px] text-dim')}
      >
        <Trans>So you can get your profile back on another phone.</Trans>
      </Text>

      <TextInput
        value={value}
        onChangeText={(next) => {
          setValue(next)
          setProblem(null)
        }}
        placeholder={t`you@example.com`}
        placeholderTextColor={DIM_INK}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => {
          void handleSend()
        }}
        className="mb-2 rounded-lg border border-dim/30 bg-card px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        // Mobile Safari zooms the whole page in on focus for any input under 16px —
        // the one web quirk with no CSS opt-out, only a bigger font. Native has no
        // such behaviour, so it keeps the smaller size the rest of the card uses.
        // Same trade the nickname card's input makes.
        style={{ fontSize: Platform.OS === 'web' ? 16 : 13 }}
      />

      {problem !== null && (
        <Text selectable={false} className={cn(TYPE.hint, 'mb-3 text-red-500')}>
          {t(EMAIL_PROBLEM_LINES[problem])}
        </Text>
      )}

      {problem === null && !online && (
        <Text selectable={false} className={cn(TYPE.hint, 'mb-3 text-dim')}>
          <Trans>No connection — a code can only be sent online.</Trans>
        </Text>
      )}

      {/* The promise, on every card that asks for an address and in the same words
              each time. It is the only reason a player has to hand one over at all, and a
              line that appeared on the first card and not the third would read as a
              promise that had quietly stopped applying. */}
      <Text
        selectable={false}
        className={cn(TYPE.caption, 'mb-1 leading-[12px] text-dim')}
      >
        <Trans>
          Only ever used to get your profile back. No newsletters, no offers, nothing else
          — ever.
        </Trans>
      </Text>

      <View className="mt-2 flex-row gap-3">
        <TrackedPressable
          id="email.cancel"
          onPress={onDismiss}
          className="flex-1 items-center rounded-xl bg-card py-3"
        >
          <Text selectable={false} className={cn(TYPE.buttonSm, 'text-dim')}>
            <Trans>CANCEL</Trans>
          </Text>
        </TrackedPressable>

        <TrackedPressable
          id="email.send"
          onPress={() => {
            void handleSend()
          }}
          disabled={!canSend}
          className="flex-1 items-center rounded-xl bg-primary py-3"
          style={{ opacity: canSend ? 1 : 0.5 }}
        >
          <Text selectable={false} className={cn(TYPE.buttonSm, 'text-on-strong')}>
            {sending ? <Trans>SENDING…</Trans> : <Trans>SEND CODE</Trans>}
          </Text>
        </TrackedPressable>
      </View>
    </>
  )
}
