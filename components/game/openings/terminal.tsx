import { useEffect } from 'react'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { openingLength } from '@/modes/opening-beats'

// BINARY's **opening**: an MS-DOS terminal starting the game — and staying.
//
// The game screen is in the `dos` **scheme** from the first frame, and the play area is
// already the terminal (`TerminalBoard`, the `lines` target form), typing the command that
// starts the run. When it has been entered the first target arrives, as the next line.
//
// So this scene draws nothing: the board is the drawing, from the first frame to the last, and
// nothing ever hands over to anything. All that is left here is the length of the wait.
//
// The `short` take is for a run dealt again: the same command, typed at a speed no one would
// type it, so a retry passes through the machine without waiting for it.
export function Terminal({ take, onDone }: OpeningSceneProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, openingLength(take))
    return () => {
      clearTimeout(timer)
    }
  }, [])
  return null
}
