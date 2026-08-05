import { AntDesign } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { GuideBullet } from '@/components/guide/guide-bullet'
import { MODE_DESCRIPTIONS, MODE_GRADIENT, MODES, type Mode } from '@/machines/game'

export function ModeCard({ mode, facts }: { mode: Mode; facts: string[] }) {
  const [from, to] = MODE_GRADIENT[mode]
  const [line1, line2] = MODE_DESCRIPTIONS[mode].split('\n')
  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-card">
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="flex-row items-center justify-between px-4 py-2.5"
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          {MODES[mode].label}
        </Text>
        <View className="flex-row items-center gap-1">
          {MODES[mode].lives === Number.POSITIVE_INFINITY ? (
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1px] text-on-strong"
            >
              ∞ LIVES
            </Text>
          ) : (
            Array.from({ length: MODES[mode].lives }).map((_, i) => (
              <AntDesign key={i} name="heart" size={11} color="#FFFFFF" />
            ))
          )}
        </View>
      </LinearGradient>
      <View className="px-4 pb-3 pt-2.5">
        <Text
          selectable={false}
          className="mb-1 font-mono text-[11px] font-bold italic tracking-[0.5px] text-dim"
        >
          {line1?.trim()} {line2?.trim()}
        </Text>
        {facts.map((f) => (
          <GuideBullet key={f} color={from}>
            {f}
          </GuideBullet>
        ))}
      </View>
    </View>
  )
}
