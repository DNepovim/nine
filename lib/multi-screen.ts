// Which multiplayer screen a room is on: the waiting room, the shared run or the results — none of
// them for a player who is in no room. `active` is any of the three.
export type MultiPhase = 'waiting' | 'playing' | 'results'

export type MultiScreen = {
  waiting: boolean
  playing: boolean
  results: boolean
  active: boolean
}

export function multiScreenOf(inRoom: boolean, phase: MultiPhase): MultiScreen {
  const waiting = inRoom && phase === 'waiting'
  const playing = inRoom && phase === 'playing'
  const results = inRoom && phase === 'results'
  return { waiting, playing, results, active: waiting || playing || results }
}
