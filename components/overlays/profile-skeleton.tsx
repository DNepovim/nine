import { View } from 'react-native'

import { SkeletonBar, SkeletonPulse } from '@/components/overlays/skeleton'
import { SCORED_MODES } from '@/modes'

// The five lifetime cells — RUNS, HITS, TIME and the two averages — as a count rather
// than as a list, since a stand-in has no values to put in them.
const STAT_CELLS = 5

// Three difficulties under each mode's heading, which is what the real table draws.
const BOARD_ROWS = 3

// The profile card while the profile is still being read.
//
// Built to the shape of the card that is coming — the name, the fortune, the row of five
// cells, a heading and three rows per scored mode — because the point of it is the jump it
// prevents. A card that stood a single LOADING… line in the middle of itself was about a
// fifth of its own height, so the dialog grew by four fifths the moment the read landed.
//
// The bars are placed by eye against the real card rather than derived from it: a stand-in
// only has to leave the reader's eye in the right place, and a figure that insisted on
// being exact would be a second copy of the layout to keep in step with the first.
export function ProfileSkeleton() {
  return (
    <SkeletonPulse className="gap-3">
      {/* The name, with the motto's line under it. */}
      <View className="items-center gap-2">
        <SkeletonBar className="h-[26px] w-[170px] rounded-md" />
        <SkeletonBar className="h-[10px] w-[110px]" />
      </View>

      {/* FORTUNE, which is the one figure on the card set large. */}
      <SkeletonBar className="h-[30px] w-[140px] self-center rounded-md" />

      <View className="flex-row justify-center gap-4">
        {Array.from({ length: STAT_CELLS }, (_, cell) => (
          <View key={cell} className="items-center gap-1">
            <SkeletonBar className="h-[11px] w-7" />
            <SkeletonBar className="h-[7px] w-9" />
          </View>
        ))}
      </View>

      {/* The BOARDS tile: the label outside it, the mode headings and their rows within,
          on the same card the real section is drawn on so only the figures are missing. */}
      <View className="gap-1">
        <SkeletonBar className="h-[7px] w-12" />
        <View className="rounded-2xl bg-card px-3 py-1.5">
          {SCORED_MODES.map((mode) => (
            <View key={mode}>
              <View className="h-9 justify-end pb-1">
                <SkeletonBar className="h-[11px] w-16" />
              </View>
              {Array.from({ length: BOARD_ROWS }, (_, row) => (
                <View key={row} className="h-7 flex-row items-center">
                  <SkeletonBar className="h-2.5 w-10" />
                  <View className="flex-1" />
                  <SkeletonBar className="ml-3 h-2.5 w-8" />
                  <SkeletonBar className="ml-3 h-2.5 w-8" />
                  <SkeletonBar className="ml-3 h-2.5 w-8" />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </SkeletonPulse>
  )
}
