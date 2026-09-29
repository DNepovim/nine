import { Pressable, Text } from 'react-native'

import { cn } from '@/lib/cn'

// One button in the gallery's sidebar.
//
// Shared by the two kinds of thing in there: a screen, which stays lit for as long as it
// is the one on show, and a moment — an announcement, a toast, a hit — which fires and is
// done. Same dress either way; what differs is only whether anything stays selected
// afterwards.
export function GalleryButton({
  label,
  hint,
  selected = false,
  onPress,
}: {
  label: string
  // The section the entry came from, drawn dim in front of the label. Only search results
  // pass one: with the sections folded away there is nothing above a row to say what
  // `TWO` or `short · three` is two of.
  hint?: string
  selected?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('rounded-lg px-2.5 py-2', selected ? 'bg-strong' : 'bg-card')}
    >
      <Text
        selectable={false}
        className={cn(
          'font-mono text-[11px] font-bold tracking-[0.5px]',
          selected ? 'text-on-strong' : 'text-primary',
        )}
      >
        {hint !== undefined && (
          <Text className={cn(selected ? 'text-on-strong opacity-60' : 'text-dim')}>
            {hint}
            {' · '}
          </Text>
        )}
        {label}
      </Text>
    </Pressable>
  )
}
