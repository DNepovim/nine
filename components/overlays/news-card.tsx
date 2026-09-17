import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { MarkdownText } from '@/components/markdown-text'
import type { NewsItem } from '@/types/news'

// One announcement. Sized by its content — the dialog around it decides how
// much room that gets.
export function NewsCard({ item }: { item: NewsItem }) {
  // `t` resolves the descriptors the item carries, and subscribes this card to the
  // active locale so a switch re-renders it.
  const { t } = useLingui()
  return (
    <View>
      <View className="items-center">
        <View
          className="h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${item.accent}26` }}
        >
          <Ionicons name={item.icon} size={30} color={item.accent} />
        </View>

        <Text
          selectable={false}
          className="mt-4 text-center font-mono text-[17px] font-black tracking-[2px]"
          style={{ color: item.accent }}
        >
          {t(item.title).toUpperCase()}
        </Text>
      </View>

      <View className="mt-2">
        <MarkdownText source={t(item.body)} accent={item.accent} />
      </View>
    </View>
  )
}
