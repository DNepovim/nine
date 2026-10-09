import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

const ICON = 11

// The line under the nickname: what the player says about themselves, and — on their own
// profile — the way in to changing it.
//
// Sentence case and narrow tracking, unlike every other label on the modal. Wide tracking
// on caps is the app's voice for things it is *telling* you; this is the one line on the
// screen the app did not write, and shouting it in the house style would make a player's
// own words read as another heading.
//
// Drawn in dim rather than in a colour of its own. The nickname above it is the loud
// thing, and a motto that competed with it would turn the top of the modal into two
// headlines.
export function ProfileMotto({
  motto,
  // Only ever true on the profile of the player holding the phone. A motto is public to
  // read and private to write, and this is the whole of that distinction on screen.
  editable,
  onEdit,
}: {
  motto: string | null
  editable: boolean
  onEdit: () => void
}) {
  // Somebody else's profile with nothing written on it. An empty line under a stranger's
  // name reads as something missing rather than as something they never wrote.
  if (motto === null && !editable) return null

  if (motto === null) {
    return (
      <TrackedPressable
        id="profile.add_motto"
        onPress={onEdit}
        hitSlop={8}
        className="flex-row items-center gap-1 self-center rounded-full bg-card px-3 py-1"
      >
        <Ionicons name="add" size={ICON} color={DIM_INK} />
        <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
          <Trans>ADD MOTTO</Trans>
        </Text>
      </TrackedPressable>
    )
  }

  return (
    <View className="flex-row items-center justify-center gap-1.5 px-2">
      {/* `shrink` so the pencil is never pushed off the card by a long motto — the text
          wraps to a second line instead, which fifty characters can do on a narrow
          phone. */}
      <Text
        selectable={false}
        className={cn(TYPE.proseSm, 'shrink text-center text-dim')}
      >
        {motto}
      </Text>
      {editable && (
        <TrackedPressable id="profile.edit_motto" onPress={onEdit} hitSlop={10}>
          <Ionicons name="create-outline" size={ICON} color={DIM_INK} />
        </TrackedPressable>
      )}
    </View>
  )
}
