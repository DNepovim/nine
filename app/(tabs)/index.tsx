import { AntDesign } from '@expo/vector-icons'
import { useMachine } from '@xstate/react'
import { useFonts } from 'expo-font'
import { isNotNull, isOneOf } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { DialButton } from '@/components/game/dial-button'
import { FloatingPoints } from '@/components/game/floating-points'
import { FloatingStat } from '@/components/game/floating-stat'
import { MenuButton } from '@/components/game/menu-button'
import { MultiplayerGame } from '@/components/game/multiplayer-game'
import { ScoreDigit } from '@/components/game/score-digit'
import { TargetCard } from '@/components/game/target-card'
import { AdvancedOptionsOverlay } from '@/components/overlays/advanced-options-overlay'
import { GameOverOverlay } from '@/components/overlays/game-over-overlay'
import { MenuOverlay } from '@/components/overlays/menu-overlay'
import { MultiplayerGameOver } from '@/components/overlays/multiplayer-game-over'
import { MultiplayerMenu } from '@/components/overlays/multiplayer-menu'
import { MultiplayerWaiting } from '@/components/overlays/multiplayer-waiting'
import { NicknameModal } from '@/components/overlays/nickname-modal'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { Screen } from '@/components/screen'
import { mono } from '@/constants/theme'
import { useDisplayOptions } from '@/hooks/use-display-options'
import { useDisplayScore } from '@/hooks/use-display-score'
import { useDisplayedTargets } from '@/hooks/use-displayed-targets'
import { useFloatingPoints } from '@/hooks/use-floating-points'
import { useFloatingStat } from '@/hooks/use-floating-stat'
import { useMultiplayerGame } from '@/hooks/use-multiplayer-game'
import { useMultiplayerRoom } from '@/hooks/use-multiplayer-room'
import { usePersistedDifficulty } from '@/hooks/use-persisted-difficulty'
import { usePersistedMode } from '@/hooks/use-persisted-mode'
import { usePersistedStats } from '@/hooks/use-persisted-stats'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { useScoreSubmission } from '@/hooks/use-score-submission'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { useTargetSpawner } from '@/hooks/use-target-spawner'
import { useTheme } from '@/hooks/use-theme'
import { valueProgress } from '@/lib/value-progress'
import {
  computeSum,
  DIFFICULTIES,
  effectiveTimeout,
  gameMachine,
  getDifficultyColor,
  MODE_GRADIENT,
  MODES,
  streakMultiplier,
} from '@/machines/game'
import { computePar } from '@/machines/scoring'
import type { MultiMode } from '@/types/multiplayer'

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
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Close advanced options whenever the game starts or resumes so that pausing
  // again always shows the pause screen, not the advanced options overlay.
  useEffect(() => {
    if (isPlaying) setAdvancedOpen(false)
  }, [isPlaying])

  const { userId, nickname, isReady, updateNickname } = useSupabaseAuth()
  const { submit: submitScore } = useScoreSubmission(userId, nickname, isReady)
  const [showNicknameModal, setShowNicknameModal] = useState(false)

  // Trigger score submission on each game-over transition.
  const prevIsGameOverRef = useRef(false)
  useEffect(() => {
    if (isGameOver === prevIsGameOverRef.current) return
    prevIsGameOverRef.current = isGameOver
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
    submitScore,
  ])

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

  useTargetSpawner({ isPlaying, targetCount: targets.length, mode, difficulty, send })
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
  const duration = effectiveTimeout(mode, difficulty)

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

  return (
    <>
      {/* ── Game screen (single padded wrapper) ── */}
      <Screen>
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

          {/* Row 2 — hearts · center stat · score cluster */}
          <View className="mt-1.5 flex-row items-center">
            <View className="flex-1 flex-row gap-1">
              {[0, 1, 2].map((i) => (
                <AntDesign
                  key={i}
                  name="heart"
                  size={22}
                  color={
                    MODES[mode].lives === Number.POSITIVE_INFINITY || i < lives
                      ? '#E5534B'
                      : isDark
                        ? '#1C1D30'
                        : '#FDFCFA'
                  }
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

            {/* Score cluster: digital readout + streak multiplier badge */}
            <View className="flex-1 relative items-end">
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
                  bonus={f.bonus}
                  onDone={() => {
                    removeFloat(f.id)
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Target numbers */}
        <View className="flex-1" onLayout={onContainerLayout}>
          {displayedTargets.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              isDark={isDark}
              duration={duration}
              par={mode === 'trainee' ? computePar(grid, target.value) : undefined}
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
                weight={(Math.floor(index / 3) + 1) * ((index % 3) + 1)}
                showSum={showSum}
                trainee={mode === 'trainee'}
                onDelta={(delta) => {
                  send({ type: 'PRESS', index, delta, now: Date.now() })
                }}
                onSet={(cellValue) => {
                  send({ type: 'SET_CELL', index, value: cellValue, now: Date.now() })
                }}
              />
            ))}
          </View>
        </View>
      </Screen>

      {/* ── Game-over overlay ── */}
      {isGameOver && (
        <GameOverOverlay
          gameMode={mode}
          difficulty={difficulty}
          userId={userId}
          nickname={nickname}
          score={state.context.score}
          hits={state.context.hits}
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          onNewGame={() => {
            send({ type: 'MENU' })
          }}
        />
      )}

      {/* ── Pause overlay ── */}
      {isPaused && !advancedOpen && (
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
            send({ type: 'MENU' })
          }}
          onOpenAdvanced={() => {
            setAdvancedOpen(true)
          }}
        />
      )}

      {/* ── Advanced options — shared between menu and pause ── */}
      {advancedOpen && (
        <AdvancedOptionsOverlay
          isDark={isDark}
          showSum={showSum}
          onToggleSum={toggleSum}
          onToggleTheme={toggleTheme}
          onClose={() => {
            setAdvancedOpen(false)
          }}
        />
      )}

      {/* ── Menu overlay ── */}
      {isMenu && !advancedOpen && !isMultiActive && (
        <MenuOverlay
          gameMode={mode}
          difficulty={difficulty}
          userId={userId}
          nickname={nickname}
          joinError={multiRoom.error}
          initialPlayMode={menuInitialTab}
          onPlay={() => {
            setMenuInitialTab('alone')
            send({ type: 'START' })
          }}
          onSetMode={(next) => {
            send({ type: 'SET_MODE', mode: next })
          }}
          onSetDifficulty={(next) => {
            send({ type: 'SET_DIFFICULTY', difficulty: next })
          }}
          onOpenAdvanced={() => {
            setAdvancedOpen(true)
          }}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
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

      {/* Persistent menu button — same spot in game & pause; morphs grid↔cross */}
      <MenuButton
        visible={isPlaying || isPaused}
        paused={isPaused}
        onToggle={() => {
          send({ type: isPaused ? 'RESUME' : 'PAUSE' })
        }}
        color={isDark ? '#2A2B44' : '#D4D0C8'}
        style={{ position: 'absolute', top: 12, right: 18, zIndex: 20 }}
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
    </>
  )
}
