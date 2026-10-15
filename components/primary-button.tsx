import type { ReactNode } from 'react'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'
import { Text } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The thing a screen is asking you to press.
//
// One component because the same button was spelled five ways across nineteen files: two
// paddings (`py-3.5` and `py-4`), three radii (`rounded-lg`, `rounded-xl`, `rounded-2xl`),
// and an icon variant that re-derived the row for itself. Nothing chose those numbers —
// each was typed next to whatever was already on screen, which is the typography story in
// a different medium.
//
// The padding is settled at the dialogs' `py-3.5`. The screen buttons that used to sit at
// `py-4` tighten by two pixels, which is below the threshold anyone reads as a change but
// above the threshold that makes two buttons look like two decisions.
//
// Always a `TrackedPressable` rather than a `Pressable`, because every one of the nineteen
// already was: a button this loud is one the funnel wants to know about. The `id` comes
// from `constants/buttons.ts` and is not free text.
// What each tone is made of. The fill and its ink in one place, so the pair can never be
// set half way — `text-on-strong` on a transparent box is the bug this table prevents.
const TONE = {
  strong: { box: 'bg-strong', ink: 'text-on-strong' },
  quiet: { box: 'border border-muted', ink: 'text-dim' },
  danger: { box: 'border border-red-500/40', ink: 'text-red-500' },
} as const

export function PrimaryButton({
  id,
  onPress,
  label,
  icon,
  variant = 'full',
  tone = 'strong',
  disabled = false,
  hitSlop,
  className,
  style,
}: {
  id: ButtonId
  onPress: PressableProps['onPress']
  // A node rather than a string: nearly every caller has a `<Trans>` to hand.
  label: ReactNode
  // Drawn after the label, which puts the button in a row and gives it side padding.
  // For the one case where the CTA names an action with a mark — install, open, share.
  icon?: ReactNode
  // `compact` is the button that sits *inside* a row rather than under one: the admin
  // screens' FIND and NEW, where a full-width CTA would outweigh the field beside it. A
  // smaller radius and the smaller label, because it is competing with a field for the
  // eye rather than ending a screen.
  variant?: 'full' | 'compact'
  // How loud it is. `strong` is the filled CTA and the default — the thing the screen is
  // asking you to press. The other two are the same button at the same size saying
  // something else about itself, and both were asked for by the **admin screens**, which
  // had hand-rolled a bordered pressable apiece: `quiet` is RESET TO ROLE DEFAULTS, an
  // action that undoes rather than commits, and `danger` is DELETE ROLE, which is the one
  // irreversible press in the app. Those two were the only outlined full-width buttons
  // anywhere, at two radii and a padding of their own.
  //
  // A tone and not a colour: a caller choosing a hue here is the drift this component
  // exists to stop. Red is the app's refusal ink, which every error message on these
  // screens already wears.
  tone?: 'strong' | 'quiet' | 'danger'
  disabled?: boolean
  // Asked for by the dev screen's RUN, which is `compact` and sits in a tight row of
  // challenge rows — small enough that the touch target wants to be bigger than the paint.
  hitSlop?: number
  // Placement only — `mt-*`, `self-center`, an explicit width. Never the shape: a caller
  // passing `rounded-xl` or `py-2` here is the drift this component exists to stop.
  className?: string
  style?: StyleProp<ViewStyle>
}) {
  const compact = variant === 'compact'
  return (
    <TrackedPressable
      id={id}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      className={cn(
        'items-center justify-center',
        // The two quiet tones are an outline on the screen's own ground rather than a
        // fill, which is the whole of the difference: same shape, same height, same
        // label, and it does not read as the thing to press.
        TONE[tone].box,
        compact ? 'rounded-lg px-4' : 'rounded-2xl py-3.5',
        // The row only when there is a second thing in it. A `flex-row` around a lone
        // label would centre it the same way and then surprise the next person who adds
        // an icon to a button that already looked like it had one.
        icon !== undefined && 'flex-row gap-2 px-6',
        disabled && 'opacity-40',
        className,
      )}
      style={style}
    >
      <Text
        selectable={false}
        className={cn(compact ? TYPE.buttonSm : TYPE.button, TONE[tone].ink)}
      >
        {label}
      </Text>
      {icon}
    </TrackedPressable>
  )
}
