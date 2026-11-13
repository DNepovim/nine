import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'

import {
  CODE_LENGTH,
  codeProblem,
  cooldownRemaining,
  type EmailProblem,
} from '@/lib/account-email'

// The six-digit field on the email code card, and everything that answers it: what is
// typed, why it was refused, the two requests that can be in flight, the clock the resend
// waits out, the clipboard offer, and the erase and the fill that move digits on and off.
//
// The card draws; this decides. Held apart so the card is a layout and the field's rules
// can be read in one place.

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

// Which problems are the code's own, and so the ones the frames go red for. The others are
// about the request rather than about what was typed: nothing is wrong with six digits that
// never left the phone, and reddening them would tell the player to go and find a new code
// when what they need is a connection.
export const CODE_FAULTS: readonly EmailProblem[] = ['bad_code', 'expired']

export function useCodeEntry({
  sentAt: initialSentAt,
  done,
  onConfirm,
  onResend,
}: {
  sentAt: number | null
  done: boolean
  onConfirm: (code: string) => Promise<{ error: EmailProblem | null }>
  onResend: () => Promise<{ error: EmailProblem | null }>
}) {
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

  return {
    value,
    problem,
    confirming,
    resending,
    fillTo,
    canPaste,
    busy,
    waiting,
    ready,
    take,
    handleClear,
    handlePaste,
    handleConfirm,
    handleResend,
  }
}
