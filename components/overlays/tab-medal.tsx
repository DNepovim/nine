import { Text, View } from 'react-native'

import type { MyRankRow } from '@/lib/leaderboard'
import { medalRank } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'

// Hung off the label's top-right corner rather than sitting beside it, so adding one
// cannot widen a tab and shuffle the row — the underline is measured from these layouts,
// and a tab that changed width as its medal arrived would drag the underline with it.
const OFFSET = -2

// The medal the player holds on this period of the board, on the tab that opens it.
//
// The whole point is not having to open the tab: a place on this week's board is worth
// knowing about from the row of labels, and the rotation only shows one period at a
// time. `myRank` is already fetched for every period, so this costs no request.
export function TabMedal({ myRank }: { myRank: MyRankRow | null }) {
  if (myRank === null) return null
  const rank = medalRank(myRank.rank, myRank.best_score)
  if (rank === null) return null

  return (
    <View
      pointerEvents="none"
      className="absolute"
      style={{ top: OFFSET, right: OFFSET }}
    >
      <Text selectable={false} className="text-[9px] leading-[11px]">
        {rankMedal(rank)}
      </Text>
    </View>
  )
}
