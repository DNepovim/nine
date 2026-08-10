import { Text, View } from 'react-native'

const HINT_CLASS = 'font-mono text-[10px] font-bold tracking-[0.5px] text-dim'

// A single dial button surrounded by its gesture hints.
export function ControlsDiagram() {
  return (
    <View className="items-center py-1">
      <Text selectable={false} className={HINT_CLASS}>
        SWIPE UP +1
      </Text>
      <View className="my-1.5 flex-row items-center gap-3">
        <Text selectable={false} className={HINT_CLASS}>
          ◀ SET 0
        </Text>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-strong">
          <Text
            selectable={false}
            className="font-mono text-[26px] font-medium text-on-strong"
          >
            5
          </Text>
        </View>
        <Text selectable={false} className={HINT_CLASS}>
          SET 9 ▶
        </Text>
      </View>
      <Text selectable={false} className={HINT_CLASS}>
        SWIPE DOWN −1
      </Text>
      <Text
        selectable={false}
        className="mt-3 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        TAP = +1 (WRAPS 9 → 0)
      </Text>
    </View>
  )
}
