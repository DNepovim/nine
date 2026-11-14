import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { darkGradientOf } from '@/modes'

// The offer to stop reading and play, straight under the contents list. It wears
// Trainee's CTA gradient because that is the board it lands on, and it says what the
// tutorial takes off that board instead of repeating what the label already says.
//
// A row rather than the centred block it used to be: at the top of a page it has to
// hold its own against the title above it, so it takes the full width, puts the mark
// of a run on the left and the arrow out of the page on the right, and carries its own
// caption inside rather than hanging one underneath.
export function HowToPlayTryIt({ onPress }: { onPress: () => void }) {
  return (
    <TrackedPressable
      id="how_to_play.try_it"
      onPress={onPress}
      className="mt-5 overflow-hidden rounded-2xl"
    >
      <LinearGradient
        colors={[...darkGradientOf('trainee')]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="flex-row items-center gap-3 px-4 py-3.5"
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
        >
          <Ionicons name="play" size={15} color="#FFFFFF" />
        </View>
        <View className="flex-1">
          <Text selectable={false} className={cn(TYPE.button, 'text-on-strong')}>
            <Trans>TRY IT</Trans>
          </Text>
          {/* The one caption that cannot be text-dim: it sits on the gradient, not on
              the page, so it takes a thinned white instead of the page's grey. */}
          <Text
            selectable={false}
            className={cn(TYPE.labelSm, 'mt-1')}
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <Trans>ONE TARGET · NO CLOCK · NO LIVES</Trans>
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
      </LinearGradient>
    </TrackedPressable>
  )
}
