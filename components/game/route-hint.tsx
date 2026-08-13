import { isEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Text, View } from 'react-native'

import { DIAL_COLORS } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { lerpColor, MODE_GRADIENT } from '@/machines/game'
import type { RouteStep } from '@/machines/scoring'

// Trainee's colour, worn by the pill's edge and the step counts — the frame stays the
// mode's, so the miniatures inside are the only thing wearing the dial's colours.
const TINT = MODE_GRADIENT.trainee[0]

// A key is drawn as a filled disc so the hint reads as buttons rather than as more
// arithmetic — the row says "press these", and the shape is what says it.
const KEY_SIZE = 14

// The line around the row, held right back at a third the way the tips panel holds
// its own edge — enough to gather the keys into one thing, not enough to compete with
// them. Alpha on the colour rather than an `opacity` style, which would take the keys
// and their numerals down with the border.
const BORDER = 1
const BORDER_TINT = `${TINT}55`

// Room for a key plus the border and padding around it: 14 + 2 + 2, rounded up.
const ROUTE_HINT_HEIGHT = 20

// More keys than this and the row stops being glanceable at 8px. A route needing five
// is a board nobody was going to read off a single line anyway.
const MAX_KEYS = 4

// The heaviest key is ×9 and the lightest ×1, so a weight sits at (w - 1) / 8 along
// the ramp.
const WEIGHT_SPAN = 8

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

// The optimal way to the target the debrief just described — "2×(9) › 1×(3)", meaning
// spend two steps on ×9 keys, then one on a ×3.
//
// Coarsest key first, which is both what computeRoute returns and how the game is
// taught. The count is steps rather than taps, so a swipe to 9 counts as the one step
// it costs.
export function RouteHint({ route }: { route: readonly RouteStep[] }) {
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
        className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
        style={{ borderWidth: BORDER, borderColor: BORDER_TINT }}
      >
        {route.slice(0, MAX_KEYS).map((step, i) => {
          const { background, ink } = keyColors(isDark, step.weight)
          return (
            <Fragment key={step.weight}>
              {i > 0 && (
                <Text selectable={false} className="font-mono text-[9px] text-dim">
                  ›
                </Text>
              )}
              <View className="flex-row items-center gap-0.5">
                {/* The count keeps the mode's tint rather than the key's: at 9px on the
                    surface, the pale end of the dial ramp would all but vanish, and the
                    disc beside it already carries the key's identity. */}
                <Text
                  selectable={false}
                  className="font-mono text-[9px] font-bold"
                  style={{ color: TINT }}
                >
                  {step.steps}×
                </Text>
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: KEY_SIZE,
                    height: KEY_SIZE,
                    backgroundColor: background,
                  }}
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[8px] font-black"
                    style={{ color: ink }}
                  >
                    {step.weight}
                  </Text>
                </View>
              </View>
            </Fragment>
          )
        })}
      </View>
    </View>
  )
}
