import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
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
import { useChampionsContext } from '@/hooks/use-champions'
import { useMyMedals } from '@/hooks/use-my-medals'
import { useOnline } from '@/hooks/use-online'
import { useTheme } from '@/hooks/use-theme'
import { useViewport } from '@/hooks/use-viewport'
import { championMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { inviteMessage, SHARE_URL } from '@/lib/invite-message'
import {
  DARK_MODE_GRADIENT,
  DARK_MULTIPLAYER_GRADIENT,
  lerpColor,
  MODE_GRADIENT,
  MULTIPLAYER_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { AnimatedLetter } from './animated-letter'
import { DifficultySelector } from './difficulty-selector'
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
  initialPlayMode = 'alone',
  onPlay,
  onPlayModeChange,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
  onAddNickname,
  onHowToPlay,
  onCreateRoom,
  onOpenJoinRoom,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  // The locally stored all-time best for this board, for the challenge the invite
  // carries. The board below reads the shared store and needs nothing from here.
  bestScore: number
  initialPlayMode?: PlayMode
  onPlay: () => void
  // Fired on every ALONE / WITH FRIENDS toggle, not just at mount — this screen
  // unmounts under Options and How to Play (they render above it), which drops its
  // local `playMode` state. The caller mirrors this into whatever it feeds back as
  // `initialPlayMode`, so remounting after either lands back on the tab the player
  // left, rather than always defaulting to ALONE.
  onPlayModeChange?: (playMode: PlayMode) => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
  onAddNickname: () => void
  onHowToPlay: () => void
  onCreateRoom: () => void
  // The code entry itself lives on its own screen now — this just opens it.
  onOpenJoinRoom: () => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'
  const { medals } = useMyMedals(userId)
  // Same mark the leaderboard, the pause screen and a room wear beside this
  // player's name — worn here over the title itself, since the title is this
  // player's too.
  const champions = useChampionsContext()
  const mark = championMark(userId, champions)
  // Creating or joining a room is a Supabase round trip either way, so both are
  // dead ends with no connection — disabled rather than left to fail after a tap.
  const online = useOnline()
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)
  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode)
  const [panelWidth, setPanelWidth] = useState(0)
  const panelOffset = useSharedValue(0)
  const { width: windowWidth } = useViewport()
  // Screen has px-4 on each side (32px total); use as fallback before onLayout fires.
  const effectivePanelWidth = panelWidth > 0 ? panelWidth : windowWidth - 32

  // The title and the WITH FRIENDS pill read multiplayer's own pair while that tab is
  // open, rather than whichever singleplayer mode `focused` last was — pinned to
  // accuracy since a room is always created as accuracy.
  const activeMode: Mode | 'arcade' | 'multiplayer' =
    playMode === 'friends' ? 'multiplayer' : focused
  const activeGradient =
    playMode === 'friends' ? MULTIPLAYER_GRADIENT.accuracy : MODE_GRADIENT[focused]

  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(activeGradient[0])
  const gradEndSv = useSharedValue<string>(activeGradient[1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  useEffect(() => {
    gradStartSv.value = activeGradient[0]
    gradEndSv.value = activeGradient[1]
  }, [activeGradient, gradStartSv, gradEndSv])

  // Highlight the remembered mode: `focused` is seeded before the persisted mode
  // finishes hydrating into the machine, so re-sync when gameMode lands.
  useEffect(() => {
    setFocused(gameMode)
  }, [gameMode])

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelOffset.value }],
  }))

  const handlePlayModeSelect = (pm: PlayMode) => {
    setPlayMode(pm)
    onPlayModeChange?.(pm)
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

          {/* The mark this player wears everywhere their name does, over the one
              title that's always theirs — silent for everyone who hasn't taken an
              Extreme all-time board. */}
          {mark !== null && (
            <Text
              selectable={false}
              className="letter-float-1 mb-1 text-[26px] leading-[30px]"
            >
              {mark}
            </Text>
          )}

          {/* NINE title */}
          <View className="mb-4 flex-row gap-3">
            {(['N', 'I', 'N', 'E'] as const).map((char, i) => (
              <AnimatedLetter
                key={i}
                char={char}
                color={lerpColor(activeGradient[0], activeGradient[1], i / 3)}
                tBase={i / 3}
                gradStart={gradStartSv}
                gradEnd={gradEndSv}
                gradPhase={gradPhase}
                mode={activeMode}
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
              {/* overflow: 'hidden' of its own — the shared row's clip only bounds the
                  two panels together, so ARCADE's SOON badge, which deliberately hangs
                  past its own tab (see CornerBadge), was free to cross from this panel's
                  space into WITH FRIENDS' once this one slid off to make room for it. */}
              <View style={{ width: effectivePanelWidth, overflow: 'hidden' }}>
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
              <View
                style={{ width: effectivePanelWidth, overflow: 'hidden' }}
                className="relative items-center"
              >
                {/* Just the two doors in: start a room, or walk into one that
                    already exists. The code and its keyboard used to live right
                    here — they get their own screen now, past JOIN ROOM, so this
                    tab is a choice rather than a form. */}
                <View className="items-center gap-4 py-10">
                  {/* Fixed to accuracy's pair rather than `focused`: onCreateRoom
                      always creates an accuracy room (`app/(tabs)/index.tsx`),
                      regardless of which singleplayer mode this tab inherited. */}
                  <Pressable
                    onPress={onCreateRoom}
                    disabled={!online}
                    className={cn(
                      'w-56 overflow-hidden rounded-2xl',
                      !online && 'opacity-40',
                    )}
                    style={shadow}
                  >
                    <LinearGradient
                      colors={[...DARK_MULTIPLAYER_GRADIENT.accuracy]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      className="items-center py-4"
                    >
                      <Text
                        selectable={false}
                        className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
                      >
                        <Trans>CREATE ROOM</Trans>
                      </Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={onOpenJoinRoom}
                    disabled={!online}
                    className={cn(
                      'w-56 items-center rounded-2xl border-2 py-[14px]',
                      !online && 'opacity-40',
                    )}
                    style={{ borderColor: MULTIPLAYER_GRADIENT.accuracy[0] }}
                  >
                    <Text
                      selectable={false}
                      className="font-mono text-[13px] font-black tracking-[2px]"
                      style={{ color: MULTIPLAYER_GRADIENT.accuracy[0] }}
                    >
                      <Trans>JOIN ROOM</Trans>
                    </Text>
                  </Pressable>
                </View>
                {/* Covers both buttons rather than disabling them piece by piece —
                    creating or joining a room is a Supabase round trip either way, so
                    nothing under here can do anything useful without a connection. */}
                {!online && (
                  <View className="absolute inset-0 items-center justify-center gap-3 bg-surface px-6">
                    <Ionicons name="cloud-offline-outline" size={32} color={dimColor} />
                    <Text
                      selectable={false}
                      className="font-mono text-[11px] font-black tracking-[2px] text-dim"
                    >
                      <Trans>YOU'RE OFFLINE</Trans>
                    </Text>
                    <Text
                      selectable={false}
                      className="text-center font-mono text-[10px] font-bold leading-[16px] tracking-[0.5px] text-dim"
                    >
                      <Trans>CONNECT TO THE INTERNET TO PLAY WITH FRIENDS</Trans>
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Bottom CTA. Its own margin now, rather than whatever a fixed-height box had
            left over: the panel above already carries a bottom margin, so this is the
            breathing room on top of it.

            ALONE only — WITH FRIENDS carries its own two buttons in the panel above,
            since there are two doors in rather than one PLAY. */}
        <View className="mt-4 items-center gap-8">
          {playMode === 'alone' && (
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
                  <Trans>PLAY GAME</Trans>
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
                  <Trans>OPTIONS</Trans>
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
                  <Trans>SHARE</Trans>
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
                  <Trans>HOW TO PLAY</Trans>
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  )
}
