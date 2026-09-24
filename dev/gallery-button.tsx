import { Pressable, Text } from 'react-native'

import { cn } from '@/lib/cn'

// One button in the gallery's sidebar.
//
// Shared by the two kinds of thing in there: a screen, which stays lit for as long as it
// is the one on show, and an announcement, which fires and is done. Same dress either
// way — what differs is only whether anything stays selected afterwards.
export function GalleryButton({
  label,
  selected = false,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('rounded-lg px-2 py-1.5', selected ? 'bg-strong' : 'bg-card')}
    >
      <Text
        selectable={false}
        className={cn(
          'font-mono text-[9px] font-bold tracking-[0.5px]',
          selected ? 'text-on-strong' : 'text-primary',
        )}
      >
        {label}
      </Text>
    </Pressable>
  )
}
