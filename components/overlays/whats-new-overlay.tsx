import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { NewsCard } from '@/components/overlays/news-card'
import { PageDots } from '@/components/page-dots'
import { DIM_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { useViewport } from '@/hooks/use-viewport'
import { cn } from '@/lib/cn'
import type { NewsItem } from '@/types/news'

// A dialog, not a screen: as tall as its content, capped so a long announcement
// scrolls rather than running off the display.
export function WhatsNewOverlay({
  items,
  onDismiss,
}: {
  items: readonly NewsItem[]
  onDismiss: () => void
}) {
  const [index, setIndex] = useState(0)
  const { height } = useViewport()
  const { colorScheme } = useTheme()

  const item = items[index]
  if (item === undefined) return null

  const isFirst = index === 0
  const isLast = index === items.length - 1

  return (
    <ModalCard
      title={<Trans>WHAT’S NEW</Trans>}
      onDismiss={onDismiss}
      maxHeight={height * 0.85}
    >
      {(close) => (
        <>
          {/* flexShrink lets a long body scroll while a short one stays its own
                height — without it the ScrollView would claim the whole cap. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingVertical: 8 }}
          >
            <NewsCard item={item} />
          </ScrollView>

          {items.length > 1 && (
            <View className="mt-3">
              <PageDots
                total={items.length}
                current={index}
                color={item.accent}
                onSelect={setIndex}
              />
            </View>
          )}

          <View className="mt-3 flex-row items-center justify-center gap-3">
            {items.length > 1 && (
              <Pressable
                onPress={() => {
                  setIndex((current) => current - 1)
                }}
                disabled={isFirst}
                className={cn(
                  'flex-row items-center gap-1 rounded-2xl bg-card px-4 py-3.5',
                  isFirst && 'opacity-[0.3]',
                )}
              >
                <Ionicons name="arrow-back" size={14} color={DIM_INK[colorScheme]} />
                <Text
                  selectable={false}
                  className="font-mono text-[12px] font-black tracking-[1.5px] text-dim"
                >
                  <Trans>BACK</Trans>
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                if (isLast) close()
                else setIndex((current) => current + 1)
              }}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-strong px-6 py-3.5"
            >
              <Text
                selectable={false}
                className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
              >
                {isLast ? 'LET’S GO' : 'NEXT'}
              </Text>
              <Ionicons
                name={isLast ? 'play' : 'arrow-forward'}
                size={14}
                color="#d8d2f4"
              />
            </Pressable>
          </View>
        </>
      )}
    </ModalCard>
  )
}
