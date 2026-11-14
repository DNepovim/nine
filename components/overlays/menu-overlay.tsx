import { Trans } from '@lingui/react/macro'
import { isNonEmptyString } from 'narrowland'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { GradientName } from '@/components/gradient-name'
import { IntroAlonePanel } from '@/components/overlays/intro-alone-panel'
import { IntroCta } from '@/components/overlays/intro-cta'
import { IntroFriendsPanel } from '@/components/overlays/intro-friends-panel'
import { IntroLinks } from '@/components/overlays/intro-links'
import { Screen } from '@/components/screen'
import type { AchievementId } from '@/constants/achievements'
import { TYPE } from '@/constants/typography'
import { useChampionsContext } from '@/hooks/use-champions'
import { useFlag } from '@/hooks/use-flags'
import { useIntroPaging } from '@/hooks/use-intro-paging'
import type { LostMedalNews } from '@/hooks/use-lost-medals'
import { useOnline } from '@/hooks/use-online'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import { useTitleGradient } from '@/hooks/use-title-gradient'
import type { SessionCard } from '@/lib/challenge-session'
import { playerMarks } from '@/lib/champions'
import { cn } from '@/lib/cn'
import type { Medal } from '@/lib/medals'
import type { OpenSession } from '@/lib/session-board'
import type { VoteOption } from '@/lib/session-ratings'
import {
  darkGradientOf,
  gradientOf,
  lerpColor,
  MULTIPLAYER_GRADIENT,
  type Difficulty,
  type ModeId,
} from '@/modes'

