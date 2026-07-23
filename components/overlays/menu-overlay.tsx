import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { Screen } from '@/components/screen'
import { APP_RED } from '@/constants/colors'
import {
  DARK_MODE_GRADIENT,
  lerpColor,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { AnimatedLetter } from './animated-letter'
import { DifficultySelector } from './difficulty-selector'
import { HighScores } from './high-scores'
import { ModeSelector } from './mode-selector'

// ─── worklet helpers ─────────────────────────────────────────────────────────

function lerpHex(a: string, b: string, t: number): string {
  'worklet'
  const r1 = parseInt(a.slice(1, 3), 16)
  const g1 = parseInt(a.slice(3, 5), 16)
  const b1 = parseInt(a.slice(5, 7), 16)
  const r2 = parseInt(b.slice(1, 3), 16)
  const g2 = parseInt(b.slice(3, 5), 16)
  const b2 = parseInt(b.slice(5, 7), 16)
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return '#' + h(r1 + (r2 - r1) * t) + h(g1 + (g2 - g1) * t) + h(b1 + (b2 - b1) * t)
}

// ─── constants ───────────────────────────────────────────────────────────────

type PlayMode = 'alone' | 'friends'

const PLAY_MODES: { key: PlayMode; label: string; soon?: true }[] = [
  { key: 'alone', label: 'ALONE' },
  { key: 'friends', label: 'WITH FRIENDS', soon: true },
]

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SoonBadge() {
  return (
    <View
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: APP_RED,
        borderRadius: 5,
        paddingHorizontal: 4,
        paddingVertical: 1,
      }}
    >
      <Text
        style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '800', letterSpacing: 0.5 }}
      >
        SOON
      </Text>
    </View>
  )
}

// Pill tab: ALONE / WITH FRIENDS
function PlayModeTab({
  playMode,
  gameMode,
  gradPhase,
  onSelect,
}: {
  playMode: PlayMode
  gameMode: Mode
  gradPhase: SharedValue<number>
  onSelect: (pm: PlayMode) => void
}) {
  const [layouts, setLayouts] = useState<({ x: number; width: number } | null)[]>(() =>
    PLAY_MODES.map(() => null),
  )
  const bgLeft = useSharedValue(-999)
  const bgRight = useSharedValue(-999)
  const sel0 = useSharedValue(playMode === 'alone' ? 1 : 0)
  const sel1 = useSharedValue(playMode === 'friends' ? 1 : 0)

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bgLeft.value }],
    width: Math.max(0, bgRight.value - bgLeft.value),
  }))
  const innerGradStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(gradPhase.value * Math.PI * 2) * 12 }],
  }))
  const textStyle0 = useAnimatedStyle(() => ({
    color: lerpHex('#aaa69e', '#FFFFFF', sel0.value),
  }))
  const textStyle1 = useAnimatedStyle(() => ({
    color: lerpHex('#aaa69e', '#FFFFFF', sel1.value),
  }))

  useEffect(() => {
    const index = PLAY_MODES.findIndex((p) => p.key === playMode)
    const layout = layouts[index]
    if (!layout) return
    const newLeft = layout.x
    const newRight = layout.x + layout.width
    const spring = { damping: 40, stiffness: 300 }
    if (bgLeft.value < -900) {
      bgLeft.value = newLeft
      bgRight.value = newRight
      return
    }
    if (newLeft >= bgLeft.value) {
      bgRight.value = withSpring(newRight, spring)
      bgLeft.value = withDelay(60, withSpring(newLeft, spring))
    } else {
      bgLeft.value = withSpring(newLeft, spring)
      bgRight.value = withDelay(60, withSpring(newRight, spring))
    }
  }, [playMode, layouts, bgLeft, bgRight])

  useEffect(() => {
    const t = { duration: 200 }
    sel0.value = withTiming(playMode === 'alone' ? 1 : 0, t)
    sel1.value = withTiming(playMode === 'friends' ? 1 : 0, t)
  }, [playMode, sel0, sel1])

  return (
    <View className="mb-3 items-center">
      <View className="flex-row rounded-md bg-card">
        <Animated.View
          pointerEvents="none"
          style={[
            bgStyle,
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: 6,
              overflow: 'hidden',
            },
          ]}
        >
          <Animated.View
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: -16, right: -16 },
              innerGradStyle,
            ]}
          >
            <LinearGradient
              colors={[...MODE_GRADIENT[gameMode]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </Animated.View>

        {PLAY_MODES.map(({ key, label, soon }, i) => (
          <Pressable
            key={key}
            onPress={() => {
              onSelect(key)
            }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout
              setLayouts((prev) => {
                const next = [...prev]
                next[i] = { x, width }
                return next
              })
            }}
            className="px-2 py-1"
          >
            <Animated.Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px]"
              style={i === 0 ? textStyle0 : textStyle1}
            >
              {label}
            </Animated.Text>
            {soon === true && <SoonBadge />}
          </Pressable>
        ))}
      </View>
    </View>
  )
}

// 4-digit game code input
function GameCodeInput({
  value,
  onChange,
  accentColor,
}: {
  value: string
  onChange: (v: string) => void
  accentColor: string
}) {
  return (
    <View className="my-6 items-center">
      <Text
        selectable={false}
        className="mb-4 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        GAME CODE
      </Text>
      <View>
        <View className="flex-row gap-3">
          {[0, 1, 2, 3].map((i) => {
            const digit = value[i] ?? ''
            return (
              <View
                key={i}
                style={{
                  width: 52,
                  height: 68,
                  borderWidth: 2,
                  borderRadius: 10,
                  borderColor: digit ? accentColor + '80' : '#aaa69e40',
                  backgroundColor: digit ? accentColor + '12' : undefined,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  selectable={false}
                  className="font-mono text-[28px] font-black"
                  style={{ color: digit ? accentColor : '#aaa69e40' }}
                >
                  {digit}
                </Text>
              </View>
            )
          })}
        </View>
        {/* Hidden TextInput captures keyboard input; the boxes above display it */}
        <TextInput
          value={value}
          onChangeText={(t) => {
            onChange(t.replace(/\D/g, '').slice(0, 4))
          }}
          keyboardType="number-pad"
          maxLength={4}
          caretHidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0,
          }}
        />
      </View>
    </View>
  )
}

