import { Text } from 'react-native'

import { GOLD_INK } from '@/constants/colors'
import type { Segment, SegmentKind, Sentence } from '@/dev/weekly-recap/lines'
import { useTheme } from '@/hooks/use-theme'

// One sentence of a recap. Three things in it are coloured — a nickname, a board, a
// record — and everything between them is ordinary text, so the segments are drawn as
// nested Text inside one paragraph rather than as a row of views. Nesting is what keeps
// the line wrapping as prose.
//
// Sentence case with tight tracking, following the announcement bar rather than the
// app's label style: wide tracking is a caps device and reads as airy on prose.
// A board and a record are label-like, so they are set in mono like every other label in
// the app — which is also what keeps them from being mistaken for a player, since a
// nickname's colour is drawn from the same spectrum the mode gradients are.
const SEGMENT_CLASS = {
  plain: '',
  name: 'font-bold',
  board: 'font-mono text-[11px] font-bold',
  record: 'font-mono text-[11px] font-bold',
} as const satisfies Record<SegmentKind, string>

export function RecapSentence({ sentence }: { sentence: Sentence }) {
  const { colorScheme } = useTheme()

  const colorFor = (segment: Segment): string | undefined => {
    if (segment.kind === 'record') return GOLD_INK[colorScheme]
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
