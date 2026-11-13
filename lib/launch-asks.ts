// The queue of asks the intro makes on launch — a reply, the news, the install prompt, the
// recording and push cards, a live challenge, an address — and when each may have its turn.

import type { AccountNoticeKind } from '@/components/overlays/account-notice'

// What the intro has to say about this player's address, if anything.
//
// The two can never both be true — a device told its profile moved was signed out and
// handed a fresh anonymous account, which has no address pending on it — so the order
// below is a statement about which matters, not a tie-break.
//
// CONFIRM YOUR EMAIL is any address waiting on its code, including one on a profile that
// already has a confirmed address beside it — which is every change in flight.
//
// It was read as "no address yet" for a while, and that was a worse answer to a real
// problem. The problem: a restore hands the new phone a session carrying whatever was
// parked in `email_change` on the profile it brought over, so a change somebody started
// on another handset nags here, every launch, about an inbox this player may not have.
// The cost of answering it this way: a player who starts a change and closes the dialog
// loses the only door back to the six digits — no line here, and their own card offering
// to change an address they had just changed. Stranding somebody mid-task is the worse of
// the two, and the nag at least opens on a card that can resend, re-point or finish.
//
// Putting a change *down* is the piece neither version has: nothing in the app clears
// `email_change`, because GoTrue has no call for it. That is the fix this is waiting on.
export function accountNoticeFor({
  moved,
  pendingEmail,
}: {
  moved: boolean
  pendingEmail: string | null
}): AccountNoticeKind | null {
  if (moved) return 'moved'
  if (pendingEmail !== null) return 'confirm'
  return null
}

// Whether the intro may be interrupted to ask, once, for an address.
//
// Last in the queue of launch asks: a reply written to this player, the news, the install
// prompt and the recording ask all come first, and none of them is ever up at the same
// time as this. The nickname card is on the list too — it is the card this one *follows*,
// and the two stacked would be two dialogs deep before the player has agreed to either.
export function mayAskForEmail({
  splashDone,
  onIntro,
  titleDialogOpen,
  nicknameOpen,
  repliesReady,
  hasReply,
  newsReady,
  newsVisible,
  installing,
  consentVisible,
  challengeUp,
}: {
  splashDone: boolean
  onIntro: boolean
  titleDialogOpen: boolean
  nicknameOpen: boolean
  repliesReady: boolean
  hasReply: boolean
  newsReady: boolean
  newsVisible: boolean
  installing: boolean
  consentVisible: boolean
  // A challenge's dialog, open or owed by the launch — see `useSessionAsk`.
  challengeUp: boolean
}): boolean {
  if (!splashDone || !onIntro || titleDialogOpen || nicknameOpen) return false
  if (!repliesReady || hasReply) return false
  if (!newsReady || newsVisible) return false
  return !installing && !consentVisible && !challengeUp
}

// Whether the launch may open a live challenge's dialog by itself — see `useSessionAsk`.
//
// The same queue the email ask reads, one place ahead of it: the reply, the popup and its
// rating, the install prompt and the recording ask all go first, and the email ask waits
// on this. Never over a dialog already up, the player's own or the email ask's.
export function mayOpenSessionAsk({
  splashDone,
  onIntro,
  otherDialogUp,
  repliesReady,
  hasReply,
  newsReady,
  newsVisible,
  installing,
  consentVisible,
}: {
  splashDone: boolean
  onIntro: boolean
  otherDialogUp: boolean
  repliesReady: boolean
  hasReply: boolean
  newsReady: boolean
  newsVisible: boolean
  installing: boolean
  consentVisible: boolean
}): boolean {
  if (!splashDone || !onIntro || otherDialogUp) return false
  if (!repliesReady || hasReply) return false
  if (!newsReady || newsVisible) return false
  return !installing && !consentVisible
}

// Whether the launch asks ahead of the push card have all had their turn: the same queue
// the session-recording card waits in, apart from that card itself. Pulled out of the
// component so the screen's own branching does not carry it.
export const launchAsksClear = ({
  splashDone,
  onIntro,
  repliesReady,
  hasReply,
  newsReady,
  newsVisible,
  challengeUp,
  installing,
  replayVisible,
}: {
  splashDone: boolean
  onIntro: boolean
  repliesReady: boolean
  hasReply: boolean
  newsReady: boolean
  newsVisible: boolean
  challengeUp: boolean
  installing: boolean
  replayVisible: boolean
}): boolean =>
  splashDone &&
  onIntro &&
  repliesReady &&
  !hasReply &&
  newsReady &&
  !newsVisible &&
  !challengeUp &&
  !installing &&
  !replayVisible
