import { View } from 'react-native'

import type { DialSpec } from '@/modes/dial'

// A challenge's mark: its own dial, drawn as dots.
//
// Every challenge needs something to wear beside its name, and twenty-odd of them need
// twenty-odd somethings. Drawing the dial is what makes that free — the shape comes out
// of the challenge's own rules rather than out of a file of glyphs somebody has to keep
// filling, and it says the one true thing about a challenge that fits in a 20pt square:
// what you will be playing on. Four keys is four dots; the nine every shipped mode uses
// is three rows of three.
//
// It replaced a `flash-outline` bolt that every challenge shared, which was a mark for
// the *category* on a card that already says CHALLENGE on its own edge.
//
// Deliberately not pressable and deliberately unlabelled: it is a mark, and the name is
// beside it. `aria-hidden` for that reason — a screen reader gets the name and the dial
// shape would only be noise.

// How much of a cell the dot fills, the rest being the gap. A dial is read as a grid, and
// a grid needs the space between its cells to be visible at this size.
const FILL = 0.62

export function DialMark({
  dial,
  color,
  size,
}: {
  dial: DialSpec
  color: string
  // The square the mark is drawn inside.
  //
  // Given by the caller rather than fixed here, which is what lets the mark stand the
  // same height as the words beside it: the challenge banner measures its own text block
  // and hands that height over, so the two read as one label rather than as an icon that
  // happens to be near some type. A constant could only ever match one caller's line
  // height, and would drift the moment either changed.
  size: number
}) {
  // The cell is the square that has to fit on the *longer* axis, so a wide dial and a
  // tall one are both drawn inside the same box rather than one of them bursting it.
  const cell = size / Math.max(dial.rows, dial.cols)
  const dot = Math.max(2, Math.round(cell * FILL))
  const gap = Math.max(1, Math.round(cell - dot))

  return (
    // Centred in the square it was given: a 1×4 dial is a quarter of its own width tall,
    // and left to itself it would sit against the top of the row rather than on the line
    // through the middle of the words.
    <View
      style={{ height: size, width: size, gap }}
      className="items-center justify-center"
      aria-hidden
    >
      {Array.from({ length: dial.rows }, (_, row) => (
        <View key={row} className="flex-row" style={{ gap }}>
          {Array.from({ length: dial.cols }, (_, col) => (
            <View
              key={col}
              style={{
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: color,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
