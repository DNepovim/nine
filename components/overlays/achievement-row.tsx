import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { achievement, type AchievementId } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format-date'

// A secret one keeps its name as well as its rule. Naming it would be telling.
const SECRET_TITLE = msg`???`
const SECRET_HINT = msg`Do something nobody thought to ask for.`
const SECRET_EMBLEM = '🔒'

// One achievement on the list: what it is, how to get it, and either the day it was
// earned or how far along it is.
//
// Locked rows are dimmed rather than hidden. The list is the ladder — a player needs to
// see what is above them for the strip on the intro screen to mean anything.
export function AchievementRow({
  id,
  earnedAt,
  progress,
}: {
  id: AchievementId
  // ISO 8601, or null for one not yet earned.
  earnedAt: string | null
  // How far along, out of the achievement's own target. Ignored once earned, and
  // meaningless for the ones with nothing to count.
  progress: number
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()
  const def = achievement(id)
  const earned = earnedAt !== null
  // A secret stays secret until it is earned — then it is just an achievement.
  const hidden = def.secret === true && !earned
  const target = def.target

  return (
    <View className="w-full flex-row items-start gap-3 py-2">
      <Text
        selectable={false}
        className={cn('text-[18px] leading-[22px]', !earned && 'opacity-30')}
      >
        {hidden ? SECRET_EMBLEM : def.emblem}
      </Text>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text
            selectable={false}
            numberOfLines={1}
            className={cn(
              'flex-1 font-mono text-[11px] font-black tracking-[1.5px]',
              !earned && 'text-dim',
            )}
            style={earned ? { color: ACHIEVEMENT_INK[colorScheme] } : null}
          >
            {hidden ? t(SECRET_TITLE) : t(def.title)}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
          >
            {earnedAt !== null
              ? formatShortDate(earnedAt)
              : target === undefined
                ? ''
                : `${progress}/${target}`}
          </Text>
        </View>

        <Text
          selectable={false}
          className={cn(
            'font-mono text-[9px] leading-[14px] tracking-[0.3px] text-dim',
            !earned && 'opacity-70',
          )}
        >
          {hidden ? t(SECRET_HINT) : t(def.hint)}
        </Text>

        {/* A bar only where there is something to count, and only while it still counts
            for something — an earned achievement is done, not 7/7. */}
        {!earned && target !== undefined && (
          <View className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-elevated">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round((100 * progress) / target)}%`,
                backgroundColor: ACHIEVEMENT_INK[colorScheme],
              }}
            />
          </View>
        )}
      </View>
    </View>
  )
}
