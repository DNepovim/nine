import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What a render crash leaves on screen instead of a blank page. Deliberately built from
// nothing but tokens and primitives: the boundary that mounts this may be standing in
// for the tree the theme provider lives in, so it cannot lean on any context.
export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-8">
      <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-3 text-primary')}>
        <Trans>SOMETHING BROKE</Trans>
      </Text>
      <Text selectable={false} className={cn(TYPE.proseSm, 'mb-8 text-center text-dim')}>
        <Trans>
          Not your fault. The error has been reported — try again, and if it keeps
          happening, reload the page.
        </Trans>
      </Text>
      <PrimaryButton
        id="crash.try_again"
        onPress={onRetry}
        className="px-12"
        label={<Trans>TRY AGAIN</Trans>}
      />
    </View>
  )
}
