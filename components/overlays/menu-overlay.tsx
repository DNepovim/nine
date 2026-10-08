import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { isNonEmptyString, isOneOf } from 'narrowland'
import { useEffect, useMemo, useState } from 'react'
import { Platform, Share, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { GradientName } from '@/components/gradient-name'
import { Screen } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import type { AchievementId } from '@/constants/achievements'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useChampionsContext } from '@/hooks/use-champions'
import { useFlag } from '@/hooks/use-flags'
import type { LostMedalNews } from '@/hooks/use-lost-medals'
import { useOnline } from '@/hooks/use-online'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import { useViewport } from '@/hooks/use-viewport'
import { championMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { boardName, SHARE_URL, shouldBoast } from '@/lib/invite-message'
import type { Medal } from '@/lib/medals'
import {
  ARCADE_TEASER,
  DARK_MULTIPLAYER_GRADIENT,
  darkGradientOf,
  DIFFICULTIES,
  gradientOf,
  labelOf,
  lerpColor,
  MODE_ORDER,
  MULTIPLAYER_GRADIENT,
  openModes,
  SCORED_MODES,
  traitsOf,
  type Difficulty,
  type ModeId,
} from '@/modes'

import { AccountNotice, type AccountNoticeKind } from './account-notice'
import { AchievementProgress } from './achievement-progress'
import { AnimatedLetter } from './animated-letter'
import { ArcadeTeaser } from './arcade-teaser'
import { DifficultySelector } from './difficulty-selector'
import { HighScores } from './high-scores'
import { ModeSelector } from './mode-selector'
import { ModeTips } from './mode-tips'
import { PlayModeTab, type PlayMode } from './play-mode-tab'
import { RecentWinners } from './recent-winners'
import { TitleMark } from './title-mark'
import { TitleSlot } from './title-slot'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// What a challenge's pill wears in its corner. A mode that is only here today has to say
// so on the pill, or it reads as one of the permanent three.
const CHALLENGE_TAG = '24H'

// The mode pills this screen shows, in order: the player's three, then whichever
// challenges are open right now, then ARCADE.
//
// ARCADE is last and is everyone's. For whoever holds the `arcade` flag it is a door; for
// everyone else it is a teaser wearing SOON, with PLAY GAME dead under it and a card in
// the slot below saying what is coming — see ArcadeTeaser. It was hidden from everyone
// else for a while, on the grounds that a tab which does nothing is the first row to cut.
// A tab that *says* something is not that tab: the promise was already made the first time
// a player saw the badge, and answering it is cheaper than withdrawing it.
//
// The challenges are read off the registry rather than listed here, which is the whole
// point of their having a window: one opens and closes without this screen being touched.
// There are none open today, so this adds nothing to the row — see modes/challenges.
const introModes = (now: number): ModeId[] => [
  ...MODE_ORDER,
  ...openModes(now)
    .filter((mode) => mode.window !== null && mode.engine === 'targets')
    .map((mode) => mode.id),
  'arcade',
]

export function MenuOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  bestScore,
  medals,
  lostMedals,
  onLostMedalsSeen,
  accountNotice,
  onAccountNotice,
  achievementsEarned,
  achievementsLatest,
  achievementsLoaded,
  onOpenAchievements,
  onOpenMedals,
  initialPlayMode = 'alone',
  initialFocus = gameMode,
  onFocusChange,
  onPlay,
  onPlayArcade,
  onPlayModeChange,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
  onAddNickname,
  onHowToPlay,
  onCreateRoom,
  onOpenJoinRoom,
  onOpenDev,
  onOpenAdmin,
}: {
  gameMode: ModeId
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  // The locally stored all-time best for this board, for the challenge the invite
  // carries. The board below reads the shared store and needs nothing from here.
  bestScore: number
  // What the player holds across all six boards. Read by the game screen rather than
  // here: this screen unmounts for the whole run, and the achievements need the same one
  // request while a run is going.
  medals: readonly Medal[]
  // The medals a rival took while the app was closed, with the names they went to,
  // announced one after another in the medal line's own slot before the medals themselves
  // appear there. Read by the game screen for the same reason the medals are: this screen
  // unmounts for the whole run, and the answer they are diffed against arrives with the
  // one request that is already going.
  lostMedals: readonly LostMedalNews[]
  onLostMedalsSeen: () => void
  // The one thing the intro says about this player's address, or null for the ordinary
  // case where there is nothing to say. Decided by the caller, which is the only place
  // that knows both halves — see app/(tabs)/index.tsx.
  accountNotice: AccountNoticeKind | null
  onAccountNotice: () => void
  // How many of the catalogue the player holds.
  achievementsEarned: number
  // The most recently achieved one, or null before there is one.
  achievementsLatest: AchievementId | null
  // Whether the device's copy has been read. The strip waits rather than flashing 0 of 48
  // at a player who holds thirty.
  achievementsLoaded: boolean
  onOpenAchievements: () => void
  // The list behind the medal line: everything the player holds, and what the week took
  // off them. Owned by the caller like the achievements list is — both are screens over
  // this one, not pieces of it.
  onOpenMedals: () => void
  initialPlayMode?: PlayMode
  // Which pill is focused when this screen arrives, and every change to it. The same shape
  // and the same reason as `initialPlayMode` above: this screen unmounts for an arcade run,
  // and ARCADE is the one pill whose choice is committed nowhere — the three modes come
  // back off `gameMode`, so without this a player leaving an arcade run would find the
  // screen focused on whichever mode they played before it.
  initialFocus?: ModeId
  onFocusChange?: (focus: ModeId) => void
  onPlay: () => void
  // PLAY GAME with ARCADE focused. Its own door rather than a mode passed through
  // `onPlay`, because arcade is not a `Mode`: it has no board, no lives and no place in
  // `MODES`, and the run it starts is not the game machine's.
  onPlayArcade: () => void
  // Fired on every ALONE / WITH FRIENDS toggle, not just at mount — this screen
  // unmounts under Options and How to Play (they render above it), which drops its
  // local `playMode` state. The caller mirrors this into whatever it feeds back as
  // `initialPlayMode`, so remounting after either lands back on the tab the player
  // left, rather than always defaulting to ALONE.
  onPlayModeChange?: (playMode: PlayMode) => void
  onSetMode: (mode: ModeId) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
  onAddNickname: () => void
  onHowToPlay: () => void
  onCreateRoom: () => void
  // The code entry itself lives on its own screen now — this just opens it.
  onOpenJoinRoom: () => void
  // The dev and admin screens, each its own door behind its own flag — see
  // constants/features.ts. Always passed, since whether either is shown at all is decided
  // below rather than by the caller.
  onOpenDev: () => void
  onOpenAdmin: () => void
}) {
  const { t } = useLingui()
  // Same mark the leaderboard, the pause screen and a room wear beside this
  // player's name — worn here over the title itself, since the title is this
  // player's too.
  const champions = useChampionsContext()
  const mark = championMark(userId, champions)
  // Just the player's own, for the greeting above the title — the one name on this
  // screen with no board row behind it to carry its averages.
  const myFactors = usePlayerFactors(userId === null ? EMPTY_IDS : [userId])
  // Creating or joining a room is a Supabase round trip either way, so both are
  // dead ends with no connection — disabled rather than left to fail after a tap.
  const online = useOnline()
  const showMultiplayer = useFlag('multiplayer')
  const showArcade = useFlag('arcade')
  const showDev = useFlag('dev')
  const showAdmin = useFlag('admin')
  // A stored ARCADE focus is only honoured by a reader who can actually *open* it. The
  // pill is everyone's now, so this is no longer about a tab that is not there — it is
  // about where a launch lands: opening every time on a pill whose PLAY GAME is dead
  // would make the teaser the screen rather than a thing on it. A player without the flag
  // can still press ARCADE and read it; they just do not start there.
  const [focused, setFocused] = useState<ModeId>(
    initialFocus === 'arcade' && !showArcade ? gameMode : initialFocus,
  )
  // Read once per open rather than per render: a window closing while the player is
  // looking at the intro would otherwise take the pill out from under their thumb.
  const [openedAt] = useState(() => Date.now())
  const modeItems = useMemo(() => introModes(openedAt), [openedAt])
  const badges: Partial<Record<string, string>> = useMemo(() => {
    const marks: Record<string, string> = {
      arcade: showArcade ? ARCADE_TEASER.devTag : ARCADE_TEASER.tag,
    }
    for (const id of modeItems) {
      if (id.startsWith('challenge/')) marks[id] = CHALLENGE_TAG
    }
    return marks
  }, [modeItems, showArcade])

  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode)
  const [panelWidth, setPanelWidth] = useState(0)
  const panelOffset = useSharedValue(0)
  const { width: windowWidth } = useViewport()
  // Screen has px-4 on each side (32px total); use as fallback before onLayout fires.
  const effectivePanelWidth = panelWidth > 0 ? panelWidth : windowWidth - 32

  // The title and the WITH FRIENDS pill read multiplayer's own pair while that tab is
  // open, rather than whichever singleplayer mode `focused` last was — pinned to
  // accuracy since a room is always created as accuracy.
  const activeMode: ModeId | 'multiplayer' =
    playMode === 'friends' ? 'multiplayer' : focused
  const activeGradient =
    playMode === 'friends' ? MULTIPLAYER_GRADIENT.accuracy : gradientOf(focused)

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

  // Highlight the remembered pill. `focused` is seeded at mount, before either half of
  // what the player was last on has landed — the machine's `mode` hydrates out of storage,
  // and so does the bit that says they were on ARCADE — so re-sync whenever one of them
  // arrives. ARCADE wins while it is the stored answer: the mode underneath it is the pill
  // the player drops back onto when they leave arcade, not a change of focus, and reading
  // it as one is what used to take them off ARCADE on every launch and on every END.
  //
  // The first line of it is what stops this fighting the player's own thumb. A press is
  // reported up (`onFocusChange`) and comes straight back down as `initialFocus`, so every
  // tap on a pill arrives here a second time looking exactly like a stored answer — and a
  // player without the arcade flag who pressed ARCADE was put back on their last mode by
  // the branch below before they saw the teaser. One tap did nothing and the second one
  // worked, because by then there was no change left for this to react to.
  //
  // What tells the two apart is that the echo already agrees with what is focused, and a
  // stored answer arriving does not. Read through the updater rather than off `focused`,
  // which would have to be a dependency and would run this on the very press it exists to
  // leave alone.
  useEffect(() => {
    setFocused((current) => {
      if (initialFocus === current) return current
      return initialFocus === 'arcade' && showArcade ? 'arcade' : gameMode
    })
  }, [gameMode, initialFocus, showArcade])

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
          {/* The mark this player wears everywhere their name does, crowning the whole
              block rather than sitting between the greeting and the title — it is the
              rarest thing on the screen, and the top is where the eye starts. Silent for
              everyone who hasn't taken an Extreme all-time board, and tappable for
              anyone who has yet to find out what the thing over their name is. */}
          {mark !== null && <TitleMark mark={mark} mine float className="mb-1" />}

          {/* Greeting — only shown when nickname is set. The player's own name is
              drawn the way their name is drawn everywhere else, in the gradient their
              averages earn; the words around it stay dim, so the one coloured thing on
              the line is the one word that is theirs. */}
          <Text selectable={false} className={cn(TYPE.figure, 'mb-2 text-dim')}>
            {isNonEmptyString(nickname) ? (
              <>
                {`Hi `}
                <GradientName nickname={nickname} {...myFactors(userId)} />
                {`, let's multiply`}
              </>
            ) : (
              `Let's multiply`
            )}
          </Text>

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

          {/* The one line under the title. What the player holds across all six boards
              and the last thing they achieved take turns in it, and for a few seconds on
              open, one by one, whatever a rival took off them while the app was closed
              covers both. The slot owns its own emptiness, its height and its margin;
              see TitleSlot. */}
          <TitleSlot
            medals={medals}
            news={lostMedals}
            onNewsSeen={onLostMedalsSeen}
            onPressMedals={onOpenMedals}
            achievements={
              achievementsLoaded ? (
                <AchievementProgress
                  earned={achievementsEarned}
                  latest={achievementsLatest}
                  onPress={onOpenAchievements}
                />
              ) : null
            }
          />

          {/* Under the medals rather than over them. What the title slot says is about
              what this player has won, which is why they are here; this is a chore or a
              piece of bad news, and either way it is not the first thing the start screen
              should put in front of them. */}
          {accountNotice !== null && (
            <AccountNotice kind={accountNotice} onPress={onAccountNotice} />
          )}

          {/* ALONE / WITH FRIENDS tabs. Hidden from everyone while the intro screen is
              being fitted into a short phone: the tab is what is gone, not the feature —
              the panel below still carries both doors in, and every multiplayer screen
              past them is untouched. With no tab there is no way onto that panel, since
              the one thing that slides it into view is a tap on WITH FRIENDS. See the
              multiplayer flag in constants/features.ts. */}
          {showMultiplayer && (
            <PlayModeTab
              playMode={playMode}
              gameMode={gameMode}
              gradPhase={gradPhase}
              onSelect={handlePlayModeSelect}
            />
          )}

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
              {/* One gap between every row of this panel, rather than each row
                  carrying a bottom margin of its own — the rows come and go with the
                  focused mode, and spacing that lives on the parent cannot leave a
                  margin behind under whichever row happens to be last. */}
              <View
                className="gap-2"
                style={{ width: effectivePanelWidth, overflow: 'hidden' }}
              >
                <ModeSelector
                  focused={focused}
                  items={modeItems}
                  gradPhase={gradPhase}
                  badges={badges}
                  onSelect={(m) => {
                    setFocused(m)
                    onFocusChange?.(m)
                    // ARCADE is the one pill whose choice is committed nowhere: it is a
                    // door rather than a mode of this machine's. Everything else — the
                    // three, and whichever challenges are open — is a run this machine
                    // deals, so it is the mode from here on.
                    if (m !== 'arcade') onSetMode(m)
                  }}
                />
                {/* Arcade shows no difficulty. It tightens as a run climbs, which is a
                    difficulty that moves rather than one picked up front — and asking for
                    a three-way choice before the player has any idea what the mode is was
                    a dial set in the dark. */}
                {traitsOf(focused).usesDifficulty && (
                  <DifficultySelector
                    gameMode={focused}
                    difficulty={difficulty}
                    gradPhase={gradPhase}
                    onSetDifficulty={onSetDifficulty}
                  />
                )}
                {/* Trainee's half of this slot: no board to show, so it teaches
                    instead. Arcade fills the same slot, but only for a player who cannot
                    open it yet — for whoever holds the flag it stays empty, because a
                    crossroad explains itself and they are two taps from one. */}
                {traitsOf(focused).coached && <ModeTips />}
                {focused === 'arcade' && !showArcade && <ArcadeTeaser />}
                {/* Who has been taking this board lately, then where it stands now —
                    both about the board the pills above just picked. */}
                {isOneOf(focused, SCORED_MODES) && (
                  <>
                    <RecentWinners gameMode={gameMode} difficulty={difficulty} />
                    <HighScores
                      gameMode={gameMode}
                      difficulty={difficulty}
                      userId={userId}
                      nickname={nickname}
                      onAddNickname={onAddNickname}
                    />
                  </>
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
                  <TrackedPressable
                    id="menu.create_room"
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
                        className={cn(TYPE.button, 'text-on-strong')}
                      >
                        <Trans>CREATE ROOM</Trans>
                      </Text>
                    </LinearGradient>
                  </TrackedPressable>
                  <TrackedPressable
                    id="menu.join_room"
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
                      className={TYPE.button}
                      style={{ color: MULTIPLAYER_GRADIENT.accuracy[0] }}
                    >
                      <Trans>JOIN ROOM</Trans>
                    </Text>
                  </TrackedPressable>
                </View>
                {/* Covers both buttons rather than disabling them piece by piece —
                    creating or joining a room is a Supabase round trip either way, so
                    nothing under here can do anything useful without a connection. */}
                {!online && (
                  <View className="absolute inset-0 items-center justify-center gap-3 bg-surface px-6">
                    <Ionicons name="cloud-offline-outline" size={32} color={DIM_INK} />
                    <Text selectable={false} className={cn(TYPE.heading, 'text-dim')}>
                      <Trans>YOU'RE OFFLINE</Trans>
                    </Text>
                    <Text
                      selectable={false}
                      className={cn(TYPE.value, 'text-center leading-[16px] text-dim')}
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
            <TrackedPressable
              id="menu.play"
              onPress={focused === 'arcade' ? onPlayArcade : onPlay}
              // Arcade is pressable now for whoever can see it, and still dead for
              // everyone else — the badge on the pill above says SOON, and the button
              // under it has to agree.
              disabled={focused === 'arcade' && !showArcade}
              className={cn(
                'w-56 overflow-hidden rounded-2xl',
                focused === 'arcade' && !showArcade && 'opacity-40',
              )}
              style={shadow}
            >
              <LinearGradient
                colors={[...darkGradientOf(focused)]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="items-center py-4"
              >
                <Text selectable={false} className={cn(TYPE.button, 'text-on-strong')}>
                  <Trans>PLAY GAME</Trans>
                </Text>
              </LinearGradient>
            </TrackedPressable>
          )}

          <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <TrackedPressable id="menu.options" onPress={onOpenAdvanced} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="settings-outline" size={10} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>OPTIONS</Trans>
                </Text>
              </View>
            </TrackedPressable>
            <TrackedPressable
              id="menu.board"
              onPress={() => {
                // The sentence lives here rather than in lib/ because it is the
                // one place that knows the active language; lib/ keeps the
                // decision and the board name, which are what a test can pin.
                const board = boardName(
                  t(labelOf(gameMode)),
                  t(DIFFICULTIES[difficulty].label),
                )
                const invite = shouldBoast(gameMode, bestScore)
                  ? t`My best at Nine is ${bestScore} — ${board}. Think you can beat it?`
                  : t`Nine buttons, one number to hit. Come take a run at it.`
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
                <Ionicons name="share-outline" size={10} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>SHARE</Trans>
                </Text>
              </View>
            </TrackedPressable>
            <TrackedPressable id="menu.how_to_play" onPress={onHowToPlay} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="help-circle-outline" size={11} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>HOW TO PLAY</Trans>
                </Text>
              </View>
            </TrackedPressable>
          </View>

          {/* Its own row rather than folded into the one above: these two are not for the
              player this screen otherwise addresses, and a row that only a role ever sees
              stays out of the way of the one everybody does. Each link asks for its own
              feature — see constants/features.ts.

              ADMIN used to be drawn inside DEV, which quietly undid the protection the
              database puts on the `admin` key: `dev` revoked for one person took the
              admin screen away with it, and the way back in was the screen that had just
              gone. A door that cannot be switched off cannot be nested inside one that
              can. */}
          {(showDev || showAdmin) && (
            <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {showDev && (
                <TrackedPressable id="menu.dev" onPress={onOpenDev} hitSlop={10}>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="code-slash-outline" size={10} color={DIM_INK} />
                    <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                      <Trans>DEV</Trans>
                    </Text>
                  </View>
                </TrackedPressable>
              )}
              {showAdmin && (
                <TrackedPressable id="menu.admin" onPress={onOpenAdmin} hitSlop={10}>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="shield-outline" size={10} color={DIM_INK} />
                    <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                      <Trans>ADMIN</Trans>
                    </Text>
                  </View>
                </TrackedPressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Screen>
  )
}
