import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { IoniconName } from '@/lib/how-to-play-sections'
import { descriptionOf, gradientOf, labelOf, type Mode } from '@/modes'

// What each mode asks of you, in one mark: Trainee teaches, Accuracy is about landing
// on the spot, Speed is about the clock. They sit where the hearts used to — a life
// count says nothing about a mode that a card full of facts doesn't already say, and
// multiplayer runs these same two modes with no lives at all.
const MODE_ICONS = {
  trainee: 'school',
  accuracy: 'locate',
  speed: 'flash',
} as const satisfies Record<Mode, IoniconName>

export function HowToPlayModeCard({ mode, facts }: { mode: Mode; facts: string[] }) {
  const { t } = useLingui()
  const [from, to] = gradientOf(mode)
  const [line1, line2] = t(descriptionOf(mode)).split('\n')
  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-card">
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="flex-row items-center justify-between px-4 py-2.5"
      >
        <Text selectable={false} className={cn(TYPE.button, 'text-on-strong')}>
          {t(labelOf(mode))}
        </Text>
        <Ionicons name={MODE_ICONS[mode]} size={15} color="#FFFFFF" />
      </LinearGradient>
      <View className="px-4 pb-3 pt-2.5">
        <Text selectable={false} className={cn(TYPE.figure, 'mb-1 italic text-dim')}>
          {line1?.trim()} {line2?.trim()}
        </Text>
        {facts.map((f) => (
          <HowToPlayBullet key={f} color={from}>
            {f}
          </HowToPlayBullet>
        ))}
      </View>
    </View>
  )
}
