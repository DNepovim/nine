import { AntDesign } from '@expo/vector-icons'
import { useMachine } from '@xstate/react'
import { useFonts } from 'expo-font'
import { isNotNull, isOneOf } from 'narrowland'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { FeedbackBookmark } from '@/components/feedback-bookmark'
import { AnnouncementEffect } from '@/components/game/announcement-effect'
import { BEST_SCORES_HEIGHT, BestScoresLine } from '@/components/game/best-scores-line'
import { Confetti } from '@/components/game/confetti'
import { DialButton } from '@/components/game/dial-button'
import { FloatingPoints } from '@/components/game/floating-points'
import { FloatingStat } from '@/components/game/floating-stat'
import { MenuButton } from '@/components/game/menu-button'
import { MultiplayerGame } from '@/components/game/multiplayer-game'
import { ScoreDigit } from '@/components/game/score-digit'
import { StepUpToast } from '@/components/game/step-up-toast'
import { TargetCard } from '@/components/game/target-card'
import { TraineeStats } from '@/components/game/trainee-stats'
import { AdvancedOptionsOverlay } from '@/components/overlays/advanced-options-overlay'
import { FeedbackOverlay } from '@/components/overlays/feedback-overlay'
import { GameOverSequence } from '@/components/overlays/game-over-sequence'
import { HowToPlayOverlay } from '@/components/overlays/how-to-play-overlay'
import { InstallOverlay } from '@/components/overlays/install-overlay'
import { MenuOverlay } from '@/components/overlays/menu-overlay'
import { MultiplayerGameOver } from '@/components/overlays/multiplayer-game-over'
import { MultiplayerMenu } from '@/components/overlays/multiplayer-menu'
import { MultiplayerWaiting } from '@/components/overlays/multiplayer-waiting'
import { NewsArchiveOverlay } from '@/components/overlays/news-archive-overlay'
import { NicknameModal } from '@/components/overlays/nickname-modal'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { StepUpOverlay } from '@/components/overlays/step-up-overlay'
import { WhatsNewOverlay } from '@/components/overlays/whats-new-overlay'
import { Screen } from '@/components/screen'
import { mono } from '@/constants/theme'
import { useAnnouncements } from '@/hooks/use-announcements'
import { useAppUpdate } from '@/hooks/use-app-update'
import { BoardProvider, useBoard } from '@/hooks/use-board'
import { ChampionsProvider, useChampions } from '@/hooks/use-champions'
import { useDisplayOptions } from '@/hooks/use-display-options'
import { useDisplayScore } from '@/hooks/use-display-score'
import { useDisplayedTargets } from '@/hooks/use-displayed-targets'
import { useDyingSequence } from '@/hooks/use-dying-sequence'
import { useFloatingPoints } from '@/hooks/use-floating-points'
import { useFloatingStat } from '@/hooks/use-floating-stat'
import { useHitCelebration } from '@/hooks/use-hit-celebration'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { useMultiplayerGame } from '@/hooks/use-multiplayer-game'
import { useMultiplayerRoom } from '@/hooks/use-multiplayer-room'
import { usePersistedDifficulty } from '@/hooks/use-persisted-difficulty'
import { usePersistedMode } from '@/hooks/use-persisted-mode'
import { usePersistedStats } from '@/hooks/use-persisted-stats'
import { useRivalRecords } from '@/hooks/use-rival-records'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { useScoreSubmission } from '@/hooks/use-score-submission'
import { useStepUp } from '@/hooks/use-step-up'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { useTargetSpawner } from '@/hooks/use-target-spawner'
import { useTheme } from '@/hooks/use-theme'
import { useTraineeCoach } from '@/hooks/use-trainee-coach'
import { useWhatsNew } from '@/hooks/use-whats-new'
import { identify, track } from '@/lib/analytics'
import type { AnalyticsEvents } from '@/lib/analytics-events'
import { barFor, isOpenable, type Leaders, type Period } from '@/lib/announcements'
import { recordScreen, type RecordScreen } from '@/lib/champions'
import { leaderOf } from '@/lib/leaderboard'
import { earnedChallenge, nextChallenge } from '@/lib/next-challenge'
import { heldPeriods, medalPeriods } from '@/lib/record-medals'
import { STEP_UP_BOARD } from '@/lib/step-up'
import { valueProgress } from '@/lib/value-progress'
import {
  computeSum,
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  gameMachine,
  getDifficultyColor,
  MODE_GRADIENT,
  MODES,
  SCORED_MODES,
  streakMultiplier,
  type Mode,
} from '@/machines/game'
import { cellWeight, computePar } from '@/machines/scoring'
import type { MultiMode } from '@/types/multiplayer'

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
const TRAINEE_CONFETTI = [MODE_GRADIENT.trainee[0]] as const

