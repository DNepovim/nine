import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'

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

export function PauseMark({ gameMode }: { gameMode: Mode }) {
  const [from, to] = MODE_GRADIENT[gameMode]

  return (
    <View className="mb-6 flex-row gap-5">
      {[0, 1].map((bar) => (
        <View
          key={bar}
          className="overflow-hidden"
          style={{ width: BAR_WIDTH, height: BAR_HEIGHT }}
        >
          <LinearGradient
            colors={[from, to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
      ))}
    </View>
  )
}
