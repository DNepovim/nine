import { useCallback, useEffect, useRef, useState } from 'react'

import { type ChallengeModalCard } from '@/components/overlays/challenge-modal'
import { useAppUpdate } from '@/hooks/use-app-update'
import { useFeedbackAnswered } from '@/hooks/use-feedback-answered'
import { useHowToPlay } from '@/hooks/use-how-to-play'
import { useInstall } from '@/hooks/use-install'
import { useReplayConsent } from '@/hooks/use-replay-consent'
import type { ScreenControl } from '@/hooks/use-run-control'
import { useSplash } from '@/hooks/use-splash'
import { useTutorialRequests } from '@/hooks/use-tutorial-request'
import { useWelcome } from '@/hooks/use-welcome'
import { track } from '@/lib/analytics'
import { OVERLAY_SCREENS, type MenuOverlayName } from '@/lib/intro-standing'
import { newRunId } from '@/lib/run-id'
import { WELCOME_BOARD } from '@/lib/welcome'

// The two dialogs behind the line under the title: everything the player holds, and
// everything there is to achieve. Not `menuOverlay`, even though two of those are dialogs
// as well: these belong to the intro and nothing else opens them, whereas every name on
// that list is reachable from the pause screen too.
export type TitleDialog = 'none' | 'medals' | 'achievements'

