import { Pressable, Text } from 'react-native'

import { cn } from '@/lib/cn'

// One button in the gallery's sidebar.
//
// Shared by every kind of thing in there: a screen, which stays lit for as long as it is
// the one on show, a moment — an announcement, a toast, a hit — which fires and is done,
// and an arcade action, which reaches into the run behind the frame. Same dress for all
// three; what differs is only whether anything stays selected afterwards.
export function GalleryButton({
  label,
  hint,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string
  // The section the entry came from, drawn dim in front of the label. Only search results
  // pass one: with the sections folded away there is nothing above a row to say what
  // `TWO` or `short · three` is two of.
  hint?: string
  selected?: boolean
  // Nothing in the picker's own list can be pressed to no effect, so this is the arcade
  // section's alone: a siege cannot be opened from a standing start, and razing needs one
  // to be under way. Dimmed rather than hidden: which of the two is off is the thing worth
  // reading off the section.
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'rounded-lg px-2.5 py-2',
        selected ? 'bg-strong' : 'bg-card',
        disabled && 'opacity-40',
      )}
    >
      <Text
        selectable={false}
        className={cn(
          'font-mono text-[11px] font-bold tracking-[0.5px]',
          selected ? 'text-on-strong' : 'text-primary',
          disabled && 'text-dim',
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
