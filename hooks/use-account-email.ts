import { isNonEmptyString } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import type { EmailBranch, EmailProblem } from '@/lib/account-email'
import {
  clearCodeCard,
  lastCodeSentAt,
  markCodeCard,
  markCodeSent,
  markEmailAsked,
  openCodeAddress,
  wasEmailAsked,
} from '@/lib/account-markers'

type Answer = { error: EmailProblem | null }

// How long the card stays up saying it worked. Long enough to read three words, short
// enough that nobody reaches for a close button first.
const DONE_HOLD_MS = 1400
type SendResult = { error: EmailProblem | null; branch: EmailBranch | null }

// Which of the two cards is up, and what it is about. One value rather than two booleans:
// the field and the six digits are two beats of one task and can never both be up, which a
// union says and a pair of flags only promises.
//
// Note what the first card does *not* carry: a purpose. There is one door now, and which
// of the two things it opens onto is not known until the server has answered — so the
// branch appears on the second card and nowhere earlier.
type EmailCard =
  // `typed` seeds the field: empty when the card is opened fresh, and the address already
  // sent when the player has come back from the code card to correct it. A typo is one
  // character wrong out of twenty-five, and retyping the other twenty-four is how a player
  // makes a second one.
  | { kind: 'address'; typed: string }
  // `sentAt` is null when no code went out to bring this card up — a player reopening it
  // off the intro's confirm line, days after the one they were sent.
  // `done` is the beat between the server accepting a code and the card going: the player
  // pressed something and it worked, and a dialog that simply vanished would leave them
  // asking whether it had. Only ever set on an attach — a restore's success is the app
  // booting into the restored profile, which is a louder answer than any line of text.
  | {
      kind: 'code'
      branch: EmailBranch
      address: string
      sentAt: number | null
      done?: boolean
    }

// The half of `use-supabase-auth` this flow needs. Named rather than taken whole so the
// dependency reads in one line, and so nothing here can reach for a part of auth that is
// none of its business.
type Account = {
  // Whether the session has been read. The pick-up below waits for it: an address is sorted
  // into attach or restore by what the session is holding, and before it has loaded the
  // session is holding null — which would call every attach a restore.
  ready: boolean
  email: string | null
  pendingEmail: string | null
  sendCode: (address: string) => Promise<SendResult>
  confirmEmail: (code: string) => Promise<Answer>
  // Takes the address beside the code rather than remembering which one a code was sent
  // to: the remembering died with the process, and this card has the address anyway.
  restoreProfile: (code: string, address: string) => Promise<Answer>
}

export type AccountEmailFlow = {
  card: EmailCard | null
  // The one door. The invitation after a nickname, the row on the player's own profile,
  // the one-time ask and the moved line all land here, and none of them has to know which
  // of the two things the player is about to do — nor does the player.
  // Seeded when the door was a pencil beside an address already held: editing one letter
  // of it should not mean typing the other twenty-four, which is the same reasoning the
  // code card's EDIT ADDRESS already follows.
  open: (typed?: string) => void
  // Reopen the code card for an address already given — the intro's confirm line. The only
  // entry point that knows its branch in advance, because an address sitting in
  // `pendingEmail` is by definition one that was being attached.
  openPendingConfirm: () => void
  send: (address: string) => Promise<Answer>
  resend: () => Promise<Answer>
  // Back to the field from the code card, carrying the address that is on it. The way out
  // of the one thing the code card cannot fix: a code sent somewhere the player cannot
  // read. `dismiss` is the other way out, and it is a different act — that one gives up.
  editAddress: () => void
  confirm: (code: string) => Promise<Answer>
  dismiss: () => void
}

