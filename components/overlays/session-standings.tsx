import { msg } from '@lingui/core/macro'
import { useFonts } from 'expo-font'
import { View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { TabPanel } from '@/components/overlays/tab-panel'
import { mono } from '@/constants/theme'
import { useSessionBoard } from '@/hooks/use-session-card'
import { useViewport } from '@/hooks/use-viewport'
import { gradientOf, headlineOf, type Difficulty, type ModeId } from '@/modes'

// The same line the dialog shows, for the same reason — see `NOBODY_YET` there. A run
// that has just finished cannot actually meet it, since the player is on the board by
// the time they read it, but a read that failed or raced the write can.
const NOBODY_YET = msg`— NOBODY HAS SCORED HERE —`

// Where a session run came, on the screen that ends it.
//
// Its own component rather than a block inside the game-over screen, because it fetches:
// a hook cannot live behind the `sessionId !== null` branch that decides whether to draw
// it. One component per file is the house rule and this is what it is for.
export function SessionStandings({
  sessionId,
  gameMode,
  difficulty,
  userId,
  nickname,
}: {
  sessionId: string
  gameMode: ModeId
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
}) {
  const { width } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const { board } = useSessionBoard(sessionId, userId)
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
        compact
      />
    </View>
  )
}
