import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { darkGradientOf, type ModeId } from '@/modes'

// How long is left of the **session** a stopped run belongs to.
//
// The score strip draws this during a run; a run that has stopped does not stop its
// window. A player reading the pause screen is deciding whether to go again, and one
// ending on the game-over screen is deciding the same thing — and the honest answer to
// "should I?" is how much of the contest is left. Without it the clock simply vanished
// at the moment it mattered most.
//
// **Why the strip does not use this component**, which is the question to answer here: the
// one on the strip has to come to a cell's exact height, with its label beside the board
// rather than over it and both sized from `CELL_TEXT_SIZE`. That is a row of scores it is
// fitting into. This is a run screen with room, so the label sits above the clock where it
// reads as a sentence. Same two parts, two layouts, and a prop that tried to serve both
// would be a component shaped by the harder of them.
//
// Drawn only for a run that belongs to a session, which is the caller's to decide — every
// one of them is already behind that question for other reasons.
export function SessionCloses({
  mode,
  closesAt,
}: {
  // Whose colours the flaps take. A challenge's dark pair, so the clock belongs to the
  // challenge being played rather than to the screen it is drawn on.
  mode: ModeId
  // When the window shuts, ms since the epoch.
  closesAt: number
}) {
  return (
    <View className="mb-5 items-center gap-1.5">
      {/* The same words the strip uses, for the same reason it gives: a run ends and a
          window closes, so the verb keeps this off the stopwatch beside it — and naming
          the subject saves the player working it out from context. */}
      <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
        <Trans>CHALLENGE CLOSES IN</Trans>
      </Text>
      {/* No `onArrive`. This clock reports; it does not decide anything. What ends a run
          when a window shuts is the strip's own boundary, and a second caller firing the
          same event from a screen the run has already left is exactly the bug that put
          `TIME GONE` over a run which ended on its lives. */}
      <ChallengeCountdown until={closesAt} gradient={darkGradientOf(mode)} flip />
    </View>
  )
}
