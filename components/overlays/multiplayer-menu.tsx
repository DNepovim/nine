import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { DARK_MULTIPLAYER_GRADIENT } from '@/modes'
import type { MultiMode } from '@/types/multiplayer'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function MultiplayerMenu({
  mode,
  onContinue,
  onLeave,
}: {
  mode: MultiMode
  onContinue: () => void
  onLeave: () => void
}) {
  return (
    <Screen overlay>
      <View className="w-full items-center" style={{ gap: 20 }}>
        <TrackedPressable
          id="multiplayer_menu.continue"
          onPress={onContinue}
          className="w-56 overflow-hidden rounded-2xl"
          style={shadow}
        >
          <LinearGradient
            colors={[...DARK_MULTIPLAYER_GRADIENT[mode]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="items-center py-4"
          >
            <Text selectable={false} className={cn(TYPE.button, 'text-on-strong')}>
              <Trans>CONTINUE</Trans>
            </Text>
          </LinearGradient>
        </TrackedPressable>

        <TrackedPressable id="multiplayer_menu.leave" onPress={onLeave} hitSlop={10}>
          <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim underline')}>
            <Trans>LEAVE GAME</Trans>
          </Text>
        </TrackedPressable>
      </View>
    </Screen>
  )
}
