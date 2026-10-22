import { Text, View } from 'react-native'

import { APP_RED } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// There is something behind this that nobody has looked at: messages players have sent in
// and nobody has answered — and how many.
//
// Not `CornerBadge`, which is the flag that says what is behind a tab is *unfinished*
// (ARCADE's SOON, multiplayer's BETA). That is a standing fact about a feature; this is a
// thing to go and do, and it goes away when it is done.
//
// **A count, where it used to be a bare 7px dot.** The dot was drawn on the reasoning that
// a figure at that size reads as a smudge and the screen behind it prints the count. True
// of the size, wrong about the reader: the admin opens the app on a phone to find out
// whether there is anything to do, and *how much* is the half of that the dot could not
// say. So it grew to the size a figure can be read at — the round badge a phone's own
// home screen draws, widening into a pill past one digit.
//
// Positioned in the `style` prop rather than in classes, as `CornerBadge` is: it hangs
// outside its parent on both axes, and the offsets are what keep it clear of the corner.
const SIZE = 16

// Past this the badge would be wider than the word it sits on. The screen behind it has
// the exact figure.
const MAX_SHOWN = 99

export function UnreadDot({ count }: { count: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: -SIZE / 2,
        right: -SIZE / 2 - 4,
        minWidth: SIZE,
        height: SIZE,
        paddingHorizontal: 4,
        borderRadius: SIZE / 2,
        backgroundColor: APP_RED,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text selectable={false} className={cn(TYPE.labelSm, 'text-white')}>
        {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
      </Text>
    </View>
  )
}
