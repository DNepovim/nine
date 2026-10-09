import { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef, useState } from 'react'
import { AppState, Platform, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { CodeCells } from '@/components/overlays/code-cells'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK, PRIMARY_INK } from '@/constants/colors'
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
//
// Both short, and the restore one deliberately shorter than what it does: RESTORE PROFILE
// is the sentence this button used to carry, and at `buttonSm` on a narrow phone it was
// wider than the half of the row it has. The act is named twice over already — by the
// paragraph above the button and by the busy label the press turns it into — so the button
// itself can be a verb.
const ACTIONS = {
  attach: msg`CONFIRM`,
  restore: msg`SUBMIT`,
} as const satisfies Record<EmailBranch, MessageDescriptor>

// What the button says once the server has taken the code. One word for both branches,
// because only one of them ever reaches it: a restore is already reloading the app by the
// time this would be drawn.
const DONE_LABEL = msg`CONFIRMED`

const BUSY_LABELS = {
  attach: msg`CONFIRMING…`,
  restore: msg`RESTORING…`,
} as const satisfies Record<EmailBranch, MessageDescriptor>

// How often the cooldown line is redrawn while it is counting. A second, because it counts
// in seconds — a faster tick would redraw the same number.
const TICK_MS = 1000

// A refused code is taken off the field digit by digit rather than cleared at a stroke.
//
// The hold first, because the message and the red frames have to be read before the thing
// they are about disappears — a field that emptied itself the instant the answer came back
// would leave the player looking at a complaint about nothing. Then the digits come off
// right to left, the way they would under a backspace held down, which is the one erasure a
// phone keyboard has taught everybody to recognise.
const ERASE_HOLD_MS = 800
const ERASE_STEP_MS = 55

// And a pasted code goes on the same way it would be typed, left to right. Slightly quicker
// than the erase: this one is going somewhere.
const FILL_STEP_MS = 45

// How long the line under the frames takes to arrive. Short: it is a correction, and a
// correction that makes an entrance is a card drawing attention to the player's mistake.
const FADE_MS = 160

// Which problems are the code's own, and so the ones the frames go red for. The others are
// about the request rather than about what was typed: nothing is wrong with six digits that
// never left the phone, and reddening them would tell the player to go and find a new code
// when what they need is a connection.
const CODE_FAULTS: readonly EmailProblem[] = ['bad_code', 'expired']

// How far a link fades once it cannot be pressed. The same weight the card's own buttons
// dim by, so a dead link and a dead button read as the same state.
const DISABLED_OPACITY = 0.5

