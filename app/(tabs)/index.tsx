import { AntDesign, Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMachine } from '@xstate/react'
import Constants from 'expo-constants'
import { useFonts } from 'expo-font'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import {
  computeSum,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  gameMachine,
  type Difficulty,
  type HitInfo,
  type Stats,
  type Target,
} from '@/machines/game'

const mono = Fonts.mono
const APP_BLUE = '#4C7EFF'
const APP_RED = '#E5534B'
const SWIPE_THRESHOLD = 20

// Dial buttons tint by value (0 → 9), transitioning across an on-brand cool
// gradient. Light: pale lavender → periwinkle blue. Dark: deep navy → app blue.
const DIAL_COLORS = {
  light: { low: '#ECEAF7', high: '#8296FF' },
  dark: { low: '#1E2036', high: '#4C7EFF' },
}

// The score above the dial transitions from the target numbers' background color
// (APP_BLUE, the pie fill) up to the standard text color.
const SCORE_COLORS = {
  light: { low: APP_BLUE, high: '#1C1928' },
  dark: { low: APP_BLUE, high: '#D8D2F4' },
}

// Maps a numeric value to its tint progress (0 → 1) across the 0..MAX_TARGET range.
const valueProgress = (v: number) => Math.min(1, Math.max(0, v / MAX_TARGET))
const MAX_TARGET = 324 // 9 × (sum of row×col weights)
const PIE_SIZE = 80
const CARD_W = PIE_SIZE
const CARD_H = PIE_SIZE
const CARD_GAP = 10
const STATS_KEY = 'nine.stats.v2'
const LEGACY_BEST_SCORES_KEY = 'nine.bestScores.v1' // migrated → hits seed
const DIFFICULTY_KEY = 'nine.difficulty.v1'
const OPTIONS_KEY = 'nine.options.v1'

// Build identifier shown on the intro screen. EXPO_PUBLIC_BUILD_ID is injected
// at build time (git sha + timestamp); falls back to "dev" during `expo start`.
const BUILD_LABEL = `v${Constants.expoConfig?.version ?? '?'} · ${process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev'}`

// ─── Pie Countdown ──────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// Thick-stroke trick: radius = SIZE/4, strokeWidth = SIZE/2
// → stroke spans from center to edge, looks like a filled disc
const PIE_RADIUS = PIE_SIZE / 4
const PIE_STROKE = PIE_SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS

function PieCountdown({
  value,
  isDark,
  active,
  duration,
  onComplete,
}: {
  value: number
  isDark: boolean
  active: boolean
  duration: number
  onComplete: () => void
}) {
  const progress = useSharedValue(1) // 1 = full, 0 = empty
  const trackColor = isDark ? '#2A2B44' : '#D4D0C8'

  useEffect(() => {
    progress.value = withTiming(0, { duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onComplete)
    })
  }, [])

  useEffect(() => {
    if (active) return
    cancelAnimation(progress)
  }, [active])

  // strokeDashoffset 0 = full disc, CIRCUMFERENCE = empty.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  // A red arc layered over the blue one, fading in as time runs out (progress
  // 1 → 0). Uses only numeric animated props (opacity), which animate reliably
  // on SVG across platforms — unlike an animated `stroke` color string.
  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
    opacity: 1 - progress.value,
  }))

  const cx = PIE_SIZE / 2
  const cy = PIE_SIZE / 2

  return (
    <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
      <Svg width={PIE_SIZE} height={PIE_SIZE}>
        {/* Track disc */}
        <Circle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={trackColor}
          strokeWidth={PIE_STROKE}
          fill="none"
        />
        {/* Progress disc (blue) — rotated so it starts at 12 o'clock */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={APP_BLUE}
          strokeWidth={PIE_STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
        {/* Red arc over the blue one, fading in as the timer runs out */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={APP_RED}
          strokeWidth={PIE_STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={redProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      {/* Number centered — high-contrast against the blue/red disc and track */}
      <View
        style={{
          position: 'absolute',
          inset: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            // Scale by digit count so the number fills almost the whole circle
            // (targets are 0..324, i.e. 1–3 digits) while staying on one line.
            fontSize:
              String(value).length >= 3 ? 36 : String(value).length === 2 ? 50 : 58,
            fontWeight: '800',
            fontFamily: mono,
            includeFontPadding: false,
            color: isDark ? '#FFFFFF' : '#171421',
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

// ─── Target Card ────────────────────────────────────────────────────────────

type Position = { x: number; y: number }
type DisplayTarget = Target & { exiting: boolean; position: Position }

function findPosition(
  existing: DisplayTarget[],
  containerW: number,
  containerH: number,
): Position {
  const maxX = containerW - CARD_W - CARD_GAP
  const maxY = containerH - CARD_H - CARD_GAP
  if (maxX <= 0 || maxY <= 0) return { x: CARD_GAP, y: CARD_GAP }

  for (let attempt = 0; attempt < 60; attempt++) {
    const x = CARD_GAP + Math.random() * (maxX - CARD_GAP)
    const y = CARD_GAP + Math.random() * (maxY - CARD_GAP)
    const overlaps = existing.some(
      (t) =>
        !t.exiting &&
        x < t.position.x + CARD_W &&
        x + CARD_W > t.position.x &&
        y < t.position.y + CARD_H &&
        y + CARD_H > t.position.y,
    )
    if (!overlaps) return { x, y }
  }
  return {
    x: CARD_GAP + Math.random() * maxX,
    y: CARD_GAP + Math.random() * maxY,
  }
}

function TargetCard({
  target,
  isDark,
  duration,
  onExpire,
  onExitComplete,
}: {
  target: DisplayTarget
  isDark: boolean
  duration: number
  onExpire: () => void
  onExitComplete: () => void
}) {
  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 200 })
    opacity.value = withTiming(1, { duration: 180 })
  }, [])

  useEffect(() => {
    if (!target.exiting) return
    scale.value = withSpring(1.15, { damping: 10, stiffness: 300 })
    opacity.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) scheduleOnRN(onExitComplete)
    })
  }, [target.exiting])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: target.position.x,
          top: target.position.y,
        },
        animStyle,
      ]}
    >
      <PieCountdown
        value={target.value}
        isDark={isDark}
        active={!target.exiting}
        duration={duration}
        onComplete={onExpire}
      />
    </Animated.View>
  )
}