export function useAccountEmail({
  account,
  // Whether this is a moment the app may interrupt: on the intro, with nothing else
  // stacked over it and no other launch ask taking its turn. Only the one-time ask reads
  // this; everything else here happens because the player pressed something.
  canPrompt,
  // The name on the profile. The ask is only put to players who have one — without a
  // nickname there is no profile on any board, and nothing yet worth carrying to another
  // phone.
  nickname,
}: {
  account: Account
  canPrompt: boolean
  nickname: string | null
}): AccountEmailFlow {
  const [card, setCard] = useState<EmailCard | null>(null)
  // When a code last went out from this device, for as long as the app is open.
  //
  // Not on the card, which is where it used to be and where it cannot stay: the card is
  // destroyed by `dismiss` and built again by the next `open`, so closing the dialog and
  // reopening it handed the player a live RESEND button while the server was still
  // refusing — the one press they were invited to make being the one that could not work.
  // A cooldown belongs to the sending, not to the window it was started in.
  //
  // One moment rather than one per address, because that is how the server counts it:
  // `max_frequency` is spent per *user*, so a code to a second address inside the window
  // is refused exactly like a second code to the first. Measured, not assumed — see the
  // comment on `RESEND_COOLDOWN_MS`.
  //
  // A ref rather than state: nothing renders off it directly, and every write to it
  // happens beside a `setCard` that renders anyway.
  const lastSentAt = useRef<number | null>(null)

  // Stamps the send and hands back the moment, so a card is seeded from the same clock
  // read that the next one will be measured against. Written to disk as well, because the
  // trip to a mail app that this whole flow asks for is the trip the process may not
  // survive — see `EMAIL_SENT_KEY`.
  const noteSent = (): number => {
    const at = Date.now()
    lastSentAt.current = at
    void markCodeSent(at)
    return at
  }
  // Latched once the question has been put, so the effect below cannot put it twice — the
  // marker is written to storage at the same moment, but a write is a round trip and the
  // effect can run again before it lands.
  const [asked, setAsked] = useState(false)

  const hasAddress = account.email !== null || account.pendingEmail !== null

  // What the last launch was in the middle of, picked up once the session is known.
  //
  // The case this is for is not an edge: reading a code means leaving for a mail app, and
  // a home-screen web app on iOS is often killed while it is away. Without this, coming
  // back lands on the intro with the cooldown forgotten and, on a restore, with the
  // address forgotten too — so the player starts the whole thing again and the second code
  // meets the server's floor.
  //
  // The branch is derived rather than stored: an address the session is holding in
  // `new_email` is one being attached, and any other is a restore. One fact, read where it
  // already lives and so unable to disagree with itself.
  const pickedUp = useRef(false)
  useEffect(() => {
    if (!account.ready || pickedUp.current) return
    pickedUp.current = true
    void (async () => {
      lastSentAt.current = await lastCodeSentAt()
      const address = await openCodeAddress()
      if (address === null) return
      const branch: EmailBranch = account.pendingEmail === address ? 'attach' : 'restore'
      // Never over a card already up: the player opened that one just now, and this is a
      // note from a launch that is over.
      setCard(
        (current) =>
          current ?? { kind: 'code', branch, address, sentAt: lastSentAt.current },
      )
    })()
  }, [account.ready, account.pendingEmail])

  useEffect(() => {
    if (!canPrompt || asked || hasAddress) return
    // Nor over a card already up — the one picked up above, most likely, which is a player
    // mid-task rather than somebody to interrupt.
    if (card !== null) return
    if (!isNonEmptyString(nickname)) return
    // No cancellation flag, deliberately. Every step below is idempotent — latching a
    // latch, marking a mark, opening a card that is already open — so a second run that
    // overlaps the first costs a render and changes nothing, and the latch stops a third.
    void (async () => {
      const already = await wasEmailAsked()
      setAsked(true)
      if (already) return
      // Written as the card opens rather than as it closes. A player who dismisses this by
      // killing the app has still been asked, and an ask that only counts when it is
      // answered is an ask that comes back every launch until it is.
      await markEmailAsked()
      setCard({ kind: 'address', typed: '' })
    })()
  }, [canPrompt, asked, hasAddress, nickname, card])

  const open = (typed = ''): void => {
    setCard({ kind: 'address', typed })
  }

  // Nothing is undone on the way back, because there is nothing that would want undoing: an
  // address the server has parked in `new_email` is replaced by the next `sendCode`, and
  // until one lands it is the honest answer to what this profile is waiting on — which is
  // what the intro's confirm line goes on saying.
  const editAddress = (): void => {
    if (card?.kind !== 'code') return
    void clearCodeCard()
    setCard({ kind: 'address', typed: card.address })
  }

  const openPendingConfirm = (): void => {
    const address = account.pendingEmail
    if (address === null) return
    // Whatever is left of the last send's cooldown, which is usually nothing: this is the
    // intro's confirm line, reopened days later. It is not nothing when the player has
    // just closed this very dialog, which is the case that was broken.
    void markCodeCard(address)
    setCard({ kind: 'code', branch: 'attach', address, sentAt: lastSentAt.current })
  }

  const dismiss = (): void => {
    void clearCodeCard()
    setCard(null)
  }

  // The field's button. What comes back decides which card follows and what it warns
  // about; the field itself never learns, and never needed to.
  const send = async (raw: string): Promise<Answer> => {
    const res = await account.sendCode(raw)
    if (res.error !== null || res.branch === null) return { error: res.error }
    const address = raw.trim().toLowerCase()
    void markCodeCard(address)
    setCard({
      kind: 'code',
      branch: res.branch,
      // The address the server answered about rather than the one that was typed: see
      // `normalizeEmail`. What the next card echoes back has to be what a code was
      // actually sent to.
      address,
      sentAt: noteSent(),
    })
    return { error: null }
  }

  // Asking again runs the same decision again, and keeps whatever it answers. It cannot
  // come back differently in practice — an address does not stop having an account between
  // two presses — but taking the new answer rather than trusting the old one means there is
  // no stale branch to go wrong.
  const resend = async (): Promise<Answer> => {
    if (card?.kind !== 'code') return { error: 'unknown' }
    const res = await account.sendCode(card.address)
    if (res.error !== null || res.branch === null) return { error: res.error }
    setCard({ ...card, branch: res.branch, sentAt: noteSent() })
    return { error: null }
  }

  // The code card's button. A restore does not close anything on success: the app is about
  // to boot, and taking the card down first would show a frame of the intro belonging to
  // whoever was signed in a moment ago.
  const confirm = async (code: string): Promise<Answer> => {
    if (card?.kind !== 'code') return { error: 'unknown' }
    if (card.branch === 'restore') return account.restoreProfile(code, card.address)
    const res = await account.confirmEmail(code)
    if (res.error === null) {
      void clearCodeCard()
      // Said, then closed. The note on disk goes at once either way: a card that is about
      // to close is not one to reopen if the app dies inside the next second and a half.
      setCard({ ...card, done: true })
      setTimeout(() => {
        setCard(null)
      }, DONE_HOLD_MS)
    }
    return res
  }

  return { card, open, openPendingConfirm, send, resend, confirm, editAddress, dismiss }
}
