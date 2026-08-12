import { Text, View } from 'react-native'

// What the board cannot say for itself while the connection is down: the rows are as
// old as the last time they loaded, and anything played since is still on the device.
const UNSYNCED = "YOUR RECORD ISN'T ON THE BOARD YET"
const STALE = 'SCORES MAY BE OUT OF DATE'

export function OfflineNotice({ unsynced }: { unsynced: boolean }) {
  return (
    <View className="mt-3 items-center">
      <Text
        selectable={false}
        className="font-mono text-[9px] font-black tracking-[2px] text-dim"
      >
        — OFFLINE —
      </Text>
      <Text
        selectable={false}
        className="mt-1 font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        {unsynced ? UNSYNCED : STALE}
      </Text>
    </View>
  )
}