// ─── Score Digit ────────────────────────────────────────────────────────────

function ScoreDigit({
  digit,
  direction,
  isDark,
  progress,
}: {
  digit: string
  direction: 1 | -1
  isDark: boolean
  progress: number
}) {
  const prevDigit = useRef(digit)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const colorProgress = useSharedValue(progress)

  // Animate the tint as the sum changes.
  useEffect(() => {
    colorProgress.value = withTiming(progress, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    })
  }, [progress])

  useEffect(() => {
    if (digit === prevDigit.current) return
    prevDigit.current = digit

    const exitDir = direction === 1 ? -1 : 1

    opacity.value = withSequence(
      withTiming(0, { duration: 80 }),
      withTiming(1, { duration: 110 }),
    )
    translateY.value = withSequence(
      withTiming(exitDir * 10, { duration: 80 }),
      withTiming(exitDir * -10, { duration: 0 }),
      withSpring(0, { damping: 18, stiffness: 180 }),
    )
  }, [digit])

  const palette = isDark ? SCORE_COLORS.dark : SCORE_COLORS.light
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    color: interpolateColor(colorProgress.value, [0, 1], [palette.high, palette.low]),
  }))

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          fontSize: 42,
          fontWeight: '700',
          fontFamily: mono,
          letterSpacing: 2,
        },
        animStyle,
      ]}
    >
      {digit}
    </Animated.Text>
  )
}

// ─── Dial Button ────────────────────────────────────────────────────────────

