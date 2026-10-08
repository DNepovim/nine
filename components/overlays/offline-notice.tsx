import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What the board cannot say for itself while the connection is down: everyone
// else's rows are hidden rather than stale, and anything played since is still
// only on the device.
const UNSYNCED = "CONNECT TO SEE OTHERS' BESTS AND SAVE YOUR RECORD"
const SYNCED = "CONNECT TO SEE OTHERS' BESTS"

export function OfflineNotice({ unsynced }: { unsynced: boolean }) {
  return (
    <View className="mt-3 items-center">
      <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
        <Trans>YOU'RE OFFLINE</Trans>
      </Text>
      <Text
        selectable={false}
        className={cn(TYPE.caption, 'mt-1 max-w-[220px] text-center text-dim')}
      >
        {unsynced ? UNSYNCED : SYNCED}
      </Text>
    </View>
  )
}
