import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import type { BadgeCorner } from '@/components/game/dial-badge'
import { Screen } from '@/components/screen'
import { DIM_INK } from '@/constants/colors'
import type { DialCorners, DialHint } from '@/constants/dial-hints'
import { useTheme } from '@/hooks/use-theme'
import {
  DARK_MODE_GRADIENT,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { BoardBadges } from './board-badges'
import { DialHintModal } from './dial-hint-modal'
import { HighScores } from './high-scores'
import { PauseMark } from './pause-mark'
import { RunStats } from './run-stats'
import { ScoreReadout } from './score-readout'
import { TraineeDisplayOptions } from './trainee-display-options'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function PausedOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  score,
  hits,
  gameTimeMs,
  avgAccuracy,
  avgSpeed,
  corners,
  onSelectCorner,
  showPar,
  onTogglePar,
  traineeTimeoutMs,
  onSetTraineeTimeout,
  onContinue,
  onRestart,
  onMenu,
  onOpenAdvanced,
  onAddNickname,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  gameTimeMs: number
  avgAccuracy: number
  avgSpeed: number
  // What the dial is printing in each corner of a key, and the way to change one.
  // Trainee only — no other mode draws them, so no other mode shows the row.
  corners: DialCorners
  onSelectCorner: (corner: BadgeCorner, hint: DialHint | null) => void
  showPar: boolean
  onTogglePar: () => void
  traineeTimeoutMs: number
  onSetTraineeTimeout: (ms: number) => void
  onContinue: () => void
  onRestart: () => void
  onMenu: () => void
  onOpenAdvanced: () => void
  onAddNickname: () => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = DIM_INK[colorScheme]
  // Which corner's dialog is open. Held here rather than inside the grid so the dialog
  // can be rendered beside the Screen: `ModalCard` covers its parent, and a parent of
  // four tiles is four tiles' worth of scrim.
  const [editingCorner, setEditingCorner] = useState<BadgeCorner | null>(null)

  return (
    <>
      <Screen overlay>
        <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
          <View className="w-full items-center">
            {/* The same three pieces the game-over screen opens with, in the same order
              and the same dress: a mark saying what happened, the board it happened on,
              then the number. Only the mark differs — a run that stopped rather than
              one that ended. */}
            <PauseMark gameMode={gameMode} />

            {/* No difficulty pill in Trainee: there is nothing to record, and the one
              the menu happens to be sitting on is not what the run was played at. */}
            <BoardBadges
              gameMode={gameMode}
              difficulty={gameMode === 'trainee' ? undefined : difficulty}
            />

            {/* Trainee has no board, so a score here measures nothing. A tip is
              worth more to someone practising than a number they cannot place —
              but the run's own numbers still do, so they come first and the tip
              reads as advice on what they show. */}
            {gameMode !== 'trainee' && (
              <ScoreReadout
                score={score}
                color={MODE_GRADIENT[gameMode][0]}
                glow={`${MODE_GRADIENT[gameMode][0]}99`}
              />
            )}

            <RunStats
              hits={hits}
              gameTimeMs={gameTimeMs}
              avgAccuracy={avgAccuracy}
              avgSpeed={avgSpeed}
            />

            {/* Where the rotating tip used to be. A pause in Trainee is the moment the
              dial is on screen and nothing is running, so it is the one place worth
              spending on switches that change what the keys say — and four of them do
              not fit anywhere a tip would also have sat. */}
            {gameMode === 'trainee' && (
              <View className="mb-5 w-full">
                <TraineeDisplayOptions
                  corners={corners}
                  onEdit={setEditingCorner}
                  showPar={showPar}
                  onTogglePar={onTogglePar}
                  traineeTimeoutMs={traineeTimeoutMs}
                  onSetTraineeTimeout={onSetTraineeTimeout}
                />
              </View>
            )}

            {isOneOf(gameMode, ['accuracy', 'speed']) && (
              <HighScores
                gameMode={gameMode}
                userId={userId}
                nickname={nickname}
                onAddNickname={onAddNickname}
                compact
              />
            )}
          </View>

          <View className="items-center gap-8">
            <View className="w-56 gap-3">
              <Pressable
                onPress={onContinue}
                className="overflow-hidden rounded-2xl"
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
                    <Trans>CONTINUE</Trans>
                  </Text>
                </LinearGradient>
              </Pressable>
              {/* Nothing to restart for in Trainee. A run there is not a score being
                chased, so the board as it stands is as good as a fresh one — and the
                button was offering to throw away the very thing being practised on. */}
              {gameMode !== 'trainee' && (
                <Pressable
                  onPress={onRestart}
                  className="items-center rounded-2xl bg-card py-4"
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[13px] font-black tracking-[2px] text-primary"
                  >
                    <Trans>RESTART RUN</Trans>
                  </Text>
                </Pressable>
              )}
            </View>
            {/* The two ways off this screen that are not the run itself, in the dim
              link dress game over uses for the same pair of jobs — small enough that
              neither competes with CONTINUE, which is what most pauses end with.
              Side by side in the same row the intro screen ends with, so the links
              under a screen's buttons sit the same way wherever you meet them. */}
            <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {/* The label says what this does, the icon says where it lands. The run is
                live behind this screen and this is the one thing here that ends it — its
                score goes to the board on the way out — so HOME on its own undersold it:
                a player looking for the way out of a run should not have to learn that
                going home is what ends one. */}
              <Pressable onPress={onMenu} hitSlop={10}>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="home-outline" size={10} color={dimColor} />
                  <Text
                    selectable={false}
                    className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                  >
                    <Trans>END RUN</Trans>
                  </Text>
                </View>
              </Pressable>
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
            </View>
          </View>
        </View>
      </Screen>

      {editingCorner !== null && (
        <DialHintModal
          corner={editingCorner}
          current={corners[editingCorner]}
          onSelect={(hint) => {
            onSelectCorner(editingCorner, hint)
          }}
          onDismiss={() => {
            setEditingCorner(null)
          }}
        />
      )}
    </>
  )
}
