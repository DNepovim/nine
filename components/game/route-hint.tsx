import { Ionicons } from '@expo/vector-icons'
import { isEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Text, View } from 'react-native'

import { DIAL_COLORS } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { lerpColor, MODE_GRADIENT } from '@/machines/game'
import type { MoveDirection, MoveJump, RouteStep } from '@/machines/scoring'

// Trainee's colour, worn by the pill's edge, the target and the step counts — the frame
// stays the mode's, so the miniatures inside are the only thing wearing the dial's.
const TINT = MODE_GRADIENT.trainee[0]

// A key is drawn as a filled disc so the hint reads as buttons rather than as more
// arithmetic — the row says "press these", and the shape is what says it.
const KEY_SIZE = 22

// Room for a key plus the border and padding around it.
const ROUTE_HINT_HEIGHT = 30

// The line around the row, held right back at a third the way the tips panel holds its
// own edge. Alpha on the colour rather than an `opacity` style, which would take the
// keys and their numerals down with the border.
const BORDER = 1
const BORDER_TINT = `${TINT}55`

// More keys than this and the row stops being glanceable. A route needing five is a
// board nobody was going to read off a single line anyway.
const MAX_KEYS = 4

// The heaviest key is ×9 and the lightest ×1, so a weight sits at (w - 1) / 8 along
// the ramp.
const WEIGHT_SPAN = 8

const ICON_SIZE = 13

type IoniconName = keyof typeof Ionicons.glyphMap

// The gesture that walks a key one step, by direction. Up is a tap — the dial counts up
// and wraps — and down is a swipe down, which is the only way to go back.
const WALK_ICON = {
  up: 'ellipse',
  down: 'arrow-down',
} as const satisfies Record<MoveDirection, IoniconName>

// The gesture that jumps a key straight to an end of its range. Left for 0, right for 9
// — the same two arrows the how-to-play diagram uses for them.
const JUMP_ICON = {
  zero: 'arrow-back',
  nine: 'arrow-forward',
} as const satisfies Record<MoveJump, IoniconName>

// The miniatures wear the dial's own ramp, so a key in the hint is coloured the way the
// dial colours keys — pale lavender to periwinkle in light, deep navy to app blue in
// dark, and the numeral in the dial's ink.
//
// One difference the dial cannot avoid: it runs the ramp over a button's *value*, where
// this runs it over the weight. Weight is what a miniature identifies and what the
// route is about, and it also means a key's colour here does not shift as the run goes
// on — the hint would be unreadable if ×9 changed shade every time the dial moved.
const keyColors = (isDark: boolean, weight: number) => {
  const palette = isDark ? DIAL_COLORS.dark : DIAL_COLORS.light
  return {
    background: lerpColor(palette.low, palette.high, (weight - 1) / WEIGHT_SPAN),
    ink: palette.text,
  }
}

// One instruction: the gesture to make, how many times, and on which key. A jump is
// drawn on its own — it happens once whatever follows it — and the walk after it takes
// the count.
function Step({ step, isDark }: { step: RouteStep; isDark: boolean }) {
  const { background, ink } = keyColors(isDark, step.weight)
  return (
    <View className="flex-row items-center gap-1">
      {step.jump !== null && (
        <Ionicons name={JUMP_ICON[step.jump]} size={ICON_SIZE} color={TINT} />
      )}
      {step.moves > 0 && (
        <View className="flex-row items-center gap-0.5">
          <Ionicons
            name={WALK_ICON[step.direction]}
            size={step.direction === 'up' ? ICON_SIZE - 5 : ICON_SIZE}
            color={TINT}
          />
          <Text
            selectable={false}
            className="font-mono text-[11px] font-bold"
            style={{ color: TINT }}
          >
            ×{step.moves}
          </Text>
        </View>
      )}
      <View
        className="items-center justify-center rounded-full"
        style={{ width: KEY_SIZE, height: KEY_SIZE, backgroundColor: background }}
      >
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black"
          style={{ color: ink }}
        >
          {step.weight}
        </Text>
      </View>
    </View>
  )
}

// The optimal way to the target the debrief just described: where the grid stood, then
// the gestures that would have carried it to the target, then the target itself — read
// left to right the same way the move happens, from what it was to what it needed to
// be.
//
// Coarsest key first, which is both what computeRoute returns and how the game is
// taught. Counts are steps rather than taps, so a jump to an end is the one step it
// costs.
export function RouteHint({
  route,
  start,
  target,
}: {
  route: readonly RouteStep[]
  // The sum before the hit, shown to the left of the keys — the number the route
  // starts from.
  start: number | null
  // The sum the route reaches, shown to the right — the target itself has already
  // popped off the board by the time this shows, so without it the keys are a set of
  // instructions with nothing to attach them to.
  target: number | null
}) {
  const { colorScheme } = useTheme()
  const isDark = colorScheme === 'dark'

  // The outer view holds the space open whether or not there is a route; the bordered
  // pill lives inside it and is drawn only when there is. Bordering the outer view
  // instead would leave an empty box on screen for the whole run.
  //
  // The empty case carries the same margin as the filled one, or the board would drop
  // by the gap's height every time a hint arrived — which is the shove this reserved
  // row exists to prevent.
  if (isEmptyArray(route)) {
    return <View className="mt-1.5" style={{ height: ROUTE_HINT_HEIGHT }} />
  }

  return (
    <View
      className="mt-1.5 flex-row items-center justify-center"
      style={{ height: ROUTE_HINT_HEIGHT }}
    >
      <View
        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ borderWidth: BORDER, borderColor: BORDER_TINT }}
      >
        {/* The sum before the hit, read first because the move starts from it. */}
        {start !== null && (
          <>
            <Text
              selectable={false}
              className="font-mono text-[12px] font-black tracking-[0.5px]"
              style={{ color: TINT }}
            >
              {start}
            </Text>
            <Text selectable={false} className="font-mono text-[11px] text-dim">
              ›
            </Text>
          </>
        )}
        {route.slice(0, MAX_KEYS).map((step, i) => (
          <Fragment key={`${step.weight}-${step.jump ?? 'walk'}-${step.direction}`}>
            {i > 0 && (
              <Text selectable={false} className="font-mono text-[11px] text-dim">
                ›
              </Text>
            )}
            <Step step={step} isDark={isDark} />
          </Fragment>
        ))}
        {/* The sum the route reaches, read last because the move ends on it. The
            target it belongs to has already popped off the board by the time this
            shows, so without it the keys are a set of instructions with nothing to
            attach them to. */}
        {target !== null && (
          <>
            <Text selectable={false} className="font-mono text-[11px] text-dim">
              ›
            </Text>
            <Text
              selectable={false}
              className="font-mono text-[12px] font-black tracking-[0.5px]"
              style={{ color: TINT }}
            >
              {target}
            </Text>
          </>
        )}
      </View>
    </View>
  )
}
