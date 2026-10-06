import { Text } from 'react-native'

import { GOLD_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { Segment, SegmentKind, Sentence } from '@/lib/prose'

// One sentence of prose. A few words in it are coloured — a nickname, a board, a takeover —
// and everything between them is ordinary text, so the segments are drawn as nested Text
// inside one paragraph rather than as a row of views. Nesting is what keeps the line
// wrapping as prose.
//
// Sentence case with tight tracking, following the announcement bar rather than the app's
// label style: wide tracking is a caps device and reads as airy on prose. A board and a
// takeover are label-like, so they are set in mono like every other label in the app —
// which is also what keeps them from being mistaken for a player, since a nickname's colour
// is drawn from the same spectrum the mode gradients are.
const SEGMENT_CLASS = {
  plain: '',
  name: 'font-bold',
  board: 'font-mono text-[11px] font-bold',
  takeover: 'font-mono text-[11px] font-bold',
  // Set like a board and left the prose's own colour. Violet on the winnings card means
  // what you were *paid*, and the only violet figure on it should be the one at the foot.
  score: 'font-mono text-[11px] font-bold',
} as const satisfies Record<SegmentKind, string>

export function ProseSentence({ sentence }: { sentence: Sentence }) {
  const { colorScheme } = useTheme()

  const colorFor = (segment: Segment): string | undefined => {
    if (segment.kind === 'takeover') return GOLD_INK[colorScheme]
    return segment.color
  }

  return (
    <Text
      selectable={false}
      className="text-[13px] leading-[21px] text-primary"
      style={{ letterSpacing: 0.3 }}
    >
      {sentence.map((segment, index) => (
        <Text
          key={`${segment.kind}-${index}-${segment.text}`}
          selectable={false}
          className={SEGMENT_CLASS[segment.kind]}
          style={{ color: colorFor(segment) }}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  )
}
