import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { SECTIONS, type SectionKey } from '@/lib/how-to-play-sections'

export function HowToPlaySectionHeader({
  section,
  onMeasure,
}: {
  section: SectionKey
  // Reports where this header sits inside the scroll content, so the contents list
  // can jump to it. Measured rather than estimated: the sections are prose and their
  // heights move with every copy edit.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  const { icon, title, color } = SECTIONS[section]
  return (
    <View
      className="mb-3 mt-8 flex-row items-center gap-2.5"
      onLayout={(e) => {
        onMeasure(section, e.nativeEvent.layout.y)
      }}
    >
      <View
        className="h-7 w-7 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}26` }}
      >
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text
        selectable={false}
        className="font-mono text-[15px] font-black tracking-[2px] text-primary"
      >
        {t(title)}
      </Text>
    </View>
  )
}
