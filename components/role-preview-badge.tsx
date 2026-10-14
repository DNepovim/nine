import { Trans } from '@lingui/react/macro'
import { Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TrackedPressable } from '@/components/tracked-pressable'
import { LAYER } from '@/constants/layers'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// How far off the safe area the badge sits. Small: this is a corner marker, and the
// corner is the point.
//
// Measured from the inset rather than from the viewport, the way arcade and the
// multiplayer game measure their own top padding — nothing above this component pads for
// a notch, so a flat offset would put the badge under one. The corner it lands in is
// empty on every screen that pads its content down from the top; the exception is the
// run top bar, whose left slot holds the run's name, and a live run is not what anybody
// opens a preview to look at.
const INSET = 6

// Which role the app is currently being drawn as, and the way back out of it.
//
// Pinned to the top-left corner over everything — see `LAYER.rolePreview`. A preview
// takes away the ADMIN link that started it, which is what previewing a role without it
// means, so this badge is the only way back: it is drawn on every screen, over dialogs
// as well, and pressing it anywhere ends the preview.
//
// Filled rather than outlined, and never dimmed. A marker saying the app is lying to you
// about who you are is not chrome to be tucked away — it has to be the one thing on the
// screen that was obviously added.
export function RolePreviewBadge({
  // The role's label, or null for an ordinary player with no role at all.
  label,
  onExit,
}: {
  label: string | null
  onExit: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <TrackedPressable
      id="shared.preview_exit"
      onPress={onExit}
      // Generous, because the badge is small and it is the escape hatch.
      hitSlop={10}
      className="absolute left-3 flex-row items-center rounded-lg bg-strong px-2 py-1"
      style={{ top: insets.top + INSET, zIndex: LAYER.rolePreview }}
    >
      <Text selectable={false} className={cn(TYPE.rowLabel, 'text-on-strong')}>
        {/* The word, then the role, then the way out. The label is a row in `roles` and
            cannot carry a message id, so it is printed as it was typed — which is also
            how it reads on the tab the preview was started from. */}
        <Trans>PREVIEW</Trans>
        {': '}
        {label ?? <Trans>NO ROLE</Trans>}
        {'  ✕'}
      </Text>
    </TrackedPressable>
  )
}