import { AccountNotice, type AccountNoticeKind } from './account-notice'
import { AchievementProgress } from './achievement-progress'
import { AnimatedLetter } from './animated-letter'
import { PlayModeTab, type PlayMode } from './play-mode-tab'
import { TitleMark } from './title-mark'
import { TitleSlot } from './title-slot'

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
  onRestoreProfile,
  onHowToPlay,
  onCreateRoom,
  onOpenJoinRoom,
  onOpenChallenge,
  nextVote,
  onOpenVote,
  onOpenVoteResults,
  onShare,
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
  // The address card, opened from under the nickname button for a player whose profile is
  // on another phone. The intro is the only screen that offers it: a restore reloads the
  // app, which the pause screen would be doing to a live run.
  onRestoreProfile: () => void
  onHowToPlay: () => void
  onCreateRoom: () => void
  // The code entry itself lives on its own screen now — this just opens it.
  onOpenJoinRoom: () => void
  // Pressed on the challenge card. The dialog behind it belongs to the screen above —
  // a ModalCard mounted in this panel would scrim the panel rather than the app.
  onOpenChallenge: (card: NonNullable<SessionCard<OpenSession>>) => void
  // **The vote** on the next two challenges, empty where there is none, and the link that
  // opens its dialog — which belongs to the screen above, like the challenge one.
  nextVote: readonly VoteOption[]
  onOpenVote: () => void
  // For a player who has voted: the pie of where it stands.
  onOpenVoteResults: () => void
  // Pressed on SHARE, with the sentence the invite would carry — written here, where
  // the board and the best are known. The dialog lives above, for the same reason the
  // challenge one does.
  onShare: (invite: string) => void
  onOpenAdmin: () => void
}) {
  // The same marks the leaderboard, the pause screen and a room wear beside this
  // player's name — worn here over the title itself, since the title is this
  // player's too.
  const champions = useChampionsContext()
  const marks = playerMarks(userId, champions)
  // Just the player's own, for the greeting above the title — the one name on this
  // screen with no board row behind it to carry its averages.
  const myFactors = usePlayerFactors(userId === null ? EMPTY_IDS : [userId])
  // Creating or joining a room is a Supabase round trip either way, so both are
  // dead ends with no connection — disabled rather than left to fail after a tap.
  const online = useOnline()
  const showMultiplayer = useFlag('multiplayer')
  const showArcade = useFlag('arcade')
  // A stored ARCADE focus is only honoured by a reader who can actually *open* it. The
  // pill is everyone's now, so this is no longer about a tab that is not there — it is
  // about where a launch lands: opening every time on a pill whose PLAY GAME is dead
  // would make the teaser the screen rather than a thing on it. A player without the flag
  // can still press ARCADE and read it; they just do not start there.
  const [focused, setFocused] = useState<ModeId>(
    initialFocus === 'arcade' && !showArcade ? gameMode : initialFocus,
  )
  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode)
  const {
    width: effectivePanelWidth,
    panelStyle,
    slideTo,
    onLayout: onPanelsLayout,
  } = useIntroPaging(playMode)

  // The title and the WITH FRIENDS pill read multiplayer's own pair while that tab is
  // open, rather than whichever singleplayer mode `focused` last was — pinned to
  // accuracy since a room is always created as accuracy.
  const activeMode: ModeId | 'multiplayer' =
    playMode === 'friends' ? 'multiplayer' : focused
  const activeGradient =
    playMode === 'friends' ? MULTIPLAYER_GRADIENT.accuracy : gradientOf(focused)

  const { gradPhase, gradStartSv, gradEndSv } = useTitleGradient(activeGradient)

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

  const handleFocus = (m: ModeId) => {
    setFocused(m)
    onFocusChange?.(m)
    // ARCADE is the one pill whose choice is committed nowhere: it is a
    // door rather than a mode of this machine's. Everything else — the
    // three, and whichever challenges are open — is a run this machine
    // deals, so it is the mode from here on.
    if (m !== 'arcade') onSetMode(m)
  }

  const handlePlayModeSelect = (pm: PlayMode) => {
    setPlayMode(pm)
    onPlayModeChange?.(pm)
    slideTo(pm)
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
          {/* The marks this player wears everywhere their name does, crowning the whole
              block rather than sitting between the greeting and the title — they are the
              rarest things on the screen, and the top is where the eye starts. Silent for
              everyone holding neither an Extreme all-time board nor the last challenge,
              and tappable for anyone yet to find out what the things over their name
              are. */}
          <TitleMark marks={marks} mine float className="mb-1" />

          {/* Greeting — only shown when nickname is set. The player's own name is
              drawn the way their name is drawn everywhere else, in the gradient their
              averages earn; the words around it stay dim, so the one coloured thing on
              the line is the one word that is theirs. */}
          <Text selectable={false} className={cn(TYPE.figure, 'mb-2 text-dim')}>
            {isNonEmptyString(nickname) ? (
              <Trans>
                Hi <GradientName nickname={nickname} {...myFactors(userId)} />, let's
                multiply
              </Trans>
            ) : (
              <Trans>Let's multiply</Trans>
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
          <View className="w-full overflow-hidden" onLayout={onPanelsLayout}>
            <Animated.View
              style={[
                { flexDirection: 'row', width: effectivePanelWidth * 2 },
                panelStyle,
              ]}
            >
              <IntroAlonePanel
                width={effectivePanelWidth}
                focused={focused}
                onFocus={handleFocus}
                gradPhase={gradPhase}
                showArcade={showArcade}
                gameMode={gameMode}
                difficulty={difficulty}
                onSetDifficulty={onSetDifficulty}
                userId={userId}
                nickname={nickname}
                onAddNickname={onAddNickname}
                onRestoreProfile={onRestoreProfile}
                onOpenChallenge={onOpenChallenge}
                nextVote={nextVote}
                onOpenVote={onOpenVote}
                onOpenVoteResults={onOpenVoteResults}
              />

              {/* Panel 1: WITH FRIENDS */}
              <IntroFriendsPanel
                width={effectivePanelWidth}
                online={online}
                onCreateRoom={onCreateRoom}
                onOpenJoinRoom={onOpenJoinRoom}
              />
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
            <IntroCta
              id="menu.play"
              onPress={focused === 'arcade' ? onPlayArcade : onPlay}
              // Arcade is pressable now for whoever can see it, and still dead for
              // everyone else — the badge on the pill above says SOON, and the button
              // under it has to agree.
              disabled={focused === 'arcade' && !showArcade}
              colors={darkGradientOf(focused)}
              label={<Trans>PLAY GAME</Trans>}
            />
          )}

          <IntroLinks
            userId={userId}
            gameMode={gameMode}
            difficulty={difficulty}
            bestScore={bestScore}
            onOpenAdvanced={onOpenAdvanced}
            onShare={onShare}
            onHowToPlay={onHowToPlay}
            onOpenAdmin={onOpenAdmin}
          />
        </View>
      </View>
    </Screen>
  )
}
