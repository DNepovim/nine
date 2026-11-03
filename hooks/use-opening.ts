import { useState } from 'react'
import type { StateValue } from 'xstate'

import { SCHEMES } from '@/constants/colors'
import {
  openingOf,
  schemeOf,
  type ModeId,
  type OpeningKind,
  type OpeningTake,
  type SchemeKind,
} from '@/modes'

// The game screen's half of a mode's **opening**: whether the run is held **ready** for
// one, how much of it plays, whether it has reached its switch, and so which **scheme**
// the screen is drawn in. The machine's half is the `ready` state itself.
//
// The take and the switch are decided the moment the machine lands in `ready`, from where
// it came from, in the render that lands there rather than in an effect after it — an
// effect would draw one frame of the last run's take, and a frame of the dark screen
// before the lights are on. A run dealt from the intro plays the `full` take; one dealt
// again from a pause or game over plays the `short` one, so twenty retries are not twenty
// whole scenes.
//
// The scheme is `day` behind the intro, which covers the game screen, and while an
// opening has not yet reached its switch — the lights are still on. It is the mode's own
// everywhere else, a restored run included, which comes back already switched.
export function useOpening({
  state,
  mode,
}: {
  // The machine's state value. Read only for its name, so this hook knows the names of
  // three states and nothing else about the machine — every state of it is flat, and a
  // nested value would read as none of them.
  state: StateValue
  mode: ModeId
}): {
  // The opening to draw now: the mode's own while its run is held, otherwise null.
  layer: OpeningKind | null
  // The opening whose **remains** stay behind the run once its scene is over — playing,
  // paused, and under game over — or null on the intro and while the scene itself plays.
  remains: OpeningKind | null
  take: OpeningTake
  // Whether the dial may draw itself as its scheme has it — false only while an opening
  // is still playing with the lights on. See `opened` on `Dial`.
  opened: boolean
  scheme: SchemeKind
  // The phone's own icons. They follow the game screen only while it is what is on
  // screen: the pause and game over screens over it are drawn light.
  statusBar: 'dark' | 'light'
  // Held or playing: the game screen is the thing on screen and a thumb is on it. What
  // keeps the feedback tab off a scene that is about to become a live run — see
  // `showFeedbackBookmark`.
  inPlay: boolean
  onSwitch: () => void
} {
  const name = typeof state === 'string' ? state : ''
  const held = name === 'ready'
  const [previous, setPrevious] = useState(name)
  const [take, setTake] = useState<OpeningTake>('full')
  const [switched, setSwitched] = useState(true)
  if (name !== previous) {
    setPrevious(name)
    if (held) {
      setTake(previous === 'menu' ? 'full' : 'short')
      setSwitched(false)
    }
  }
  const lightsOn = name === 'menu' || (held && !switched)
  const scheme = lightsOn ? 'day' : schemeOf(mode)
  const onScreen = held || name === 'playing'
  return {
    layer: held ? openingOf(mode) : null,
    remains: held || name === 'menu' ? null : openingOf(mode),
    take,
    opened: !held || switched,
    scheme,
    statusBar: onScreen ? SCHEMES[scheme].inks.statusBar : 'dark',
    inPlay: onScreen,
    onSwitch: () => {
      setSwitched(true)
    },
  }
}
