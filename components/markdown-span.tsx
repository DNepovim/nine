import { Linking, Text } from 'react-native'

import { cn } from '@/lib/cn'
import type { Inline } from '@/lib/markdown'

// One inline run. Nested <Text> inherits the parent's style on both native and
// web, so emphasis composes without re-declaring the base type.
export function MarkdownSpan({ span, accent }: { span: Inline; accent: string }) {
  const isLink = span.href !== undefined
  return (
    <Text
      selectable={false}
      onPress={
        isLink && span.href !== undefined
          ? () => {
              void Linking.openURL(span.href ?? '')
            }
          : undefined
      }
      className={cn(
        span.bold && 'font-black',
        span.italic && 'italic',
        span.code && 'bg-card',
        isLink && 'underline',
      )}
      style={isLink ? { color: accent } : undefined}
    >
      {span.text}
    </Text>
  )
}
