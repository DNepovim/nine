import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { APP_VIOLET } from '@/constants/colors'
import { formatShortDay } from '@/lib/format-date'
import { awardPoints, totalAwards, type Award } from '@/lib/winnings'
import type { AwardBlock } from '@/lib/winnings-announcement'
import { DIFFICULTIES, getDifficultyColor, MODES } from '@/machines/game'

// What the player won while they were away: the boards they took, what each paid, and
// what the lot of it added to their rating.
//
// The accent is APP_VIOLET rather than gold or the achievement green, and deliberately so.
// Gold means a record you *currently hold* and green means an achievement you *keep*;
// winnings are a fourth thing — paid once for a window that has shut, and never taken
// back — so borrowing either would say something untrue. Violet is the app's own hue, for
// the element that belongs to no scale.
const ACCENT = APP_VIOLET

function AwardRow({ award }: { award: Award }) {
  const { t } = useLingui()
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text
        selectable={false}
        className="font-mono text-[10px] font-bold tracking-[1px]"
        style={{ color: getDifficultyColor(award.mode, award.difficulty) }}
      >
        {t(MODES[award.mode].label)} · {t(DIFFICULTIES[award.difficulty].label)}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
        >
          {award.score.toLocaleString()}
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black tracking-[0.5px]"
          style={{ color: ACCENT }}
        >
          +{awardPoints(award).toLocaleString()}
        </Text>
      </View>
    </View>
  )
}

function Block({ block }: { block: AwardBlock }) {
  return (
    <View className="gap-1.5">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold tracking-[1.5px] text-dim"
      >
        {block.period === 'day' ? (
          <Trans>DAY · {formatShortDay(block.wonOn)}</Trans>
        ) : (
          <Trans>WEEK · {formatShortDay(block.wonOn)}</Trans>
        )}
      </Text>
      {block.awards.map((award) => (
        <AwardRow key={`${award.mode}-${award.difficulty}`} award={award} />
      ))}
    </View>
  )
}

export function WinningsCard({ blocks }: { blocks: readonly AwardBlock[] }) {
  const total = totalAwards(blocks.flatMap((block) => block.awards))

  return (
    <View>
      <View className="items-center">
        <View
          className="h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${ACCENT}26` }}
        >
          <Ionicons name="trending-up" size={30} color={ACCENT} />
        </View>

        <Text
          selectable={false}
          className="mt-4 text-center font-mono text-[17px] font-black tracking-[2px]"
          style={{ color: ACCENT }}
        >
          <Trans>YOU WON</Trans>
        </Text>
      </View>

      <View className="mt-4 gap-3.5">
        {blocks.map((block) => (
          <Block key={`${block.period}-${block.wonOn}`} block={block} />
        ))}
      </View>

      <View className="mt-4 flex-row items-baseline justify-between gap-3 border-t border-muted pt-3">
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          <Trans>ADDED TO YOUR RATING</Trans>
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[15px] font-black tracking-[1px]"
          style={{ color: ACCENT }}
        >
          +{total.toLocaleString()}
        </Text>
      </View>
    </View>
  )
}
