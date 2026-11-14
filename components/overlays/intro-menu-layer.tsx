import { MenuOverlay } from '@/components/overlays/menu-overlay'
import type { ScreenIntro } from '@/hooks/use-intro-standing'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { idsOf, latestAchievement } from '@/lib/achievement-store'
import { track } from '@/lib/analytics'
import { newRunId } from '@/lib/run-id'
import { bestOn } from '@/machines/game'

// The intro screen, as the game screen hands it everything it reads and every door it opens.
export function IntroMenuLayer({
  control,
  dialogs,
  account,
  asks,
  announcements,
  intro,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  account: ScreenAccount
  asks: ScreenAsks
  announcements: ScreenAnnouncements
  intro: ScreenIntro
}) {
  const { difficulty, mode, send, setRunSession, stats } = control
  const {
    setArcadeOpen,
    setChallengeCard,
    setMenuOverlay,
    setShareInvite,
    setTitleDialog,
  } = dialogs
  const { dismissMoved, nickname, userId } = account
  const { nextVote, setShowNicknameModal, setVoteOpen, setVoteResultsOpen } = asks
  const { achievements, lostMedals, medals } = announcements
  const {
    accountEmail,
    accountNotice,
    handleCreateRoom,
    introDrawn,
    markSessionSeen,
    menuInitialTab,
    menuOnArcade,
    setMenuInitialTab,
    setMenuOnArcade,
  } = intro
  return (
    <>
      {/* ── Menu overlay ── */}
      {introDrawn && (
        <MenuOverlay
          gameMode={mode}
          difficulty={difficulty}
          userId={userId}
          nickname={nickname}
          bestScore={bestOn(stats, mode, difficulty).score}
          medals={medals}
          lostMedals={lostMedals.news}
          onLostMedalsSeen={lostMedals.dismiss}
          accountNotice={accountNotice}
          onAccountNotice={() => {
            if (accountNotice === 'moved') {
              // Clearing it here, on the tap, is the whole of how this line is
              // dismissed — it survives launches precisely so that it cannot be
              // missed, and the press is the player having read it.
              dismissMoved()
              accountEmail.open()
              return
            }
            accountEmail.openPendingConfirm()
          }}
          achievementsEarned={idsOf(achievements.store).length}
          achievementsLatest={latestAchievement(achievements.store)}
          achievementsLoaded={achievements.loaded}
          onOpenAchievements={() => {
            setTitleDialog('achievements')
            track('screen_opened', { screen: 'achievements' })
          }}
          onOpenMedals={() => {
            setTitleDialog('medals')
            track('screen_opened', { screen: 'medals' })
          }}
          initialPlayMode={menuInitialTab}
          onPlayModeChange={setMenuInitialTab}
          initialFocus={menuOnArcade ? 'arcade' : mode}
          onFocusChange={(focus) => {
            setMenuOnArcade(focus === 'arcade')
          }}
          onPlay={() => {
            setRunSession(null)
            setMenuInitialTab('alone')
            send({ type: 'START', now: Date.now(), runId: newRunId() })
            track('run_started', { mode, difficulty, from: 'menu' })
          }}
          onPlayArcade={() => {
            setMenuInitialTab('alone')
            setArcadeOpen(true)
          }}
          onSetMode={(next) => {
            send({ type: 'SET_MODE', mode: next })
          }}
          onSetDifficulty={(next) => {
            send({ type: 'SET_DIFFICULTY', difficulty: next })
          }}
          onOpenAdvanced={() => {
            setMenuOverlay('advanced')
          }}
          onAddNickname={() => {
            setShowNicknameModal(true)
          }}
          // Unseeded: a player taking this door has no address on this profile to
          // correct — the one card they get is the field, empty, and what it turns
          // out to mean is the server's answer rather than a question.
          onRestoreProfile={() => {
            accountEmail.open()
          }}
          onHowToPlay={() => {
            setMenuOverlay('howToPlay')
          }}
          onCreateRoom={handleCreateRoom}
          onOpenJoinRoom={() => {
            setMenuOverlay('joinRoom')
          }}
          onOpenChallenge={(card) => {
            if (card.state === 'live') markSessionSeen(card.session.id)
            setChallengeCard(card)
          }}
          nextVote={nextVote.options}
          onOpenVote={() => {
            setVoteOpen(true)
          }}
          onOpenVoteResults={() => {
            setVoteResultsOpen(true)
          }}
          onShare={setShareInvite}
          onOpenAdmin={() => {
            setMenuOverlay('admin')
          }}
        />
      )}
    </>
  )
}
