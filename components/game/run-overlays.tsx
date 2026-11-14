import Animated from 'react-native-reanimated'

import { AchievementDetail } from '@/components/overlays/achievement-detail'
import { GameOverSequence } from '@/components/overlays/game-over-sequence'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { StepUpOverlay } from '@/components/overlays/step-up-overlay'
import type { ScreenIntro } from '@/hooks/use-intro-standing'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import type { ScreenLifeLoss } from '@/hooks/use-life-loss'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenBoards } from '@/hooks/use-run-boards'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenEnding } from '@/hooks/use-run-ending'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { achievementCard } from '@/lib/achievements'
import { track } from '@/lib/analytics'
import { personalBar } from '@/lib/announcements'
import { newRunId } from '@/lib/run-id'
import { sessionClockOf } from '@/lib/run-session'
import { STEP_UP_BOARD } from '@/lib/step-up'
import { bestOn } from '@/machines/game'

// What stands over a run when it stops: the life-loss flash, the game-over cinematic, the
// pause screen and the step-up offer behind it, and the card a tapped achievement opens.
export function RunOverlays({
  control,
  dialogs,
  account,
  asks,
  boards,
  announcements,
  ending,
  dying,
  intro,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  account: ScreenAccount
  asks: ScreenAsks
  boards: ScreenBoards
  announcements: ScreenAnnouncements
  ending: ScreenEnding
  dying: ScreenLifeLoss
  intro: ScreenIntro
}) {
  const {
    corners,
    difficulty,
    elapsedMs,
    isPaused,
    mode,
    opening,
    playerClockMs,
    resuming,
    runSession,
    runSessionClosesAt,
    send,
    setCorner,
    setPlayerClockMs,
    setResuming,
    setRunSession,
    showPar,
    showRoute,
    showStats,
    state,
    stats,
    strikes,
    togglePar,
    toggleRoute,
    toggleStats,
    tutorial,
    windowShut,
  } = control
  const { setMenuOverlay } = dialogs
  const { nickname, userId } = account
  const { setShowNicknameModal } = asks
  const { board, runSessionBoard, runSessionMedals } = boards
  const {
    achievements,
    askedAchievement,
    avgAccuracy,
    avgSpeed,
    crossed,
    setAskedAchievement,
    setStepUpOpen,
    stepUpOpen,
  } = announcements
  const { endRunEarly, runMedals, runPodium, runScreen, titleRoll } = ending
  const {
    dyingPhase,
    flashStyle,
    overlayOpacity,
    overlayStyle,
    setOverlayTitleY,
    titleStyle,
  } = dying
  const { menuScreenOpen } = intro
  return (
    <>
      {/* ── Life-loss flash — red tint over the game screen ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: opening.flash,
          },
          flashStyle,
        ]}
      />

      {/* ── Game-over cinematic (overlay crossfade + flying title) ── */}
      <GameOverSequence
        sessionId={runSession}
        sessionBoard={runSessionBoard}
        sessionClosesAt={sessionClockOf(runSession, runSessionClosesAt)}
        windowShut={windowShut}
        // Where this run came on its session — see `runSessionMedals`. The rank is
        // needed a layer higher than the medal, because the title is decided here
        // and flies up before the screen under it exists.
        sessionMedals={runSessionMedals}
        sessionRank={runSessionMedals[0]?.rank ?? null}
        phase={dyingPhase}
        overlayStyle={overlayStyle}
        overlayOpacity={overlayOpacity}
        scheme={opening.scheme}
        titleStyle={titleStyle}
        onTitleLayout={setOverlayTitleY}
        gameMode={mode}
        difficulty={difficulty}
        userId={userId}
        nickname={nickname}
        score={state.context.score}
        hits={state.context.hits}
        gameTimeMs={state.context.elapsedMs}
        strikes={state.context.strikes}
        medals={runMedals}
        podium={runPodium}
        screen={runScreen}
        personalBest={crossed.includes('record')}
        bestScore={personalBar(
          bestOn(stats, mode, difficulty).score,
          board.forever.myBest,
        )}
        titleRoll={titleRoll}
        avgAccuracy={avgAccuracy}
        avgSpeed={avgSpeed}
        achievements={achievements.runEarned}
        achievementStore={achievements.store}
        achievementFacts={achievements.facts}
        onPlayAgain={() => {
          send({ type: 'RESTART', now: Date.now(), runId: newRunId() })
          track('run_started', { mode, difficulty, from: 'play_again' })
        }}
        onChallenge={(nextMode, nextDifficulty) => {
          // A dare is a different board, so it is not the session's run any more.
          // Without this the next run posts into the challenge's standings under
          // whatever mode and rung the dare picked — see `runSession`.
          setRunSession(null)
          // Both land before RESTART builds the fresh game, so it reads the board
          // the player just accepted — and the persistence hooks remember it.
          send({ type: 'SET_MODE', mode: nextMode })
          send({ type: 'SET_DIFFICULTY', difficulty: nextDifficulty })
          send({ type: 'RESTART', now: Date.now(), runId: newRunId() })
          track('challenge_accepted', {
            mode,
            difficulty,
            to_mode: nextMode,
            to: nextDifficulty,
          })
          track('run_started', {
            mode: nextMode,
            difficulty: nextDifficulty,
            from: 'challenge',
          })
        }}
        onMenu={() => {
          send({ type: 'MENU' })
        }}
      />

      {/* ── Pause overlay ── */}
      {/* Where the toast leads. Sits over the paused run, and takes the pause
      screen's place while it is up — both belong to the same frozen run, and two
      of them would be two answers to the same press. */}
      {isPaused && stepUpOpen && (
        <StepUpOverlay
          gameMode={STEP_UP_BOARD.mode}
          difficulty={STEP_UP_BOARD.difficulty}
          onStart={() => {
            // Out of the paused run first: START builds its fresh game from the
            // machine's own mode, so the board has to be set before it lands, and
            // only the menu accepts either.
            send({ type: 'MENU' })
            // The step-up is a board of its own, so whatever session the paused run
            // belonged to is not this run's. See the dare above and `runSession`.
            setRunSession(null)
            send({ type: 'SET_MODE', mode: STEP_UP_BOARD.mode })
            send({ type: 'SET_DIFFICULTY', difficulty: STEP_UP_BOARD.difficulty })
            send({ type: 'START', now: Date.now(), runId: newRunId() })
            setStepUpOpen(false)
            track('challenge_accepted', {
              mode,
              difficulty,
              to_mode: STEP_UP_BOARD.mode,
              to: STEP_UP_BOARD.difficulty,
            })
            track('run_started', {
              mode: STEP_UP_BOARD.mode,
              difficulty: STEP_UP_BOARD.difficulty,
              from: 'challenge',
            })
          }}
          onOtherMode={() => {
            // The intro with every board on offer, rather than the one we picked.
            send({ type: 'MENU' })
            setRunSession(null)
            setStepUpOpen(false)
          }}
        />
      )}

      {isPaused && !menuScreenOpen && !stepUpOpen && !resuming && (
        <PausedOverlay
          sessionClosesAt={sessionClockOf(runSession, runSessionClosesAt)}
          sessionBoard={runSessionBoard}
          gameMode={mode}
          difficulty={difficulty}
          userId={userId}
          nickname={nickname}
          score={state.context.score}
          hits={state.context.hits}
          gameTimeMs={elapsedMs}
          strikes={strikes}
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          achievements={achievements.runEarned}
          achievementStore={achievements.store}
          achievementFacts={achievements.facts}
          tutorial={tutorial}
          corners={corners}
          onSelectCorner={setCorner}
          showPar={showPar}
          onTogglePar={togglePar}
          showStats={showStats}
          onToggleStats={toggleStats}
          showRoute={showRoute}
          onToggleRoute={toggleRoute}
          playerClockMs={playerClockMs}
          onSetPlayerClock={setPlayerClockMs}
          onContinue={() => {
            setResuming(true)
          }}
          onRestart={() => {
            // The run being abandoned is still live, so its score goes to the board
            // before the fresh one replaces it — same as leaving for the intro.
            endRunEarly('restart')
            send({ type: 'RESTART', now: Date.now(), runId: newRunId() })
            track('run_started', { mode, difficulty, from: 'restart' })
          }}
          onMenu={() => {
            endRunEarly('end_run')
            send({ type: 'MENU' })
          }}
          onOpenAdvanced={() => {
            setMenuOverlay('advanced')
          }}
          onAddNickname={() => {
            setShowNicknameModal(true)
          }}
        />
      )}

      {/* ── The card a tapped announcement opens ──
        After the pause screen it brought on, so it lands over it rather than
        under. The same card the chips on the pause and game over screens open,
        over everything the run has earned so far and opened on the one the bar
        was naming. */}
      {askedAchievement !== null && (
        <AchievementDetail
          {...achievementCard(achievements.runEarned, askedAchievement)}
          store={achievements.store}
          facts={achievements.facts}
          onDismiss={() => {
            setAskedAchievement(null)
          }}
        />
      )}
    </>
  )
}