// The three ways into the tutorial: the first launch's offer over the intro, TRY IT at
// the end of the guide, and the dev sidebar. All three deal the same run straight onto the
// board; what the door decides is what the funnel is told — and 'dev' is told nothing. The
// two a player can reach are the `from` values `run_started` already names.
type TutorialDoor = 'welcome' | 'guide' | 'dev'
// Which of the game screen's overlays and dialogs is up, and the doors into the tutorial:
// the menu overlay, the challenge card, the share sheet, the feedback bookmark, the title
// dialogs, and the asks the app makes of itself — install, replay, update, the welcome.
export function useScreenDialogs({ control }: { control: ScreenControl }) {
  const { isMenu, isPaused, isPlaying, pauseRun, send } = control
  // Which menu-level overlay is open. Only one shows at a time, and the menu
  // itself is hidden while any of them is open — a single source of truth avoids
  // z-order/gating clashes between separate booleans.
  const [menuOverlay, setMenuOverlay] = useState<MenuOverlayName>('none')
  // Whether the challenge lab was opened from the admin hub, so closing it goes back
  // there rather than all the way out to the intro.
  // The challenge card the player pressed, and the dialog it opened. Held here rather
  // than in `menu-overlay.tsx`: a `ModalCard` mounted inside the paging panel would
  // scrim the panel rather than the screen.
  const [challengeCard, setChallengeCard] = useState<ChallengeModalCard>()
  // The invite SHARE on the intro would send, while its dialog is up.
  const [shareInvite, setShareInvite] = useState<string>()
  // Whether an arcade run is up. Its own boolean rather than a state of the game machine:
  // arcade is not that machine's run — no score, no lives, no board — and the screen it
  // puts up is mounted over the intro the way a multiplayer game is.
  const [arcadeOpen, setArcadeOpen] = useState(false)
  const [titleDialog, setTitleDialog] = useState<TitleDialog>('none')
  // The feedback dialog floats over whatever is showing rather than replacing it, so
  // it is its own boolean instead of a member of the overlay union above.
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Whether the feedback bookmark is showing its label. Lives up here, not inside
  // the bookmark, because the bookmark unmounts while the dialog it opens is on
  // screen — an internal flag would forget a swipe-to-collapse the moment the
  // player closed that dialog. Paused brings it back on its own; game over does
  // the same once its cinematic lands, further down. Menu is the reset: whichever
  // screen sent the player back there, the bookmark should wait behind the edge
  // again next time it matters.
  const [bookmarkRevealed, setBookmarkRevealed] = useState(false)
  useEffect(() => {
    if (isPaused) setBookmarkRevealed(true)
  }, [isPaused])
  useEffect(() => {
    if (isMenu) setBookmarkRevealed(false)
  }, [isMenu])
  // One event per overlay actually opened. 'none' is a closing, not an opening.
  useEffect(() => {
    if (menuOverlay === 'none') return
    track('screen_opened', { screen: OVERLAY_SCREENS[menuOverlay] })
  }, [menuOverlay])
  const installPrompt = useInstall()
  // Whether session replay may run, and the two ways to change it — the banner below on
  // a first ask, the toggle inside OPTIONS on every ask after. See
  // hooks/use-replay-consent.ts for why there are not two stores for this.
  const replayConsent = useReplayConsent()
  const { done: splashDone } = useSplash()
  const { ready: updateReady, apply: applyUpdate } = useAppUpdate()

  // Close advanced options whenever the game starts or resumes so that pausing
  // again always shows the pause screen, not the advanced options overlay.
  useEffect(() => {
    if (isPlaying) setMenuOverlay('none')
  }, [isPlaying])

  // Whether the guide has been read, for the one achievement that asks.
  const howToPlay = useHowToPlay()
  const feedbackAnswered = useFeedbackAnswered()

  // Deals the tutorial on its own board. Shared by the three doors into it — the welcome, the
  // guide's TRY IT, and the dev sidebar — so all three agree on the board it is played on.
  //
  // The board is sent again here rather than trusted from wherever the caller left it: these
  // are the two events START reads, and a persisted mode landing in between — the hydration
  // hooks send the same events — would otherwise deal the run somewhere else.
  const startTutorial = useCallback(
    // Which door it came through. 'dev' is reported nowhere: a run dealt from the dev
    // sidebar would otherwise show up in the funnel as a player taking the tutorial.
    (from: TutorialDoor) => {
      send({ type: 'SET_MODE', mode: WELCOME_BOARD.mode })
      send({ type: 'SET_DIFFICULTY', difficulty: WELCOME_BOARD.difficulty })
      send({ type: 'START', now: Date.now(), runId: newRunId(), tutorial: true })
      if (from !== 'dev') track('run_started', { ...WELCOME_BOARD, from })
    },
    [send],
  )

  // The dev sidebar's way in — see hooks/use-tutorial-request.ts. Zero in a production
  // build, where nothing ever asks.
  const tutorialsAsked = useTutorialRequests()
  const tutorialsDealt = useRef(tutorialsAsked)
  useEffect(() => {
    if (tutorialsAsked === tutorialsDealt.current) return
    tutorialsDealt.current = tutorialsAsked
    // START is only accepted on the intro, so the run standing — if there is one — has to be
    // put down first. All three go whatever state the machine is in: a state with no handler
    // for one of them drops it, and the ones that land still walk playing → paused → menu.
    //
    // The run being replaced is abandoned rather than ended: no score is submitted on the way
    // out, where END RUN would have. That is the right trade for a dev button and the wrong
    // one for anything a player can press.
    pauseRun('dev')
    send({ type: 'MENU' })
    setMenuOverlay('none')
    startTutorial('dev')
  }, [tutorialsAsked, send, startTutorial])

  // A device nobody has played on opens on the intro with one card over it, offering the
  // tutorial — Trainee with its clock, its cadence and its options taken off. See
  // constants/tutorial.ts. The card itself is drawn below, on `welcomeOffer`.
  const welcome = useWelcome()

  return {
    applyUpdate,
    arcadeOpen,
    bookmarkRevealed,
    challengeCard,
    feedbackAnswered,
    feedbackOpen,
    howToPlay,
    installPrompt,
    menuOverlay,
    replayConsent,
    setArcadeOpen,
    setBookmarkRevealed,
    setChallengeCard,
    setFeedbackOpen,
    setMenuOverlay,
    setShareInvite,
    setTitleDialog,
    shareInvite,
    splashDone,
    startTutorial,
    titleDialog,
    updateReady,
    welcome,
  }
}

export type ScreenDialogs = ReturnType<typeof useScreenDialogs>