// How long the intro has to stand undisturbed before a waiting new version is allowed
// to swap itself in. Not zero: a player who has just come back from a run would be
// reloaded on the spot, and an app that restarts the instant you reach the menu reads as
// a crash. Anything they start inside the window cancels it.
const UPDATE_SETTLE_MS = 2500

// The menu-level overlays, one open at a time. 'none' means the screen under them —
// the intro or the pause screen — is what shows. Feedback is not here: it is a
// dialog over whatever is showing, not a screen of its own.
type MenuOverlayName = 'none' | 'advanced' | 'howToPlay' | 'news'

// Overlay names → the screen names the warehouse knows, so the event table stays the
// only place that spells them. 'none' has no row: it is a closing, not an opening.
const OVERLAY_SCREENS = {
  advanced: 'options',
  howToPlay: 'how_to_play',
  news: 'news',
} as const satisfies Record<
  Exclude<MenuOverlayName, 'none'>,
  AnalyticsEvents['screen_opened']['screen']
>

// Where the menu button sits, level with the NINE row. Trainee draws no
// best-scores strip, so everything below it — the button included — comes up by
// exactly that strip's height.
const MENU_TOP = {
  trainee: 36 - BEST_SCORES_HEIGHT,
  accuracy: 36,
  speed: 36,
} as const satisfies Record<Mode, number>

function HeartIcon({ filled, emptyColor }: { filled: boolean; emptyColor: string }) {
  const scale = useSharedValue(1)
  const fillOp = useSharedValue(filled ? 1 : 0)
  const prevFilled = useRef(filled)

  useEffect(() => {
    if (prevFilled.current && !filled) {
      scale.value = withSequence(
        withTiming(1.5, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 10, stiffness: 250 }),
      )
      fillOp.value = withDelay(80, withTiming(0, { duration: 200 }))
    } else if (!prevFilled.current && filled) {
      fillOp.value = 1
      scale.value = 1
    }
    prevFilled.current = filled
  }, [filled, fillOp, scale])

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const fillStyle = useAnimatedStyle(() => ({ opacity: fillOp.value }))

  return (
    <Animated.View style={scaleStyle}>
      <AntDesign name="heart" size={22} color={emptyColor} />
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          fillStyle,
        ]}
      >
        <AntDesign name="heart" size={22} color="#E5534B" />
      </Animated.View>
    </Animated.View>
  )
}

