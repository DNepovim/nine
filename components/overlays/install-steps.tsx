import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'

import { InstallStep } from '@/components/overlays/install-step'
import { APP_VIOLET } from '@/constants/colors'

const GLYPH = 18

// iOS has no install API, so this is the whole iOS half of the feature: the two
// taps a player makes for themselves. Isolated in its own file because it
// describes someone else's UI, and someone else's UI changes.
//
// Only the first step varies — every iOS browser ends at the same share sheet,
// they just keep the Share button in different places, so the caller supplies
// that line and this owns the rest.
export function InstallSteps({ stepOne }: { stepOne: string }) {
  return (
    <View className="mt-4 gap-2">
      <InstallStep step={1} label={stepOne}>
        {/* Ionicons' share-outline is the iOS share glyph. */}
        <Ionicons name="share-outline" size={GLYPH} color={APP_VIOLET} />
      </InstallStep>

      <InstallStep step={2} label="Choose Add to Home Screen">
        {/* Safari's square-plus, which Ionicons has no equivalent of — so the
            square is a border and the plus sits inside it. */}
        <View
          className="items-center justify-center rounded-[5px] border border-muted"
          style={{ width: GLYPH, height: GLYPH }}
        >
          <Ionicons name="add" size={12} color={APP_VIOLET} />
        </View>
      </InstallStep>
    </View>
  )
}
