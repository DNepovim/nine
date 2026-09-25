import { Text } from 'react-native'

import { GOLD_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'

// One cell of the comparison table: a figure, and whether it is the better of the two.
//
// Gold for the side that is ahead, and gold for the reason it means everywhere else in the
// app — a standing you currently hold and could lose tomorrow, which is exactly what
// leading a head-to-head is. `GOLD_INK` rather than `GOLD_SCALE`: the colour *is* the text
// here, and the scale is a background palette that cannot carry one.
//
// The side behind drops to dim rather than staying put, so the pair reads at a glance from
// the contrast between them instead of from a colour the eye has to find. A row nobody
// wins leaves both at full strength, which is what makes a judged row look judged.
export function CompareValue({
  text,
  tone,
}: {
  text: string
  // 'lead' and 'trail' are the two halves of a judged row; 'plain' is both halves of an
  // unjudged one, and both halves of a tie.
  tone: 'lead' | 'trail' | 'plain'
}) {
  const { colorScheme } = useTheme()
  return (
    <Text
      selectable={false}
      numberOfLines={1}
      className={cn(
        'w-[72px] text-right font-mono text-[11px] font-bold',
        tone === 'trail' ? 'text-dim' : 'text-primary',
      )}
      style={tone === 'lead' ? { color: GOLD_INK[colorScheme] } : undefined}
    >
      {text}
    </Text>
  )
}
