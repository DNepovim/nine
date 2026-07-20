import { AntDesign } from '@expo/vector-icons'
import { useMachine } from '@xstate/react'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { DialButton } from '@/components/game/dial-button'
import { FloatingPoints } from '@/components/game/floating-points'
import { MenuButton } from '@/components/game/menu-button'
import { ScoreDigit } from '@/components/game/score-digit'
import { TargetCard } from '@/components/game/target-card'
import { AdvancedOptionsOverlay } from '@/components/overlays/advanced-options-overlay'
import { MenuOverlay, type MenuMode } from '@/components/overlays/menu-overlay'
import { Screen } from '@/components/screen'
import { mono } from '@/constants/theme'
import { useDisplayOptions } from '@/hooks/use-display-options'
import { useDisplayScore } from '@/hooks/use-display-score'
import { useDisplayedTargets } from '@/hooks/use-displayed-targets'
import { useFloatingPoints } from '@/hooks/use-floating-points'
import { usePersistedDifficulty } from '@/hooks/use-persisted-difficulty'
import { usePersistedStats } from '@/hooks/use-persisted-stats'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { useTargetSpawner } from '@/hooks/use-target-spawner'
import { useTheme } from '@/hooks/use-theme'
import { valueProgress } from '@/lib/value-progress'
import { computeSum, DIFFICULTIES, gameMachine } from '@/machines/game'

export default function GameScreen() {
  const { colorScheme, toggleTheme } = useTheme()
  const isDark = colorScheme === 'dark'
  const [state, send] = useMachine(gameMachine)

  // Seven-segment font for the digital score readout.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })

  const { grid, lives, targets, difficulty, stats, hitBatch } = state.context
  const isPlaying = state.matches('playing')
  const isMenu = state.matches('menu')
  const isPaused = state.matches('paused')
  const isGameOver = state.matches('gameOver')

  usePersistedStats(stats, send)
  usePersistedDifficulty(difficulty, send)
  const { showSum, showFactor, toggleSum, toggleFactor } = useDisplayOptions()
  const [advancedOpen, setAdvancedOpen] = useState(false)

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

  useTargetSpawner({ isPlaying, targetCount: targets.length, send })
  const { floats, removeFloat } = useFloatingPoints(hitBatch)
  const { displayedTargets, removeDisplayed, onContainerLayout } = useDisplayedTargets({
    machineTargets: targets,
    isPlaying,
    stateValue: stateName,
  })

  // Dial pad is a square sized to fit its container (min of width/height), so it
  // never overflows over the score above it.
  const [dialSize, setDialSize] = useState(0)

  const menuMode: MenuMode = isGameOver ? 'gameOver' : isPaused ? 'paused' : 'menu'

  return (
    <>
      {/* ── Game screen (single padded wrapper) ── */}
      <Screen>
        <View className="mb-3">
          {/* Row 1 — NINE (left) + MENU label (right). The dots icon is the
              absolute overlay at top-right, so reserve room for it. */}
          <View
            className="mb-1 flex-row items-center justify-between"
            style={{ paddingRight: 32 }}
          >
            <Text
              selectable={false}
              className="font-mono text-[30px] font-black tracking-[8px] text-muted"
            >
              NINE
            </Text>
            <Text
              selectable={false}
              className="font-mono text-[14px] font-black tracking-[3px] text-muted"
            >
              MENU
            </Text>
          </View>

          {/* Row 2 — hearts + score, right-aligned under the menu */}
          <View className="flex-row items-center justify-between gap-2.5 mt-1.5">
            <View className="flex-row gap-1">
              {[0, 1, 2].map((i) => (
                <AntDesign
                  key={i}
                  name="heart"
                  size={22}
                  color={i < lives ? '#E5534B' : isDark ? '#1C1D30' : '#FDFCFA'}
                />
              ))}
            </View>
            <View className="relative">
              <Text
                selectable={false}
                className="text-[17px] tracking-[1px] text-score"
                style={{ fontFamily: dsegLoaded ? 'DSEG7' : mono }}
              >
                {displayScore}
              </Text>
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
              duration={DIFFICULTIES[difficulty].duration}
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
                showFactor={showFactor}
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

      {/* ── Menu / Pause / Game-over overlay (shared layout) ── */}
      {(isMenu || isPaused || isGameOver) &&
        (advancedOpen ? (
          <AdvancedOptionsOverlay
            isDark={isDark}
            showSum={showSum}
            showFactor={showFactor}
            onToggleSum={toggleSum}
            onToggleFactor={toggleFactor}
            onToggleTheme={toggleTheme}
            onClose={() => {
              setAdvancedOpen(false)
            }}
          />
        ) : (
          <MenuOverlay
            mode={menuMode}
            stats={stats}
            difficulty={difficulty}
            dsegLoaded={dsegLoaded}
            currentScore={state.context.score}
            currentHits={state.context.hits}
            onPlay={() => {
              send({ type: isGameOver ? 'RESTART' : 'START' })
            }}
            onContinue={() => {
              send({ type: 'RESUME' })
            }}
            onNewGame={() => {
              send({ type: 'MENU' })
            }}
            onSetDifficulty={(next) => {
              send({ type: 'SET_DIFFICULTY', difficulty: next })
            }}
            onOpenAdvanced={() => {
              setAdvancedOpen(true)
            }}
          />
        ))}

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
    </>
  )
}
