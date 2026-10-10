import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

import { PILL_INSET, ProfilePill, ProfilePillFloat } from './profile-pill'

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
//
// Centred in the card with the pencil floating beside it, exactly as the name above is
// drawn — the two lines are a pair and are read as one block, so a motto centred on
// different middle from the name would read as a mistake rather than as a choice.
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
      <View className="items-center">
        <ProfilePill
          id="profile.add_motto"
          label={<Trans>ADD MOTTO</Trans>}
          onPress={onEdit}
        />
      </View>
    )
  }

  return (
    <View className="justify-center">
      <Text
        selectable={false}
        className={cn(TYPE.proseSm, PILL_INSET, 'text-center text-dim')}
      >
        {motto}
      </Text>
      {editable && (
        <ProfilePillFloat>
          <ProfilePill id="profile.edit_motto" onPress={onEdit} />
        </ProfilePillFloat>
      )}
    </View>
  )
}
