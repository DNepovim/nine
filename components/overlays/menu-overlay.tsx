import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { isNonEmptyString, isOneOf } from 'narrowland'
import { useEffect, useState } from 'react'
import { Platform, Pressable, Share, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { Screen } from '@/components/screen'
import { useMyMedals } from '@/hooks/use-my-medals'
import { useTheme } from '@/hooks/use-theme'
import { useViewport } from '@/hooks/use-viewport'
import { cn } from '@/lib/cn'
import { inviteMessage, SHARE_URL } from '@/lib/invite-message'
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
import { MedalLine } from './medal-line'
import { ModeSelector } from './mode-selector'
import { ModeTips } from './mode-tips'
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
  bestScore,
  joinError,
  initialPlayMode = 'alone',
  onPlay,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
  onAddNickname,
  onHowToPlay,
  onCreateRoom,
  onJoinRoom,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  // The locally stored all-time best for this board, for the challenge the invite
  // carries. The board below reads the shared store and needs nothing from here.
  bestScore: number
  joinError: string | null
  initialPlayMode?: PlayMode
  onPlay: () => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
  onAddNickname: () => void
  onHowToPlay: () => void
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'
  const medals = useMyMedals(userId)
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)
  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode)
  const [gameCode, setGameCode] = useState('')
  const [panelWidth, setPanelWidth] = useState(0)
  const panelOffset = useSharedValue(0)
  const { width: windowWidth } = useViewport()
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

  // Highlight the remembered mode: `focused` is seeded before the persisted mode
  // finishes hydrating into the machine, so re-sync when gameMode lands.
  useEffect(() => {
    setFocused(gameMode)
  }, [gameMode])

  // Auto-join when 4 digits are entered.
  useEffect(() => {
    if (gameCode.length === 4) {
      onJoinRoom(gameCode)
      setGameCode('')
    }
  }, [gameCode, onJoinRoom])

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelOffset.value }],
  }))

  const handlePlayModeSelect = (pm: PlayMode) => {
    setPlayMode(pm)
    const index = pm === 'alone' ? 0 : 1
    panelOffset.value = withTiming(-index * effectivePanelWidth, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    })
  }

  return (
    <Screen overlay>
      {/* Sized by its content. This used to stand in a 560px box with the top section
          and the CTA pushed to its ends, which held PLAY at the same height whichever
          mode was focused — but the box was a hand-tuned constant, and every trim to
          the rows above it turned more of the box into empty space between the board
          and the button. `Screen overlay` centres this block anyway, so the height was
          buying stability in one axis at the cost of a gap that grew on its own. */}
      <View className="w-full items-center">
        {/* Top section */}
        <View className="w-full items-center">
          {/* Greeting — only shown when nickname is set */}
          <Text
            selectable={false}
            className="mb-2 font-mono text-[11px] font-bold tracking-[0.5px] text-dim"
          >
            {isNonEmptyString(nickname)
              ? `Hi ${nickname}, let's multiply`
              : `Let's multiply`}
          </Text>

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

          {/* What the player holds across all six boards, all-time. Silent until they
              have a podium finish, so the title keeps its space on a fresh install. */}
          <MedalLine medals={medals} />

          {/* ALONE / WITH FRIENDS tabs */}
          <PlayModeTab
            playMode={playMode}
            gameMode={gameMode}
            gradPhase={gradPhase}
            onSelect={handlePlayModeSelect}
          />

          {/* Horizontally paging content panels — translateX avoids the Safari
              scrollTo-on-overflow:hidden bug that breaks the tab switch on web */}
          <View
            className="w-full overflow-hidden"
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width
              setPanelWidth(w)
              // Snap to current panel instantly on layout (no animation)
              const index = playMode === 'alone' ? 0 : 1
              panelOffset.value = -index * w
            }}
          >
            <Animated.View
              style={[
                { flexDirection: 'row', width: effectivePanelWidth * 2 },
                panelStyle,
              ]}
            >
              {/* Panel 0: ALONE */}
              <View style={{ width: effectivePanelWidth }}>
                <ModeSelector
                  focused={focused}
                  gradPhase={gradPhase}
                  onSelect={(m) => {
                    setFocused(m)
                    if (isOneOf(m, ['trainee', 'accuracy', 'speed'])) onSetMode(m)
                  }}
                />
                {isOneOf(focused, ['accuracy', 'speed']) && (
                  <DifficultySelector
                    gameMode={gameMode}
                    difficulty={difficulty}
                    gradPhase={gradPhase}
                    onSetDifficulty={onSetDifficulty}
                  />
                )}
                {/* Trainee's half of this slot: no board to show, so it teaches
                    instead. Arcade stays empty — it isn't playable yet. */}
                {focused === 'trainee' && <ModeTips />}
                {isOneOf(focused, ['accuracy', 'speed']) && (
                  <HighScores
                    gameMode={gameMode}
                    userId={userId}
                    nickname={nickname}
                    onAddNickname={onAddNickname}
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
            </Animated.View>
          </View>
        </View>

        {/* Bottom CTA. Its own margin now, rather than whatever a fixed-height box had
            left over: the panel above already carries a bottom margin, so this is the
            breathing room on top of it. */}
        <View className="mt-4 items-center gap-8">
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

          <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Pressable onPress={onOpenAdvanced} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="settings-outline" size={10} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  OPTIONS
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                const invite = inviteMessage(gameMode, difficulty, bestScore)
                // iOS takes the link as its own item, so the sheet can offer it to
                // AirDrop and Copy Link; Android ignores `url` and needs it inline.
                void Share.share(
                  Platform.OS === 'ios'
                    ? { message: invite, url: SHARE_URL }
                    : { message: `${invite}\n\n${SHARE_URL}` },
                )
              }}
              hitSlop={10}
            >
              <View className="flex-row items-center gap-1">
                <Ionicons name="share-outline" size={10} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  SHARE
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={onHowToPlay} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="help-circle-outline" size={11} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  HOW TO PLAY
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  )
}
