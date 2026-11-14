import { useLingui } from '@lingui/react/macro'

import { FeedbackBookmark } from '@/components/feedback-bookmark'
import { AchievementsOverlay } from '@/components/overlays/achievements-overlay'
import { FeedbackOverlay } from '@/components/overlays/feedback-overlay'
import { MedalsOverlay } from '@/components/overlays/medals-overlay'
import { ModalCard } from '@/components/overlays/modal-card'
import { NICKNAME_TITLE, NicknameModal } from '@/components/overlays/nickname-modal'
import { PRIMARY_INK } from '@/constants/colors'
import type { ScreenIntro } from '@/hooks/use-intro-standing'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import type { ScreenLifeLoss } from '@/hooks/use-life-loss'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { track } from '@/lib/analytics'
import { feedbackGameState, showFeedbackBookmark } from '@/lib/feedback-bookmark'

// The feedback bookmark and its dialog, the two dialogs behind the line under the title,
// and the nickname card — each drawn over whichever screen is up.
export function TitleDialogs({
  control,
  dialogs,
  account,
  asks,
  announcements,
  dying,
  intro,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  account: ScreenAccount
  asks: ScreenAsks
  announcements: ScreenAnnouncements
  dying: ScreenLifeLoss
  intro: ScreenIntro
}) {
  const { t } = useLingui()
  const { difficulty, isGameOver, mode, opening, resuming, state } = control
  const {
    arcadeOpen,
    bookmarkRevealed,
    feedbackOpen,
    menuOverlay,
    setBookmarkRevealed,
    setFeedbackOpen,
    setTitleDialog,
    titleDialog,
  } = dialogs
  const { email, updateNickname } = account
  const { setShowNicknameModal, showNicknameModal } = asks
  const { achievements, medalHistory, standings } = announcements
  const { gameOverBookmarkReady } = dying
  const {
    accountEmail,
    executeMultiAction,
    pendingMultiAction,
    setPendingMultiAction,
    showMultiGame,
  } = intro
  return (
    <>
      {/* ── Feedback bookmark and its dialog — every screen except a live run ── */}
      {/* Mounted after the overlays so they draw over whichever one is up; a live
        dial is the one place a tab a thumb could graze has no business being.
        On game over it waits for gameOverBookmarkReady — see the dying-sequence
        effect above — rather than showing the instant isGameOver flips. */}
      {showFeedbackBookmark({
        // A run held for its opening counts: the scene ends in a live run, and a
        // dialog opened over it would leave that run playing underneath.
        isPlaying: opening.inPlay,
        resuming,
        showMultiGame,
        feedbackOpen,
        isGameOver,
        gameOverBookmarkReady,
        inArcade: arcadeOpen,
        inArchive: menuOverlay === 'news',
      }) && (
        <FeedbackBookmark
          mode={mode}
          revealed={bookmarkRevealed}
          onCollapse={() => {
            setBookmarkRevealed(false)
          }}
          onPress={() => {
            setFeedbackOpen(true)
            track('screen_opened', { screen: 'feedback' })
          }}
        />
      )}
      {/* ── The two dialogs behind the line under the title, drawn over whatever
        screen opened them rather than in place of it — see TitleDialog ── */}
      {titleDialog === 'medals' && (
        <MedalsOverlay
          standings={standings}
          history={medalHistory}
          onClose={() => {
            setTitleDialog('none')
          }}
        />
      )}
      {titleDialog === 'achievements' && (
        <AchievementsOverlay
          store={achievements.store}
          facts={achievements.facts}
          onClose={() => {
            setTitleDialog('none')
          }}
        />
      )}

      {feedbackOpen && (
        <FeedbackOverlay
          gameMode={mode}
          difficulty={difficulty}
          score={state.context.score}
          gameState={feedbackGameState(state.value, state.context)}
          onClose={() => {
            setFeedbackOpen(false)
          }}
        />
      )}

      {/* ── The nickname ──
        The app's ordinary dialog, like the address one it hands over to. It used to
        be a platform window for the keyboard's sake; `ModalCard`'s `avoidKeyboard`
        is what made that unnecessary, and being the same kind of dialog as its
        successor is what makes the hand-over safe — nothing is presented while
        something else is dismissing, which is the swap iOS used to drop. */}
      {showNicknameModal && (
        <ModalCard
          title={t(NICKNAME_TITLE)}
          titleColor={PRIMARY_INK}
          closeButton={false}
          avoidKeyboard
          onDismiss={() => {
            setShowNicknameModal(false)
            setPendingMultiAction(null)
          }}
        >
          {(close) => (
            <NicknameModal
              onSave={async (name) => {
                const res = await updateNickname(name)
                if (res.error) return res
                setShowNicknameModal(false)
                if (pendingMultiAction) {
                  executeMultiAction(pendingMultiAction)
                  setPendingMultiAction(null)
                }
                // The second step of claiming a name, and it is immediate: the card turns
                // over to ask for an address. Nothing gates it but already having one —
                // a player on their way into a multiplayer room gets the room *and* the
                // card, because the ask is worth more than the half second of tidiness
                // that skipping it would buy.
                if (email === null) accountEmail.open()
                return res
              }}
              onDismiss={close}
            />
          )}
        </ModalCard>
      )}
    </>
  )
}
