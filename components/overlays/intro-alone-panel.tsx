import { isOneOf } from 'narrowland'
import { useMemo } from 'react'
import { View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { ArcadeTeaser } from '@/components/overlays/arcade-teaser'
import { ChallengeCard } from '@/components/overlays/challenge-card'
import { DifficultySelector } from '@/components/overlays/difficulty-selector'
import { HighScores } from '@/components/overlays/high-scores'
import { ModeSelector } from '@/components/overlays/mode-selector'
import { ModeTips } from '@/components/overlays/mode-tips'
import { RecentWinners } from '@/components/overlays/recent-winners'
import { useSessionCard } from '@/hooks/use-session-card'
import type { SessionCard } from '@/lib/challenge-session'
import type { OpenSession } from '@/lib/session-board'
import type { VoteOption } from '@/lib/session-ratings'
import {
  ARCADE_TEASER,
  MODE_ORDER,
  SCORED_MODES,
  traitsOf,
  type Difficulty,
  type ModeId,
} from '@/modes'

// The mode pills this screen shows, in order: the player's three, then ARCADE.
//
// ARCADE is last and is everyone's. For whoever holds the `arcade` flag it is a door; for
// everyone else it is a teaser wearing SOON, with PLAY GAME dead under it and a card in
// the slot below saying what is coming — see ArcadeTeaser. It was hidden from everyone
// else for a while, on the grounds that a tab which does nothing is the first row to cut.
// A tab that *says* something is not that tab: the promise was already made the first time
// a player saw the badge, and answering it is cheaper than withdrawing it.
//
// **No challenges.** They used to join this row, read off the registry, each wearing a
// 24H badge. They have their own card above the pills now — see `ChallengeCard` — and
// two doors to one thing on one screen is the drift that gets a feature built twice:
// the pill skipped the description and the standings, which is most of what there is to
// say about a challenge. It also buys something structural, which is that `openModes`
// stays a synchronous read of a compiled registry: a session lives on the server, and a
// pill driven by one would have made this list wait on a request.
const introModes = (): ModeId[] => [...MODE_ORDER, 'arcade']

// The intro's ALONE panel: a live challenge's card, the mode pills, the difficulty, and
// whatever the focused pill has under it. See `MenuOverlay`, which pages between this and
// the WITH FRIENDS panel and holds which pill is focused.
export function IntroAlonePanel({
  width,
  focused,
  onFocus,
  gradPhase,
  showArcade,
  gameMode,
  difficulty,
  onSetDifficulty,
  userId,
  nickname,
  onAddNickname,
  onRestoreProfile,
  onOpenChallenge,
  nextVote,
  onOpenVote,
  onOpenVoteResults,
}: {
  // The panel's own width — one page of the intro's two.
  width: number
  focused: ModeId
  onFocus: (mode: ModeId) => void
  gradPhase: SharedValue<number>
  showArcade: boolean
  gameMode: ModeId
  difficulty: Difficulty
  onSetDifficulty: (difficulty: Difficulty) => void
  userId: string | null
  nickname: string | null
  onAddNickname: () => void
  onRestoreProfile: () => void
  onOpenChallenge: (card: NonNullable<SessionCard<OpenSession>>) => void
  nextVote: readonly VoteOption[]
  onOpenVote: () => void
  onOpenVoteResults: () => void
}) {
  // Held in a const so the press handler below closes over a narrowed value rather than
  // re-reading something it cannot narrow.
  // `reckon` goes down to the card, which hands it to its own clock: a teaser that runs
  // out becomes the live card on that tick rather than on the next launch. One re-render
  // of this screen, at the boundary — see the note on `ChallengeCountdown`, which is the
  // reason the clock lives in a component of its own.
  const { card: challenge, reckon: reckonChallenge } = useSessionCard()
  const modeItems = useMemo(() => introModes(), [])
  const badges: Partial<Record<string, string>> = useMemo(
    () => ({ arcade: showArcade ? ARCADE_TEASER.devTag : ARCADE_TEASER.tag }),
    [showArcade],
  )

  return (
    <>
      {/* Panel 0: ALONE */}
      {/* overflow: 'hidden' of its own — the shared row's clip only bounds the
        two panels together, so ARCADE's SOON badge, which deliberately hangs
        past its own tab (see CornerBadge), was free to cross from this panel's
        space into WITH FRIENDS' once this one slid off to make room for it. */}
      {/* One gap between every row of this panel, rather than each row
        carrying a bottom margin of its own — the rows come and go with the
        focused mode, and spacing that lives on the parent cannot leave a
        margin behind under whichever row happens to be last. */}
      <View className="gap-2" style={{ width, overflow: 'hidden' }}>
        {/* A challenge that is on, or opens tomorrow. First row of the panel:
          it is the thing that goes away, and the pills below it are not. Draws
          nothing at all most days, and the panel's own `gap-2` is what means
          its absence leaves no hole. */}
        {challenge !== null && (
          <ChallengeCard
            card={challenge}
            onArrive={reckonChallenge}
            vote={{
              options: nextVote,
              onOpen: onOpenVote,
              onOpenResults: onOpenVoteResults,
            }}
            onPress={() => {
              onOpenChallenge(challenge)
            }}
          />
        )}
        <ModeSelector
          focused={focused}
          items={modeItems}
          gradPhase={gradPhase}
          badges={badges}
          onSelect={onFocus}
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
              onRestoreProfile={onRestoreProfile}
            />
          </>
        )}
      </View>
    </>
  )
}
