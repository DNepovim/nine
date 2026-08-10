import { Text, View } from 'react-native'

import { MarkdownSpan } from '@/components/markdown-span'
import type { Block } from '@/lib/markdown'

// marked reports depths 1–6; anything past three renders at the smallest size.
const HEADING_SIZE: Record<number, string | undefined> = {
  1: 'text-[16px]',
  2: 'text-[14px]',
  3: 'text-[13px]',
}

const headingClass = (level: number) => HEADING_SIZE[level] ?? 'text-[13px]'

// One block of a parsed announcement. Type follows the app's mono voice rather
// than generic markdown defaults.
export function MarkdownBlock({ block, accent }: { block: Block; accent: string }) {
  if (block.type === 'rule') {
    return <View className="my-3 h-px w-full bg-muted" />
  }

  if (block.type === 'heading') {
    return (
      <Text
        selectable={false}
        className={`mt-3 font-mono font-black tracking-[1.5px] text-primary ${headingClass(block.level)}`}
      >
        {block.spans.map((span, i) => (
          <MarkdownSpan key={i} span={span} accent={accent} />
        ))}
      </Text>
    )
  }

  if (block.type === 'list') {
    return (
      <View className="mt-2 gap-1.5">
        {block.items.map((spans, index) => (
          <View key={index} className="flex-row gap-2.5">
            <Text
              selectable={false}
              className="font-mono text-[12px] font-bold leading-[19px]"
              style={{ color: accent }}
            >
              {block.ordered ? `${index + 1}.` : '•'}
            </Text>
            <Text
              selectable={false}
              className="flex-1 font-mono text-[12px] font-medium leading-[19px] text-primary"
            >
              {spans.map((span, i) => (
                <MarkdownSpan key={i} span={span} accent={accent} />
              ))}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <Text
      selectable={false}
      className="mt-2 font-mono text-[12px] font-medium leading-[19px] text-dim"
    >
      {block.spans.map((span, i) => (
        <MarkdownSpan key={i} span={span} accent={accent} />
      ))}
    </Text>
  )
}
