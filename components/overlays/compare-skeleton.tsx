import { ScrollView, View } from 'react-native'

import { SkeletonBar, SkeletonPulse } from '@/components/overlays/skeleton'
import { COMPARE_STATS } from '@/lib/compare'
import { SCORED_MODES } from '@/modes'

// The six boards and the WON row that totals them — the foot of the table counts as one of
// its rows for the purpose of standing in for its height.
const BOARD_ROWS = SCORED_MODES.length * 3 + 1

// The box the champion mark sits in on the real header, kept empty here. A bar would be a
// crown promised to a player who may not hold one; the height still has to be held, or the
// names would start higher than they end up.
const MARK_BOX = 30

// The comparison while the viewer's own career is still being read.
//
// The table's own two columns of figures are what takes the height here, so the stand-in is
// the two heads, the sentence between them, and the rows — all at the heights the real table
// draws them at, so the card does not grow out from under the reader's thumb when the read
// lands. The other player's profile came in with the card and is never waited on.
//
// Laid out like the real table rather than as one tall column: the heads and the sentence
// hold their place and the blocks give way inside the card's height cap, so a short phone
// clips nothing and the CLOSE button stays where the thumb left it. The scroll is dead —
// there is nothing in here to read.
export function CompareSkeleton() {
  return (
    <SkeletonPulse className="shrink gap-3">
      <View className="flex-row items-start">
        {[0, 1].map((side) => (
          <View key={side} className="flex-1 items-center gap-0.5">
            <View style={{ height: MARK_BOX }} />
            <SkeletonBar className="h-[17px] w-[100px] rounded-md" />
            <SkeletonBar className="mt-1 h-[9px] w-[56px]" />
          </View>
        ))}
      </View>

      {/* The verdict, which is the one line on the card written as a sentence — two lines
          of it, which is what most of the phrasings come to. */}
      <View className="items-center gap-1.5">
        <SkeletonBar className="h-[9px] w-[70%]" />
        <SkeletonBar className="h-[9px] w-[45%]" />
      </View>

      <ScrollView
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 1 }}
      >
        <View className="gap-3">
          <Block rows={COMPARE_STATS.length} />
          <Block rows={BOARD_ROWS} />
        </View>
      </ScrollView>
    </SkeletonPulse>
  )
}

// One block of the table: the bar where its label goes, `CardSection`'s own tile under it,
// and a row of bars per row at the height every row of the comparison is drawn on.
function Block({ rows }: { rows: number }) {
  return (
    <View className="gap-1">
      <SkeletonBar className="h-[7px] w-12" />
      <View className="rounded-2xl bg-card px-3 py-1.5">
        {Array.from({ length: rows }, (_, row) => (
          <View key={row} className="h-7 flex-row items-center">
            <SkeletonBar className="h-2.5 w-14" />
            <View className="flex-1" />
            <SkeletonBar className="ml-3 h-2.5 w-11" />
            <SkeletonBar className="ml-3 h-2.5 w-11" />
          </View>
        ))}
      </View>
    </View>
  )
}
