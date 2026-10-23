import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The three shapes the admin's figures are drawn in: a tile for a number that is its own
// headline, a bar a day for the fortnight, and a meter for one of several magnitudes.
//
// Deliberately three and not a chart library. Everything on that screen is a count, and
// a count has only ever three jobs here — *be read*, *be compared against yesterday*, or
// *be compared against its neighbours* — so these are those three jobs rather than a
// general plotting surface nobody would reuse.
//
// ─── On colour ───────────────────────────────────────────────────────────────
//
// A bar is a **mark**, not a hairline: the reader compares its length and so has to see
// where it ends. That is a higher bar than the 3px accent rules on these screens have to
// clear — `ADMIN_ACCENT`'s amber is about 2:1 on the parchment surface, which is plenty
// for an edge and not enough for a fill — so every bar here takes its colour from the
// caller, and every caller passes an ink rather than a scale stop.
//
// The figures themselves stay in text tokens. A number drawn in its own series colour is
// the commonest way a chart becomes unreadable, and at these sizes it would be
// unreadable twice over.

// How tall the fortnight's plot stands. A fixed height rather than a ratio of the width,
// so a phone and a tablet draw the same chart and the bars only get wider. Short on
// purpose: it is one of six blocks on a screen that is read by scrolling, and fourteen
// bars are compared against each other rather than measured against an axis.
const PLOT_H = 80

// What a day nobody played is drawn as. Never nothing: a zero that collapsed to the
// baseline would close the gap it is there to show, and a fortnight with Tuesday missing
// would read as thirteen days.
const ZERO_H = 2

// A number that is its own headline: how many players, how many runs, how many minutes.
//
// Not a chart, and that is the point — a single magnitude with nothing to compare it
// against is a figure, and drawing one as a one-bar chart is a frame around a word.
export function StatTile({
  label,
  value,
  note,
  onPress,
  className,
}: {
  label: ReactNode
  // Already formatted. A string and not a number, because two of these tiles count
  // minutes and one counts a share, and a tile that did its own formatting would have to
  // know which.
  value: string
  // The line under the figure that says what it is to be read against: what the window
  // before came to, or what the whole is. Left off by a figure that stands alone.
  note?: ReactNode
  // Opens the players the figure is made of. **The analytics screen's top tiles are the
  // callers that asked for this**; a tile without it is a figure and nothing more.
  onPress?: () => void
  className?: string
}) {
  const body = (
    <>
      <Text selectable={false} numberOfLines={1} className={cn(TYPE.caption, 'text-dim')}>
        {label}
      </Text>
      <Text selectable={false} className={cn(TYPE.figureLarge, 'text-primary')}>
        {value}
      </Text>
      {note !== undefined && (
        <Text selectable={false} numberOfLines={1} className={cn(TYPE.hint, 'text-dim')}>
          {note}
        </Text>
      )}
    </>
  )
  const box = cn('flex-1 rounded-xl bg-card px-2 py-1.5', className)
  if (onPress === undefined) return <View className={box}>{body}</View>
  return (
    <TrackedPressable id="admin.stat_tile" onPress={onPress} className={box}>
      {body}
    </TrackedPressable>
  )
}

// A bar a day over a fortnight: the one thing on the screen that is about change rather
// than about a total.
//
// One series, so no legend — the heading above it names what the bars are, and a box
// repeating that would be furniture. One label at each end of the axis and one on the
// tallest bar: a number over every bar is fourteen figures nobody reads, and the two that
// are worth reading are *when* and *how high it got*.
export function DayBars({
  days,
  color,
}: {
  days: readonly { day: string; value: number }[]
  // An ink, not a scale stop. See the note at the top of this file.
  color: string
}) {
  const peak = days.reduce((high, day) => Math.max(high, day.value), 0)
  return (
    <View>
      <View className="flex-row items-end gap-0.5" style={{ height: PLOT_H }}>
        {days.map((day) => (
          <View
            key={day.day}
            // Rounded at the top and square at the baseline, so the bar reads as standing
            // on the axis rather than floating over it.
            className="flex-1 rounded-t"
            style={{
              height: peak === 0 ? ZERO_H : Math.max(ZERO_H, (day.value / peak) * PLOT_H),
              backgroundColor: color,
            }}
          />
        ))}
      </View>
      {/* The axis. A hairline rather than a ruled grid: the bars are compared against
          each other and against the peak printed beside the heading, and gridlines behind
          fourteen bars this narrow are more ink than the data. */}
      <View className="mt-1 h-px bg-muted" />
    </View>
  )
}

// One of several magnitudes, read against the largest of them: how many runs each board
// took this week.
//
// A row and not a column of vertical bars, because what these carry is a *name* — and a
// name under a 40px-wide bar is a name turned on its side. The label is on the bar's own
// line, which is also what makes the colour beside it decoration rather than the key:
// two of this app's six boards are the same hue by design (difficulty is a position along
// the mode's own pair, so accuracy-extreme and speed-easy meet in the middle), and a
// chart that asked colour to say which board this is would be unreadable for exactly
// those two.
export function MeterRow({
  label,
  value,
  share,
  color,
}: {
  label: ReactNode
  value: string
  // Nought to one, against the biggest row of the set. Clamped here rather than trusted:
  // a share over one would draw a bar out of its own track.
  share: number
  color: string
}) {
  return (
    <View className="mb-2">
      <View className="flex-row items-end justify-between gap-2">
        <Text
          selectable={false}
          numberOfLines={1}
          className={cn(TYPE.rowLabel, 'shrink text-primary')}
        >
          {label}
        </Text>
        <Text selectable={false} className={cn(TYPE.figure, 'text-dim')}>
          {value}
        </Text>
      </View>
      <View className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <View
          className="h-2 rounded-full"
          style={{
            width: `${Math.min(1, Math.max(0, share)) * 100}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  )
}
