import { Pressable, type PressableProps } from 'react-native'

import { screenOf, type ButtonId } from '@/constants/buttons'
import { track } from '@/lib/analytics'

// A `Pressable` that says it was pressed.
//
// This exists instead of PostHog's autocapture, which would get the same coverage from
// one config line. Autocapture patches touch handling across the whole app, and the dial
// is the most touch-sensitive thing in Nine — a dropped frame on a seven-second target
// is a worse bug than a missing funnel. One `track` call on a button that was actually
// pressed costs nothing by comparison, and it only ever runs on the buttons named in
// `constants/buttons.ts` rather than on every touch the app sees.
//
// Everything else is `Pressable` verbatim: props are forwarded untouched, `children` as
// a render prop included, so swapping the tag changes nothing a player can see.
export type TrackedPressableProps = PressableProps & {
  // What was pressed, from the one list. Not free text — see `constants/buttons.ts`.
  id: ButtonId
}

export function TrackedPressable({ id, onPress, ...rest }: TrackedPressableProps) {
  return (
    <Pressable
      {...rest}
      // Null and undefined are passed straight back through rather than wrapped. A
      // `Pressable` with no handler is a button that currently does nothing — the pause
      // button between runs is exactly this — and reporting a press of it would invent
      // taps the player cannot have made anything of.
      onPress={
        onPress == null
          ? onPress
          : (event) => {
              track('button_pressed', { id, screen: screenOf(id) })
              onPress(event)
            }
      }
    />
  )
}
