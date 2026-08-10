import { Pressable, View } from 'react-native'

import { cn } from '@/lib/cn'

// Position within a short sequence of pages. The current dot stretches rather
// than growing, so the row's height never shifts. Pass onSelect to make the
// dots a control rather than just an indicator — each gets a padded pressable
// so the 6px target is actually reachable with a thumb.
export function PageDots({
  total,
  current,
  color,
  onSelect,
}: {
  total: number
  current: number
  color: string
  onSelect?: (index: number) => void
}) {
  return (
    <View className="mt-3 flex-row justify-center">
      {Array.from({ length: total }, (_, index) => {
        const reached = index <= current
        const dot = (
          <View
            className={cn(
              'h-1.5 rounded-full',
              index === current ? 'w-5' : 'w-1.5',
              !reached && 'bg-muted',
            )}
            style={reached ? { backgroundColor: color } : null}
          />
        )
        if (onSelect === undefined) {
          return (
            <View key={index} className="px-1 py-2">
              {dot}
            </View>
          )
        }
        return (
          <Pressable
            key={index}
            className="px-1 py-2"
            hitSlop={6}
            onPress={() => {
              onSelect(index)
            }}
          >
            {dot}
          </Pressable>
        )
      })}
    </View>
  )
}
