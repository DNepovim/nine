import { isOneOf } from 'narrowland'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

import { type DyingPhase } from '@/hooks/use-dying-sequence'
import type { Period } from '@/lib/announcements'
import type { RecordScreen } from '@/lib/champions'
import { gameOverTitle } from '@/lib/game-over-title'
import { type Difficulty, type Mode } from '@/machines/game'

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
  screen,
  personalBest,
  titleRoll,
  avgAccuracy,
  avgSpeed,
  onPlayAgain,
  onChallenge,
  onMenu,
}: {
  phase: DyingPhase
  overlayStyle: StyleProp<AnimatedStyle<ViewStyle>>
  titleStyle: StyleProp<AnimatedStyle<ViewStyle>>
  onTitleLayout: (centerY: number) => void
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  gameTimeMs: number
  strikes: number
  medals: readonly Period[]
  // How loudly this game over celebrates — latched with the run upstream.
  screen: RecordScreen
  // Whether the run beat the player's own stored best — the title's second tier.
  personalBest: boolean
  // Which of the tier's three lines to use, drawn once per game over upstream.
  titleRoll: number
  avgAccuracy: number
  avgSpeed: number
  onPlayAgain: () => void
  onChallenge: (mode: Mode, difficulty: Difficulty) => void
  onMenu: () => void
}) {
  if (phase === 'idle') return null
  const revealed = phase === 'done'
  // One title for both copies: the flying one and the one it hands off to must read
  // the same, or the words would change under the player mid-flight.
  // Trainee has infinite lives and never reaches this screen, but the title's pools are
  // keyed by scored mode — fall back rather than widen the type for a case that cannot
  // happen.
  const scoredMode = isOneOf(gameMode, ['accuracy', 'speed']) ? gameMode : 'accuracy'
  const words = gameOverTitle(
    { screen, mode: scoredMode, medals, personalBest, difficulty, score, hits, strikes },
    titleRoll,
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
          gameTimeMs={gameTimeMs}
          strikes={strikes}
          record={medals[0] ?? null}
          screen={screen}
          titleWords={words}
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          titleHidden={!revealed}
          onTitleLayout={onTitleLayout}
          onPlayAgain={onPlayAgain}
          onChallenge={onChallenge}
          onMenu={onMenu}
        />
      </Animated.View>

      {/* Flying title — pops in over the frozen targets, flies up during blend. */}
      {!revealed && (
        <Animated.View pointerEvents="none" style={[FILL_CENTER, titleStyle]}>
          <GameOverTitle
            gameMode={gameMode}
            words={words}
            shadow={medals[0] === 'ever'}
          />
        </Animated.View>
      )}
    </>
  )
}
