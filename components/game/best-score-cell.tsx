import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { GradientName } from '@/components/gradient-name'
import type { RecordHolder } from '@/hooks/use-board'
import { cn } from '@/lib/cn'
import { shortName } from '@/lib/short-name'

// Two lines of small type beside one big number, and the pair of them is exactly as tall
// as it is: the label on top, whoever holds the score under it, and the number reaching
// across both. Spelled out in explicit line heights rather than left to the platform's
// default leading, which differs between iOS, Android and web — this is a strip where one
// stray pixel shows.
//
// Both lines are set at one size, and that size is smaller than either line needs: the
// slack inside the two boxes is what separates them. They are a pair read together — a
// label in one size over a name in another read as one thing said and a second thing
// added, which is not what a cell is.
const TEXT_SIZE = 6
const LABEL_LINE = 8
const HOLDER_LINE = 7
export const BEST_CELL_HEIGHT = LABEL_LINE + HOLDER_LINE

// A nickname is allowed sixteen characters and there is room here for twelve, so a long
// one is cut and marked with an ellipsis. Capped rather than free because the name is in
// the cell's flow and so sets its width: the row is spaced with `justify-between`, and an
// uncapped name taking a record would push the four scores about.
//
// Cut by characters rather than held to a pixel width, because this face is monospaced
// and a gradient name is one `Text` per character — a nested run React Native will not
// reliably ellipsise for us. See `shortName`.
const HOLDER_CHARS = 12

// A slow breathe rather than a flash — this sits beside three other still numbers, and
// anything faster would read as an error state instead of a nudge.
const PULSE_MS = 700
const PULSE_SCALE = 1.14

// One label + number pair in the best-scores line, with whoever holds it underneath. The
// label stays in the shared dim ink; the number carries its own colour from the game
// spectrum so the four scores stay tellable apart at a glance.
//
// A record the player holds is named rather than recoloured: the number's colour is
// what says which period it belongs to, and spending that on ownership would leave two
// gold cells that no longer read as different boards. The line below carries it instead
// — YOU, in gold, which is the one thing here worth looking twice at.
//
// Somebody else's name is drawn in the gradient their own averages earn them, the same
// as on a board row, the winners stripe and their profile. A player is one colour
// wherever the app writes their name, and this strip is no exception.
export function BestScoreCell({
  label,
  value,
  color,
  digitFont,
  holder = null,
  sub = null,
  mine = false,
  mineColor,
  pulsing = false,
  onPress,
}: {
  label: string
  value: number
  color: string
  digitFont: string
  // The player whose record this is, drawn in their own colours. Null where there is no
  // name to draw: a board whose record has not arrived or does not exist, and the two
  // cells that say a word instead — see `sub`.
  holder?: RecordHolder | null
  // The second line where a name would be the wrong thing to write: the player's own
  // cell, whose two lines are one phrase — YOUR / BEST — and a record the player holds,
  // which says YOU rather than reading their own nickname back at them.
  sub?: string | null
  // Whether this board's record is the player's own. All it decides is the ink of the
  // word below, which is the only thing gold is spent on here.
  mine?: boolean
  // Gold that reads as text on the active theme — see GOLD_INK.
  mineColor?: string
  // Whether the live score is close enough to this bar to nudge the player toward it —
  // see lib/near-record.ts. Never true on more than one cell at once, since only the
  // tightest gap counts as close.
  pulsing?: boolean
  // Opens the profile of whoever this cell is about. The whole cell answers, not the
  // name alone: at six pixels the name is a third of an already hairline row, and a
  // target that small is one nobody can hit. Undefined where there is no profile behind
  // the cell — a board with no record, a device with no player yet — which is also what
  // takes the press away rather than leaving a target that does nothing.
  onPress?: () => void
}) {
  const scale = useSharedValue(1)

  useEffect(() => {
    if (!pulsing) {
      scale.value = withTiming(1, { duration: PULSE_MS / 2 })
      return
    }
    scale.value = withRepeat(
      withTiming(PULSE_SCALE, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [pulsing, scale])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    // Generous hit slop, and wider above and below than to the sides: the strip is a
    // hairline with the top bar under it, so there is room to reach vertically, while
    // four cells sit shoulder to shoulder across it and a horizontal overreach would
    // start answering for the cell next door.
    <Pressable
      className="flex-row items-center gap-1"
      disabled={onPress === undefined}
      hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
      onPress={onPress}
    >
      {/* Held to the pair's height whether or not there is a name to put in it, so the
          cell that has nobody to name — the player's own — is the same height as the
          three beside it. `shrink` is the safety valve: four long names against four
          five-digit scores is more than a narrow display holds, and a name giving way is
          better than the row running off the edge. */}
      <View className="shrink" style={{ height: BEST_CELL_HEIGHT }}>
        <Text
          selectable={false}
          className="font-mono font-bold tracking-[1px] text-dim"
          style={{ fontSize: TEXT_SIZE, lineHeight: LABEL_LINE }}
        >
          {label}
        </Text>
        {holder !== null && (
          <GradientName
            nickname={shortName(holder.nickname, HOLDER_CHARS)}
            avgAccuracy={holder.avgAccuracy}
            avgSpeed={holder.avgSpeed}
            numberOfLines={1}
            className="font-mono font-bold tracking-[0.5px]"
            style={{ fontSize: TEXT_SIZE, lineHeight: HOLDER_LINE }}
          />
        )}
        {sub !== null && (
          <Text
            selectable={false}
            numberOfLines={1}
            className={cn('font-mono font-bold tracking-[1px]', !mine && 'text-dim')}
            style={[
              { fontSize: TEXT_SIZE, lineHeight: HOLDER_LINE },
              mine && mineColor !== undefined ? { color: mineColor } : null,
            ]}
          >
            {sub}
          </Text>
        )}
      </View>
      <Animated.Text
        selectable={false}
        numberOfLines={1}
        className="text-[12px] tracking-[1px]"
        style={[
          { fontFamily: digitFont, color, lineHeight: BEST_CELL_HEIGHT },
          pulseStyle,
        ]}
      >
        {value}
      </Animated.Text>
    </Pressable>
  )
}
