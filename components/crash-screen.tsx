import { Pressable, Text, View } from 'react-native'

// What a render crash leaves on screen instead of a blank page. Deliberately built from
// nothing but tokens and primitives: the boundary that mounts this may be standing in
// for the tree the theme provider lives in, so it cannot lean on any context.
export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-8">
      <Text
        selectable={false}
        className="mb-3 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        SOMETHING BROKE
      </Text>
      <Text
        selectable={false}
        className="mb-8 text-center font-mono text-[11px] leading-[18px] text-dim"
      >
        Not your fault. The error has been reported — try again, and if it keeps
        happening, reload the page.
      </Text>
      <Pressable
        onPress={onRetry}
        className="items-center rounded-2xl bg-strong px-12 py-4"
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          TRY AGAIN
        </Text>
      </Pressable>
    </View>
  )
}
