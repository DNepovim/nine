import { isNonEmptyString } from 'narrowland'
import { useEffect, useState } from 'react'

import type { EmailBranch, EmailProblem } from '@/lib/account-email'
import { markEmailAsked, wasEmailAsked } from '@/lib/account-markers'

type Answer = { error: EmailProblem | null }
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
  | { kind: 'code'; branch: EmailBranch; address: string; sentAt: number | null }

// The half of `use-supabase-auth` this flow needs. Named rather than taken whole so the
// dependency reads in one line, and so nothing here can reach for a part of auth that is
// none of its business.
type Account = {
  email: string | null
  pendingEmail: string | null
  sendCode: (address: string) => Promise<SendResult>
  confirmEmail: (code: string) => Promise<Answer>
  restoreProfile: (code: string) => Promise<Answer>
}

export type AccountEmailFlow = {
  card: EmailCard | null
  // The one door. The invitation after a nickname, the row on the player's own profile,
  // the one-time ask and the moved line all land here, and none of them has to know which
  // of the two things the player is about to do — nor does the player.
  open: () => void
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
  // Latched once the question has been put, so the effect below cannot put it twice — the
  // marker is written to storage at the same moment, but a write is a round trip and the
  // effect can run again before it lands.
  const [asked, setAsked] = useState(false)

  const hasAddress = account.email !== null || account.pendingEmail !== null

  useEffect(() => {
    if (!canPrompt || asked || hasAddress) return
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
  }, [canPrompt, asked, hasAddress, nickname])

  const open = (): void => {
    setCard({ kind: 'address', typed: '' })
  }

  // Nothing is undone on the way back, because there is nothing that would want undoing: an
  // address the server has parked in `new_email` is replaced by the next `sendCode`, and
  // until one lands it is the honest answer to what this profile is waiting on — which is
  // what the intro's confirm line goes on saying.
  const editAddress = (): void => {
    if (card?.kind !== 'code') return
    setCard({ kind: 'address', typed: card.address })
  }

  const openPendingConfirm = (): void => {
    const address = account.pendingEmail
    if (address === null) return
    setCard({ kind: 'code', branch: 'attach', address, sentAt: null })
  }

  const dismiss = (): void => {
    setCard(null)
  }

  // The field's button. What comes back decides which card follows and what it warns
  // about; the field itself never learns, and never needed to.
  const send = async (raw: string): Promise<Answer> => {
    const res = await account.sendCode(raw)
    if (res.error !== null || res.branch === null) return { error: res.error }
    setCard({
      kind: 'code',
      branch: res.branch,
      // The address the server answered about rather than the one that was typed: see
      // `normalizeEmail`. What the next card echoes back has to be what a code was
      // actually sent to.
      address: raw.trim().toLowerCase(),
      sentAt: Date.now(),
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
    setCard({ ...card, branch: res.branch, sentAt: Date.now() })
    return { error: null }
  }

  // The code card's button. A restore does not close anything on success: the app is about
  // to boot, and taking the card down first would show a frame of the intro belonging to
  // whoever was signed in a moment ago.
  const confirm = async (code: string): Promise<Answer> => {
    if (card?.kind !== 'code') return { error: 'unknown' }
    if (card.branch === 'restore') return account.restoreProfile(code)
    const res = await account.confirmEmail(code)
    if (res.error === null) setCard(null)
    return res
  }

  return { card, open, openPendingConfirm, send, resend, confirm, editAddress, dismiss }
}