// ─── main export ─────────────────────────────────────────────────────────────

export function MenuOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  onPlay,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  onPlay: () => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
}) {
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)
  const [playMode, setPlayMode] = useState<PlayMode>('alone')
  // Multiplayer only has accuracy/speed; snap to accuracy when focused is trainee/arcade
  const mpFocused: 'accuracy' | 'speed' = focused === 'speed' ? 'speed' : 'accuracy'
  const [gameCode, setGameCode] = useState('')
  const [panelWidth, setPanelWidth] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const { width: windowWidth } = useWindowDimensions()
  // Screen has px-4 on each side (32px total); use as fallback before onLayout fires.
  const effectivePanelWidth = panelWidth > 0 ? panelWidth : windowWidth - 32

  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(MODE_GRADIENT[gameMode][0])
  const gradEndSv = useSharedValue<string>(MODE_GRADIENT[gameMode][1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  useEffect(() => {
    gradStartSv.value = MODE_GRADIENT[focused][0]
    gradEndSv.value = MODE_GRADIENT[focused][1]
  }, [focused, gradStartSv, gradEndSv])

  const handlePlayModeSelect = (pm: PlayMode) => {
    setPlayMode(pm)
    const index = pm === 'alone' ? 0 : 1
    scrollRef.current?.scrollTo({ x: index * effectivePanelWidth, animated: true })
  }

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 640 }}>
        {/* Top section */}
        <View className="w-full items-center">
          {/* Greeting — only shown when nickname is set */}
          {nickname !== null && nickname.length > 0 && (
            <Text
              selectable={false}
              className="mb-2 font-mono text-[11px] font-bold tracking-[0.5px] text-dim"
            >
              {`Hi ${nickname}, let's count`}
            </Text>
          )}

          {/* NINE title */}
          <View className="mb-4 flex-row gap-3">
            {(['N', 'I', 'N', 'E'] as const).map((char, i) => (
              <AnimatedLetter
                key={i}
                char={char}
                color={lerpColor(
                  MODE_GRADIENT[focused][0],
                  MODE_GRADIENT[focused][1],
                  i / 3,
                )}
                tBase={i / 3}
                gradStart={gradStartSv}
                gradEnd={gradEndSv}
                gradPhase={gradPhase}
                mode={focused}
                delay={i * 80}
                letterIndex={i}
              />
            ))}
          </View>

          {/* ALONE / WITH FRIENDS tabs */}
          <PlayModeTab
            playMode={playMode}
            gameMode={gameMode}
            gradPhase={gradPhase}
            onSelect={handlePlayModeSelect}
          />

          {/* Horizontally paging content panels */}
          <View
            className="w-full"
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width
              setPanelWidth(w)
              // Re-snap to current panel after layout resolution (no animation)
              const index = playMode === 'alone' ? 0 : 1
              scrollRef.current?.scrollTo({ x: index * w, animated: false })
            }}
          >
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
            >
              {/* Panel 0: ALONE */}
              <View style={{ width: effectivePanelWidth }}>
                <ModeSelector
                  focused={focused}
                  gradPhase={gradPhase}
                  onSelect={(m) => {
                    setFocused(m)
                    if (m !== 'arcade') onSetMode(m)
                  }}
                />
                {focused !== 'arcade' && focused !== 'trainee' && (
                  <DifficultySelector
                    gameMode={gameMode}
                    difficulty={difficulty}
                    gradPhase={gradPhase}
                    onSetDifficulty={onSetDifficulty}
                  />
                )}
                {focused !== 'trainee' && focused !== 'arcade' && (
                  <HighScores
                    gameMode={gameMode}
                    difficulty={difficulty}
                    userId={userId}
                    nickname={nickname}
                  />
                )}
              </View>

              {/* Panel 1: WITH FRIENDS */}
              <View style={{ width: effectivePanelWidth }} className="items-center">
                <ModeSelector
                  focused={mpFocused}
                  gradPhase={gradPhase}
                  items={['accuracy', 'speed']}
                  onSelect={(m) => {
                    setFocused(m)
                    if (m !== 'arcade') onSetMode(m)
                  }}
                />
                <GameCodeInput
                  value={gameCode}
                  onChange={setGameCode}
                  accentColor={MODE_GRADIENT[mpFocused][0]}
                />
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Bottom CTA */}
        <View className="items-center gap-8">
          {playMode === 'alone' ? (
            <Pressable
              onPress={onPlay}
              disabled={focused === 'arcade'}
              className="w-56 overflow-hidden rounded-2xl"
              style={{ ...shadow, opacity: focused === 'arcade' ? 0.4 : 1 }}
            >
              <LinearGradient
                colors={[...DARK_MODE_GRADIENT[gameMode]]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="items-center py-4"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
                >
                  PLAY GAME
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              disabled
              className="w-56 overflow-hidden rounded-2xl"
              style={{ ...shadow, opacity: 0.4 }}
            >
              <LinearGradient
                colors={[...DARK_MODE_GRADIENT[mpFocused]]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="items-center py-4"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
                >
                  CREATE GAME
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          <Pressable onPress={onOpenAdvanced} hitSlop={10}>
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
            >
              ADVANCED OPTIONS
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
