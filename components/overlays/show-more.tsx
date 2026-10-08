import { Plural, Trans } from '@lingui/react/macro'
import { Text } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The way into the rest of a list that opened on a slice of itself, and back out of it.
// Drawn inside the card the rows are on rather than under it, because it belongs to that
// list and not to the dialog — and in dim caps rather than as a button, since nothing
// happens here but more of what is already on screen.
//
// Shared by the two lists that open short: the medals dialog's week of losses and the
// profile's stretches held. Both are a column of rows read newest first, and both were
// drawing this by hand; one component is what keeps the two from drifting apart.
export function ShowMore({
  id,
  hidden,
  expanded,
  onToggle,
}: {
  // Where the tap is counted. Each list names its own, so one dialog's taps never land in
  // the other's funnel.
  id: ButtonId
  // How many rows the slice is holding back. Read only while the list is short — once it
  // is open the link says SHOW LESS and has nothing to count.
  hidden: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <TrackedPressable id={id} onPress={onToggle} className="items-center py-2">
      <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
        {expanded ? (
          <Trans>SHOW LESS</Trans>
        ) : (
          <Plural value={hidden} one="SHOW # MORE" other="SHOW # MORE" />
        )}
      </Text>
    </TrackedPressable>
  )
}
