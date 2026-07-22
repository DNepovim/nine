import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

import {
  ARCADE_TEASER,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
  MODE_ORDER,
  MODES,
  type Mode,
} from '@/machines/game'

export function ModeSelector({
  focused,
  onSelect,
}: {
  focused: Mode | 'arcade'
  onSelect: (m: Mode | 'arcade') => void
}) {
  return (
    <View className="mb-3 items-center">
      <Text
        selectable={false}
        className="mb-2 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        GAME MODES
      </Text>
      <View className="flex-row justify-center">
        {([...MODE_ORDER, 'arcade'] as (Mode | 'arcade')[]).map((m) => {
          const isActive = m === focused
          if (m === 'arcade') {
            return (
              <Pressable
                key="arcade"
                onPress={() => {
                  onSelect('arcade')
                }}
                className="rounded-xl px-3.5 py-2"
                style={
                  isActive
                    ? { backgroundColor: ARCADE_TEASER.color }
                    : { backgroundColor: 'transparent', opacity: 0.6 }
                }
              >
                <Text
                  selectable={false}
                  className="font-mono text-[11px] font-black tracking-[1.5px]"
                  style={{ color: isActive ? '#FFFFFF' : ARCADE_TEASER.color }}
                >
                  {ARCADE_TEASER.label}
                </Text>
                {/* SOON badge — top-right corner */}
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: '#E5534B',
                    borderRadius: 5,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    selectable={false}
                    style={{
                      color: '#FFFFFF',
                      fontSize: 7,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    {ARCADE_TEASER.tag}
                  </Text>
                </View>
              </Pressable>
            )
          }
          return (
            <Pressable
              key={m}
              onPress={() => {
                onSelect(m)
              }}
              className="overflow-hidden rounded-xl"
            >
              {isActive ? (
                <LinearGradient
                  colors={[...MODE_GRADIENT[m]]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="px-3.5 py-2"
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[11px] font-black tracking-[1.5px] text-white"
                  >
                    {MODES[m].label}
                  </Text>
                </LinearGradient>
              ) : (
                <View className="px-3.5 py-2">
                  <Text
                    selectable={false}
                    className="font-mono text-[11px] font-black tracking-[1.5px]"
                    style={{ color: MODE_GRADIENT[m][0] }}
                  >
                    {MODES[m].label}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
      <Text
        selectable={false}
        className="mt-3 px-8 text-center font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
      >
        {focused === 'arcade' ? ARCADE_TEASER.description : MODE_DESCRIPTIONS[focused]}
      </Text>
    </View>
  )
}
