import { View } from 'react-native'

import { cn } from '@/lib/cn'

// Progress through the sub-tasks of a single lesson (the four gestures, the two
// weight comparisons). Separate from the stepper, which tracks whole screens.
export function SubStepDots({
  total,
  current,
  color,
}: {
  total: number
  current: number
  color: string
}) {
  return (
    <View className="mt-3 flex-row justify-center gap-2">
      {Array.from({ length: total }, (_, index) => {
        const reached = index <= current
        return (
          <View
            key={index}
            className={cn(
              'h-1.5 rounded-full',
              index === current ? 'w-5' : 'w-1.5',
              !reached && 'bg-muted',
            )}
            style={reached ? { backgroundColor: color } : null}
          />
        )
      })}
    </View>
  )
}
