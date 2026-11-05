// How ONE KEY's plane flies, as numbers: what pulls it down and how long a fall takes. The
// plane's frame loop (`components/game/openings/takeoff.tsx`) steps the same law frame by frame;
// this is the same law run ahead, to say how long until the ground.

import { seeded } from '@/lib/storm'

// In px and seconds: how hard the ground pulls, and how much the air holds the plane back, as
// a share of its speed a second.
export const GRAVITY = 1100
export const DRAG = 3

// The longest a fall is counted for, in ms: a plane that would climb forever is not waited for.
const LONGEST_MS = 5000
const STEP = 1 / 60

// How long, in ms, a plane at height `y` going down at `climb` px/s (negative going up) takes
// to reach `ground`, with no more presses.
export function fallMs(y: number, climb: number, ground: number): number {
  let height = y
  let speed = climb
  let elapsed = 0
  while (height < ground && elapsed < LONGEST_MS) {
    speed += (GRAVITY - speed * DRAG) * STEP
    height += speed * STEP
    elapsed += STEP * 1000
  }
  return elapsed
}

export type RoadsideKind = 'tree' | 'pine' | 'house' | 'cow'

export type Roadside = {
  // How far along the track it stands, in px.
  at: number
  kind: RoadsideKind
  // How big it is drawn against its natural size.
  scale: number
}

const KINDS: readonly RoadsideKind[] = ['tree', 'pine', 'house', 'cow', 'tree', 'cow']

// What stands along the ground as the plane goes by: `count` trees, houses and cows spread along a
// track `track` px long that the screen is a window on and that comes round again. The same
// every time for the same seed, one of a kind never next to another of its own, and none
// closer than a fifth of an even spacing to the next, so the ground has gaps in it.
export function roadside(seed: number, count: number, track: number): Roadside[] {
  const roll = seeded(seed)
  const gap = track / count
  const items: Roadside[] = []
  for (let index = 0; index < count; index += 1) {
    const before = items[index - 1]?.kind
    const options = KINDS.filter((kind) => kind !== before)
    items.push({
      at: Math.round(index * gap + gap * (0.2 + roll() * 0.6)),
      kind: options[Math.floor(roll() * options.length)] ?? 'tree',
      scale: 0.8 + roll() * 0.5,
    })
  }
  return items
}
