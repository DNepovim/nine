import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import type { AdminSession } from '@/lib/admin/sessions'
import { spanStatus, STATUS_LABEL } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import { labelOf } from '@/modes'

// One planned session on the planner's list: which challenge, when, and where that span
// stands against now.
//
// A row whose challenge this build has never heard of is drawn rather than hidden, and
// drawn as what it is — the raw id and NOT IN THIS BUILD, because `labelOf` would answer
// GAME for it and a list of sessions all called GAME is worse than useless. Still
// pressable: a row booked for a challenge that has been taken out of the catalog is
// exactly the row somebody needs to open and cancel.
export function AdminSessionRow({
  session,
  now,
  onOpen,
}: {
  session: AdminSession
  // Read once per open by the screen above, not per render. A window crossing while the
  // planner is up must not relabel a row out from under a tap already on its way to it.
  now: number
  onOpen: (session: AdminSession) => void
}) {
  const { t } = useLingui()
  const status = spanStatus(session, now)
  return (
    <TrackedPressable
      id="admin.session"
      onPress={() => {
        onOpen(session)
      }}
      className="flex-row items-center justify-between gap-3 border-b border-dim/10 py-2.5"
    >
      <View className="flex-1">
        <Text selectable={false} className={cn(TYPE.prose, 'text-primary')}>
          {session.inBuild ? t(labelOf(session.modeId)) : session.modeId}
        </Text>
        <Text selectable={false} className={cn(TYPE.value, 'mt-0.5 text-dim')}>
          {formatDayTime(session.opensAt)} → {formatDayTime(session.closesAt)}
        </Text>
        {!session.inBuild && (
          <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1 text-red-500')}>
            <Trans>NOT IN THIS BUILD</Trans>
          </Text>
        )}
      </View>
      {/* Dimmed once it is over. An expired session is kept — it is the record of what
          ran — but it is not what a reader scanning this list is looking for. */}
      <Text
        selectable={false}
        className={cn(TYPE.labelSm, 'text-dim', status === 'expired' && 'opacity-50')}
      >
        {STATUS_LABEL[status]}
      </Text>
    </TrackedPressable>
  )
}
