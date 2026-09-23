import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Pressable, Text } from 'react-native'

// The way out of a run, sitting in the top row beside NINE.
//
// In the row rather than floating over it: the slot it occupies used to be an empty
// spacer whose only job was to balance an absolutely positioned button, and a layout
// that has to be counterweighted is one position change away from drifting. Being in
// flow also means the pause screen covers it, which is the whole reason the old button
// needed a second state — it stayed on top and had to become a close cross.
//
// The word takes the difficulty line's type exactly — same size, weight, tracking and
// `dim` ink — so the row carries the same quiet label at both ends. The glyph takes the
// mode's own colour and the size of NINE beside it, which leaves the icon, not the word,
// as the thing the eye lands on.
const ICON = 24

// Ionicons draw inside a square with transparent padding, so a glyph flushed to the end
// of its row still stops short of the edge. The score below is a text run with no such
// inset, and the two columns visibly failed to line up. This cancels the padding so the
// bars sit over the score's last digit rather than a few pixels inside it.
const GLYPH_INSET = -3

export function PauseButton({ color, onPress }: { color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      className="flex-row items-center gap-1.5"
      accessibilityRole="button"
    >
      <Text
        selectable={false}
        className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>PAUSE</Trans>
      </Text>
      <Ionicons
        name="pause"
        size={ICON}
        color={color}
        style={{ marginRight: GLYPH_INSET }}
      />
    </Pressable>
  )
}
