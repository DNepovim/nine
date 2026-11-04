import { useEffect, useRef, useState } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import type { StateValue } from 'xstate'

import { APP_RED, SCHEMES } from '@/constants/colors'
import {
  OPENING_BAR_WAITS,
  OPENING_STARTS_LIT,
  openingOf,
  SCHEME_BAR,
  schemeOf,
  type ModeId,
  type OpeningKind,
  type OpeningTake,
  type SchemeKind,
} from '@/modes'

// How long a **peek** keeps the lights on. Long enough to catch a key or two and nowhere
// near long enough to read the whole dial.
const PEEK_MS = 200

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
// Every run starts with the lights on, a retry included, for however long its take gives them.
//
// A **peek** is the lights coming on again mid-run: the player pulling what an opening left
// behind (`LightsOutPull`), for `PEEK_MS`. Everything about it runs through the same two
// answers the switch does, the scheme and `opened`, so the screen and the dial simply are as
// they were before the switch, and nothing else has to hear of it.
//
// The scheme is `day` behind the intro, which covers the game screen, and while an
// opening's full take has not yet reached its switch — the lights are still on. It is the
// mode's own
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
  // Whether the run is held **ready**.
  held: boolean
  take: OpeningTake
  // Whether the dial may draw itself as its scheme has it — false only while an opening
  // is still playing with the lights on. See `opened` on `Dial`.
  opened: boolean
  scheme: SchemeKind
  // The scheme the rows above the dial wear, and the one ink it draws them in if it has one, for
  // what is coloured up in the screen rather than under the provider. See `OPENING_BAR_WAITS`.
  barScheme: SchemeKind
  barInk: string | null
  // The scheme the keys and the sum wear, held the same way, so a mirror's keys are glass from
  // the first frame rather than changing as the edge goes.
  dialScheme: SchemeKind
  // The phone's own icons. They follow the game screen only while it is what is on
  // screen: the pause and game over screens over it are drawn light.
  statusBar: 'dark' | 'light'
  // Held or playing: the game screen is the thing on screen and a thumb is on it. What
  // keeps the feedback tab off a scene that is about to become a live run — see
  // `showFeedbackBookmark`.
  inPlay: boolean
  // What the screen flashes when a life goes: the app's red, or a **monochrome** scheme's
  // one ink.
  flash: string
  onSwitch: () => void
  // The lights on again for a moment, mid-run. See `PEEK_MS`.
  peeking: boolean
  peek: () => void
  // How the remains are being pulled: held here because they are drawn behind the run and
  // felt above it, by two components. See `OpeningOver`.
  pull: { tug: SharedValue<number>; wave: SharedValue<number> }
  // How far an edge has swept the screen, nought to one, held here because the scene moves it
  // and the dial and the sheet under the run read it. One when nothing is sweeping, so a dial
  // that turns with it stands as it ends, a restored run included.
  sweep: SharedValue<number>
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
  const [peeking, setPeeking] = useState(false)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (peekTimer.current !== null) clearTimeout(peekTimer.current)
    },
    [],
  )
  const tug = useSharedValue(0)
  const wave = useSharedValue(1)
  const sweep = useSharedValue(1)
  const kind = openingOf(mode)
  // An opening that starts in the mode's scheme has no moment with the lights on, which is
  // also what spares a retry a frame of the day colours flashing through it.
  const startsLit = kind !== null && OPENING_STARTS_LIT[kind]
  // Only in play: a pull that lands as a run ends must not light the screen under game over.
  const peeked = peeking && name === 'playing'
  const lightsOn = name === 'menu' || (held && !switched && startsLit) || peeked
  const scheme = lightsOn ? 'day' : schemeOf(mode)
  const barWaits = kind !== null && OPENING_BAR_WAITS[kind]
  const dialScheme = lightsOn && barWaits ? 'day' : schemeOf(mode)
  const barScheme = SCHEME_BAR[dialScheme]
  const onScreen = held || name === 'playing'
  return {
    layer: held ? kind : null,
    remains: held || name === 'menu' ? null : kind,
    held,
    take,
    opened: !peeked && (!held || switched),
    scheme,
    barScheme,
    barInk: SCHEMES[barScheme].inks.mono,
    dialScheme,
    statusBar: onScreen ? SCHEMES[scheme].inks.statusBar : 'dark',
    inPlay: onScreen,
    flash: SCHEMES[scheme].inks.mono ?? APP_RED,
    onSwitch: () => {
      setSwitched(true)
    },
    peeking: peeked,
    peek: () => {
      if (peekTimer.current !== null) clearTimeout(peekTimer.current)
      setPeeking(true)
      peekTimer.current = setTimeout(() => {
        setPeeking(false)
      }, PEEK_MS)
    },
    pull: { tug, wave },
    sweep,
  }
}
