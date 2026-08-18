import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

// The door to the feedback overlay: a bookmark tucked into the bottom-right edge,
// there on every screen except a live run — a dial mid-run has no room for a tab a
// thumb could graze. Deliberately quiet: card surface, dim ink, small type — it
// should be findable when a player goes looking and invisible until then.
export function FeedbackBookmark({ onPress }: { onPress: () => void }) {
  const { colorScheme } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="absolute bottom-16 right-0 flex-row items-center gap-1.5 rounded-l-2xl border border-r-0 border-muted bg-card py-2.5 pl-3 pr-2"
    >
      <Ionicons
        name="chatbox-outline"
        size={11}
        color={colorScheme === 'dark' ? '#504e6e' : '#aaa69e'}
      />
      <Text
        selectable={false}
        className="font-mono text-[9px] font-bold tracking-[1.5px] text-dim"
      >
        FEEDBACK
      </Text>
    </Pressable>
  )
}
