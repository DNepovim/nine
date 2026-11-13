import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK, PRIMARY_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { EMAIL_PROBLEM_LINES, type EmailProblem } from '@/lib/account-email'
import { cn } from '@/lib/cn'

// How long the line under the frames takes to arrive. Short: it is a correction, and a
// correction that makes an entrance is a card drawing attention to the player's mistake.
const FADE_MS = 160

// How far a link fades once it cannot be pressed. The same weight the card's own buttons
// dim by, so a dead link and a dead button read as the same state.
export const DISABLED_OPACITY = 0.5

// One band under the frames, holding whichever small line belongs there and keeping its
// height whether it holds one or none.
//
// That fixed height is the whole point of it. All four come and go while the player is
// looking at the card — a code lands, a code is refused, a clipboard is offered, a field
// wants emptying — and a card that grew and shrank by a line each time would move the
// buttons under the finger on its way to the press. So the band is `h-4` and everything in
// it is absolute: a line that runs long draws past its space instead of making more.
//
// The order is the order of what the player needs to know. A code that was taken beats a
// code that was refused, which beats either offer — and the two offers are one slot
// because they are one act, putting the field into the state the player wants.
export function EmailFieldNote({
  done,
  problem,
  typed,
  offerPaste,
  busy,
  onClear,
  onPaste,
}: {
  done: boolean
  problem: EmailProblem | null
  typed: boolean
  offerPaste: boolean
  busy: boolean
  onClear: () => void
  onPaste: () => void
}) {
  const { t } = useLingui()

  return (
    <View className="relative mt-2 h-4">
      {done ? (
        // Primary ink rather than the green that would be the obvious choice: green in
        // this app means an achievement and means nothing else, and a confirmed address
        // is not one. See the design guide's palette table.
        <Animated.View
          entering={FadeInDown.duration(FADE_MS)}
          className="absolute inset-x-0 top-0 flex-row items-center justify-center gap-1"
        >
          <Ionicons name="checkmark-circle" size={10} color={PRIMARY_INK} />
          <Text selectable={false} className={cn(TYPE.hint, 'text-center text-primary')}>
            <Trans>Address confirmed.</Trans>
          </Text>
        </Animated.View>
      ) : problem !== null ? (
        // Down rather than in: it belongs to the frames above it and arrives from
        // them, the way a thing being said about something arrives after it.
        <Animated.View
          entering={FadeInDown.duration(FADE_MS)}
          className="absolute inset-x-0 top-0"
        >
          <Text selectable={false} className={cn(TYPE.hint, 'text-center text-red-500')}>
            {t(EMAIL_PROBLEM_LINES[problem])}
          </Text>
        </Animated.View>
      ) : typed ? (
        /* The field has something in it, so the useful offer is the opposite one. It
       takes the place of the paste link rather than sitting beside it: they are
       the same act — put the field into the state the player wants — and only one
       of them is ever the one they mean.

       It is also the way out of a code that is being erased too slowly, or a
       half-typed one the player would rather start again than back over. */
        <View className="absolute inset-x-0 top-0 flex-row justify-center">
          <TrackedPressable
            id="email_code.clear"
            onPress={onClear}
            hitSlop={10}
            disabled={busy}
            style={{ opacity: busy ? DISABLED_OPACITY : 1 }}
          >
            <View className="flex-row items-center gap-1">
              <Ionicons name="close-circle-outline" size={10} color={DIM_INK} />
              <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                <Trans>CLEAR</Trans>
              </Text>
            </View>
          </TrackedPressable>
        </View>
      ) : (
        offerPaste && (
          /* Offered rather than done, and this is the one place the clipboard cannot
         be asked about first. Deciding whether to show this by its *contents*
         would mean reading it on every open: on iOS that raises "Allow Paste?"
         over a card the player has not touched, and on the web it is not allowed
         at all outside a gesture — `navigator.clipboard.read()` is what every one
         of expo-clipboard's reads goes through there, including the one that only
         claims to check. So the offer stands whenever the field is empty, and the
         only read happens under the finger that asked for it.

         It is there on coming back from the mail app with a code copied, which is
         the one moment it is the fastest thing on the card. */
          <View className="absolute inset-x-0 top-0 flex-row justify-center">
            <TrackedPressable id="email_code.paste" onPress={onPaste} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="clipboard-outline" size={10} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>PASTE FROM CLIPBOARD</Trans>
                </Text>
              </View>
            </TrackedPressable>
          </View>
        )
      )}
    </View>
  )
}
