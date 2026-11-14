import { useEffect, useState } from 'react'

import { useAccountEmail } from '@/hooks/use-account-email'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import { useMultiplayerScreens } from '@/hooks/use-multiplayer-screens'
import { usePersistedArcadeFocus } from '@/hooks/use-persisted-arcade-focus'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { introStanding, isMenuScreen, welcomeStanding } from '@/lib/intro-standing'
import {
  accountNoticeFor,
  launchAsksClear,
  mayAskForEmail,
  mayOpenSessionAsk,
} from '@/lib/launch-asks'

// How long the intro has to stand undisturbed before a waiting new version is allowed
// to swap itself in. Not zero: a player who has just come back from a run would be
// reloaded on the spot, and an app that restarts the instant you reach the menu reads as
// a crash. Anything they start inside the window cancels it.
const UPDATE_SETTLE_MS = 2500
// Where the player stands at the intro, and the asks queued for it: the multiplayer rooms,
// the launch queue's turns, the address, a live challenge, and the update that waits for a
// quiet intro.
export function useIntroStanding({
  control,
  dialogs,
  account,
  asks,
  announcements,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  account: ScreenAccount
  asks: ScreenAsks
  announcements: ScreenAnnouncements
}) {
  const { isMenu, savedRun } = control
  const {
    applyUpdate,
    arcadeOpen,
    challengeCard,
    installPrompt,
    menuOverlay,
    replayConsent,
    setChallengeCard,
    splashDone,
    titleDialog,
    updateReady,
    welcome,
  } = dialogs
  const {
    confirmEmail,
    email,
    isReady,
    moved,
    nickname,
    pendingEmail,
    restoreProfile,
    sendCode,
    userId,
  } = account
  const {
    consentUp,
    feedbackReplies,
    launchPopupUp,
    sessionAsk,
    setShowNicknameModal,
    showNicknameModal,
    whatsNew,
  } = asks
  const { recordMultiplayer } = announcements
  // ── Multiplayer ────────────────────────────────────────────────────────────

  const {
    multiRoom,
    multiGame,
    pendingMultiAction,
    setPendingMultiAction,
    executeMultiAction,
    handleCreateRoom,
    handleJoinRoom,
    handleAdminStartGame,
    showMultiWaiting,
    showMultiGame,
    showMultiResults,
    isMultiActive,
  } = useMultiplayerScreens({
    userId,
    nickname,
    askNickname: () => {
      setShowNicknameModal(true)
    },
    recordMultiplayer,
  })

  const [showMultiMenu, setShowMultiMenu] = useState(false)
  const [menuInitialTab, setMenuInitialTab] = useState<'alone' | 'friends'>('alone')
  // Whether the start screen was left on the ARCADE pill, across launches as well as
  // across screens. Only that one bit, rather than the focused pill itself: the three
  // modes are the machine's own `mode` and come back from there, and a second copy of them
  // here would be free to drift from it the moment anything else changed the mode.
  const { onArcade: menuOnArcade, setOnArcade: setMenuOnArcade } =
    usePersistedArcadeFocus()

  // The intro, but for whatever is stacked over it: the machine is idle, the player is not
  // in a room or on the map, and whether this launch owes the tutorial offer has been
  // decided. Read through the two answers
  // below rather than directly, so nothing in the tree can decide for itself what counts
  // as being at the start screen.
  const atIntro =
    isMenu &&
    !isMultiActive &&
    !arcadeOpen &&
    welcome.decided &&
    // A run the app was closed on is still being asked about, or is on its way into the
    // machine. Either way the player is about to be looking at a pause screen, and the
    // start screen has no business flashing up in front of it.
    savedRun.settled

  // `introDrawn` paints the start screen; `onIntro` is the stricter answer — a question
  // put over a card the player opened themselves is an interruption, not a launch ask.
  const { drawn: introDrawn, alone: introAlone } = introStanding(atIntro, menuOverlay)
  const { offer: welcomeOffer, free: onIntro } = welcomeStanding(
    introAlone,
    splashDone,
    welcome.pending,
  )
  // The push card's turn in the launch queue, right behind the recording card.
  const pushCardClear = launchAsksClear({
    splashDone,
    onIntro,
    repliesReady: feedbackReplies.ready,
    hasReply: feedbackReplies.reply !== null,
    newsReady: whatsNew.ready,
    newsVisible: launchPopupUp,
    challengeUp: challengeCard !== undefined,
    installing: installPrompt.target !== 'none',
    replayVisible: replayConsent.visible,
  })
  const menuScreenOpen = isMenuScreen(menuOverlay)

  // Putting an address on this profile, and fetching a profile back from one. Below
  // `onIntro`, which it reads: the one-time ask is a launch ask like the three above it
  // and waits its turn behind every one of them.
  const accountEmail = useAccountEmail({
    account: {
      ready: isReady,
      email,
      pendingEmail,
      sendCode,
      confirmEmail,
      restoreProfile,
    },
    nickname,
    canPrompt: mayAskForEmail({
      splashDone,
      onIntro,
      titleDialogOpen: titleDialog !== 'none',
      nicknameOpen: showNicknameModal,
      repliesReady: feedbackReplies.ready,
      hasReply: feedbackReplies.reply !== null,
      newsReady: whatsNew.ready,
      newsVisible: launchPopupUp,
      installing: installPrompt.target !== 'none',
      consentVisible: consentUp,
      challengeUp: sessionAsk.owed !== null || challengeCard !== undefined,
    }),
  })

  // A challenge gone live since this player last looked, opened for them the first time
  // they reach the intro while it runs and nothing else is asking — see `mayOpenSessionAsk`.
  const owedSession = sessionAsk.owed
  const markSessionSeen = sessionAsk.seen
  const mayOpenSession = mayOpenSessionAsk({
    splashDone,
    onIntro,
    otherDialogUp:
      titleDialog !== 'none' ||
      showNicknameModal ||
      challengeCard !== undefined ||
      accountEmail.card !== null,
    repliesReady: feedbackReplies.ready,
    hasReply: feedbackReplies.reply !== null,
    newsReady: whatsNew.ready,
    newsVisible: launchPopupUp,
    installing: installPrompt.target !== 'none',
    consentVisible: consentUp,
  })
  useEffect(() => {
    if (owedSession === null || !mayOpenSession) return
    // Seen as it opens rather than as it closes: closing the app on it is still having
    // been shown it, and a dialog that waits to be answered comes back every launch.
    markSessionSeen(owedSession.session.id)
    setChallengeCard(owedSession)
  }, [owedSession, mayOpenSession, markSessionSeen])

  const accountNotice = accountNoticeFor({ moved, pendingEmail })

  // A new build waits on the device until the app lets it through, because the swap ends
  // in a reload. The intro with nothing open over it is the only place that costs
  // nothing: mid-run it would throw the run away, over an overlay it would lose whatever
  // was being typed, and in a multiplayer room it would drop the player out of it.
  useEffect(() => {
    if (!updateReady || !onIntro || showNicknameModal) return
    // The intro is still underneath these two, but a reload while the player is reading
    // the catalogue is the same lost place as a reload over any other open thing.
    if (titleDialog !== 'none' || challengeCard !== undefined) return
    const timer = setTimeout(applyUpdate, UPDATE_SETTLE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [updateReady, applyUpdate, onIntro, showNicknameModal, titleDialog, challengeCard])

  return {
    accountEmail,
    accountNotice,
    executeMultiAction,
    handleAdminStartGame,
    handleCreateRoom,
    handleJoinRoom,
    introDrawn,
    isMultiActive,
    markSessionSeen,
    menuInitialTab,
    menuOnArcade,
    menuScreenOpen,
    multiGame,
    multiRoom,
    onIntro,
    pendingMultiAction,
    pushCardClear,
    setMenuInitialTab,
    setMenuOnArcade,
    setPendingMultiAction,
    setShowMultiMenu,
    showMultiGame,
    showMultiMenu,
    showMultiResults,
    showMultiWaiting,
    welcomeOffer,
  }
}

export type ScreenIntro = ReturnType<typeof useIntroStanding>
