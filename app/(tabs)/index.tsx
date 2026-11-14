import { useLingui } from '@lingui/react/macro'
import { StatusBar } from 'expo-status-bar'
import { isOneOf } from 'narrowland'
import { lazy, Suspense } from 'react'
import { Text, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { FeedbackBookmark } from '@/components/feedback-bookmark'
import { AnnouncementEffect } from '@/components/game/announcement-effect'
import { ArcadeGame } from '@/components/game/arcade-game'
import { Arrival, ArrivalStage } from '@/components/game/arrival'
import { BarScore } from '@/components/game/bar-score'
import { BestScoresLine } from '@/components/game/best-scores-line'
import { Confetti } from '@/components/game/confetti'
import { Dial } from '@/components/game/dial'
import { AXIS_STRIP } from '@/components/game/dial-axes'
import { DigitStrip } from '@/components/game/digit-strip'
import { DraftedSegments } from '@/components/game/drafted-segments'
import { FloatingLifeLoss } from '@/components/game/floating-life-loss'
import { FloatingPoints } from '@/components/game/floating-points'
import { FloatingStat } from '@/components/game/floating-stat'
import { FootprintTrail } from '@/components/game/footprint-trail'
import { HeartIcon } from '@/components/game/heart-icon'
import { HitSync } from '@/components/game/hit-sync'
import { MultiplayerGame } from '@/components/game/multiplayer-game'
import {
  OpeningLayer,
  OpeningOver,
  OpeningRemains,
  OpeningUnder,
} from '@/components/game/opening-layer'
import { PencilWipe } from '@/components/game/pencil-wipe'
import { RunStopwatch } from '@/components/game/run-stopwatch'
import { RunTopBar } from '@/components/game/run-top-bar'
import { ScoreDigit } from '@/components/game/score-digit'
import { StepUpToast } from '@/components/game/step-up-toast'
import { StrikeShot } from '@/components/game/strike-shot'
import { SumHush } from '@/components/game/sum-hush'
import { TraineeStats } from '@/components/game/trainee-stats'
import { TutorialCard } from '@/components/game/tutorial-card'
import { TutorialIntro } from '@/components/game/tutorial-intro'
import { TutorialStepper } from '@/components/game/tutorial-stepper'
import { AchievementDetail } from '@/components/overlays/achievement-detail'
import { AchievementsOverlay } from '@/components/overlays/achievements-overlay'
import { AdminOverlay } from '@/components/overlays/admin-overlay'
import { AdvancedOptionsOverlay } from '@/components/overlays/advanced-options-overlay'
import { ChallengeModal } from '@/components/overlays/challenge-modal'
import { FeedbackOverlay } from '@/components/overlays/feedback-overlay'
import { FeedbackReplyOverlay } from '@/components/overlays/feedback-reply-overlay'
import { GameOverSequence } from '@/components/overlays/game-over-sequence'
import { HowToPlayOverlay } from '@/components/overlays/how-to-play-overlay'
import { InstallOverlay } from '@/components/overlays/install-overlay'
import { JoinRoomOverlay } from '@/components/overlays/join-room-overlay'
import { MedalsOverlay } from '@/components/overlays/medals-overlay'
import { MenuOverlay } from '@/components/overlays/menu-overlay'
import { ModalCard } from '@/components/overlays/modal-card'
import { MultiplayerGameOver } from '@/components/overlays/multiplayer-game-over'
import { MultiplayerMenu } from '@/components/overlays/multiplayer-menu'
import { MultiplayerWaiting } from '@/components/overlays/multiplayer-waiting'
import { NewsArchiveOverlay } from '@/components/overlays/news-archive-overlay'
import { NextVoteDialog } from '@/components/overlays/next-vote-dialog'
import { NextVoteResultsDialog } from '@/components/overlays/next-vote-results-dialog'
import { NICKNAME_TITLE, NicknameModal } from '@/components/overlays/nickname-modal'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { PushConsentOverlay } from '@/components/overlays/push-consent-overlay'
import { RatingOverlay } from '@/components/overlays/rating-overlay'
import { ReplayConsentOverlay } from '@/components/overlays/replay-consent-overlay'
import { ShareModal } from '@/components/overlays/share-modal'
import { StepUpOverlay } from '@/components/overlays/step-up-overlay'
import { TutorialDoneModal } from '@/components/overlays/tutorial-done-modal'
import { TutorialOfferModal } from '@/components/overlays/tutorial-offer-modal'
import { WhatsNewOverlay } from '@/components/overlays/whats-new-overlay'
import { RolePreviewBadge } from '@/components/role-preview-badge'
import { Screen } from '@/components/screen'
import { SurfaceWash } from '@/components/surface-wash'
import { TrackedPressable } from '@/components/tracked-pressable'
import { PRIMARY_INK } from '@/constants/colors'
import { DEFAULT_DIAL_CORNERS } from '@/constants/dial-hints'
import { TUTORIAL_BANNER_HEIGHT } from '@/constants/tutorial'
import { TYPE } from '@/constants/typography'
import { BoardProvider } from '@/hooks/use-board'
import { ChampionsProvider } from '@/hooks/use-champions'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { FlagsProvider } from '@/hooks/use-flags'
import { useIntroStanding } from '@/hooks/use-intro-standing'
import { useLaunchAsks } from '@/hooks/use-launch-asks'
import { useLifeLoss } from '@/hooks/use-life-loss'
import { LocaleGate } from '@/hooks/use-locale'
import { usePlayField } from '@/hooks/use-play-field'
import { usePlayerAccount } from '@/hooks/use-player-account'
import { PlayerProfileProvider } from '@/hooks/use-profile-modal'
import { useRunAnnouncements } from '@/hooks/use-run-announcements'
import { useRunBoards } from '@/hooks/use-run-boards'
import { useRunControl } from '@/hooks/use-run-control'
import { useRunEnding } from '@/hooks/use-run-ending'
import { useRunSession } from '@/hooks/use-run-session'
import { SchemeProvider } from '@/hooks/use-scheme'
import { useScreenDialogs } from '@/hooks/use-screen-dialogs'
import { idsOf, latestAchievement } from '@/lib/achievement-store'
import { achievementCard } from '@/lib/achievements'
import { track } from '@/lib/analytics'
import { personalBar } from '@/lib/announcements'
import { DRAW } from '@/lib/dial-sketch'
import { feedbackGameState, showFeedbackBookmark } from '@/lib/feedback-bookmark'
import { newRunId } from '@/lib/run-id'
import { sessionBestsOf, sessionClockOf } from '@/lib/run-session'
import { wordmarkFor } from '@/lib/run-title'
import { STEP_UP_BOARD } from '@/lib/step-up'
import { multiplierColor } from '@/lib/streak-badge'
import { valueProgress } from '@/lib/value-progress'
import { bestOn } from '@/machines/game'
import { computePar } from '@/machines/scoring'
import {
  darkGradientOf,
  gradientOf,
  isMode,
  runLabel,
  SCORED_MODES,
  showsFigures,
} from '@/modes'

// The screen gallery's stage, in development only — the screen being looked at, drawn
// inside the app so it sees the real board store, champions, fonts and theme. Its picker
// lives outside the phone frame; see app/_layout.tsx.
//
// Loaded through a dynamic import inside a `__DEV__` ternary rather than imported at the
// top: babel-preset-expo folds `__DEV__` to false before Metro builds its dependency
// graph, so a production export drops the branch, the arrow that names the module, and
// therefore the module itself. A static import would be hoisted and shipped whatever the
// branch said.
//
// `import()` rather than `require()` because it carries its own types — `require`
// returns `any`, and typing that back would take either an assertion or a lint
// exemption, both of which this codebase does without.
const GalleryStage = __DEV__
  ? lazy(async () => {
      const mod = await import('@/dev/gallery')
      return { default: mod.GalleryStage }
    })
  : null

// Trainee's shower wears the mode's own blue rather than the default spectrum. This
// fires on every clean hit, and the full arc is the personal-best celebration's — a
// hit-by-hit sprinkle borrowing it made the two read as the same event.
const TRAINEE_CONFETTI = [gradientOf('trainee')[0]] as const

// What the pause button does, or null where it is not drawn. It stands through a held run's
// opening too, so the top bar is whole from the first frame: a tap there is the opening's skip,
// which lies over the bar, and so this one is never heard.
const pauseButtonPress = (
  playing: boolean,
  held: boolean,
  pause: () => void,
): (() => void) | null => {
  if (playing) return pause
  return held ? () => {} : null
}

// The row of hearts and score on a **mirrored** dial, drawn back to front like the rest of it.
const MIRRORED_ROW = { transform: [{ scaleX: -1 }] }

// The hearts are laid in a row, a few points apart; a board drawn in wraps them in a box of their
// own, which has to lay them out the same way.
const HEARTS_ROW = { flexDirection: 'row', gap: 4 } as const

export default function GameScreen() {
  const { t } = useLingui()
  const control = useRunControl()
  const session = useRunSession({ control })
  const dialogs = useScreenDialogs({ control })
  const account = usePlayerAccount()
  const asks = useLaunchAsks({ control, dialogs, account })
  const boards = useRunBoards({ control, account })
  const announcements = useRunAnnouncements({
    control,
    session,
    dialogs,
    account,
    asks,
    boards,
  })
  const ending = useRunEnding({ control, account, asks, boards, announcements })
  const field = usePlayField({ control, boards, announcements, ending })
  const dying = useLifeLoss({ control, dialogs, field })
  const intro = useIntroStanding({ control, dialogs, account, asks, announcements })

  const {
    dismissMoved,
    email,
    nickname,
    pendingEmail,
    rolePreview,
    shownFeatures,
    updateNickname,
    userId,
  } = account
  const {
    bestEver,
    bestToday,
    bestWeek,
    board,
    champions,
    inRun,
    previousWinner,
    runSessionBoard,
    runSessionMedals,
  } = boards
  const {
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
  } = intro
  const {
    TargetBoard,
    TargetView,
    barGlow,
    barLightStyle,
    corners,
    dial,
    difficulty,
    digitFont,
    drag,
    elapsedMs,
    grid,
    hitBatch,
    hits,
    isGameOver,
    isMenu,
    isPaused,
    isPlaying,
    lives,
    mode,
    opening,
    pauseRun,
    playerClockMs,
    resuming,
    rules,
    runAccent,
    runId,
    runSession,
    runSessionClosesAt,
    runSubtitle,
    send,
    setCorner,
    setPlayerClockMs,
    setResuming,
    setRunSession,
    setRunSessionClosesAt,
    setWindowShut,
    showPar,
    showRoute,
    showStats,
    showSum,
    state,
    stats,
    streak,
    strikes,
    submode,
    toggleDrag,
    togglePar,
    toggleRoute,
    toggleStats,
    toggleSum,
    tutorial,
    windowShut,
  } = control
  const {
    achievements,
    announcement,
    askedAchievement,
    avgAccuracy,
    avgSpeed,
    celebration,
    coach,
    crossed,
    lostMedals,
    medalHistory,
    medals,
    sendDialed,
    setAskedAchievement,
    setStepUpOpen,
    setSweptIn,
    standings,
    stepUp,
    stepUpOpen,
  } = announcements
  const {
    avgDirection,
    avgStat,
    barDrawn,
    boardTargets,
    currentMultiplier,
    dialControls,
    direction,
    drafting,
    drawing,
    drill,
    drillCards,
    drillTints,
    flame,
    floatStats,
    floats,
    furthestStep,
    legs,
    lesson,
    noteBoardSize,
    noteSumRowRect,
    onContainerLayout,
    removeDisplayed,
    removeFloat,
    removeFloatStat,
    removeShot,
    setRewindSeq,
    shots,
    shownSum,
    shuffleDial,
    shuffles,
    targetsShortcuts,
    taught,
    tip,
  } = field
  const { handleWindowShut, setModeBeforeSession } = session
  const {
    dyingPhase,
    flashStyle,
    gameOverBookmarkReady,
    lostMarks,
    overlayOpacity,
    overlayStyle,
    setOverlayTitleY,
    targetsAreaRef,
    titleStyle,
  } = dying
  const { endRunEarly, runMedals, runPodium, runScreen, titleRoll } = ending
  const {
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
    welcome,
  } = dialogs
  const {
    feedbackReplies,
    launchPopupUp,
    nextVote,
    pushConsent,
    setShowNicknameModal,
    setVoteOpen,
    setVoteResultsOpen,
    showNicknameModal,
    voteOpen,
    voteResultsOpen,
    whatsNew,
  } = asks

  return (
    // Outermost, because what a player may be shown decides whether a door is drawn at
    // all — a question that comes before anything behind the door. Empty until auth has
    // answered, which for all but a handful of players is the answer; see use-flags.
    //
    // A role preview replaces the set here and nowhere else: this is the one place that
    // decides what is drawn, and a preview is a view rather than a grant. Every write is
    // still guarded on the server against the caller's own row.
    <FlagsProvider features={shownFeatures}>
      {/* Renders nothing. The language lives above the splash and the feature set
          arrives here, so this is where the two meet — see LocaleGate. */}
      <LocaleGate />
      {/* Every board on screen reads this one store, so the intro, the pause screen and
          the game over screen cannot show three different answers to the same question. */}
      <ChampionsProvider value={champions}>
        {/* Inside the champions provider: a profile wears the same crown or bird the row
          that opened it does, read from the one store rather than fetched again. */}
        <PlayerProfileProvider
          viewerId={userId}
          account={{
            email,
            pendingEmail,
            emailFlow: accountEmail,
            onRename: updateNickname,
          }}
        >
          <BoardProvider value={board}>
            {/* First of all, so the game and everything over it paints on the wash. */}
            <SchemeProvider kind={opening.scheme}>
              <SurfaceWash />
            </SchemeProvider>
            <StatusBar style={opening.statusBar} />

            {/* The celebration sits before the Screen so it paints behind the game's own UI.
            Keyed on the announcement so each one plays from the start, and so escalating
            through two records in a run swaps the effect rather than reusing it. */}
            {announcement !== null && (
              <AnnouncementEffect
                key={announcement.id}
                id={announcement.id}
                mode={mode}
              />
            )}

            {/* Trainee celebrates the hit rather than the run — half a record's pieces,
            because this fires many times a run and should not shout as loudly.
            Keyed on the batch so consecutive clean hits each get their own. */}
            {celebration.seq !== null && (
              <Confetti key={celebration.seq} density="half" colors={TRAINEE_CONFETTI} />
            )}

            {/* Trainee only, once a run, and never for a player who already knows the
            boards exist. Floats over the top bars rather than sitting in the layout —
            Trainee reclaims the band a strip would occupy. Holds until it is answered,
            which is why it carries NOT NOW — and holds through a pause rather than being
            withdrawn by one, which is why it is drawn only while the run is live: an
            unanswered offer belongs over the dial, not over the pause screen. */}
            {isPlaying && stepUp.message !== null && !stepUpOpen && (
              <StepUpToast
                opener={stepUp.message.opener}
                invite={stepUp.message.invite}
                mode={STEP_UP_BOARD.mode}
                onPress={() => {
                  // Frozen rather than ended: backing out of the screen this opens leaves
                  // the practice run exactly where it stood.
                  pauseRun('step_up')
                  stepUp.dismiss()
                  setStepUpOpen(true)
                }}
                onDismiss={stepUp.dismiss}
              />
            )}

            {/* The same offer the toast makes, at the one moment the tutorial has it to
            make: the lesson over and a target taken without it. A dialog rather than a
            toast because nothing is running underneath — the tutorial has no clock — and
            because the end of the lesson is worth stopping for.

            Drawn through the pause it opens as well as the run it was made on: accepting
            freezes the run behind it, and the card has an exit to play before the screen
            it leads to takes over. */}
            {taught.open && (
              <TutorialDoneModal
                mode={STEP_UP_BOARD.mode}
                onAccept={() => {
                  // Frozen rather than ended, exactly as the toast does it: backing out
                  // of the screen this opens leaves the tutorial where it stood.
                  pauseRun('step_up')
                  taught.dismiss()
                  setStepUpOpen(true)
                }}
                onDismiss={taught.dismiss}
              />
            )}

            {/* ── Game screen (single padded wrapper) ── */}
            {/* In the run's **scheme**; the overlays after it keep their own. */}
            <SchemeProvider kind={opening.scheme}>
              {/* What the opening left behind, under everything the run draws. */}
              <OpeningUnder kind={opening.layer} sweep={opening.sweep} />
              <OpeningRemains
                kind={opening.remains}
                lit={opening.peeking}
                pull={opening.pull}
                running={isPlaying}
                finished={isGameOver}
                runId={state.context.runId}
                grid={state.context.grid}
                figures={{ accuracy: avgAccuracy, speed: avgSpeed, streak, hits, lives }}
              />
              {/* Each time a run leaves the intro, the screen comes in a piece at a time
              — see components/game/arrival.tsx. */}
              <ArrivalStage arrived={!isMenu} topAtOnce={dial.mirror}>
                <Screen>
                  {/* Every row above the dial, in the scheme those rows wear. */}
                  <SchemeProvider kind={opening.barScheme} ink={opening.barTint}>
                    <Animated.View style={barLightStyle}>
                      {/* Row 0 — board bests, a hairline above the top bar. In every mode,
              Trainee included: it has no board to report, and reserves the height
              instead, so that the dial below is the same size in all of them. */}
                      <Arrival order={0} from="above">
                        <BestScoresLine
                          session={sessionBestsOf(
                            runSession,
                            runSessionClosesAt,
                            runSessionBoard,
                            rules.scoring.measure,
                            userId,
                            previousWinner,
                          )}
                          onWindowShut={handleWindowShut}
                          inRun={inRun}
                          mode={mode}
                          announcement={announcement}
                          onOpenAchievement={(id) => {
                            pauseRun('achievement')
                            setAskedAchievement(id)
                          }}
                          onPause={() => {
                            pauseRun('best_scores')
                          }}
                          viewerId={userId}
                          score={state.context.score}
                          yourBest={bestOn(stats, mode, difficulty).score}
                          loaded={board.loaded}
                          todayIsMine={board.today.recordIsMine}
                          weekIsMine={board.week.recordIsMine}
                          everIsMine={board.forever.recordIsMine}
                          todayHolder={board.today.recordHolder}
                          weekHolder={board.week.recordHolder}
                          everHolder={board.forever.recordHolder}
                          today={bestToday}
                          week={bestWeek}
                          ever={bestEver}
                        />
                      </Arrival>
                      {/* A step up in the stack, which only ever matters during the tutorial: the
                  card's tap-through is the last child of this screen and covers everything
                  under this band, so without the lift MENU would be unreachable for as
                  long as a card was up. Harmless everywhere else — nothing else here
                  overlaps the bar. */}
                      <View className="mb-3" style={{ zIndex: 1 }}>
                        {/* Row 1 — the same bar every run is played under. NINE is tinted by
                    the rung here; the pause button shows only while a run is actually
                    going, since the screen it opens is a full overlay that covers this
                    slot rather than needing a button of its own on top. */}
                        <View className="mb-1">
                          <RunTopBar
                            accent={runAccent}
                            title={t(runLabel(mode, submode))}
                            subtitle={
                              runSubtitle === null ? null : t(runSubtitle).toLowerCase()
                            }
                            wordmark={wordmarkFor(mode, difficulty)}
                            mirrored={dial.mirror}
                            drawn={barDrawn}
                            onPause={pauseButtonPress(isPlaying, opening.held, () => {
                              pauseRun('button')
                            })}
                          />
                        </View>

                        {/* Row 2 — hearts · center stat or the lesson's steps · score cluster */}
                        <View
                          className="mt-1.5 flex-row items-center"
                          style={dial.mirror ? MIRRORED_ROW : undefined}
                        >
                          {/* Hearts — one per life the mode actually gives, and a mode that
                    spends none shows none.

                    **As many as the mode gives, not three.** This drew a fixed `[0, 1, 2]`
                    whatever the rules said, which was right while every mode that spent
                    lives spent three of them. A challenge may pin two — `four-keys` does —
                    and the third heart then rendered empty: it stayed mounted across the
                    mode change with `filled` flipping true → false, which is precisely the
                    signal `HeartIcon` plays the *losing a life* sequence for. So a
                    challenge opened by visibly killing a heart the player never had, on
                    its first frame.

                    Drawing the real count fixes it at the source: the extra heart is
                    unmounted rather than emptied, and an unmount animates nothing. Losing
                    a life mid-run still flips a mounted heart and still plays. */}
                          <Arrival
                            order={4}
                            from="above"
                            className="relative flex-1 flex-row gap-1"
                          >
                            {/* Drawn in after the top line, on a board that is being drawn. */}
                            <PencilWipe
                              progress={barDrawn}
                              window={DRAW.hearts}
                              style={HEARTS_ROW}
                            >
                              {rules.lives.count !== Number.POSITIVE_INFINITY &&
                                Array.from({ length: rules.lives.count }, (_, i) => (
                                  <HeartIcon
                                    key={i}
                                    filled={i < lives}
                                    emptyColor={'#FDFCFA'}
                                  />
                                ))}
                            </PencilWipe>
                            {/* Says why, the moment a hit rather than an expiry is what took the
                      heart — Accuracy's wasteful-hit rule is invisible otherwise.
                      Shares the points floats' lifecycle: same `floats` list, same
                      removal, just a second element for the rare entry that costLife. */}
                            {floats
                              .filter((f) => f.costLife)
                              .map((f) => (
                                <FloatingLifeLoss
                                  key={f.id}
                                  onDone={() => {
                                    removeFloat(f.id)
                                  }}
                                />
                              ))}
                          </Arrival>

                          {/* Where the player is in the lesson, in the slot a scored run keeps its
                      score bar in — which a tutorial draws nothing of: no hearts, since its
                      lives never run out, no accuracy, and no score. So the row is empty in
                      a lesson, and this is the one place on the screen that both belongs to
                      the run's own chrome and has nothing else to say.

                      It sat under the board once, between the targets and the banner. Up
                      here it is the top bar's third line rather than something floating in
                      the playfield, and the canvas below keeps the height the dots were
                      taking.

                      Dark and deaf while one of the lesson's cards is up: the card's
                      tap-through takes the whole viewport under this band, so a press here
                      is a press meant for the card. `onTapThrough` is non-null exactly at
                      those steps. */}
                          <Arrival order={5} from="above">
                            {tutorial && (
                              <TutorialStepper
                                current={hits}
                                furthest={furthestStep}
                                live={lesson.onTapThrough === null}
                                onGo={(board) => {
                                  send({ type: 'REWIND', board, now: Date.now() })
                                  setRewindSeq((seq) => seq + 1)
                                }}
                              />
                            )}

                            {/* Center: the figure the run is judged by.
                      
                      A race is judged by its clock, so that is what stands here — the
                      same number the standings will place it on, running. A hits run is
                      judged by how many targets it has taken, and shows that count: its
                      average accuracy could only ever read 100%, a slip being the end of
                      it. Every other scored run is judged by a factor and shows the
                      average of it. Nothing stands here on a mode with neither. */}
                            {!showsFigures(mode) && rules.scoring.measure === 'time' && (
                              <RunStopwatch
                                elapsedMs={state.context.elapsedMs}
                                playingSince={state.context.playingSince}
                                digitFont={digitFont}
                              />
                            )}

                            {!showsFigures(mode) && rules.scoring.measure === 'hits' && (
                              <DigitStrip text={String(hits)} direction={1} />
                            )}

                            {!showsFigures(mode) &&
                              rules.scoring.measure === 'score' &&
                              isOneOf(mode, SCORED_MODES) && (
                                <View style={{ alignItems: 'center' }}>
                                  <DigitStrip
                                    text={`${avgStat}%`}
                                    direction={avgDirection.current}
                                  />
                                  {floatStats.map((f) => (
                                    <FloatingStat
                                      key={f.id}
                                      value={f.value}
                                      progress={f.progress}
                                      onDone={() => {
                                        removeFloatStat(f.id)
                                      }}
                                    />
                                  ))}
                                </View>
                              )}
                          </Arrival>

                          {/* Score cluster: digital readout + streak multiplier badge.
                  Hidden in a mode that keeps no board — practice is not a scored run. */}
                          <Arrival
                            order={6}
                            from="above"
                            className="flex-1 relative items-end"
                          >
                            {rules.capabilities.scored && (
                              <>
                                <PencilWipe progress={barDrawn} window={DRAW.score}>
                                  <View className="flex-row items-baseline gap-1.5">
                                    <BarScore
                                      score={state.context.score}
                                      digitFont={digitFont}
                                      glow={barGlow}
                                    />
                                    {streak > 0 && (
                                      <Text
                                        selectable={false}
                                        className={TYPE.buttonSm}
                                        style={[
                                          {
                                            color:
                                              opening.barInk ??
                                              multiplierColor(currentMultiplier),
                                          },
                                          barGlow,
                                        ]}
                                      >
                                        {`×${currentMultiplier}`}
                                      </Text>
                                    )}
                                  </View>
                                </PencilWipe>
                                {floats.map((f) => (
                                  <FloatingPoints
                                    key={f.id}
                                    points={f.points}
                                    progress={f.progress}
                                    multiplier={f.multiplier}
                                    onDone={() => {
                                      removeFloat(f.id)
                                    }}
                                  />
                                ))}
                              </>
                            )}
                          </Arrival>
                        </View>
                      </View>
                    </Animated.View>
                  </SchemeProvider>

                  {/* The board and the sum row in one box, because a strike's shot crosses
                between them: the layer at the end of it is absolute over both, and this
                is the only space where the muzzle and the target it is aimed at are
                measured from the same origin. */}
                  <View className="flex-1">
                    {/* Target numbers */}
                    <View className="flex-1">
                      {/* The footprints of a steps run, on the floor under every card. */}
                      <FootprintTrail legs={legs} />
                      {/* Trainee's readout — how many targets they have cleared and how the press
                  they just made actually went, which is what a learner wants and a score
                  cannot tell them.

                  It sits inside the targets area rather than up in the top bar, and that is
                  a layout constraint rather than a design preference: the bar's height comes
                  out of the same leftover the dial is sized from, and this block is ~85px
                  against the bests strip's 25, which took about 10px off every dial button
                  in Trainee alone. Down here it costs the spawn canvas instead — which has
                  room to give, and which is measured below, so targets never land under it.

                  Nothing of it in the tutorial. Every figure here is a reading of a run
                  that has barely started, and the line under them coaches a press the
                  player has not been told how to make yet — the teaching there is the
                  tooltips still to come, and this would be talking over them. */}
                      {rules.capabilities.coached && (
                        <TraineeStats
                          hits={hits}
                          batch={hitBatch}
                          praise={celebration.message ?? coach.line}
                          showStats={showStats}
                          showRoute={showRoute}
                          route={coach.route}
                          routeStart={coach.routeStart}
                          routeTarget={coach.routeTarget}
                        />
                      )}

                      {/* The canvas the targets actually spawn into. It carries the measurement,
                  so its bounds are whatever is left after the readout above. */}
                      <GestureDetector gesture={targetsShortcuts}>
                        <View
                          ref={targetsAreaRef}
                          className="flex-1"
                          onLayout={(event) => {
                            onContainerLayout(event)
                            noteBoardSize(event)
                          }}
                        >
                          {/* The targets in the mode's **target form**: discs where they were
                              dealt, or a terminal's lines. */}
                          <TargetBoard
                            runId={runId}
                            take={opening.take}
                            held={opening.held}
                          >
                            {boardTargets.map((target) => (
                              <TargetView
                                maxValue={dial.maxSum}
                                key={target.id}
                                target={target}
                                // The clock this target spawned with, so a ring never retargets
                                // mid-flight when Speed's timeout tightens.
                                duration={target.duration}
                                par={
                                  rules.capabilities.coached && showPar
                                    ? computePar(dial, grid, target.value)
                                    : undefined
                                }
                                dying={isGameOver && dyingPhase !== 'waiting'}
                                frozen={isPaused}
                                // Nine cards have to stand on this board at once in a drilled
                                // run, and nine at `PIE_SIZE` do not fit a phone — so each is
                                // given its own size, and they differ from one another on
                                // purpose. Undefined everywhere else, which is the size every
                                // other mode draws.
                                size={drillCards?.[target.seq]?.size}
                                // A drilled board keeps its taken cards. The nine are a picture
                                // the player is learning, and one vanishing on every hit would
                                // leave nothing to have learnt by the ninth.
                                spent={drill !== null}
                                // And its own colour, out of this challenge's own family. A
                                // fixed nine is learnt as a picture, and a colour is read before
                                // a number is — where the band tint every other mode wears says
                                // which hundred a target is in, which on a drill the player
                                // already knows.
                                color={drillTints?.[target.seq]}
                                // Whether this target has a clock to run down at all. Read off
                                // the rules rather than off the submode: the tutorial is the
                                // one that patches `countsDown` off today, and a drilled run
                                // does the same for a reason of its own — one clock per run,
                                // and here it is the stopwatch.
                                clocked={rules.clock.countsDown}
                                // How long a number shows before it fades — the **glimpse**,
                                // null for a number that never hides. Read off the rules, so the
                                // card never learns which mode is asking.
                                glimpse={rules.spawn.glimpse}
                                driftStep={rules.spawn.drift}
                                onExpire={() => {
                                  send({
                                    type: 'TARGET_EXPIRED',
                                    id: target.id,
                                    now: Date.now(),
                                  })
                                }}
                                onExitComplete={() => {
                                  removeDisplayed(target.id)
                                }}
                              />
                            ))}
                          </TargetBoard>
                          {drafting && <DraftedSegments drawing={drawing} />}
                          {/* The lesson's two pointing cards. The first goes beside the target,
                    above or below it as the canvas allows — see lib/tutorial-tip.ts. The
                    second goes at the foot of the canvas with its beak turned down at the
                    sum row directly beneath, which is the one thing on the screen whose
                    place never moves. */}
                          {/* Placed on the card itself rather than on a wrapper around it: the
                    card is the view being mounted and unmounted, so it has to be the one
                    carrying the position its exit animation plays out from. */}
                          {lesson.voice === 'targetTip' &&
                            lesson.line !== null &&
                            tip !== null && (
                              <TutorialCard
                                text={t(lesson.line)}
                                beak={tip.beak}
                                anchorX={tip.beakAt}
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  top: tip.top,
                                }}
                              />
                            )}
                          {/* The lesson's first word, set in the middle of the board with
                    nothing else on it: what this run is, and that none of it counts. No
                    card around it, because a card is something said about something else
                    on the screen and there is nothing else on the screen yet — see
                    components/game/tutorial-intro.tsx. */}
                          {lesson.voice === 'opening' && lesson.line !== null && (
                            <TutorialIntro text={t(lesson.line)} />
                          )}
                          {lesson.voice === 'sumTip' && lesson.line !== null && (
                            <TutorialCard
                              text={t(lesson.line)}
                              beak="down"
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 8,
                              }}
                            />
                          )}
                        </View>
                      </GestureDetector>
                    </View>

                    {/* ── Score above dial ── */}
                    {/* A reserved slot rather than whatever the digits need, so the dial sits at
                  the same height whether the sum is 0 or 324 — and the same height a lesson
                  puts it at, since DialStage reserves this too. */}
                    <View
                      className="items-center justify-center"
                      style={{ height: SUM_ROW_HEIGHT }}
                      onLayout={noteSumRowRect}
                    >
                      {/* Dimmed under the lesson's first word, which is the only thing on the
                    board while it is up — see components/game/sum-hush.tsx. */}
                      <SchemeProvider kind={opening.dialScheme}>
                        <Arrival order={7} from="below">
                          {!dial.hidesSum && (
                            <SumHush hushed={lesson.voice === 'opening'}>
                              {/* The sum's half of a hit — it swells as the target's number swells
                      out of the ring collapsing above. */}
                              <HitSync seq={hitBatch.seq}>
                                <View className="flex-row">
                                  {String(shownSum)
                                    .split('')
                                    .map((digit, i, arr) => (
                                      <ScoreDigit
                                        key={arr.length - 1 - i}
                                        digit={digit}
                                        direction={direction}
                                        progress={valueProgress(shownSum, dial.maxSum)}
                                      />
                                    ))}
                                </View>
                              </HitSync>
                            </SumHush>
                          )}
                        </Arrival>
                      </SchemeProvider>
                    </View>

                    {/* The band the tutorial talks in: between the sum and the dial, held open
                  for the whole run rather than appearing with the words.

                  It was above the board once, in the slot Trainee's readout takes. Down
                  here a line saying to swipe a key down is a hand's width from the keys and
                  from the total it is about, rather than a headline at the top of a screen
                  — and the two pointing cards still have the whole canvas above it to be
                  placed in.

                  Held open for the reason it always was: the canvas above is measured, so a
                  card arriving would shorten it under a target already placed in the taller
                  one. What the band costs comes off that canvas, which is to say the sum
                  sits exactly this much higher in a lesson than in a run. The dial does not
                  move at all — it is sized from the viewport, and it is the one thing on
                  this screen whose place a lesson may not change.

                  The strip at the foot of it is the dial's own multipliers, which are drawn
                  up out of the dial's box into this band — see components/game/dial-axes.tsx.
                  Reserved rather than shared, so a banner and a `1×` are never in the same
                  place. */}
                    {tutorial && (
                      <View
                        className="justify-center px-1"
                        style={{
                          height: TUTORIAL_BANNER_HEIGHT + AXIS_STRIP,
                          paddingBottom: AXIS_STRIP,
                        }}
                      >
                        {lesson.voice === 'banner' && lesson.line !== null && (
                          <TutorialCard text={t(lesson.line)} beak="none" />
                        )}
                      </View>
                    )}

                    {/* ── Strike shots ── */}
                    <View
                      pointerEvents="none"
                      className="absolute inset-0 overflow-visible"
                    >
                      {shots.map((shot) => (
                        <StrikeShot
                          key={shot.id}
                          kind={shot.kind}
                          fromX={shot.from.x}
                          fromY={shot.from.y}
                          toX={shot.to.x}
                          toY={shot.to.y}
                          radius={shot.radius}
                          sumDigits={shot.sumDigits}
                          rounds={shot.rounds}
                          seed={shot.id}
                          onDone={() => {
                            removeShot(shot.id)
                          }}
                        />
                      ))}
                    </View>
                  </View>

                  {/* ── Dial pad ── */}
                  {/* Its own content's height, not a share of what is left. Splitting the
                remainder with the targets area is what cropped the bottom row on a short
                screen: the dial's size comes from the width now, so half the leftover
                height is not a number it can be asked to fit inside. The targets area
                above takes the slack instead. */}
                  <View>
                    <SchemeProvider kind={opening.dialScheme}>
                      <Dial
                        dial={dial}
                        values={grid.flat()}
                        opened={opening.opened}
                        sweep={opening.sweep}
                        showSum={showSum && !tutorial}
                        trainee={rules.capabilities.keyHints}
                        // The tutorial prints the weight and nothing else, whatever the player
                        // has since chosen for practice: it is the one number a key cannot be
                        // worked out without, and every other corner is a lesson that has not
                        // been given yet.
                        corners={tutorial ? DEFAULT_DIAL_CORNERS : corners}
                        // What each key will take, and which one is being asked for. `full`
                        // everywhere in every run but a guided tutorial route.
                        controls={dialControls}
                        liveKey={lesson.liveKey}
                        // The lesson's own dial: its corner numbers drawn large, because in a
                        // lesson they are the thing being taught rather than a reference beside a
                        // game; the row and column multipliers up once the lesson has explained
                        // them; and whichever gesture it is currently asking for, mimed over the
                        // keys until the player makes it.
                        bigHints={tutorial}
                        axes={lesson.axes}
                        hand={lesson.hand}
                        // Both halves of the answer: the player's own setting, and the lesson's
                        // — which takes the drag away until it has taught it, and says yes in
                        // every run that is not a live tutorial.
                        drag={drag && lesson.drag}
                        flame={flame}
                        // On a dial that scrambles, every hit is a scramble — see `Dial`.
                        hitSeq={hitBatch.seq + shuffles}
                        peakFrom={darkGradientOf(mode)[0]}
                        peakTo={darkGradientOf(mode)[1]}
                        onDelta={(index, delta, sweep) => {
                          coach.notePress(index, delta)
                          lesson.notePress(delta)
                          sendDialed(
                            { type: 'PRESS', index, delta, now: Date.now() },
                            sweep,
                          )
                        }}
                        onSet={(index, cellValue, sweep) => {
                          coach.noteSet(index, cellValue)
                          lesson.noteSet(cellValue)
                          sendDialed(
                            {
                              type: 'SET_CELL',
                              index,
                              value: cellValue,
                              now: Date.now(),
                            },
                            sweep,
                          )
                        }}
                        onSweep={() => {
                          lesson.noteSweep()
                          setSweptIn((held) => ({
                            ...held,
                            gesture: state.context.runSeq,
                          }))
                        }}
                      />
                    </SchemeProvider>
                  </View>

                  {/* ── Tap-through for the lesson's two pointing cards ── */}
                  {/* A card asking to be read holds the dial shut, and this is the other half
                of that: a tap anywhere is how the player says they have read it, rather
                than waiting out a clock they cannot see. Mounted only while a card is up,
                so nothing catches a press that belongs to the game. Every key is already
                inert underneath — the dial is `off` at these steps — so this exists to
                hear the tap, not to block one.

                A child of the screen rather than a layer over the whole app, and that is
                what leaves the top bar above it: the bar is lifted a step in the stack
                below, so MENU stays pressable while a card is up. A lesson is still a run,
                and a run the player cannot put down because it is explaining itself is the
                one thing this card must not become. The negative insets cancel the
                screen's own padding, so what is left under the bar is covered to the
                edges. */}
                  {lesson.onTapThrough !== null && (
                    <TrackedPressable
                      id="tutorial.tap_through"
                      onPress={lesson.onTapThrough}
                      className="absolute -bottom-2 -left-4 -right-4 top-0"
                      accessibilityLabel={t`Continue the tutorial`}
                    />
                  )}
                </Screen>
              </ArrivalStage>

              {/* The remains, in front of the run — see `OpeningOver`. */}
              <OpeningOver
                kind={opening.remains}
                pull={opening.pull}
                onPeek={opening.peek}
                livesLost={rules.lives.count - state.context.lives}
                livesLeft={state.context.lives}
                lostAt={lostMarks}
                running={isPlaying}
                finished={isGameOver}
                runId={state.context.runId}
                grid={state.context.grid}
                onEnd={() => {
                  send({ type: 'CRASH', now: Date.now() })
                }}
                onShuffle={shuffleDial}
              />

              {/* ── The opening, over the held run ── */}
              {/* Drawn only while the run is **ready**. The switch turns the screen under it
                over to the mode's scheme; the end, or a tap, starts the run's clock. */}
              {opening.layer !== null && (
                <OpeningLayer
                  key={state.context.runId}
                  kind={opening.layer}
                  take={opening.take}
                  sweep={opening.sweep}
                  barLight={opening.barLight}
                  onShuffle={shuffleDial}
                  onSwitch={opening.onSwitch}
                  onDone={() => {
                    opening.onSwitch()
                    send({ type: 'BEGIN', now: Date.now() })
                  }}
                />
              )}
            </SchemeProvider>

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

            {/* ── Advanced options — shared between menu and pause ── */}
            {menuOverlay === 'advanced' && (
              <AdvancedOptionsOverlay
                showSum={showSum}
                onToggleSum={toggleSum}
                drag={drag}
                onToggleDrag={toggleDrag}
                replayConsent={replayConsent.consent}
                onToggleReplayConsent={() => {
                  if (replayConsent.consent === 'granted') replayConsent.decline()
                  else replayConsent.allow()
                }}
                push={pushConsent.row}
                pushHelp={pushConsent.help}
                onTogglePush={pushConsent.toggle}
                onOpenNews={() => {
                  setMenuOverlay('news')
                }}
                onClose={() => {
                  setMenuOverlay('none')
                }}
              />
            )}

            {/* ── News archive — opened from advanced options ── */}
            {menuOverlay === 'news' && (
              <NewsArchiveOverlay
                onClose={() => {
                  setMenuOverlay('advanced')
                }}
              />
            )}

            {/* ── How to play guide ── */}
            {menuOverlay === 'howToPlay' && (
              <HowToPlayOverlay
                onClose={() => {
                  setMenuOverlay('none')
                  howToPlay.markRead()
                }}
                // The same run a first launch opens on, asked for this time, and dealt the
                // same way: straight onto the board, with the lesson's own opening card
                // the first thing said over it. Reaching the bottom of the guide is
                // reading it, whichever button is pressed there, so this marks it read
                // exactly as GOT IT does.
                onTryTutorial={() => {
                  setMenuOverlay('none')
                  howToPlay.markRead()
                  startTutorial('guide')
                }}
              />
            )}

            {/* ── Join a room by code — its own screen past WITH FRIENDS' JOIN ROOM ──
              !isMultiActive so a successful join steps aside for the waiting room
              rather than sitting on top of it — nothing else resets `menuOverlay`
              back to 'none' on that edge. */}
            {menuOverlay === 'joinRoom' && !isMultiActive && (
              <JoinRoomOverlay
                joinError={multiRoom.error}
                onJoinRoom={handleJoinRoom}
                onClose={() => {
                  setMenuOverlay('none')
                }}
              />
            )}

            {/* ── Admin — who holds a role, and a search to hand one out. Before the
                challenge dialog, which its CHALLENGES gallery opens and which has to draw
                over it. ── */}
            {menuOverlay === 'admin' && (
              <AdminOverlay
                viewerId={userId}
                onPreview={(role, label) => {
                  rolePreview.start(role, label)
                  // And out of the way. The point of a preview is the app underneath it,
                  // and the screen that started it is about to lose the link that drew it.
                  setMenuOverlay('none')
                }}
                onOpenChallenge={(modeId, session) => {
                  setChallengeCard({ state: 'lab', modeId, session })
                }}
                onClose={() => {
                  setMenuOverlay('none')
                }}
              />
            )}

            {/* ── The intro's SHARE: the address as a QR code, the system sheet behind it ── */}
            {shareInvite !== undefined && (
              <ShareModal
                invite={shareInvite}
                onDismiss={() => {
                  setShareInvite(undefined)
                }}
              />
            )}

            {/* ── The vote, from the link on the intro. Under the challenge dialog, which
                a player can open from the same card. ── */}
            {voteResultsOpen && (
              <NextVoteResultsDialog
                options={nextVote.options}
                onDismiss={() => {
                  setVoteResultsOpen(false)
                }}
              />
            )}
            {voteOpen && (
              <NextVoteDialog
                options={nextVote.options}
                onVote={nextVote.vote}
                onDismiss={() => {
                  setVoteOpen(false)
                }}
              />
            )}

            {/* ── A challenge, in full: what it asks, who leads, and the way in. After the
                admin screen, whose gallery opens it too and has to stay under it. ── */}
            {challengeCard !== undefined && (
              <ChallengeModal
                card={challengeCard}
                userId={userId}
                nickname={nickname}
                onStart={(modeId, sessionId) => {
                  if (sessionId === null) {
                    // The lab deals a challenge outside any session, which is the point
                    // of it: no window, and so no standings to post to.
                    setRunSession(null)
                    if (isMode(mode)) setModeBeforeSession(mode)
                    send({ type: 'SET_MODE', mode: modeId })
                    send({ type: 'START', now: Date.now(), runId: newRunId() })
                    setChallengeCard(undefined)
                    setMenuOverlay('none')
                    track('run_started', { mode: modeId, difficulty, from: 'dev' })
                    return
                  }
                  // Set before the run is dealt, so the first thing the run can do —
                  // cross a record on its opening hit — already knows where its score
                  // belongs.
                  setRunSession(sessionId)
                  setRunSessionClosesAt(challengeCard.session?.closesAt ?? null)
                  // Cleared before the run is dealt rather than after, for the reason the
                  // two lines above are set here: a value the next run reads has to be
                  // right before that run exists.
                  setWindowShut(false)
                  // And remember the board they were on, so the intro is handed back the
                  // way they left it rather than stuck on a challenge with no pill.
                  if (isMode(mode)) setModeBeforeSession(mode)
                  send({ type: 'SET_MODE', mode: modeId })
                  send({ type: 'START', now: Date.now(), runId: newRunId() })
                  setChallengeCard(undefined)
                  track('run_started', { mode: modeId, difficulty, from: 'session' })
                }}
                onDismiss={() => {
                  setChallengeCard(undefined)
                }}
              />
            )}

            {/* ── The first launch's tutorial offer — ahead of every launch ask below ── */}
            {welcomeOffer && (
              <TutorialOfferModal
                onAccept={() => {
                  startTutorial('welcome')
                  // Written down beside the run it records. Only the first launch owes
                  // it — the other two doors are a tutorial asked for a second time.
                  welcome.taken()
                }}
                onDismiss={welcome.declined}
              />
            )}

            {/* ── A reply to something the player sent ── */}
            {/* First of the three launch dialogs. Somebody answering what you wrote is the
            one of them addressed to you by name, and it would be a poor thing to meet
            after two screens of announcements. Several queue and are shown one at a
            time, oldest first — see hooks/use-feedback-replies.ts. */}
            {onIntro && feedbackReplies.reply !== null && (
              <FeedbackReplyOverlay
                gameMode={mode}
                answer={feedbackReplies.reply.answer}
                quote={feedbackReplies.reply.quote}
                onDismiss={() => {
                  feedbackReplies.dismiss()
                  // The same moment the answer is marked seen on the server, so HEARD
                  // BACK is kept by exactly the replies the player has been shown.
                  feedbackAnswered.markAnswered()
                }}
              />
            )}

            {/* ── What's new — announcements the player hasn't seen yet ── */}
            {/* A first-ever launch has nothing unseen to show — use-whats-new.ts marks
            everything seen when there is no record at all.

            Waits on the reply request the same way the install prompt waits on this one:
            `ready` is what says "asked and answered", and painting before it would put
            the news up only to have a reply land on top of it. */}
            {onIntro &&
              feedbackReplies.ready &&
              feedbackReplies.reply === null &&
              whatsNew.visible && (
                <WhatsNewOverlay
                  cards={whatsNew.cards}
                  onDismiss={whatsNew.dismiss}
                  onAccept={whatsNew.accept}
                />
              )}

            {/* ── Session dialog — the summary of a closed session, then its rating, remark
            and the vote. Mounted once the popup has unmounted rather than alongside it,
            so its card rises after the popup's has gone instead of over it. `asking` is
            the owed summary — see `summary` in use-session-summaries.ts. ── */}
            {onIntro &&
              feedbackReplies.ready &&
              feedbackReplies.reply === null &&
              !whatsNew.visible &&
              whatsNew.rating.asking !== null && (
                <RatingOverlay
                  summary={whatsNew.rating.asking}
                  onSend={whatsNew.rating.send}
                  onRemark={whatsNew.rating.remark}
                  options={nextVote.options.filter((option) => option.canVote)}
                  onVote={nextVote.vote}
                  onDismiss={whatsNew.rating.done}
                />
              )}

            {/* ── Install prompt — web only, and only once the news has had its turn.
            Every launch until the player installs: closing it lasts the session.

            The ask normally happens earlier, over the splash (app/_layout.tsx). This is
            the launch that has no splash to hold — the reload a service-worker update ends
            in — so `splashDone` is what keeps the two copies from ever being up at once. ── */}
            {splashDone &&
              onIntro &&
              feedbackReplies.ready &&
              feedbackReplies.reply === null &&
              whatsNew.ready &&
              !launchPopupUp &&
              challengeCard === undefined &&
              installPrompt.target !== 'none' && (
                <InstallOverlay
                  target={installPrompt.target}
                  onInstall={installPrompt.install}
                  onDismiss={installPrompt.dismiss}
                />
              )}

            {/* ── Session-recording ask — the one thing analytics does that needs it,
            and the SDK is held off it until this is answered. Lowest of the launch
            asks: it waits for the install prompt's own turn to end (dismissed or
            installed, either reads as target 'none'), same priority tier, one at a
            time. Every launch until answered, like the install prompt beside it;
            answering either way — ALLOW or NO THANKS — is what stops it coming back.
            Revisited later from OPTIONS, which calls the same hook. ── */}
            {splashDone &&
              onIntro &&
              feedbackReplies.ready &&
              feedbackReplies.reply === null &&
              whatsNew.ready &&
              !launchPopupUp &&
              challengeCard === undefined &&
              installPrompt.target === 'none' &&
              replayConsent.visible && (
                <ReplayConsentOverlay
                  onAllow={replayConsent.allow}
                  onDecline={replayConsent.decline}
                  onDismiss={replayConsent.dismiss}
                />
              )}

            {/* ── Push consent ── The second step, behind the replay card above: same
                turn in the queue, and never up at the same time as it. Answered, or
                waved off for the session, like the card before it. ── */}
            {pushConsent.visible && pushCardClear && (
              <PushConsentOverlay
                reach={pushConsent.reach}
                onAllow={pushConsent.allow}
                onDecline={pushConsent.decline}
                onDismiss={pushConsent.dismiss}
              />
            )}

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

            {/* ── Multiplayer screens (above everything) ── */}

            {showMultiWaiting && multiRoom.room && (
              <MultiplayerWaiting
                code={multiRoom.room.code}
                mode={multiRoom.room.mode}
                players={multiRoom.players}
                userId={userId}
                isAdmin={multiRoom.isAdmin}
                onLeave={() => {
                  setMenuInitialTab('friends')
                  void multiRoom.leave()
                }}
                onStart={handleAdminStartGame}
                onSetMode={(m) => {
                  void multiRoom.setRoomMode(m)
                }}
              />
            )}

            {showMultiGame && (
              <MultiplayerGame
                drag={drag}
                mode={multiGame.mode}
                userId={userId}
                players={multiGame.players}
                currentTarget={multiGame.currentTarget}
                targetCount={multiGame.targetCount}
                onHit={multiGame.sendHit}
                onTargetExpire={() => {
                  // Only admin resolves; non-admin's timer is purely visual.
                }}
                onMenu={() => {
                  setShowMultiMenu(true)
                }}
              />
            )}

            {showMultiGame && showMultiMenu && (
              <MultiplayerMenu
                mode={multiGame.mode}
                onContinue={() => {
                  setShowMultiMenu(false)
                }}
                onLeave={() => {
                  setMenuInitialTab('friends')
                  setShowMultiMenu(false)
                  void multiRoom.leave()
                }}
              />
            )}

            {showMultiResults && (
              <MultiplayerGameOver
                players={multiGame.players}
                mode={multiGame.mode}
                userId={userId}
                isAdmin={multiRoom.isAdmin}
                onReady={multiGame.sendReady}
                onModeChange={multiGame.sendModeChange}
                onStartNext={multiGame.startNextGame}
                onLeave={() => {
                  setMenuInitialTab('friends')
                  void multiRoom.leave()
                }}
              />
            )}

            {/* ── An arcade run. Over the intro rather than inside the game screen: the
                dial is the same dial, but what it is answering is a crossroad on a map,
                and none of the run above — the score, the lives, the board, the saved run
                — has anything to say about one. END takes it down, and taking it down
                ends the run. ── */}
            {arcadeOpen && (
              <ArcadeGame
                drag={drag}
                onEnd={() => {
                  setArcadeOpen(false)
                }}
              />
            )}

            {/* Last child and explicitly stacked: every overlay above is absolutely
              positioned and opaque, so a stage mounted earlier draws underneath the
              screen it is meant to be showing. Renders nothing until the picker on the
              desk outside the frame chooses something.
              The stacking lives on the stage's own view rather than on a wrapper here.
              A wrapper is mounted whether or not a screen is chosen, and a full-bleed
              absolute view at zIndex 100 over the whole app takes every press — which
              in a dev build left nothing on the screen clickable at all. */}
            {GalleryStage !== null && (
              <Suspense fallback={null}>
                <GalleryStage />
              </Suspense>
            )}

            {/* ── Which role the app is being drawn as, and the way back out ──
                Last child and above every layer: a preview of a role without `admin` has
                taken away the link that started it, so this badge is the only way back.
                Not inside any screen, because the preview is looked at from all of them. */}
            {rolePreview.preview !== null && (
              <RolePreviewBadge
                label={rolePreview.preview.label}
                onExit={rolePreview.stop}
              />
            )}
          </BoardProvider>
        </PlayerProfileProvider>
      </ChampionsProvider>
    </FlagsProvider>
  )
}
