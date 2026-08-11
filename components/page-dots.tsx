import { Pressable, View } from 'react-native'

import { PageDot } from '@/components/page-dot'

// Position within a short sequence of pages. The current dot stretches rather
// than growing, so the row's height never shifts. Pass onSelect to make the
// dots a control rather than just an indicator — each gets a padded pressable
// so the 6px target is actually reachable with a thumb.
//
// Spacing is the caller's: the row carries no margin of its own, because one
// caller hangs it off a border rather than stacking it under content.
export function PageDots({
  total,
  current,
  color,
  uniform = false,
  onSelect,
}: {
  total: number
  current: number
  color: string
  // Give every dot the same colour instead of filling up to the current one.
  // Progress means nothing on a sequence that loops, and there the row reads as
  // a dotted line rather than as a meter — the stretched dot still says where
  // you are.
  uniform?: boolean
  onSelect?: (index: number) => void
}) {
  return (
    <View className="flex-row justify-center">
      {Array.from({ length: total }, (_, index) => {
        const reached = uniform || index <= current
        const dot = <PageDot active={index === current} filled={reached} color={color} />
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
