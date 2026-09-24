import { Trans } from '@lingui/react/macro'
import { FlatList, Pressable, Text } from 'react-native'

import { NewsRelease } from '@/components/overlays/news-release'
import { ScreenLayer } from '@/components/screen'
import { RELEASES } from '@/constants/news'
import type { Release } from '@/types/news'

const keyOf = (release: Release) => release.date

// Everything ever announced, newest first. FlatList so the list stays cheap as
// releases accumulate — only what's on screen is rendered.
export function NewsArchiveOverlay({ onClose }: { onClose: () => void }) {
  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>WHAT’S NEW</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-6 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>EVERYTHING THAT’S CHANGED</Trans>
      </Text>

      <FlatList
        data={RELEASES}
        keyExtractor={keyOf}
        renderItem={({ item }) => <NewsRelease release={item} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text selectable={false} className="font-mono text-[12px] font-medium text-dim">
            <Trans>Nothing announced yet.</Trans>
          </Text>
        }
      />

      <Pressable
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </Pressable>
    </ScreenLayer>
  )
}
