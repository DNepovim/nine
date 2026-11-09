import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { GradientText } from '@/components/gradient-text'
import { LiveDot } from '@/components/overlays/live-dot'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { dayAndMonth } from '@/lib/format-date'
import { gradientOf, labelOf, modeById } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// The cells a table of challenges is drawn in, shared by the two screens that list them:
// the planner (`admin-sessions.tsx`), a row per session, and the challenges lab
// (`dev-overlay.tsx`), a row per challenge. One set so the two tables read as one.

// The date a session opens, as a block: the day as a figure with its month under it.
//
// The whole range used to be spelled out on one line — `15 Oct 12:00 → 16 Oct 12:00`,
// which is four facts in a row where a reader scanning the list wants one. The day it
// starts is what a session is filed under; how long it runs is said once, under the name,
// by `formatWindowLength`; and the exact minutes are on the form behind the row, which is
// where somebody who cares about them is going.
//
// A live session wears `LiveDot` to the left of its date — the one mark on the planner
// that says a row is in front of players now, since the status chip it used to sit in
// is gone. Every other row holds the dot's lane empty, so the dates stay in one column.
export function WhenBlock({ at, live = false }: { at: number; live?: boolean }) {
  const { day, month } = dayAndMonth(at)
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="w-[5px]">{live && <LiveDot />}</View>
      <View className="w-9 items-center">
        <Text selectable={false} className={cn(TYPE.figureLarge, 'text-primary')}>
          {day}
        </Text>
        <Text selectable={false} className={cn(TYPE.caption, '-mt-0.5 text-dim')}>
          {month}
        </Text>
      </View>
    </View>
  )
}

// The challenge's own name in the challenge's own colours, which is the one place on
// these screens a hue carries a word. A list of sessions reads as a list of dates
// otherwise — and a challenge *is* its colour on the intro, on its card and on the screen
// a run of it ends on, so it is what the row is recognised by here too.
//
// Through `challengeInk` rather than the raw pair: the second stop is the bright end of
// the arc and measures about 1.7:1 on this surface, so a name lerped onto it would fade
// out as it was read. See the note at that function — the same bargain `NAME_INK` strikes
// for a nickname.
//
// A challenge this build has never heard of is drawn as what it is — the raw id and NOT
// IN THIS BUILD — because `labelOf` would answer GAME for it, and a list of sessions all
// called GAME is worse than useless.
export function ChallengeTitle({
  modeId,
  className = TYPE.cardTitleSm,
  wrap = false,
}: {
  modeId: string
  // The type role, for a caller that draws the name smaller than a list row does — the
  // session form's challenge dropdown, whose rows and closed field are a button's height.
  className?: string
  // Wrap a long name rather than cut it. The gallery's tiles asked for it: a tile is half
  // a phone wide, and a cut name is a name nobody can read.
  wrap?: boolean
}) {
  const { t } = useLingui()
  if (modeById(modeId) === null) {
    return (
      <>
        <Text selectable={false} numberOfLines={1} className={cn(className, 'text-dim')}>
          {modeId}
        </Text>
        <Text selectable={false} className={cn(TYPE.hint, 'text-red-500')}>
          ⚠ <Trans>NOT IN THIS BUILD</Trans>
        </Text>
      </>
    )
  }
  return (
    <GradientText
      text={t(labelOf(modeId))}
      from={challengeInk(gradientOf(modeId)[0])}
      to={challengeInk(gradientOf(modeId)[1])}
      numberOfLines={wrap ? undefined : 1}
      className={className}
    />
  )
}
