import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { Screen } from '@/components/screen'
import { cn } from '@/lib/cn'
import {
  DARK_MODE_GRADIENT,
  lerpColor,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { AnimatedLetter } from './animated-letter'
import { DifficultySelector } from './difficulty-selector'
import { GameCodeInput } from './game-code-input'
import { HighScores } from './high-scores'
import { ModeSelector } from './mode-selector'
import { PlayModeTab, type PlayMode } from './play-mode-tab'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function MenuOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  joinError,
  initialPlayMode = 'alone',
  onPlay,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
  onCreateRoom,
  onJoinRoom,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  joinError: string | null
  initialPlayMode?: PlayMode
  onPlay: () => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
}) {
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)
  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode)
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

  // Auto-join when 4 digits are entered.
  useEffect(() => {
    if (gameCode.length === 4) {
      onJoinRoom(gameCode)
      setGameCode('')
    }
  }, [gameCode, onJoinRoom])

  const handlePlayModeSelect = (pm: PlayMode) => {
    setPlayMode(pm)
    const index = pm === 'alone' ? 0 : 1
    scrollRef.current?.scrollTo({ x: index * effectivePanelWidth, animated: true })
  }

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
        {/* Top section */}
        <View className="w-full items-center">
          {/* Greeting — only shown when nickname is set */}
          {nickname !== null && nickname.length > 0 && (
            <Text
              selectable={false}
              className="mb-2 font-mono text-[11px] font-bold tracking-[0.5px] text-dim"
            >
              {`Hi ${nickname}, let's multiply`}
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
                <GameCodeInput
                  value={gameCode}
                  onChange={setGameCode}
                  accentColors={MODE_GRADIENT[focused] as [string, string]}
                  joinError={joinError}
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
              className={cn(
                'w-56 overflow-hidden rounded-2xl',
                focused === 'arcade' && 'opacity-40',
              )}
              style={shadow}
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
              onPress={onCreateRoom}
              className="w-56 overflow-hidden rounded-2xl"
              style={shadow}
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
