import { Text, View } from 'react-native'

// What the board cannot say for itself while the connection is down: everyone
// else's rows are hidden rather than stale, and anything played since is still
// only on the device.
const UNSYNCED = "CONNECT TO SEE OTHERS' BESTS AND SAVE YOUR RECORD"
const SYNCED = "CONNECT TO SEE OTHERS' BESTS"

export function OfflineNotice({ unsynced }: { unsynced: boolean }) {
  return (
    <View className="mt-3 items-center">
      <Text
        selectable={false}
        className="font-mono text-[9px] font-black tracking-[2px] text-dim"
      >
        YOU'RE OFFLINE
      </Text>
      <Text
        selectable={false}
        className="mt-1 max-w-[220px] text-center font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        {unsynced ? UNSYNCED : SYNCED}
      </Text>
    </View>
  )
}
