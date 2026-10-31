import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { View } from 'react-native'

import { InstallStep } from '@/components/overlays/install-step'
import { APP_VIOLET } from '@/constants/colors'

const GLYPH = 18

// Most mobile browsers have no install API, so this is the whole manual
// half of the feature: the two taps a player makes for themselves. Isolated in
// its own file because it describes someone else's UI, and someone else's UI
// changes.
//
// Only the first step varies — every one of these browsers ends at an item called
// Add to Home Screen, they just keep the way to it in different places (Share on
// iOS, a menu elsewhere), so the caller supplies that line and its glyph and
// this owns the rest.
export function InstallSteps({
  stepOne,
  glyph,
}: {
  stepOne: string
  glyph: keyof typeof Ionicons.glyphMap
}) {
  return (
    <View className="mt-4 gap-2">
      <InstallStep step={1} label={stepOne}>
        <Ionicons name={glyph} size={GLYPH} color={APP_VIOLET} />
      </InstallStep>

      <InstallStep step={2} label={<Trans>Choose Add to Home Screen</Trans>}>
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
