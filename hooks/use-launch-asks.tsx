import { useState } from 'react'

import { useFeedbackReplies } from '@/hooks/use-feedback-replies'
import { useNextVote } from '@/hooks/use-next-vote'
import type { ScreenAccount } from '@/hooks/use-player-account'
import { usePopupDeck } from '@/hooks/use-popup-deck'
import { usePushConsent } from '@/hooks/use-push-consent'
import type { ScreenControl } from '@/hooks/use-run-control'
import { useScoreSubmission } from '@/hooks/use-score-submission'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { useSessionAsk } from '@/hooks/use-session-ask'

// What is waiting for the player at launch: the popup deck, the push consent, the vote, a
// live session not yet shown, replies to their messages — and the score submission and the
// nickname card those lean on.
export function useLaunchAsks({
  control,
  dialogs,
  account,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  account: ScreenAccount
}) {
  const { runSession } = control
  const { replayConsent } = dialogs
  const { isReady, nickname, shownFeatures, userId } = account
  // Below `useSupabaseAuth`, which it reads: the winnings half of the deck is per player,
  // and there is nothing to ask the server for until there is a player to ask about.
  const whatsNew = usePopupDeck(userId, runSession, shownFeatures)
  // The second step of the consent: whether this device may be pushed to. Behind the replay
  // ask, and resolved from `shownFeatures` for the reason given above.
  const pushConsent = usePushConsent({
    held: shownFeatures.has('push'),
    replay: replayConsent.consent,
    userId,
  })
  const consentUp = replayConsent.visible || pushConsent.visible
  // **The vote** on which of the next two challenges opens first. Lifted to the screen
  // because two things read it that share no parent: the rating dialog's third step and the
  // intro's link, whose dialog is opened here for the scrim's sake.
  const nextVote = useNextVote(shownFeatures.has('challenges') && userId !== null)
  const [voteOpen, setVoteOpen] = useState(false)
  const [voteResultsOpen, setVoteResultsOpen] = useState(false)
  // Whether the launch popup *or the rating that follows it* is up. Everything that waits
  // its turn behind the popup — the email ask, the install prompt, the session-recording
  // ask — waits behind the rating too: it is the popup's last word, opened only once the
  // popup has gone, and a prompt landing in the gap between the two would stack on it.
  const launchPopupUp = whatsNew.visible || whatsNew.rating.asking !== null

  // A live session this player has not been shown, opened over the intro once the launch
  // asks ahead of it have had their turn — see the effect below `accountEmail`.
  const sessionAsk = useSessionAsk(shownFeatures.has('challenges'))

  const { submit: submitScore } = useScoreSubmission(userId, nickname, isReady)

  // Answers to messages the player sent, asked for once the session is known. Shown on
  // the intro, ahead of the news — a reply written to you personally outranks a release
  // note.
  const feedbackReplies = useFeedbackReplies(userId, isReady)

  const [showNicknameModal, setShowNicknameModal] = useState(false)

  return {
    consentUp,
    feedbackReplies,
    launchPopupUp,
    nextVote,
    pushConsent,
    sessionAsk,
    setShowNicknameModal,
    setVoteOpen,
    setVoteResultsOpen,
    showNicknameModal,
    submitScore,
    voteOpen,
    voteResultsOpen,
    whatsNew,
  }
}

export type ScreenAsks = ReturnType<typeof useLaunchAsks>
