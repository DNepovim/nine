import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { DARK_MODE_GRADIENT } from '@/machines/game'
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
        <Pressable
          onPress={onContinue}
          className="w-56 overflow-hidden rounded-2xl"
          style={shadow}
        >
          <LinearGradient
            colors={[...DARK_MODE_GRADIENT[mode]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="items-center py-4"
          >
            <Text
              selectable={false}
              className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
            >
              CONTINUE
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={onLeave} hitSlop={10}>
          <Text
            selectable={false}
            className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
          >
            LEAVE GAME
          </Text>
        </Pressable>
      </View>
    </Screen>
  )
}
