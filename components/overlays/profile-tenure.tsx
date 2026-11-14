import { Plural, Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// Past this many months the line counts years instead. A profile two years old that said
// "joined 24 months ago" would be asking the reader to do the division.
const MONTHS_IN_YEAR = 12

// Past this many days the last-run line names the day instead. "6 days ago" is still a
// glance; "23 days ago" is a sum, and the date answers it directly.
const DAYS_IN_WEEK = 7

// How long a player has been at this, and when they last played — under the name on the
// profile card. See `PlayerProfileOverlay`, which says why it is set as it is.
export function ProfileTenure({
  joinedMonths,
  lastRunDays,
  lastRunDay,
}: {
  // Months since the player joined, or null where the server could not say.
  joinedMonths: number | null
  // Days since their last run, or null for a player with no runs.
  lastRunDays: number | null
  // That run's day, written out — read past a week.
  lastRunDay: string
}) {
  return (
    <View className="gap-1">
      {joinedMonths !== null && (
        <Text selectable={false} className={cn(TYPE.footnote, 'text-center text-dim')}>
          {joinedMonths < 1 ? (
            <Trans>joined this month</Trans>
          ) : joinedMonths < MONTHS_IN_YEAR ? (
            <Plural
              value={joinedMonths}
              one="joined a month ago"
              other="joined # months ago"
            />
          ) : (
            <Plural
              value={Math.floor(joinedMonths / MONTHS_IN_YEAR)}
              one="joined a year ago"
              other="joined # years ago"
            />
          )}
        </Text>
      )}
      {/* When they last played, under how long they have been at it — the
        other half of the same question, whether this is someone who is still
        here. Relative for the first week, then the day itself. Left off for a
        player with no runs rather than saying "never", which a profile with a
        name on a board cannot honestly be. */}
      {lastRunDays !== null && (
        <Text selectable={false} className={cn(TYPE.footnote, 'text-center text-dim')}>
          {lastRunDays === 0 ? (
            <Trans>last played today</Trans>
          ) : lastRunDays === 1 ? (
            <Trans>last played yesterday</Trans>
          ) : lastRunDays < DAYS_IN_WEEK ? (
            <Plural value={lastRunDays} other="last played # days ago" />
          ) : (
            <Trans>last played on {lastRunDay}</Trans>
          )}
        </Text>
      )}
    </View>
  )
}
