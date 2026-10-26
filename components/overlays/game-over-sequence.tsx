import { isOneOf } from 'narrowland'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

import type { PeriodBoard } from '@/hooks/use-board'
import { type DyingPhase } from '@/hooks/use-dying-sequence'
import type { AchievementStore } from '@/lib/achievement-store'
import type { AchievementFacts, Award } from '@/lib/achievements'
import type { Period } from '@/lib/announcements'
import type { BoardMedal } from '@/lib/board-medals'
import type { RecordScreen } from '@/lib/champions'
import { gameOverTitle } from '@/lib/game-over-title'
import { modeById, SCORED_MODES, type Difficulty, type ModeId } from '@/modes'

import { GameOverOverlay } from './game-over-overlay'
import { GameOverTitle } from './game-over-title'

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
const FILL_CENTER: ViewStyle = { ...FILL, alignItems: 'center', justifyContent: 'center' }

// The last-life death cinematic: the game-over overlay fades in (its own title
// hidden until the hand-off) while a floating "GAME OVER" title flies up from
// the frozen targets to land on the overlay's title slot. The overlay stays
// mounted across dying → blend → done (never remounts) so its leaderboard
// subscription isn't torn down and re-created mid-sequence.
export function GameOverSequence({
  phase,
  overlayStyle,
  titleStyle,
  onTitleLayout,
  gameMode,
  difficulty,
  userId,
  nickname,
  score,
  hits,
  gameTimeMs,
  strikes,
  medals,
  podium,
  screen,
  personalBest,
  titleRoll,
  avgAccuracy,
  avgSpeed,
  achievements,
  achievementStore,
  achievementFacts,
  sessionId,
  sessionBoard,
  sessionClosesAt,
  sessionRank,
  sessionMedals,
  windowShut,
  onPlayAgain,
  onChallenge,
  onMenu,
}: {
  phase: DyingPhase
  overlayStyle: StyleProp<AnimatedStyle<ViewStyle>>
  titleStyle: StyleProp<AnimatedStyle<ViewStyle>>
  onTitleLayout: (centerY: number) => void
  gameMode: ModeId
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  gameTimeMs: number
  strikes: number
  medals: readonly Period[]
  // Whether the run earned any podium place at all, gold, silver or bronze — latched
  // with the run upstream. A superset of `medals`, which only counts the top spot.
  podium: boolean
  // How loudly this game over celebrates — latched with the run upstream.
  screen: RecordScreen
  // Whether the run beat the player's own stored best — the title's second tier.
  personalBest: boolean
  // Which of the tier's three lines to use, drawn once per game over upstream.
  titleRoll: number
  avgAccuracy: number
  avgSpeed: number
  achievements: readonly Award[]
  // Passed straight through to the game over screen; see EarnedAchievements.
  achievementStore: AchievementStore
  achievementFacts: AchievementFacts
  // Which session the run belonged to, if any — forwarded straight through to the
  // screen, which is what decides between a session board and a three-period one.
  sessionId: string | null
  // That session's standings, or null while unread — passed straight through.
  sessionBoard: PeriodBoard | null
  // When that session's window shuts, or null. Passed straight through.
  sessionClosesAt: number | null
  // Where the run came on its session's standings, for a challenge. Null for an ordinary
  // run and for a session whose board has not been read yet — the title falls back to
  // what the run itself was worth, which is what it did before sessions existed.
  sessionRank: 1 | 2 | 3 | null
  // The run's place on its session, as the screen under the title draws it — empty off
  // a session. Worked out once by the game screen; see `runSessionMedals`.
  sessionMedals: readonly BoardMedal[]
  // Whether the run ended because its **session**'s window shut rather than on its own
  // terms. Reaches the title first — it outranks every claim about how the run went — and
  // the overlay second, where it quiets PLAY AGAIN and withholds the dare.
  windowShut: boolean
  onPlayAgain: () => void
  onChallenge: (mode: ModeId, difficulty: Difficulty) => void
  onMenu: () => void
}) {
  if (phase === 'idle') return null
  const revealed = phase === 'done'
  // One title for both copies: the flying one and the one it hands off to must read
  // the same, or the words would change under the player mid-flight.
  // Trainee has infinite lives and never reaches this screen, but the title's pools are
  // keyed by scored mode — fall back rather than widen the type for a case that cannot
  // happen.
  const scoredMode = isOneOf(gameMode, SCORED_MODES) ? gameMode : 'accuracy'
  const words = gameOverTitle(
    {
      screen,
      mode: scoredMode,
      medals,
      podium,
      personalBest,
      difficulty,
      score,
      hits,
      strikes,
      sessionRank,
      windowShut,
    },
    titleRoll,
    // What this mode claims instead, where it has words of its own. Undefined for every
    // permanent mode, which is what the pools were written for.
    modeById(gameMode)?.claims,
  )

  return (
    <>
      {/* Overlay — mounted invisible from the dying phase so its title can report
          its resting position; fades in during the blend; interactive at done. */}
      <Animated.View
        pointerEvents={revealed ? 'auto' : 'none'}
        style={[FILL, overlayStyle]}
      >
        <GameOverOverlay
          gameMode={gameMode}
          difficulty={difficulty}
          userId={userId}
          nickname={nickname}
          score={score}
          hits={hits}
          sessionMedals={sessionMedals}
          gameTimeMs={gameTimeMs}
          strikes={strikes}
          record={medals[0] ?? null}
          screen={screen}
          titleWords={words}
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          achievements={achievements}
          achievementStore={achievementStore}
          achievementFacts={achievementFacts}
          sessionId={sessionId}
          sessionBoard={sessionBoard}
          sessionClosesAt={sessionClosesAt}
          windowShut={windowShut}
          titleHidden={!revealed}
          onTitleLayout={onTitleLayout}
          onPlayAgain={onPlayAgain}
          onChallenge={onChallenge}
          onMenu={onMenu}
        />
      </Animated.View>

      {/* Flying title — pops in over the frozen targets, flies up during blend, and at
          `done` is swapped for the overlay's own title in a single commit. The swap only
          goes unseen if the two copies are the same drawing, so the shadow is taken off
          the screen exactly as the overlay takes it — a painted screen's haloes, anything
          else's glass shadow. */}
      {!revealed && (
        <Animated.View pointerEvents="none" style={[FILL_CENTER, titleStyle]}>
          <GameOverTitle
            gameMode={gameMode}
            words={words}
            shadow={screen === 'crown' || screen === 'bird'}
          />
        </Animated.View>
      )}
    </>
  )
}
