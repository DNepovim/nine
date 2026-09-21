import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format-date'
import { DIFFICULTIES, MODES } from '@/machines/game'
import { getDifficultyColor, type Difficulty, type ScoredMode } from '@/machines/modes'

// One stretch of holding an all-time board's record.
//
// Open and closed reigns are the same row with a different tail: `SINCE 12 AUG` while it
// is still theirs, `12 AUG – 3 SEP` once somebody took it. The open one keeps the
// primary ink so a live reign reads as a standing rather than as history.
export function ProfileReignRow({
  mode,
  difficulty,
  score,
  tookAt,
  lostAt,
}: {
  mode: ScoredMode
  difficulty: Difficulty
  score: number
  tookAt: string
  // Null while they still hold it — the distinction the whole list is about.
  lostAt: string | null
}) {
  const { t } = useLingui()
  // Narrowed here rather than through a helper: the closed branch needs `lostAt` to be
  // a string, and only the comparison itself tells TypeScript that it is.
  const range =
    lostAt === null
      ? t`SINCE ${formatShortDate(tookAt)}`
      : `${formatShortDate(tookAt)} – ${formatShortDate(lostAt)}`

  return (
    <View className="h-7 flex-row items-center">
      <Text
        selectable={false}
        className="flex-1 font-mono text-[10px] font-black tracking-[1px]"
        style={{ color: getDifficultyColor(mode, difficulty) }}
      >
        {`${t(MODES[mode].label)} ${t(DIFFICULTIES[difficulty].label)}`}
      </Text>
      <Text
        selectable={false}
        className={cn(
          'w-20 text-right font-mono text-[11px] font-bold',
          lostAt === null ? 'text-primary' : 'text-dim',
        )}
      >
        {score}
      </Text>
      <Text
        selectable={false}
        className="w-28 text-right font-mono text-[8px] font-bold tracking-[0.5px] text-dim"
      >
        {range}
      </Text>
    </View>
  )
}
