import { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { CodeCells } from '@/components/overlays/code-cells'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
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

// Which problems are the code's own, and so the ones the frames go red for. The others are
// about the request rather than about what was typed: nothing is wrong with six digits that
// never left the phone, and reddening them would tell the player to go and find a new code
// when what they need is a connection.
const CODE_FAULTS: readonly EmailProblem[] = ['bad_code', 'expired']

// How far a link fades once it cannot be pressed. The same weight the card's own buttons
// dim by, so a dead link and a dead button read as the same state.
const DISABLED_OPACITY = 0.5

export function EmailCodeModal({
  // What the address turned out to mean — decided by the server when the code was asked
  // for, never by the player. See `sendCode`.
  branch,
  // Echoed back under the title, and in bold: it is the one thing on this card the player
  // has to check, because a mistyped address is the likeliest reason nothing arrived.
  address,
  // When the code that brought this card up was sent, or null when none was — which is
  // the case for a player reopening this days later off the intro's confirm line. Null
  // means the resend button is live immediately, because there is nothing to wait out.
  sentAt: initialSentAt,
  onConfirm,
  onResend,
  // Back to the field, with this address in it. Not the same as dismissing: a player who
  // mistyped their address is not finished, they are one character from being finished.
  onEditAddress,
  onDismiss,
}: {
  branch: EmailBranch
  address: string
  sentAt: number | null
  onConfirm: (code: string) => Promise<{ error: EmailProblem | null }>
  onResend: () => Promise<{ error: EmailProblem | null }>
  onEditAddress: () => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState<EmailProblem | null>(null)
  // Two flags rather than one. They disable the same things — a card with a request in
  // flight takes no second press of anything — but only one of them may speak for the
  // confirm button: a shared flag had asking for a new code announce CONFIRMING…, which
  // is the one thing that press is not doing.
  const [confirming, setConfirming] = useState(false)
  const [resending, setResending] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(initialSentAt)
  // Read through a lazy initialiser rather than in the render path — the compiler is free
  // to take a clock read at a different moment than you meant it.
  const [now, setNow] = useState(() => Date.now())

  const busy = confirming || resending
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
    setConfirming(true)
    const res = await onConfirm(value)
    // Left busy on the way out of a restore: the app is about to boot, and a button that
    // came back to life for the half-second before it would invite a second press of
    // something that has already happened.
    if (res.error !== null) setConfirming(false)
    setProblem(res.error)
  }

  const handleResend = async () => {
    if (waiting > 0 || busy) return
    setResending(true)
    const res = await onResend()
    setResending(false)
    setProblem(res.error)
    if (res.error === null) {
      setSentAt(Date.now())
      setNow(Date.now())
    }
  }

  return (
    <>
      {/* The question this answers is the dialog's own title — see `EmailDialog`.

          A line per sentence, because the two are about different things: the first is the
          address to check, the second is a clock. Run together they read as one fact and
          the player's eye goes past the address, which is the one thing here they have to
          look at. */}
      <Text selectable={false} className={cn(TYPE.hint, 'mt-2 leading-[15px] text-dim')}>
        <Trans>
          We sent six digits to <Text className="font-black text-primary">{address}</Text>
          .
        </Trans>
      </Text>
      <Text selectable={false} className={cn(TYPE.hint, 'mb-4 leading-[15px] text-dim')}>
        <Trans>They are good for ten minutes.</Trans>
      </Text>

      {/* The frames and the line they were refused for are one block, and the air is under
          the pair of them: a gap between the code and the reason it was rejected would read
          as the reason belonging to whatever comes next. */}
      <View className="mb-5">
        <CodeCells
          value={value}
          length={CODE_LENGTH}
          onChange={(next) => {
            setValue(next)
            setProblem(null)
          }}
          onSubmit={() => {
            void handleConfirm()
          }}
          editable={!busy}
          wrong={problem !== null && CODE_FAULTS.includes(problem)}
        />

        {problem !== null && (
          <Text
            selectable={false}
            className={cn(TYPE.hint, 'mt-2 text-center text-red-500')}
          >
            {t(EMAIL_PROBLEM_LINES[problem])}
          </Text>
        )}
      </View>

      {/* Why this card is suddenly about a restore when the player only typed their
              address. It has to come before the warning, not after: the warning is alarming
              out of nowhere, and this is the sentence that makes it make sense. */}
      {branch === 'restore' && (
        <Text
          selectable={false}
          className={cn(TYPE.hint, 'mb-2 leading-[14px] text-dim')}
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
            className={cn(TYPE.hint, 'leading-[14px] text-primary')}
          >
            <Trans>
              A profile lives on one device. Restoring it here takes it off the phone it
              is on now — and anything played on this phone under another name stays
              behind.
            </Trans>
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        <TrackedPressable
          id="email_code.cancel"
          onPress={onDismiss}
          className="flex-1 items-center rounded-xl bg-card py-3"
        >
          <Text selectable={false} className={cn(TYPE.buttonSm, 'text-dim')}>
            <Trans>CLOSE</Trans>
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
          <Text selectable={false} className={cn(TYPE.buttonSm, 'text-on-strong')}>
            {confirming ? t(BUSY_LABELS[branch]) : t(ACTIONS[branch])}
          </Text>
        </TrackedPressable>
      </View>

      {/* The two things to do about a code that has not come: ask for it again, or admit it
          went to the wrong address. Under the buttons, in the voice the intro's own footer
          links use — an icon, a 10px label, no underline — because that is what a quiet way
          out of a screen looks like in this app, and neither of these is the thing the card
          is asking for.

          One row and no wrap, the same `gap-x-5` the intro's footer uses. That is what the
          counting label is short for — it drops the word CODE while it counts rather than
          growing, so the pair still fits across a narrow phone. */}
      <View className="mt-5 flex-row items-center justify-center gap-x-5">
        <TrackedPressable
          id="email_code.resend"
          onPress={() => {
            void handleResend()
          }}
          disabled={waiting > 0 || busy}
          hitSlop={10}
          // Dim rather than underlined-or-not: without an underline to drop, opacity is
          // what is left to say a link cannot be pressed yet.
          style={{ opacity: waiting > 0 || busy ? DISABLED_OPACITY : 1 }}
        >
          <View className="flex-row items-center gap-1">
            <Ionicons name="refresh-outline" size={10} color={DIM_INK} />
            <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
              {resending ? (
                <Trans>SENDING…</Trans>
              ) : waiting > 0 ? (
                <Trans>RESEND IN {waiting}S</Trans>
              ) : (
                <Trans>RESEND CODE</Trans>
              )}
            </Text>
          </View>
        </TrackedPressable>

        {/* Live through the cooldown, unlike its neighbour: nothing is sent by going
            back, so a player who can see they typed the wrong address does not have to sit
            out thirty seconds before they may say so. Dim only while something is in
            flight, which a swapped card would leave to land on nothing. */}
        <TrackedPressable
          id="email_code.edit_address"
          onPress={onEditAddress}
          disabled={busy}
          hitSlop={10}
          style={{ opacity: busy ? DISABLED_OPACITY : 1 }}
        >
          <View className="flex-row items-center gap-1">
            <Ionicons name="mail-outline" size={10} color={DIM_INK} />
            <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
              <Trans>CHANGE EMAIL</Trans>
            </Text>
          </View>
        </TrackedPressable>
      </View>
    </>
  )
}
