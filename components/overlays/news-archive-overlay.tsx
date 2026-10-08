import { Trans } from '@lingui/react/macro'
import { FlatList, Text } from 'react-native'

import { NewsRelease } from '@/components/overlays/news-release'
import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { RELEASES } from '@/constants/news'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { Release } from '@/types/news'

const keyOf = (release: Release) => release.date

// Everything ever announced, newest first. FlatList so the list stays cheap as
// releases accumulate — only what's on screen is rendered.
export function NewsArchiveOverlay({ onClose }: { onClose: () => void }) {
  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-1 text-primary')}>
        <Trans>WHAT’S NEW</Trans>
      </Text>
      <Text selectable={false} className={cn(TYPE.label, 'mb-6 text-dim')}>
        <Trans>EVERYTHING THAT’S CHANGED</Trans>
      </Text>

      <FlatList
        data={RELEASES}
        keyExtractor={keyOf}
        renderItem={({ item }) => <NewsRelease release={item} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
            <Trans>Nothing announced yet.</Trans>
          </Text>
        }
      />

      <PrimaryButton
        id="news.done"
        onPress={onClose}
        className="mt-4 self-center"
        style={{ width: 224 }}
        label={<Trans>DONE</Trans>}
      />
    </ScreenLayer>
  )
}
