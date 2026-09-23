import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'

import {
  GLASS_FAR_PX,
  GLASS_PANE_SHADOW,
  GLASS_RIM_PX,
  GLASS_SHEEN_ALPHA,
  GLASS_SHEEN_UNTIL,
  GLASS_TINT,
  glassTones,
  withAlpha,
} from '@/lib/glass'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

// Two bars, the universal sign for "stopped", where the game-over screen has its title.
//
// The pause screen used to open on a line of small caps naming the board, which said
// where you were but not what had happened. A mark this size says "stopped" before
// anything is read, and leaves the board to the badges under it — the same badges the
// game-over screen wears, so the two screens differ by the mark alone.
//
// Drawn in the mode's own gradient rather than a flat colour: every other large mark in
// the app runs the mode's pair, and a solid bar beside gradient badges would read as a
// different family.
// Square-cut, and sized to stand where the game-over title stands rather than to sit
// above the content like an icon: that title is two rows of 56px letters, so this comes
// to about the same height in a single mark.
const BAR_HEIGHT = 120
const BAR_WIDTH = 38

// The same glass the title letters are cut from: a pane with the surface coming through
// it, a sheen down its top, a lit rim along the top edge and a darker far edge along the
// foot — all of it over the mode's own pair, which is untouched underneath.
//
// The bar can do what a letter cannot, which is fade. A glyph's bands are windows onto a
// copy of it and windows have hard edges; a rectangle takes a gradient, so the sheen here
// falls off the way it would on real glass rather than stopping at a line.
const CLEAR = 'rgba(255, 255, 255, 0)'

const SHEEN = [`rgba(255, 255, 255, ${GLASS_SHEEN_ALPHA})`, CLEAR] as const

export function PauseMark({ gameMode }: { gameMode: Mode }) {
  const [from, to] = MODE_GRADIENT[gameMode]
  const { rim, far } = glassTones(to)

  return (
    <View className="mb-6 flex-row gap-5">
      {[0, 1].map((bar) => (
        // The shadow outside the clip, since what is cast falls beyond the pane. The
        // tint goes on the gradient rather than on the whole bar: an opacity here would
        // take the rim and the far edge down with it, and those carry their own — a lit
        // edge is the one part of a pane that is not see-through.
        //
        // The same float the title letters ride, on the same two clocks the first two of
        // them use: a big glass mark in this app breathes, and a pair of bars holding
        // perfectly still where NINE and the game-over title drift would read as a
        // picture of the mark rather than the mark. Different periods per bar for the
        // same reason the letters have them — in step they would pump, out of step they
        // wander.
        <View key={bar} className={`letter-float-${bar}`} style={GLASS_PANE_SHADOW}>
          <View
            className="overflow-hidden"
            style={{ width: BAR_WIDTH, height: BAR_HEIGHT }}
          >
            <LinearGradient
              colors={[withAlpha(from, GLASS_TINT), withAlpha(to, GLASS_TINT)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1 }}
            />
            {/* The sheen, fading out before the middle. */}
            <LinearGradient
              colors={SHEEN}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: GLASS_SHEEN_UNTIL }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            {/* The two edges. Absolute strips rather than gradient stops: an edge is where
              the glass stops, and a stop soft enough to interpolate is a glow. */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: GLASS_RIM_PX,
                backgroundColor: rim,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: GLASS_FAR_PX,
                backgroundColor: far,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  )
}
