import { useMemo } from 'react'
import { View } from 'react-native'

import { MarkdownBlock } from '@/components/markdown-block'
import { parseMarkdown } from '@/lib/markdown'

// Renders an announcement's markdown body. Parsing is memoised because these
// strings are constants — re-lexing on every render would be pure waste.
export function MarkdownText({ source, accent }: { source: string; accent: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source])
  return (
    <View>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} block={block} accent={accent} />
      ))}
    </View>
  )
}