export default function GameScreen() {
  const { colorScheme, toggleTheme } = useTheme()
  const isDark = colorScheme === 'dark'
  const [state, send] = useMachine(gameMachine)

  // Seven-segment font for the digital score readout.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })

  const {
    grid,
    lives,
    targets,
    mode,
    difficulty,
    stats,
    hitBatch,
    streak,
    accSum,
    spdSum,
    hits,
  } = state.context
  const isPlaying = state.matches('playing')
  const isMenu = state.matches('menu')
  const isPaused = state.matches('paused')
  const isGameOver = state.matches('gameOver')

  usePersistedStats(stats, send)
  usePersistedDifficulty(difficulty, send)
  usePersistedMode(mode, send)
  const { showSum, toggleSum } = useDisplayOptions()
  // Which menu-level overlay is open. Only one shows at a time, and the menu
  // itself is hidden while any of them is open — a single source of truth avoids
  // z-order/gating clashes between separate booleans.
  const [menuOverlay, setMenuOverlay] = useState<MenuOverlayName>('none')
  // The feedback dialog floats over whatever is showing rather than replacing it, so
  // it is its own boolean instead of a member of the overlay union above.
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // One event per overlay actually opened. 'none' is a closing, not an opening.
  useEffect(() => {
    if (menuOverlay === 'none') return
    track('screen_opened', { screen: OVERLAY_SCREENS[menuOverlay] })
  }, [menuOverlay])
  const whatsNew = useWhatsNew()
  const installPrompt = useInstallPrompt()
  const { ready: updateReady, apply: applyUpdate } = useAppUpdate()

  // Close advanced options whenever the game starts or resumes so that pausing
  // again always shows the pause screen, not the advanced options overlay.
  useEffect(() => {
    if (isPlaying) setMenuOverlay('none')
  }, [isPlaying])

  const { userId, nickname, isReady, updateNickname } = useSupabaseAuth()

  // Analytics reuses the identity the boards already rank — the anonymous Supabase user
  // id — so an event can be read next to the score it produced. Re-runs when the
  // nickname lands or changes, which just refreshes the person's properties.
  useEffect(() => {
    if (userId !== null) identify(userId, nickname)
  }, [userId, nickname])

  const { submit: submitScore } = useScoreSubmission(userId, nickname, isReady)
  const [showNicknameModal, setShowNicknameModal] = useState(false)

  // The one board store. Every surface that shows a score reads it — the strip above
  // the top bar, the intro, the pause screen and the game over screen — so they cannot
  // answer the same question differently. Trainee has no board and it stays quiet.
  const board = useBoard(mode, difficulty, userId)
  // Who holds each mode's Extreme all-time board. Two ids, read wherever a name is
  // drawn and by the game-over screen to tell a reign from a single record.
  const champions = useChampions()
  const refreshBoard = board.refresh
  const bestToday = board.today.record
  const bestWeek = board.week.record
  const bestEver = board.forever.record
  // Memoised on the fetched rows so the rival watcher only wakes when a fetch actually
  // lands, not on every render of the game screen.
  const leaders: Leaders = useMemo(
    () => ({
      today: leaderOf(board.today.rows),
      week: leaderOf(board.week.rows),
      ever: leaderOf(board.forever.rows),
    }),
    [board.today.rows, board.week.rows, board.forever.rows],
  )

  const inRun = isPlaying || isPaused
  const rival = useRivalRecords({ inRun, mode, difficulty, userId, leaders })
  const celebration = useHitCelebration(inRun, mode, hitBatch)

  // Trainee's invitation to a scored board. Offered only to a player who has never
  // posted one: the point is introducing the boards to someone who has not found them.
  const playedScored = SCORED_MODES.some((scored) =>
    DIFFICULTY_ORDER.some((level) => stats[scored][level].score > 0),
  )
  const stepUp = useStepUp({
    inRun: isPlaying,
    mode,
    batch: hitBatch,
    hits,
    playedScored,
  })
  // Open while the transitional screen is up. The run is paused behind it rather than
  // abandoned, so backing out through the intro leaves nothing half-finished.
  const [stepUpOpen, setStepUpOpen] = useState(false)
  // The toast appearing is the offer being made; latched on its rising edge so the
  // withdraw-and-reoffer dance inside one run cannot double-count.
  const stepUpOfferedRef = useRef(false)
  useEffect(() => {
    const offered = stepUp.message !== null
    if (offered && !stepUpOfferedRef.current) {
      track('challenge_offered', {
        mode,
        difficulty,
        to_mode: STEP_UP_BOARD.mode,
        to: STEP_UP_BOARD.difficulty,
      })
    }
    stepUpOfferedRef.current = offered
  }, [stepUp.message, mode, difficulty])
  const coach = useTraineeCoach({
    inRun,
    mode,
    grid,
    targets,
    batch: hitBatch,
    muted: celebration.message !== null,
  })

  const { announcement, crossed } = useAnnouncements({
    inRun,
    // Nothing is frozen until the board has answered. A run that started first gets its
    // targets the moment they land, and the score already reached is measured against
    // them — which is what a run begun on a cold start used to lose entirely.
    ready: board.loaded,
    score: state.context.score,
    // Trainee's entry stays at zero — the machine neither records nor hydrates a
    // best for it — so this needs no special case to stay quiet there.
    storedBest: stats[mode][difficulty].score,
    todayBest: barFor(bestToday, board.today.myBest),
    weekBest: barFor(bestWeek, board.week.myBest),
    everBest: barFor(bestEver, board.forever.myBest),
    todayEmpty: isOpenable(board.today.empty, board.today.myBest),
    weekEmpty: isOpenable(board.week.empty, board.week.myBest),
    rival,
    // Send the score the moment a board record falls rather than waiting for game
    // over: the write is what wakes every other player's bar, so delaying it is
    // what made rivals hear about a record minutes after it happened. The score
    // only climbs within a run, and the database refuses downgrades, so an early
    // write can never spoil the final one.
    onBoardRecord: () => {
      submitScore(mode, difficulty, state.context.score, state.context.hits)
    },
  })

  // The boards the run ended on top of, latched on the game-over edge below. What the
  // bar announced is the starting point — by game over the player's own score is the
  // record, so asking the board what this run took would say yes to every run — and
  // each claim is then checked against the board as it stands, so a rival who went past
  // mid-run takes the medal with them. Latched rather than derived because the title
  // tier reads it while flying up from the board, and a medal that moved under it would
  // change the letters mid-flight.
  const [runMedals, setRunMedals] = useState<readonly Period[]>([])
  // Latched beside the medals and for the same reason: the title reads it while flying
  // up from the board, and a rival taking the other mode's Extreme board mid-screen
  // must not turn a crown into a bird under the player.
  const [runScreen, setRunScreen] = useState<RecordScreen>('plain')

  // Which of a title tier's three lines this run gets. Drawn once per game over, not
  // per render: the title flies up from the board and hands off to the overlay, so a
  // roll taken during render would change the letters mid-flight.
  const [titleRoll, setTitleRoll] = useState(Math.random())

  // Trigger score submission on each game-over transition.
  const prevIsGameOverRef = useRef(false)
  useEffect(() => {
    if (isGameOver === prevIsGameOverRef.current) return
    prevIsGameOverRef.current = isGameOver
    if (isGameOver) {
      setTitleRoll(Math.random())
      // The boards have been kept live all run by Realtime, so what they hold now is
      // what a rival left behind if they passed us while we were playing.
      const taken = heldPeriods(medalPeriods(crossed), state.context.score, {
        today: bestToday,
        week: bestWeek,
        ever: bestEver,
      })
      const screen = isOneOf(mode, ['accuracy', 'speed'])
        ? recordScreen({
            record: taken[0] ?? null,
            mode,
            difficulty,
            userId,
            champions,
          })
        : 'plain'
      setRunMedals(taken)
      setRunScreen(screen)
      track('run_finished', {
        mode,
        difficulty,
        score: state.context.score,
        hits: state.context.hits,
        strikes: state.context.strikes,
        records: taken,
        screen,
        personal_best: crossed.includes('record'),
      })
      // Mirrors the game-over screen's own decision — see game-over-overlay.tsx, which
      // computes the same dare from the same run. Offered here, accepted in onChallenge.
      if (earnedChallenge(state.context.hits, state.context.strikes)) {
        const dare = nextChallenge(mode, difficulty)
        track('challenge_offered', {
          mode,
          difficulty,
          to_mode: dare.mode,
          to: dare.difficulty,
        })
      }
    }
    // Refresh on both edges of game over so other players' runs appear. Our own score
    // no longer depends on this landing: it is recorded on the device as it is
    // submitted, and the board store folds that in without asking the server.
    void refreshBoard()
    if (isGameOver && isOneOf(mode, ['accuracy', 'speed'])) {
      submitScore(mode, difficulty, state.context.score, state.context.hits)
      if (isReady && !nickname && state.context.score > 0) setShowNicknameModal(true)
    }
  }, [
    isGameOver,
    isReady,
    nickname,
    mode,
    difficulty,
    state.context.score,
    state.context.hits,
    state.context.strikes,
    crossed,
    bestToday,
    bestWeek,
    bestEver,
    submitScore,
    refreshBoard,
  ])

  // Ending a run yourself from the pause menu still counts: submit the score and ask
  // for a nickname exactly as running out of lives does. The game-over effect below
  // only fires on the gameOver transition, so without this the run would be lost.
  const endRunEarly = () => {
    if (!isOneOf(mode, ['accuracy', 'speed'])) return
    const { score, hits } = state.context
    if (score <= 0) return
    submitScore(mode, difficulty, score, hits)
    void refreshBoard()
    if (isReady && !nickname) setShowNicknameModal(true)
  }

  // The dial sum drives the score above the dial; the machine's composite score
  // drives the digital HUD readout.
  const sum = computeSum(grid)
  const direction = useScoreDirection(sum)
  const displayScore = useDisplayScore(state.context.score)

  const stateName = isMenu
    ? 'menu'
    : isPlaying
      ? 'playing'
      : isPaused
        ? 'paused'
        : 'gameOver'

  useTargetSpawner({
    isPlaying,
    targetCount: targets.length,
    mode,
    difficulty,
    hits,
    currentSum: sum,
    takenValues: targets.map((t) => t.value),
    send,
  })
  const { floats, removeFloat } = useFloatingPoints(hitBatch)
  const { displayedTargets, removeDisplayed, onContainerLayout } = useDisplayedTargets({
    machineTargets: targets,
    isPlaying,
    stateValue: stateName,
  })

  // Dial pad is a square sized to fit its container (min of width/height), so it
  // never overflows over the score above it.
  const [dialSize, setDialSize] = useState(0)

  const currentMultiplier = streakMultiplier(streak)

  const avgAccuracy = hits > 0 ? Math.round((100 * accSum) / hits) : 0
  const avgSpeed = hits > 0 ? Math.round((100 * spdSum) / hits) : 0

  const { floatStats, removeFloatStat } = useFloatingStat(hitBatch, mode)

  const avgStat = mode === 'accuracy' ? avgAccuracy : avgSpeed
  const prevAvgRef = useRef(avgStat)
  const avgDirection = useRef<1 | -1>(1)
  if (avgStat !== prevAvgRef.current) {
    avgDirection.current = avgStat > prevAvgRef.current ? 1 : -1
    prevAvgRef.current = avgStat
  }

  // ── Life-loss & dying sequence ──────────────────────────────────────────────

  const {
    phase: dyingPhase,
    flashStyle,
    titleStyle,
    overlayStyle,
    targetsAreaRef,
    setOverlayTitleY,
  } = useDyingSequence({ isGameOver, lives })

  // ── Multiplayer ────────────────────────────────────────────────────────────

  const multiRoom = useMultiplayerRoom(userId)
  const multiGame = useMultiplayerGame({
    gameChannel: multiRoom.gameChannel,
    userId,
    isAdmin: multiRoom.isAdmin,
    initialPlayers: multiRoom.players,
  })

  // Pending action when user tries to create/join without a nickname.
  const [pendingMultiAction, setPendingMultiAction] = useState<
    { type: 'create'; mode: MultiMode } | { type: 'join'; code: string } | null
  >(null)

  const executeMultiAction = useCallback(
    (action: { type: 'create'; mode: MultiMode } | { type: 'join'; code: string }) => {
      if (action.type === 'create') {
        void multiRoom.create('accuracy')
      } else {
        void multiRoom.join(action.code)
      }
    },
    [multiRoom],
  )

  const [showMultiMenu, setShowMultiMenu] = useState(false)
  const [menuInitialTab, setMenuInitialTab] = useState<'alone' | 'friends'>('alone')

  const handleCreateRoom = useCallback(() => {
    if (!nickname) {
      setPendingMultiAction({ type: 'create', mode: 'accuracy' })
      setShowNicknameModal(true)
      return
    }
    void multiRoom.create('accuracy')
  }, [nickname, multiRoom])

  const handleJoinRoom = useCallback(
    (code: string) => {
      if (!nickname) {
        setPendingMultiAction({ type: 'join', code })
        setShowNicknameModal(true)
        return
      }
      void multiRoom.join(code)
    },
    [nickname, multiRoom],
  )

  const handleAdminStartGame = useCallback(() => {
    const playerOrder = multiRoom.players.map((p) => p.user_id)
    const roomMode = multiRoom.room?.mode ?? 'accuracy'
    multiRoom.startGame(playerOrder)
    multiGame.applyGameStart(roomMode, playerOrder)
  }, [multiRoom, multiGame])

  // Destroy room when admin backgrounds the app.
  const multiLeaveRef = useRef(multiRoom.leave)
  useEffect(() => {
    multiLeaveRef.current = multiRoom.leave
  }, [multiRoom.leave])
  const multiRoomId = multiRoom.room?.id ?? null
  useEffect(() => {
    if (!multiRoom.isAdmin || !multiRoomId) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') void multiLeaveRef.current()
    })
    return () => {
      sub.remove()
    }
  }, [multiRoom.isAdmin, multiRoomId])

  // Which multiplayer screen to show.
  const showMultiWaiting = isNotNull(multiRoom.room) && multiGame.phase === 'waiting'
  const showMultiGame = isNotNull(multiRoom.room) && multiGame.phase === 'playing'
  const showMultiResults = isNotNull(multiRoom.room) && multiGame.phase === 'results'
  const isMultiActive = showMultiWaiting || showMultiGame || showMultiResults

  // A shared run reaching its results screen is the run finishing, and the roster at
  // that moment is who was in it. Edge-latched: the screen stays up while everyone
  // reads it, and one run is one event.
  const multiFinishedRef = useRef(false)
  useEffect(() => {
    if (showMultiResults && !multiFinishedRef.current) {
      track('multiplayer_room', { action: 'finished', players: multiRoom.players.length })
    }
    multiFinishedRef.current = showMultiResults
  }, [showMultiResults, multiRoom.players.length])

  // A new build waits on the device until the app lets it through, because the swap ends
  // in a reload. The intro with nothing open over it is the only place that costs
  // nothing: mid-run it would throw the run away, over an overlay it would lose whatever
  // was being typed, and in a multiplayer room it would drop the player out of it.
  useEffect(() => {
    const settled =
      isMenu && menuOverlay === 'none' && !isMultiActive && !showNicknameModal
    if (!updateReady || !settled) return
    const timer = setTimeout(applyUpdate, UPDATE_SETTLE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [updateReady, applyUpdate, isMenu, menuOverlay, isMultiActive, showNicknameModal])

  return (
    // Every board on screen reads this one store, so the intro, the pause screen and
    // the game over screen cannot show three different answers to the same question.
    <ChampionsProvider value={champions}>
      <BoardProvider value={board}>
        {/* The celebration sits before the Screen so it paints behind the game's own UI.
          Keyed on the announcement so each one plays from the start, and so escalating
          through two records in a run swaps the effect rather than reusing it. */}
        {announcement !== null && (
          <AnnouncementEffect key={announcement.id} id={announcement.id} mode={mode} />
        )}

        {/* Trainee celebrates the hit rather than the run — half a record's pieces,
          because this fires many times a run and should not shout as loudly.
          Keyed on the batch so consecutive clean hits each get their own. */}
        {celebration.seq !== null && (
          <Confetti key={celebration.seq} density="half" colors={TRAINEE_CONFETTI} />
        )}

        {/* Trainee only, once a run, and never for a player who already knows the
          boards exist. Floats over the top bars rather than sitting in the layout —
          Trainee reclaims the band a strip would occupy. */}
        {stepUp.message !== null && !stepUpOpen && (
          <StepUpToast
            opener={stepUp.message.opener}
            invite={stepUp.message.invite}
            mode={STEP_UP_BOARD.mode}
            onPress={() => {
              // Frozen rather than ended: backing out of the screen this opens leaves
              // the practice run exactly where it stood.
              send({ type: 'PAUSE' })
              stepUp.dismiss()
              setStepUpOpen(true)
            }}
          />
        )}

        {/* ── Game screen (single padded wrapper) ── */}
        <Screen>
          {/* Row 0 — board bests, a hairline above the top bar. Trainee is a
            practice mode with no board, so it gets no strip. */}
          {mode !== 'trainee' && (
            <BestScoresLine
              inRun={inRun}
              mode={mode}
              announcement={announcement}
              yourBest={stats[mode][difficulty].score}
              loaded={board.loaded}
              todayIsMine={board.today.recordIsMine}
              weekIsMine={board.week.recordIsMine}
              everIsMine={board.forever.recordIsMine}
              today={bestToday}
              week={bestWeek}
              ever={bestEver}
            />
          )}
          <View className="mb-3">
            {/* Row 1 — mode/difficulty left, NINE centered, spacer right */}
            <View className="mb-1 flex-row items-center">
              {/* left: mode (colored, caps) + difficulty (dim, lowercase) */}
              <View className="flex-1">
                <Text
                  selectable={false}
                  className="font-mono text-[13px] font-black tracking-[2px]"
                  style={{ color: MODE_GRADIENT[mode][0] }}
                >
                  {MODES[mode].label}
                </Text>
                {isOneOf(mode, ['accuracy', 'speed']) && (
                  <Text
                    selectable={false}
                    className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
                  >
                    {DIFFICULTIES[difficulty].label.toLowerCase()}
                  </Text>
                )}
              </View>
              {/* center: NINE — tinted by difficulty shade of mode color */}
              <Text
                selectable={false}
                className="font-mono text-[24px] font-black tracking-[8px]"
                style={{ color: getDifficultyColor(mode, difficulty) }}
              >
                NINE
              </Text>
              {/* right: spacer balancing the absolute dots menu button */}
              <View className="flex-1" />
            </View>

            {/* Row 1b — Trainee's readout. The other modes spend this space on the
              board bests; Trainee has no board, and a learner wants to know how
              the press they just made actually went. */}
            {mode === 'trainee' && (
              <TraineeStats
                hits={hits}
                batch={hitBatch}
                praise={celebration.message ?? coach.line}
                route={coach.route}
                routeTarget={coach.routeTarget}
              />
            )}

            {/* Row 2 — hearts · center stat · score cluster */}
            <View className="mt-1.5 flex-row items-center">
              {/* Hearts — Trainee has no lives, so show none. */}
              <View className="flex-1 flex-row gap-1">
                {mode !== 'trainee' &&
                  [0, 1, 2].map((i) => (
                    <HeartIcon
                      key={i}
                      filled={MODES[mode].lives === Number.POSITIVE_INFINITY || i < lives}
                      emptyColor={isDark ? '#1C1D30' : '#FDFCFA'}
                    />
                  ))}
              </View>

              {/* Center: avg accuracy or avg speed depending on mode */}
              {isOneOf(mode, ['accuracy', 'speed']) && (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row' }}>
                    {`${avgStat}%`.split('').map((digit, i, arr) => (
                      <ScoreDigit
                        key={arr.length - 1 - i}
                        digit={digit}
                        direction={avgDirection.current}
                        isDark={isDark}
                        progress={0}
                        size={16}
                      />
                    ))}
                  </View>
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

              {/* Score cluster: digital readout + streak multiplier badge.
                Hidden in Trainee — it's a practice mode, not a scored run. */}
              <View className="flex-1 relative items-end">
                {mode !== 'trainee' && (
                  <>
                    <View className="flex-row items-baseline gap-1.5">
                      <Text
                        selectable={false}
                        className="text-[17px] tracking-[1px] text-score"
                        style={{ fontFamily: dsegLoaded ? 'DSEG7' : mono }}
                      >
                        {displayScore}
                      </Text>
                      {streak > 0 && (
                        <Text
                          selectable={false}
                          className="font-mono text-[11px] font-black tracking-[1px]"
                          style={{
                            color:
                              currentMultiplier >= 8
                                ? '#E5534B'
                                : currentMultiplier >= 4
                                  ? '#7273D2'
                                  : '#4C7EFF',
                          }}
                        >
                          {`×${currentMultiplier}`}
                        </Text>
                      )}
                    </View>
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
              </View>
            </View>
          </View>

          {/* Target numbers */}
          <View ref={targetsAreaRef} className="flex-1" onLayout={onContainerLayout}>
            {displayedTargets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                isDark={isDark}
                // The clock this target spawned with, so a ring never retargets
                // mid-flight when Speed's timeout tightens.
                duration={target.duration}
                par={mode === 'trainee' ? computePar(grid, target.value) : undefined}
                dying={isGameOver}
                frozen={isPaused}
                onExpire={() => {
                  send({ type: 'TARGET_EXPIRED', id: target.id })
                }}
                onExitComplete={() => {
                  removeDisplayed(target.id)
                }}
              />
            ))}
          </View>

          {/* ── Score above dial ── */}
          <View className="items-center py-1.5">
            <View className="flex-row">
              {String(sum)
                .split('')
                .map((digit, i, arr) => (
                  <ScoreDigit
                    key={arr.length - 1 - i}
                    digit={digit}
                    direction={direction}
                    isDark={isDark}
                    progress={valueProgress(sum)}
                  />
                ))}
            </View>
          </View>

          {/* ── Dial pad — bottom two thirds ── */}
          <View
            className="flex-1 items-center justify-center"
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout
              setDialSize(Math.min(width, height))
            }}
          >
            <View
              style={{ width: dialSize, height: dialSize }}
              className="flex-row flex-wrap"
            >
              {grid.flat().map((value, index) => (
                <DialButton
                  key={index}
                  value={value}
                  isDark={isDark}
                  size={Math.floor(dialSize / 3)}
                  weight={cellWeight(index)}
                  showSum={showSum}
                  trainee={mode === 'trainee'}
                  peakFrom={DARK_MODE_GRADIENT[mode][0]}
                  peakTo={DARK_MODE_GRADIENT[mode][1]}
                  onDelta={(delta) => {
                    coach.notePress(index, delta)
                    send({ type: 'PRESS', index, delta, now: Date.now() })
                  }}
                  onSet={(cellValue) => {
                    coach.noteSet(index, cellValue)
                    send({ type: 'SET_CELL', index, value: cellValue, now: Date.now() })
                  }}
                />
              ))}
            </View>
          </View>
        </Screen>

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
              backgroundColor: '#E5534B',
            },
            flashStyle,
          ]}
        />

        {/* ── Game-over cinematic (overlay crossfade + flying title) ── */}
        <GameOverSequence
          phase={dyingPhase}
          overlayStyle={overlayStyle}
          titleStyle={titleStyle}
          onTitleLayout={setOverlayTitleY}
          gameMode={mode}
          difficulty={difficulty}
          userId={userId}
          nickname={nickname}
          score={state.context.score}
          hits={state.context.hits}
          strikes={state.context.strikes}
          medals={runMedals}
          screen={runScreen}
          personalBest={crossed.includes('record')}
          titleRoll={titleRoll}
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          onPlayAgain={() => {
            send({ type: 'RESTART' })
            track('run_started', { mode, difficulty, from: 'play_again' })
          }}
          onChallenge={(nextMode, nextDifficulty) => {
            // Both land before RESTART builds the fresh game, so it reads the board
            // the player just accepted — and the persistence hooks remember it.
            send({ type: 'SET_MODE', mode: nextMode })
            send({ type: 'SET_DIFFICULTY', difficulty: nextDifficulty })
            send({ type: 'RESTART' })
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
              send({ type: 'SET_MODE', mode: STEP_UP_BOARD.mode })
              send({ type: 'SET_DIFFICULTY', difficulty: STEP_UP_BOARD.difficulty })
              send({ type: 'START' })
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
              setStepUpOpen(false)
            }}
          />
        )}

        {isPaused && menuOverlay === 'none' && !stepUpOpen && (
          <PausedOverlay
            gameMode={mode}
            difficulty={difficulty}
            userId={userId}
            nickname={nickname}
            score={state.context.score}
            hits={state.context.hits}
            avgAccuracy={avgAccuracy}
            avgSpeed={avgSpeed}
            onContinue={() => {
              send({ type: 'RESUME' })
            }}
            onNewGame={() => {
              endRunEarly()
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

        {/* ── Advanced options — shared between menu and pause ── */}
        {menuOverlay === 'advanced' && (
          <AdvancedOptionsOverlay
            isDark={isDark}
            showSum={showSum}
            onToggleSum={toggleSum}
            onToggleTheme={toggleTheme}
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
            }}
          />
        )}

        {/* ── What's new — announcements the player hasn't seen yet ── */}
        {isMenu && menuOverlay === 'none' && !isMultiActive && whatsNew.visible && (
          <WhatsNewOverlay items={whatsNew.unseen} onDismiss={whatsNew.dismiss} />
        )}

        {/* ── Install prompt — web only, and only once the news has had its turn.
          Every launch until the player installs: closing it lasts the session. ── */}
        {isMenu &&
          menuOverlay === 'none' &&
          !isMultiActive &&
          whatsNew.ready &&
          !whatsNew.visible &&
          installPrompt.target !== 'none' && (
            <InstallOverlay
              target={installPrompt.target}
              onInstall={installPrompt.install}
              onDismiss={installPrompt.dismiss}
            />
          )}

        {/* ── Menu overlay ── */}
        {isMenu && menuOverlay === 'none' && !isMultiActive && (
          <MenuOverlay
            gameMode={mode}
            difficulty={difficulty}
            userId={userId}
            nickname={nickname}
            bestScore={stats[mode][difficulty].score}
            joinError={multiRoom.error}
            initialPlayMode={menuInitialTab}
            onPlay={() => {
              setMenuInitialTab('alone')
              send({ type: 'START' })
              track('run_started', { mode, difficulty, from: 'menu' })
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
            onHowToPlay={() => {
              setMenuOverlay('howToPlay')
            }}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {/* ── Feedback bookmark and its dialog — every screen except a live run ── */}
        {/* Mounted after the overlays so they draw over whichever one is up; a live
            dial is the one place a tab a thumb could graze has no business being. */}
        {!isPlaying && !showMultiGame && !feedbackOpen && (
          <FeedbackBookmark
            onPress={() => {
              setFeedbackOpen(true)
              track('screen_opened', { screen: 'feedback' })
            }}
          />
        )}
        {feedbackOpen && (
          <FeedbackOverlay
            gameMode={mode}
            difficulty={difficulty}
            score={state.context.score}
            onClose={() => {
              setFeedbackOpen(false)
            }}
          />
        )}

        <NicknameModal
          visible={showNicknameModal}
          onSave={async (name) => {
            const res = await updateNickname(name)
            if (!res.error) {
              setShowNicknameModal(false)
              if (pendingMultiAction) {
                executeMultiAction(pendingMultiAction)
                setPendingMultiAction(null)
              }
            }
            return res
          }}
          onSkip={() => {
            setShowNicknameModal(false)
            setPendingMultiAction(null)
          }}
        />

        {/* Persistent menu button — same spot in game & pause; morphs grid↔cross.
          Sits level with the NINE row, so it clears the best-scores strip above
          it. Trainee renders no strip, so it comes up by exactly that strip's
          height rather than by a second number that could drift from it. */}
        <MenuButton
          visible={isPlaying || isPaused}
          paused={isPaused}
          onToggle={() => {
            send({ type: isPaused ? 'RESUME' : 'PAUSE' })
          }}
          color={isDark ? '#2A2B44' : '#D4D0C8'}
          style={{
            position: 'absolute',
            top: MENU_TOP[mode],
            right: 18,
            zIndex: 20,
          }}
        />

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
            mode={multiGame.mode}
            userId={userId}
            players={multiGame.players}
            currentTarget={multiGame.currentTarget}
            targetCount={multiGame.targetCount}
            isDark={isDark}
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
      </BoardProvider>
    </ChampionsProvider>
  )
}
