import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

import { type DyingPhase } from '@/hooks/use-dying-sequence'
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
  avgAccuracy,
  avgSpeed,
  onNewGame,
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
  avgAccuracy: number
  avgSpeed: number
  onNewGame: () => void
}) {
  if (phase === 'idle') return null
  const revealed = phase === 'done'

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
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          titleHidden={!revealed}
          onTitleLayout={onTitleLayout}
          onNewGame={onNewGame}
        />
      </Animated.View>

      {/* Flying title — pops in over the frozen targets, flies up during blend. */}
      {!revealed && (
        <Animated.View pointerEvents="none" style={[FILL_CENTER, titleStyle]}>
          <GameOverTitle gameMode={gameMode} />
        </Animated.View>
      )}
    </>
  )
}
