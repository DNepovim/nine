import { View } from 'react-native'

import { APP_RED } from '@/constants/colors'

// There is something behind this that nobody has looked at: a message a player has sent
// in and nobody has answered.
//
// A dot and not a count, and not `CornerBadge` either — which is the flag that says what
// is behind a tab is *unfinished* (ARCADE's SOON, multiplayer's BETA). That is a standing
// fact about a feature; this is a thing to go and do, and it goes away when it is done.
// A number on it would be a figure drawn at 7px and read as a smudge; the screen behind
// it prints the count.
//
// Positioned in the `style` prop rather than in classes, as `CornerBadge` is: it hangs
// outside its parent on both axes, and the offsets are what keep it clear of the corner.
const SIZE = 7

export function UnreadDot() {
  return (
    <View
      style={{
        position: 'absolute',
        top: -3,
        right: -6,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: APP_RED,
      }}
    />
  )
}
