import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { SECTIONS, type SectionKey } from '@/lib/how-to-play-sections'

// What the guide covers, in order, straight under the title — so a player sees the
// shape of it before scrolling and knows how far down the page goes. Set inline
// and wrapping rather than stacked: six titles down the page would push the guide
// itself below the fold, which is the opposite of what a contents list is for.
//
// Each entry carries its section's icon and colour — the same pair its header wears
// further down, so the list reads as the page in miniature and a title is recognised
// again on arrival. The icons also do the separating that dots used to, one mark at
// the start of every entry, so nothing sits between them but space.
export function HowToPlayContents({
  sections,
  onJump,
}: {
  // Handed down rather than worked out again here, so the list and the page below it
  // are filtered by one decision instead of two that agree until they don't.
  sections: readonly SectionKey[]
  onJump: (section: SectionKey) => void
}) {
  const { t } = useLingui()
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-x-3.5 gap-y-2">
      {sections.map((key) => (
        <TrackedPressable
          id="how_to_play.page"
          key={key}
          onPress={() => {
            onJump(key)
          }}
          hitSlop={8}
          className="flex-row items-center gap-1.5"
        >
          <Ionicons name={SECTIONS[key].icon} size={11} color={SECTIONS[key].color} />
          <Text
            selectable={false}
            className={TYPE.quietAction}
            style={{ color: SECTIONS[key].color }}
          >
            {t(SECTIONS[key].title)}
          </Text>
        </TrackedPressable>
      ))}
    </View>
  )
}