// One band under the frames, holding whichever small line belongs there and keeping its
// height whether it holds one or none.
//
// That fixed height is the whole point of it. All four come and go while the player is
// looking at the card — a code lands, a code is refused, a clipboard is offered, a field
// wants emptying — and a card that grew and shrank by a line each time would move the
// buttons under the finger on its way to the press. So the band is `h-4` and everything in
// it is absolute: a line that runs long draws past its space instead of making more.
//
// The order is the order of what the player needs to know. A code that was taken beats a
// code that was refused, which beats either offer — and the two offers are one slot
// because they are one act, putting the field into the state the player wants.
function FieldNote({
  done,
  problem,
  typed,
  offerPaste,
  busy,
  onClear,
  onPaste,
}: {
  done: boolean
  problem: EmailProblem | null
  typed: boolean
  offerPaste: boolean
  busy: boolean
  onClear: () => void
  onPaste: () => void
}) {
  const { t } = useLingui()

  return (
    <View className="relative mt-2 h-4">
      {done ? (
        // Primary ink rather than the green that would be the obvious choice: green in
        // this app means an achievement and means nothing else, and a confirmed address
        // is not one. See the design guide's palette table.
        <Animated.View
          entering={FadeInDown.duration(FADE_MS)}
          className="absolute inset-x-0 top-0 flex-row items-center justify-center gap-1"
        >
          <Ionicons name="checkmark-circle" size={10} color={PRIMARY_INK} />
          <Text selectable={false} className={cn(TYPE.hint, 'text-center text-primary')}>
            <Trans>Address confirmed.</Trans>
          </Text>
        </Animated.View>
      ) : problem !== null ? (
        // Down rather than in: it belongs to the frames above it and arrives from
        // them, the way a thing being said about something arrives after it.
        <Animated.View
          entering={FadeInDown.duration(FADE_MS)}
          className="absolute inset-x-0 top-0"
        >
          <Text selectable={false} className={cn(TYPE.hint, 'text-center text-red-500')}>
            {t(EMAIL_PROBLEM_LINES[problem])}
          </Text>
        </Animated.View>
      ) : typed ? (
        /* The field has something in it, so the useful offer is the opposite one. It
       takes the place of the paste link rather than sitting beside it: they are
       the same act — put the field into the state the player wants — and only one
       of them is ever the one they mean.

       It is also the way out of a code that is being erased too slowly, or a
       half-typed one the player would rather start again than back over. */
        <View className="absolute inset-x-0 top-0 flex-row justify-center">
          <TrackedPressable
            id="email_code.clear"
            onPress={onClear}
            hitSlop={10}
            disabled={busy}
            style={{ opacity: busy ? DISABLED_OPACITY : 1 }}
          >
            <View className="flex-row items-center gap-1">
              <Ionicons name="close-circle-outline" size={10} color={DIM_INK} />
              <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                <Trans>CLEAR</Trans>
              </Text>
            </View>
          </TrackedPressable>
        </View>
      ) : (
        offerPaste && (
          /* Offered rather than done, and this is the one place the clipboard cannot
         be asked about first. Deciding whether to show this by its *contents*
         would mean reading it on every open: on iOS that raises "Allow Paste?"
         over a card the player has not touched, and on the web it is not allowed
         at all outside a gesture — `navigator.clipboard.read()` is what every one
         of expo-clipboard's reads goes through there, including the one that only
         claims to check. So the offer stands whenever the field is empty, and the
         only read happens under the finger that asked for it.

         It is there on coming back from the mail app with a code copied, which is
         the one moment it is the fastest thing on the card. */
          <View className="absolute inset-x-0 top-0 flex-row justify-center">
            <TrackedPressable id="email_code.paste" onPress={onPaste} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="clipboard-outline" size={10} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>PASTE FROM CLIPBOARD</Trans>
                </Text>
              </View>
            </TrackedPressable>
          </View>
        )
      )}
    </View>
  )
}

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
  // The code was accepted, and the card has a moment left before it closes. Decided by the
  // flow rather than here: what happens after a code lands is the flow's business, and the
  // card only has to look like it worked.
  done,
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
  done: boolean
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

  // The last value this card sent off by itself, so a code that comes back refused is not
  // sent again and again. Cleared by the player changing what is in the field, which is
  // the only thing that could make the answer different.
  const sentBySelf = useRef<string | null>(null)
  // The code a paste is in the middle of laying down, or null. Held apart from `value`
  // because the field is filled a digit at a time and the two are only equal at the end.
  const [fillTo, setFillTo] = useState<string | null>(null)
  // Whether to offer the paste link, which the two platforms answer in different ways.
  //
  // Native can be asked: `hasStringAsync` is `UIPasteboard.hasStrings` underneath, built
  // to say whether there is text without looking at it, and it raises no prompt. So the
  // link appears only when there is something to paste.
  //
  // Web cannot. expo-clipboard's `hasStringAsync` is `navigator.clipboard.read()` there —
  // a read, which is what Safari raises its paste prompt for — so asking would put that
  // prompt over a card the player has not touched. The link is simply offered instead, and
  // the only read happens under the finger that asked for it.
  const [canPaste, setCanPaste] = useState(Platform.OS === 'web')

  // `done` joins the two in-flight flags for everything that disables: there is nothing
  // left to type, resend or press on a card whose code has already been taken.
  const busy = confirming || resending || done
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

  // Six digits is the whole of what this card is waiting for, so the last one submits it.
  // Nobody reads a code, types it, and then looks for a button — and the one they would
  // find is `CONFIRM`, which is what the sixth digit already meant.
  useEffect(() => {
    if (!ready || sentBySelf.current === value) return
    sentBySelf.current = value
    void handleConfirm()
    // Keyed on the field and nothing else. `handleConfirm` is redeclared every render, so
    // naming it here would be naming a new function each time — and the ref above is what
    // actually decides, by refusing to send the same six digits twice.
  }, [ready, value])

  // Asked again whenever the app comes back, because the trip away is the point: the
  // player left to read the code and is returning with it copied.
  useEffect(() => {
    if (Platform.OS === 'web') return
    let alive = true
    const ask = (): void => {
      void Clipboard.hasStringAsync()
        .then((has) => {
          if (alive) setCanPaste(has)
        })
        .catch(() => {
          // No clipboard on this platform, or permission refused. The offer stays down
          // and the field is typed into, which is where we were.
        })
    }
    ask()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ask()
    })
    return () => {
      alive = false
      subscription.remove()
    }
  }, [])

  // A refused code, coming back off. Each pass schedules one digit and the shortening of
  // the field brings the effect round again, so the chain needs no interval and no cleanup
  // beyond its own timer.
  //
  // `setValue` rather than `take`, because `take` clears the problem and the problem is
  // what this is about: the message stays up through the erasure and after it, until the
  // player types. Typing is also what stops this early — it clears the problem, and the
  // guard below reads that as nothing left to undo.
  useEffect(() => {
    if (problem === null || !CODE_FAULTS.includes(problem) || value === '') return
    const first = value.length === CODE_LENGTH
    const timer = setTimeout(
      () => {
        const next = value.slice(0, -1)
        // Emptied. Whatever was refused is gone, so the same six digits typed again are a
        // fresh attempt rather than the one already answered.
        if (next === '') sentBySelf.current = null
        setValue(next)
      },
      first ? ERASE_HOLD_MS : ERASE_STEP_MS,
    )
    return () => {
      clearTimeout(timer)
    }
  }, [problem, value])

  // A pasted code going on, by the same arrangement in the other direction. It lands like
  // typing rather than appearing whole, which is what makes it legible as *the card being
  // filled in* rather than the card having changed.
  useEffect(() => {
    if (fillTo === null) return
    if (value === fillTo || !fillTo.startsWith(value)) {
      setFillTo(null)
      return
    }
    const timer = setTimeout(() => {
      take(fillTo.slice(0, value.length + 1))
    }, FILL_STEP_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [fillTo, value])

  // The one way into the field, and the one place that decides whether what arrived was
  // typed or pasted.
  //
  // More than one digit at a time is not something a keyboard can do, so it is a paste —
  // ⌘V, the long-press menu, the phone's own one-time-code autofill, or our own link, all
  // of which reach the field as a single jump. Each of them is staged rather than taken
  // whole, so a code never simply materialises: it lands the way it would be typed, and
  // the player can see it is their code going in.
  //
  // Starting from empty rather than from wherever the jump began, because a paste replaces
  // what is there — and the fill below reads `value` as how far along it is.
  const take = (next: string): void => {
    setProblem(null)
    if (next.length - value.length > 1) {
      setValue('')
      setFillTo(next)
      return
    }
    setValue(next)
  }

  // Everything the field was in the middle of, undone at once: what was typed, the reason
  // it was refused, the paste still landing, and the latch that would otherwise refuse to
  // send the same six digits a second time.
  const handleClear = (): void => {
    setFillTo(null)
    sentBySelf.current = null
    take('')
  }

  const handlePaste = async (): Promise<void> => {
    try {
      const text = await Clipboard.getStringAsync()
      const digits = text.replace(/\D/gu, '').slice(0, CODE_LENGTH)
      if (digits === '') return
      // Whatever was there, even a few digits short. The field takes what it is given and
      // the player finishes it; refusing a near miss would be a card that read the
      // clipboard, found something, and said nothing about it.
      //
      // Through `take` like everything else, which is what stages it: this link is only
      // one of the several ways a whole code arrives at once, and they all look the same
      // going in.
      take(digits)
    } catch {
      // iOS can refuse the read outright. Nothing to say — the field still works.
    }
  }

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
    // Whatever was sent and refused was about the old code. A new one is a new answer, so
    // the field is allowed to submit itself again — even in the unlikely case that the
    // player types the same six digits back into it.
    sentBySelf.current = null
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

      {/* The frames and the band under them are one block, and the air is under the pair
          of them: a gap between the code and the reason it was rejected would read as the
          reason belonging to whatever comes next. */}
      <View className="mb-4">
        <CodeCells
          value={value}
          length={CODE_LENGTH}
          onChange={(next) => {
            take(next)
          }}
          onSubmit={() => {
            void handleConfirm()
          }}
          editable={!busy}
          wrong={problem !== null && CODE_FAULTS.includes(problem)}
          autoFocus
        />

        <FieldNote
          done={done}
          problem={problem}
          typed={value !== ''}
          offerPaste={canPaste && fillTo === null && !busy}
          busy={busy}
          onClear={handleClear}
          onPaste={() => {
            void handlePaste()
          }}
        />
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
            {done
              ? t(DONE_LABEL)
              : confirming
                ? t(BUSY_LABELS[branch])
                : t(ACTIONS[branch])}
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
