import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

import { MarkdownText } from '@/components/markdown-text'
import { formatReleaseDate } from '@/lib/format-date'
import type { Release } from '@/types/news'

// One dated release in the archive: the day as a heading, then each of its
// announcements beneath.
export function NewsRelease({ release }: { release: Release }) {
  return (
    <View className="mb-8">
      <Text
        selectable={false}
        className="mb-3 font-mono text-[10px] font-black tracking-[2px] text-dim"
      >
        {formatReleaseDate(release.date).toUpperCase()}
      </Text>

      {release.items.map((item) => (
        <View key={item.id} className="mb-4 rounded-2xl bg-card p-4">
          <View className="flex-row items-center gap-2.5">
            <View
              className="h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${item.accent}26` }}
            >
              <Ionicons name={item.icon} size={16} color={item.accent} />
            </View>
            <Text
              selectable={false}
              className="flex-1 font-mono text-[13px] font-black tracking-[1.5px]"
              style={{ color: item.accent }}
            >
              {item.title.toUpperCase()}
            </Text>
          </View>
          <MarkdownText source={item.body} accent={item.accent} />
        </View>
      ))}
    </View>
  )
}
