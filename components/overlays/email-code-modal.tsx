import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import {
  CODE_LENGTH,
  codeProblem,
  cooldownRemaining,
  EMAIL_PROBLEM_LINES,
  type EmailBranch,
  type EmailProblem,
} from '@/lib/account-email'
import { cn } from '@/lib/cn'

// The one place the branch shows. Everything before this card is identical for both, which
// is the point of the merge; from here on they are different acts and the button has to say
// which one it is about to do.
const ACTIONS = {
  attach: msg`CONFIRM`,
  restore: msg`RESTORE PROFILE`,
} as const satisfies Record<EmailBranch, MessageDescriptor>

const BUSY_LABELS = {
  attach: msg`CONFIRMING…`,
  restore: msg`RESTORING…`,
} as const satisfies Record<EmailBranch, MessageDescriptor>

// How often the cooldown line is redrawn while it is counting. A second, because it counts
// in seconds — a faster tick would redraw the same number.
const TICK_MS = 1000

export function EmailCodeModal({
  // What the address turned out to mean — decided by the server when the code was asked
  // for, never by the player. See `sendCode`.
  branch,
  // Echoed back under the title. A player who mistyped their own address finds out here
  // rather than by waiting for a code that is never coming.
  address,
  // When the code that brought this card up was sent, or null when none was — which is
  // the case for a player reopening this days later off the intro's confirm line. Null
  // means the resend button is live immediately, because there is nothing to wait out.
  sentAt: initialSentAt,
  onConfirm,
  onResend,
  onDismiss,
}: {
  branch: EmailBranch
  address: string
  sentAt: number | null
  onConfirm: (code: string) => Promise<{ error: EmailProblem | null }>
  onResend: () => Promise<{ error: EmailProblem | null }>
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState<EmailProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(initialSentAt)
  // Read through a lazy initialiser rather than in the render path — the compiler is free
  // to take a clock read at a different moment than you meant it.
  const [now, setNow] = useState(() => Date.now())

  const waiting = cooldownRemaining(sentAt, now)

  // Only while there is something to count. An interval that ran for the life of the card
  // would be a render a second for a line that stopped changing thirty seconds ago.
  useEffect(() => {
    if (waiting === 0) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(timer)
    }
  }, [waiting])

  const ready = codeProblem(value) === null && !busy

  const handleConfirm = async () => {
    if (!ready) return
    setBusy(true)
    const res = await onConfirm(value)
    // Left busy on the way out of a restore: the app is about to boot, and a button that
    // came back to life for the half-second before it would invite a second press of
    // something that has already happened.
    if (res.error !== null) setBusy(false)
    setProblem(res.error)
  }

  const handleResend = async () => {
    if (waiting > 0 || busy) return
    setBusy(true)
    const res = await onResend()
    setBusy(false)
    setProblem(res.error)
    if (res.error === null) {
      setSentAt(Date.now())
      setNow(Date.now())
    }
  }

  return (
    <>
      <Text
        selectable={false}
        className="mb-1 font-mono text-[11px] font-black tracking-[2px] text-primary"
      >
        <Trans>DID IT REACH YOU?</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-4 font-mono text-[9px] font-bold tracking-[0.5px] text-dim"
      >
        <Trans>We sent six digits to {address}. They are good for ten minutes.</Trans>
      </Text>

      <TextInput
        value={value}
        onChangeText={(next) => {
          setValue(next.replace(/\D/gu, '').slice(0, CODE_LENGTH))
          setProblem(null)
        }}
        placeholder="000000"
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        // What makes this a field rather than a keypad: the phone offers the code from
        // the notification itself, and a code that has been pasted out of the email is
        // a code nobody had to copy down. A keypad of our own forbids both.
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleConfirm()
        }}
        className="mb-2 rounded-lg border border-dim/30 bg-background px-3 py-2 text-center font-mono font-black tracking-[8px] text-primary"
        // Bigger than the address field and bigger than the web's 16px floor: six
        // digits is the whole of what this card is for, and they are read back against
        // an email to check them.
        style={{ fontSize: 22 }}
      />

      {problem !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[9px] font-bold tracking-[0.5px] text-red-500"
        >
          {t(EMAIL_PROBLEM_LINES[problem])}
        </Text>
      )}

      <TrackedPressable
        id="email_code.resend"
        onPress={() => {
          void handleResend()
        }}
        disabled={waiting > 0 || busy}
        hitSlop={8}
        className="mb-3 self-start"
      >
        <Text
          selectable={false}
          className={cn(
            'font-mono text-[9px] font-bold tracking-[1.5px] text-dim',
            waiting === 0 && !busy && 'underline',
          )}
        >
          {waiting > 0 ? (
            <Trans>SEND ANOTHER IN {waiting}S</Trans>
          ) : (
            <Trans>SEND ANOTHER</Trans>
          )}
        </Text>
      </TrackedPressable>

      {/* Why this card is suddenly about a restore when the player only typed their
              address. It has to come before the warning, not after: the warning is alarming
              out of nowhere, and this is the sentence that makes it make sense. */}
      {branch === 'restore' && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[9px] font-bold leading-[14px] tracking-[0.5px] text-dim"
        >
          <Trans>
            This address already has a profile — almost certainly yours. The code brings
            it here.
          </Trans>
        </Text>
      )}

      {/* What a restore costs, before it is paid rather than after. Both halves are
              worth saying: one is about the phone this profile is leaving, which the player
              may still be using, and the other is about whatever they have played here
              under the name they are about to stop being.

              Not dim. Every other small line on this card is something the player may skim;
              this is the one they have to have read. */}
      {branch === 'restore' && (
        <View className="mb-3 rounded-lg border border-dim/30 px-3 py-2">
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold leading-[14px] tracking-[0.5px] text-primary"
          >
            <Trans>
              A profile lives on one device. Restoring it here takes it off the phone it
              is on now — and anything played on this phone under another name stays
              behind.
            </Trans>
          </Text>
        </View>
      )}

      <View className="mt-1 flex-row gap-3">
        <TrackedPressable
          id="email_code.cancel"
          onPress={onDismiss}
          className="flex-1 items-center rounded-xl bg-card py-3"
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
          >
            <Trans>CANCEL</Trans>
          </Text>
        </TrackedPressable>

        <TrackedPressable
          id="email_code.confirm"
          onPress={() => {
            void handleConfirm()
          }}
          disabled={!ready}
          className="flex-1 items-center rounded-xl bg-primary py-3"
          style={{ opacity: ready ? 1 : 0.5 }}
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
          >
            {busy ? t(BUSY_LABELS[branch]) : t(ACTIONS[branch])}
          </Text>
        </TrackedPressable>
      </View>
    </>
  )
}
