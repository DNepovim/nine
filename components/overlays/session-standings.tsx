import { msg } from '@lingui/core/macro'
import { useFonts } from 'expo-font'
import { View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { TabPanel } from '@/components/overlays/tab-panel'
import { mono } from '@/constants/theme'
import type { PeriodBoard } from '@/hooks/use-board'
import { useViewport } from '@/hooks/use-viewport'
import { gradientOf, headlineOf, measureOf, type Difficulty, type ModeId } from '@/modes'

// The same line the dialog shows, for the same reason — see `NOBODY_YET` there. A run
// that has just finished cannot actually meet it, since the player is on the board by
// the time they read it, but a read that failed or raced the write can.
const NOBODY_YET = msg`— NOBODY HAS SCORED HERE —`

// Where a session run came, on the screen that ends it.
//
// Given the board rather than fetching it. It used to read `useSessionBoard` itself, which
// is why it is a component at all — a hook cannot sit behind the `sessionId !== null`
// branch that decides whether to draw it. The game-over screen reads it now, because the
// **medal** above the score comes off the same standings, and two reads of one board can
// disagree: a rival landing a score between them would have put the player on a podium
// the table under it does not show.
export function SessionStandings({
  board,
  gameMode,
  difficulty,
  userId,
  nickname,
}: {
  // Null while the read is in flight, which is the caller's own `useSessionBoard` answer
  // passed straight through.
  board: PeriodBoard | null
  gameMode: ModeId
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
}) {
  const { width } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  if (board === null) return null

  return (
    <View className="mt-2">
      <TabPanel
        data={board}
        tab="forever"
        emptyLine={NOBODY_YET}
        headline={headlineOf(gameMode)}
        difficulty={difficulty}
        accentColor={gradientOf(gameMode)[0]}
        userId={userId}
        nickname={nickname}
        width={Math.min(width - 96, 280)}
        digitFont={dsegLoaded ? 'DSEG7' : mono}
        // Resolved from the challenge rather than read off a session row, which this
        // screen does not have. The two always agree for a run just played: the session
        // was booked with this challenge's own measure, and the server refuses to
        // re-point a session anybody has scored on.
        //
        // The figures here are unlabelled, as the score beside them already is — this
        // board carries no header. What matters is that the column is *there*: without
        // it the rows would be ordered by a number the player cannot see.
        measure={measureOf(gameMode)}
        compact
      />
    </View>
  )
}
