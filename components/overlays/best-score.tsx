import { Text, View } from 'react-native'

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MODES,
  type Difficulty,
  type Mode,
  type Stats,
} from '@/machines/game'

export function BestScore({
  stats,
  gameMode,
  difficulty,
}: {
  stats: Stats
  gameMode: Mode
  difficulty: Difficulty
}) {
  const best =
    gameMode === 'trainee'
      ? DIFFICULTY_ORDER.reduce<{
          score: number
          hits: number
          accSum?: number
          spdSum?: number
        }>(
          (acc, d) => {
            const s = stats.trainee[d]
            return s.score > acc.score ? s : acc
          },
          { score: 0, hits: 0 },
        )
      : stats[gameMode][difficulty]

  const bestAvgAcc =
    best.hits > 0 ? Math.round((100 * (best.accSum ?? 0)) / best.hits) : 0
  const bestAvgSpd =
    best.hits > 0 ? Math.round((100 * (best.spdSum ?? 0)) / best.hits) : 0
  const label =
    gameMode === 'trainee'
      ? `BEST · ${MODES[gameMode].label}`
      : `BEST · ${MODES[gameMode].label} · ${DIFFICULTIES[difficulty].label}`

  return (
    <View className="mb-8 items-center gap-1">
      <Text
        selectable={false}
        className="font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        {label}
      </Text>
      <Text
        selectable={false}
        className="text-[44px] tracking-[1px] text-score"
        style={{ fontFamily: 'DSEG7' }}
      >
        {best.score}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[9px] font-bold tracking-[1.2px] text-dim"
      >
        {`${best.hits} HITS`}
      </Text>
      {best.hits > 0 && (
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold tracking-[1.2px] text-dim"
        >
          {`ACC ${bestAvgAcc}%   SPD ${bestAvgSpd}%`}
        </Text>
      )}
    </View>
  )
}