function DialButton({
  value,
  isDark,
  size,
  weight,
  showSum,
  showFactor,
  onDelta,
  onSet,
}: {
  value: number
  isDark: boolean
  size: number
  weight: number
  showSum: boolean
  showFactor: boolean
  onDelta: (delta: 1 | -1) => void
  onSet: (value: number) => void
}) {
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const numTranslateY = useSharedValue(0)
  const numOpacity = useSharedValue(1)
  const numScale = useSharedValue(1)
  const colorProgress = useSharedValue(value / 9)

  // Animate the button tint whenever its value changes.
  useEffect(() => {
    colorProgress.value = withTiming(value / 9, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    })
  }, [value])

  const animateSwipe = (delta: 1 | -1) => {
    'worklet'
    const exitDir = delta === 1 ? -1 : 1

    translateY.value = withSequence(
      withTiming(exitDir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    )

    numOpacity.value = withTiming(0, { duration: 110 })
    numTranslateY.value = withTiming(exitDir * 18, { duration: 110 }, (finished) => {
      if (!finished) return
      scheduleOnRN(onDelta, delta)
      numTranslateY.value = exitDir * -18
      numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 })
      numOpacity.value = withTiming(1, { duration: 130 })
    })
  }

  // Left/right swipe sets an absolute value (left → 0, right → 9), animated the
  // same way as an up/down swipe. exitDir: -1 = up (increase), 1 = down (decrease).
  const animateSet = (newValue: number, exitDir: 1 | -1) => {
    'worklet'
    translateY.value = withSequence(
      withTiming(exitDir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    )

    numOpacity.value = withTiming(0, { duration: 110 })
    numTranslateY.value = withTiming(exitDir * 18, { duration: 110 }, (finished) => {
      if (!finished) return
      scheduleOnRN(onSet, newValue)
      numTranslateY.value = exitDir * -18
      numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 })
      numOpacity.value = withTiming(1, { duration: 130 })
    })
  }

  const animateTap = () => {
    'worklet'
    numScale.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withSpring(1, { damping: 18, stiffness: 160 }),
    )
    scheduleOnRN(onDelta, 1)
  }

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      'worklet'
      scale.value = withSpring(0.94, { damping: 20, stiffness: 260 })
    })
    .onEnd((e) => {
      'worklet'
      // Dominant axis decides the gesture: horizontal sets 0/9, vertical ±1.
      // Skip the number animation when the value wouldn't change (already 0/9).
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX < -SWIPE_THRESHOLD) {
          if (value !== 0) animateSet(0, 1)
        } else if (e.translationX > SWIPE_THRESHOLD) {
          if (value !== 9) animateSet(9, -1)
        } else animateTap()
      } else {
        if (e.translationY < -SWIPE_THRESHOLD) animateSwipe(1)
        else if (e.translationY > SWIPE_THRESHOLD) animateSwipe(-1)
        else animateTap()
      }
    })
    .onFinalize(() => {
      'worklet'
      scale.value = withSpring(1, { damping: 16, stiffness: 140 })
    })

  const palette = isDark ? DIAL_COLORS.dark : DIAL_COLORS.light
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [palette.low, palette.high],
    ),
  }))

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numTranslateY.value }, { scale: numScale.value }],
    opacity: numOpacity.value,
  }))

  return (
    <GestureDetector gesture={gesture}>
      {/* Explicit pixel size (not w-1/3 + aspect-square): iOS WebKit fails to
          derive height from aspect-ratio on wrapping flex children. */}
      <View style={{ width: size, height: size, padding: 10 }}>
        <Animated.View
          style={[
            {
              flex: 1,
              borderRadius: 999,
              justifyContent: 'center' as const,
              alignItems: 'center' as const,
              shadowColor: isDark ? '#04040C' : '#1C1928',
              shadowOpacity: isDark ? 0.9 : 0.13,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 10,
            },
            btnStyle,
          ]}
        >
          {/* Factor (row×col multiplier) — small, pinned near the top */}
          {showFactor && (
            <View
              style={{
                position: 'absolute',
                top: Math.round(size * 0.1),
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <Text
                selectable={false}
                style={{
                  fontSize: Math.max(10, Math.round(size * 0.14)),
                  fontFamily: mono,
                  fontWeight: '700',
                  includeFontPadding: false,
                  color: isDark ? '#6E6A92' : '#9A96A8',
                }}
              >
                {weight}
              </Text>
            </View>
          )}
          <Animated.Text
            selectable={false}
            style={[
              {
                fontSize: 30,
                fontFamily: mono,
                fontWeight: '500' as const,
                includeFontPadding: false,
                color: isDark ? '#C8C2E8' : '#1C1928',
              },
              numStyle,
            ]}
          >
            {showSum ? value * weight : value}
          </Animated.Text>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

// ─── Theme Toggle ────────────────────────────────────────────────────────────

const TOGGLE_W = 96
const TOGGLE_H = 40
const KNOB = TOGGLE_H - 8

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const knobX = useSharedValue(isDark ? TOGGLE_W - KNOB - 4 : 4)

  useEffect(() => {
    knobX.value = withSpring(isDark ? TOGGLE_W - KNOB - 4 : 4, {
      damping: 18,
      stiffness: 200,
    })
  }, [isDark])

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }))

  const trackDim = isDark ? '#16172A' : '#E8E4DC'
  const iconDim = isDark ? '#504E6E' : '#AAA69E'
  const iconActive = isDark ? '#D8D2F4' : '#1C1928'

  return (
    <Pressable onPress={onToggle}>
      <View
        style={{
          width: TOGGLE_W,
          height: TOGGLE_H,
          borderRadius: TOGGLE_H / 2,
          backgroundColor: trackDim,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'center',
        }}
      >
        {/* Moon — left */}
        <View
          style={{
            position: 'absolute',
            left: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="moon" size={15} color={isDark ? iconDim : iconActive} />
        </View>
        {/* Sun — right */}
        <View
          style={{
            position: 'absolute',
            right: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="sunny" size={15} color={isDark ? iconActive : iconDim} />
        </View>
        {/* Knob */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: isDark ? '#1C1D30' : '#FDFCFA',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
            },
            knobStyle,
          ]}
        />
      </View>
    </Pressable>
  )
}

// ─── Menu / Pause overlay ────────────────────────────────────────────────────

// ─── Screen wrapper — consistent padding for every screen ────────────────────
// `overlay` screens fill the viewport with the theme background and center their
// content; the plain (game) screen is a padded flex column.
function Screen({
  children,
  isDark,
  overlay = false,
}: {
  children: ReactNode
  isDark: boolean
  overlay?: boolean
}) {
  const bg = isDark ? 'bg-[#0B0C14]' : 'bg-[#F3EFE9]'
  const overlayClasses = overlay ? `items-center justify-center ${bg}` : ''
  return (
    <View
      style={overlay ? { position: 'absolute', inset: 0 } : { flex: 1 }}
      className={`px-4 py-2 ${overlayClasses}`}
    >
      {children}
    </View>
  )
}

function MenuOverlay({
  isDark,
  mode,
  stats,
  difficulty,
  currentScore,
  currentHits,
  dsegLoaded,
  onPlay,
  onContinue,
  onNewGame,
  onSetDifficulty,
  onOpenAdvanced,
}: {
  isDark: boolean
  mode: 'menu' | 'paused' | 'gameOver'
  stats: Stats
  difficulty: Difficulty
  currentScore: number
  currentHits: number
  dsegLoaded: boolean
  onPlay: () => void
  onContinue: () => void
  onNewGame: () => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
}) {
  const dimText = isDark ? 'text-[#504E6E]' : 'text-[#AAA69E]'
  const primaryText = isDark ? 'text-[#D8D2F4]' : 'text-[#1C1928]'
  const btnBg = isDark ? 'bg-[#1C1D30]' : 'bg-[#1C1928]'
  const cardBg = isDark ? 'bg-[#16172A]' : 'bg-[#E8E4DC]'
  const best = stats[difficulty]

  const isPaused = mode === 'paused'
  const isGameOver = mode === 'gameOver'
  const showConfig = mode === 'menu' || isGameOver // difficulty + best + build
  const title = isGameOver ? 'GAME OVER' : isPaused ? 'PAUSED' : 'NINE'

  const shadow = {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  }

  return (
    <Screen overlay isDark={isDark}>
      {/* MENU label beside the persistent menu button (dots → cross) on pause */}
      {isPaused && (
        <Text
          selectable={false}
          className="text-[14px] font-black tracking-[3px]"
          style={{
            position: 'absolute',
            top: 15,
            right: 46,
            fontFamily: mono,
            color: isDark ? '#2A2B44' : '#D4D0C8',
          }}
        >
          MENU
        </Text>
      )}

      {/* Current run's score — above the title on pause & game over */}
      {(isPaused || isGameOver) && (
        <View className="items-center gap-2 mb-5">
          <Text
            selectable={false}
            className={`text-[9px] font-bold tracking-[1.8px] ${dimText}`}
            style={{ fontFamily: mono }}
          >
            SCORE
          </Text>
          <Text
            selectable={false}
            style={{
              fontFamily: dsegLoaded ? 'DSEG7' : mono,
              fontSize: 44,
              letterSpacing: 1,
              color: isDark ? '#2FB35A' : '#147A32',
            }}
          >
            {currentScore}
          </Text>
          <Text
            selectable={false}
            className={`text-[9px] font-bold tracking-[1.2px] ${dimText}`}
            style={{ fontFamily: mono }}
          >
            {`${currentHits} HITS`}
          </Text>
        </View>
      )}

      <Text
        selectable={false}
        className={`font-black mb-4 ${primaryText} ${mode === 'menu' ? 'text-[48px] tracking-[10px]' : 'text-[30px] tracking-[4px]'}`}
        style={{ fontFamily: mono }}
      >
        {title}
      </Text>

      {/* Difficulty selector — menu & game over */}
      {showConfig && (
        <View className="items-center mb-6">
          <Text
            selectable={false}
            className={`text-[9px] font-bold tracking-[1.8px] mb-2 ${dimText}`}
            style={{ fontFamily: mono }}
          >
            DIFFICULTY
          </Text>
          <View
            className="flex-row flex-wrap justify-center gap-2 px-6"
            style={{ maxWidth: 320 }}
          >
            {DIFFICULTY_ORDER.map((d) => {
              const selected = d === difficulty
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    onSetDifficulty(d)
                  }}
                  className={`px-3.5 py-2 rounded-xl ${selected ? btnBg : cardBg}`}
                >
                  <Text
                    selectable={false}
                    className={`text-[11px] font-black tracking-[1.5px] ${selected ? 'text-[#D8D2F4]' : dimText}`}
                    style={{ fontFamily: mono }}
                  >
                    {DIFFICULTIES[d].label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {/* Best — menu & game over */}
      {showConfig && (
        <View className={`px-8 py-3 rounded-2xl items-center mb-8 ${cardBg}`}>
          <Text
            selectable={false}
            className={`text-[9px] font-bold tracking-[1.8px] ${dimText}`}
            style={{ fontFamily: mono }}
          >
            {`BEST · ${DIFFICULTIES[difficulty].label}`}
          </Text>
          <Text
            selectable={false}
            className={`text-[28px] font-black leading-tight ${primaryText}`}
            style={{ fontFamily: mono }}
          >
            {best.score}
          </Text>
          <Text
            selectable={false}
            className={`text-[9px] font-bold tracking-[1.2px] ${dimText}`}
            style={{ fontFamily: mono }}
          >
            {`${best.hits} HITS`}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View className="gap-3 w-56">
        {isPaused ? (
          <>
            {/* CONTINUE is the highlighted primary action */}
            <Pressable
              onPress={onContinue}
              className={`py-4 rounded-2xl items-center ${btnBg}`}
              style={shadow}
            >
              <Text
                selectable={false}
                className="text-[13px] font-black tracking-[2px] text-[#D8D2F4]"
                style={{ fontFamily: mono }}
              >
                CONTINUE
              </Text>
            </Pressable>
            <Pressable
              onPress={onNewGame}
              className={`py-4 rounded-2xl items-center ${cardBg}`}
            >
              <Text
                selectable={false}
                className={`text-[13px] font-black tracking-[2px] ${primaryText}`}
                style={{ fontFamily: mono }}
              >
                NEW GAME
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onPlay}
            className={`py-4 rounded-2xl items-center ${btnBg}`}
            style={shadow}
          >
            <Text
              selectable={false}
              className="text-[13px] font-black tracking-[2px] text-[#D8D2F4]"
              style={{ fontFamily: mono }}
            >
              PLAY GAME
            </Text>
          </Pressable>
        )}
      </View>

      {/* Advanced options link */}
      <Pressable onPress={onOpenAdvanced} hitSlop={10} className="mt-8">
        <Text
          selectable={false}
          className={`text-[10px] font-bold tracking-[1.8px] underline ${dimText}`}
          style={{ fontFamily: mono }}
        >
          ADVANCED OPTIONS
        </Text>
      </Pressable>

      {/* Build identifier */}
      {showConfig && (
        <Text
          selectable={false}
          className={`text-[9px] font-bold tracking-[1px] ${dimText}`}
          style={{ position: 'absolute', bottom: 24, fontFamily: mono }}
        >
          {BUILD_LABEL}
        </Text>
      )}
    </Screen>
  )
}

// ─── Advanced options overlay ────────────────────────────────────────────────

function AdvancedOptionsOverlay({
  isDark,
  showSum,
  showFactor,
  onToggleSum,
  onToggleFactor,
  onToggleTheme,
  onClose,
}: {
  isDark: boolean
  showSum: boolean
  showFactor: boolean
  onToggleSum: () => void
  onToggleFactor: () => void
  onToggleTheme: () => void
  onClose: () => void
}) {
  const dimText = isDark ? 'text-[#504E6E]' : 'text-[#AAA69E]'
  const primaryText = isDark ? 'text-[#D8D2F4]' : 'text-[#1C1928]'
  const cardBg = isDark ? 'bg-[#16172A]' : 'bg-[#E8E4DC]'
  const boxOn = isDark ? 'bg-[#1C1D30]' : 'bg-[#1C1928]'

  const Option = ({
    checked,
    label,
    description,
    onToggle,
  }: {
    checked: boolean
    label: string
    description: string
    onToggle: () => void
  }) => (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center gap-3 py-3"
      style={{ width: 300 }}
    >
      <View
        className={`w-7 h-7 rounded-lg items-center justify-center ${checked ? boxOn : cardBg}`}
      >
        {checked && <AntDesign name="check" size={17} color="#D8D2F4" />}
      </View>
      <View className="flex-1">
        <Text
          selectable={false}
          className={`text-[13px] font-black tracking-[1px] ${primaryText}`}
          style={{ fontFamily: mono }}
        >
          {label}
        </Text>
        <Text
          selectable={false}
          className={`text-[10px] font-bold tracking-[0.5px] mt-0.5 ${dimText}`}
          style={{ fontFamily: mono }}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  )

  return (
    <Screen overlay isDark={isDark}>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={{ position: 'absolute', top: 16, right: 16 }}
      >
        <AntDesign name="close" size={26} color={isDark ? '#2A2B44' : '#D4D0C8'} />
      </Pressable>

      <Text
        selectable={false}
        className={`text-[20px] font-black tracking-[3px] mb-8 ${primaryText}`}
        style={{ fontFamily: mono }}
      >
        ADVANCED
      </Text>

      <Option
        checked={showSum}
        label="SHOW SUM IN BUTTONS"
        description="Display value × row × column"
        onToggle={onToggleSum}
      />
      <Option
        checked={showFactor}
        label="SHOW FACTOR"
        description="Small multiplier at the top of each button"
        onToggle={onToggleFactor}
      />

      {/* Theme */}
      <View className="flex-row items-center justify-between py-3" style={{ width: 300 }}>
        <Text
          selectable={false}
          className={`text-[13px] font-black tracking-[1px] ${primaryText}`}
          style={{ fontFamily: mono }}
        >
          THEME
        </Text>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </View>

      <Pressable
        onPress={onClose}
        className={`mt-8 py-4 rounded-2xl items-center ${boxOn}`}
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="text-[13px] font-black tracking-[2px] text-[#D8D2F4]"
          style={{ fontFamily: mono }}
        >
          DONE
        </Text>
      </Pressable>
    </Screen>
  )
}

// ─── Floating hit points ─────────────────────────────────────────────────────

function FloatingPoints({
  points,
  progress,
  bonus,
  onDone,
}: {
  points: number
  progress: number
  bonus: boolean
  onDone: () => void
}) {
  const ty = useSharedValue(0)
  const op = useSharedValue(0)
  const sc = useSharedValue(bonus ? 0.5 : 0.9)

  useEffect(() => {
    op.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(1, { duration: 330 }),
      withTiming(0, { duration: 200 }),
    )
    ty.value = withSequence(
      withTiming(0, { duration: 160 }), // hold below the block — readable
      withTiming(-20, { duration: 480, easing: Easing.out(Easing.quad) }), // rise into the block
    )
    sc.value = withSequence(
      withSpring(bonus ? 1.3 : 1, { damping: 9, stiffness: 220 }),
      withTiming(bonus ? 1.18 : 1, { duration: 220 }),
    )
    const t = setTimeout(onDone, 660)
    return () => {
      clearTimeout(t)
    }
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: sc.value }],
    opacity: op.value,
  }))
  const color = interpolateColor(progress, [0, 1], [APP_RED, APP_BLUE])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 24,
          left: 0,
          right: 0,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      <Text
        selectable={false}
        style={{ fontFamily: mono, fontWeight: '900', fontSize: bonus ? 20 : 15, color }}
      >
        +{points}
      </Text>
      {bonus && (
        <Text
          selectable={false}
          style={{ fontFamily: mono, fontWeight: '900', fontSize: 11, color: '#E7B44C' }}
        >
          ×2
        </Text>
      )}
    </Animated.View>
  )
}

// ─── Menu button ─────────────────────────────────────────────────────────────
// A single persistent button that morphs between the 3×3 grid (playing) and a
// 5-dot cross of center + corners (paused). Tapping converges every dot to the
// center, toggles pause at the peak, then springs the shape back out — so the
// same element stays in place across the game/pause transition.

function MenuDot({
  collapse,
  present,
  baseX,
  baseY,
  dx,
  dy,
  d,
  color,
}: {
  collapse: SharedValue<number>
  present: SharedValue<number> // 1 = at its position, 0 = merged + hidden at center
  baseX: number
  baseY: number
  dx: number
  dy: number
  d: number
  color: string
}) {
  const style = useAnimatedStyle(() => {
    // factor: 0 = at grid position, 1 = merged at the center dot.
    const factor = 1 - present.value * (1 - collapse.value)
    return {
      transform: [{ translateX: dx * factor }, { translateY: dy * factor }],
      opacity: present.value,
    }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: baseX,
          top: baseY,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

function MenuButton({
  visible,
  paused,
  onToggle,
  color,
  size = 22,
  style,
}: {
  visible: boolean
  paused: boolean
  onToggle: () => void
  color: string
  size?: number
  style?: object
}) {
  const D = 4
  const coords = [0, (size - D) / 2, size - D]
  const center = (size - D) / 2
  const collapse = useSharedValue(0)
  // Edge dots are shown in the grid, merged+hidden at the center in the cross.
  const edge = useSharedValue(paused ? 0 : 1)
  const always = useSharedValue(1)

  useEffect(() => {
    edge.value = withTiming(paused ? 0 : 1, {
      duration: 300,
      easing: Easing.out(Easing.back(2)),
    })
  }, [paused])

  const trigger = () => {
    collapse.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 340, easing: Easing.out(Easing.back(2)) }),
    )
    setTimeout(onToggle, 160) // toggle at the peak; edges morph via the paused effect
  }

  if (!visible) return null
  return (
    <Pressable onPress={trigger} hitSlop={14} style={style}>
      <View style={{ width: size, height: size }}>
        {coords.map((y, r) =>
          coords.map((x, c) => {
            const isEdge = (r === 1) !== (c === 1) // exactly one axis centered
            return (
              <MenuDot
                key={`${r}-${c}`}
                collapse={collapse}
                present={isEdge ? edge : always}
                baseX={x}
                baseY={y}
                dx={center - x}
                dy={center - y}
                d={D}
                color={color}
              />
            )
          }),
        )}
      </View>
    </Pressable>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function GameScreen() {
  const { colorScheme, toggleTheme } = useTheme()
  const isDark = colorScheme === 'dark'
  const [state, send] = useMachine(gameMachine)

  // Seven-segment font for the digital score readout.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })

  // Load persisted per-difficulty stats once on mount, migrating the legacy
  // hit-count key (nine.bestScores.v1) into the new {score, hits} shape.
  const statsHydrated = useRef(false)
  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY)
        if (raw) {
          send({ type: 'HYDRATE_STATS', stats: JSON.parse(raw) as Partial<Stats> })
          return
        }
        const legacy = await AsyncStorage.getItem(LEGACY_BEST_SCORES_KEY)
        if (legacy) {
          const old = JSON.parse(legacy) as Record<string, number | undefined>
          const seeded: Partial<Stats> = {}
          for (const d of DIFFICULTY_ORDER) {
            const hits = old[d]
            if (typeof hits === 'number') seeded[d] = { score: 0, hits }
          }
          send({ type: 'HYDRATE_STATS', stats: seeded })
        }
      } catch {
        // ignore — start fresh
      } finally {
        statsHydrated.current = true
      }
    })()
  }, [])

  // Persist stats whenever they change (after hydration, so defaults don't clobber).
  const stats = state.context.stats
  useEffect(() => {
    if (!statsHydrated.current) return
    AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats)).catch(() => {})
  }, [stats])

  // Restore the last chosen difficulty on mount (machine starts in `menu`,
  // where SET_DIFFICULTY is handled).
  const difficultyHydrated = useRef(false)
  useEffect(() => {
    AsyncStorage.getItem(DIFFICULTY_KEY)
      .then((raw) => {
        if (raw && (DIFFICULTY_ORDER as string[]).includes(raw)) {
          send({ type: 'SET_DIFFICULTY', difficulty: raw as Difficulty })
        }
      })
      .catch(() => {})
      .finally(() => {
        difficultyHydrated.current = true
      })
  }, [])

  // Persist the difficulty when it changes (but not the default before restore).
  const difficulty = state.context.difficulty
  useEffect(() => {
    if (!difficultyHydrated.current) return
    AsyncStorage.setItem(DIFFICULTY_KEY, difficulty).catch(() => {})
  }, [difficulty])

  // Advanced display options (persisted).
  const [showSum, setShowSum] = useState(false)
  const [showFactor, setShowFactor] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const optionsHydrated = useRef(false)
  useEffect(() => {
    AsyncStorage.getItem(OPTIONS_KEY)
      .then((raw) => {
        if (!raw) return
        const o = JSON.parse(raw) as {
          showSum?: boolean
          showFactor?: boolean
        }
        if (typeof o.showSum === 'boolean') setShowSum(o.showSum)
        if (typeof o.showFactor === 'boolean') setShowFactor(o.showFactor)
      })
      .catch(() => {})
      .finally(() => {
        optionsHydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!optionsHydrated.current) return
    AsyncStorage.setItem(OPTIONS_KEY, JSON.stringify({ showSum, showFactor })).catch(
      () => {},
    )
  }, [showSum, showFactor])

  const score = computeSum(state.context.grid)
  const prevScoreRef = useRef(score)
  const direction: 1 | -1 = score >= prevScoreRef.current ? 1 : -1
  useEffect(() => {
    prevScoreRef.current = score
  }, [score])

  const isPlaying = state.matches('playing')

  // Spawn targets every 5s (first immediately) while playing; clearing the board
  // spawns the next one right away and restarts the 5s cadence.
  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnTarget = useCallback(() => {
    send({
      type: 'ADD_TARGET',
      value: Math.floor(Math.random() * (MAX_TARGET + 1)),
      at: Date.now(),
    })
  }, [send])
  const restartCadence = useCallback(() => {
    if (spawnTimer.current) clearInterval(spawnTimer.current)
    spawnTimer.current = setInterval(spawnTarget, 5000)
  }, [spawnTarget])

  useEffect(() => {
    if (!isPlaying) {
      if (spawnTimer.current) clearInterval(spawnTimer.current)
      return
    }
    spawnTarget()
    restartCadence()
    return () => {
      if (spawnTimer.current) clearInterval(spawnTimer.current)
    }
  }, [isPlaying, spawnTarget, restartCadence])

  // Immediate respawn when a hit clears the board mid-game. Reset the tracker
  // whenever we're not playing so a fresh game's targets→0 reset isn't mistaken
  // for a cleared board (which would spawn an extra target on start).
  const prevTargetCount = useRef(0)
  useEffect(() => {
    if (!isPlaying) {
      prevTargetCount.current = 0
      return
    }
    const count = state.context.targets.length
    if (prevTargetCount.current > 0 && count === 0) {
      spawnTarget()
      restartCadence()
    }
    prevTargetCount.current = count
  }, [state.context.targets.length, isPlaying, spawnTarget, restartCadence])

  // Score counts up to the machine's Score as the floating "+points" merge in.
  const composite = state.context.score
  const [displayScore, setDisplayScore] = useState(0)
  const displayScoreRef = useRef(0)
  useEffect(() => {
    const from = displayScoreRef.current
    const to = composite
    if (from === to) return
    if (to < from) {
      displayScoreRef.current = to
      setDisplayScore(to)
      return
    }
    const start = Date.now()
    const dur = 400
    let raf: number
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur)
      const v = Math.round(from + (to - from) * t)
      displayScoreRef.current = v
      setDisplayScore(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [composite])

  // Floating "+points" feedback, driven by the machine's hit batch.
  type Float = { id: number } & HitInfo
  const [floats, setFloats] = useState<Float[]>([])
  const floatId = useRef(0)
  const lastHitSeq = useRef(0)
  useEffect(() => {
    const batch = state.context.hitBatch
    if (batch.seq === lastHitSeq.current || batch.hits.length === 0) return
    lastHitSeq.current = batch.seq
    setFloats((prev) => [
      ...prev,
      ...batch.hits.map((h) => ({ id: ++floatId.current, ...h })),
    ])
    if (batch.hits.some((h) => h.bonus) && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }
  }, [state.context.hitBatch])
  const removeFloat = (id: number) => {
    setFloats((prev) => prev.filter((f) => f.id !== id))
  }

  // Sync displayed targets with machine (to allow exit animations)
  const [displayedTargets, setDisplayedTargets] = useState<DisplayTarget[]>([])
  const containerSize = useRef({ width: 0, height: 0 })

  // Dial pad is a square sized to fit its container (min of width/height),
  // so it never overflows over the score above it.
  const [dialSize, setDialSize] = useState(0)

  useEffect(() => {
    const machineIds = new Set(state.context.targets.map((t) => t.id))
    setDisplayedTargets((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        exiting: t.exiting || !machineIds.has(t.id),
      }))
      const displayedIds = new Set(prev.map((t) => t.id))
      const placed = [...updated]
      const incoming = state.context.targets
        .filter((t) => !displayedIds.has(t.id))
        .map((t) => {
          const position = findPosition(
            placed,
            containerSize.current.width,
            containerSize.current.height,
          )
          const entry = { ...t, exiting: false, position }
          placed.push(entry)
          return entry
        })
      return [...updated, ...incoming]
    })
  }, [state.context.targets])

  const removeDisplayed = (id: number) => {
    setDisplayedTargets((prev) => prev.filter((t) => t.id !== id))
  }

  // Clear displayed targets when starting a fresh game
  const prevStateRef = useRef(state.value)
  useEffect(() => {
    const prev = prevStateRef.current
    const wasMenuOrGameOver = prev === 'menu' || prev === 'gameOver'
    if (wasMenuOrGameOver && state.matches('playing')) {
      setDisplayedTargets([])
    }
    prevStateRef.current = state.value
  }, [state.value])

  const isMenu = state.matches('menu')
  const isPaused = state.matches('paused')
  const isGameOver = state.matches('gameOver')

  return (
    <>
      {/* ── Game screen (single padded wrapper) ── */}
      <Screen isDark={isDark}>
        <View className="mb-3">
          {/* Row 1 — NINE (left) + MENU label (right). The dots icon is the
              absolute overlay at top-right, so reserve room for it. */}
          <View
            className="flex-row items-center justify-between mb-1"
            style={{ paddingRight: 32 }}
          >
            <Text
              selectable={false}
              className="text-[30px] font-black tracking-[8px]"
              style={{ fontFamily: mono, color: isDark ? '#2A2B44' : '#D4D0C8' }}
            >
              NINE
            </Text>
            <Text
              selectable={false}
              className="text-[14px] font-black tracking-[3px]"
              style={{ fontFamily: mono, color: isDark ? '#2A2B44' : '#D4D0C8' }}
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
                  color={
                    i < state.context.lives ? '#E5534B' : isDark ? '#1C1D30' : '#FDFCFA'
                  }
                />
              ))}
            </View>
            <View className="realtive">
              <Text
                selectable={false}
                style={{
                  fontFamily: dsegLoaded ? 'DSEG7' : mono,
                  fontSize: 17,
                  letterSpacing: 1,
                  color: isDark ? '#2FB35A' : '#147A32',
                }}
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
        <View
          className="flex-1"
          onLayout={(e) => {
            containerSize.current = {
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            }
          }}
        >
          {displayedTargets.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              isDark={isDark}
              duration={DIFFICULTIES[state.context.difficulty].duration}
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
            {String(score)
              .split('')
              .map((digit, i, arr) => (
                <ScoreDigit
                  key={arr.length - 1 - i}
                  digit={digit}
                  direction={direction}
                  isDark={isDark}
                  progress={valueProgress(score)}
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
            {state.context.grid.flat().map((value, index) => (
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
            onToggleSum={() => {
              setShowSum((v) => !v)
            }}
            onToggleFactor={() => {
              setShowFactor((v) => !v)
            }}
            onToggleTheme={toggleTheme}
            onClose={() => {
              setAdvancedOpen(false)
            }}
          />
        ) : (
          <MenuOverlay
            isDark={isDark}
            mode={isGameOver ? 'gameOver' : isPaused ? 'paused' : 'menu'}
            stats={state.context.stats}
            difficulty={state.context.difficulty}
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
            onSetDifficulty={(difficulty) => {
              send({ type: 'SET_DIFFICULTY', difficulty })
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
