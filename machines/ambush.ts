import {
  AMBUSH_PAR_MAX,
  AMBUSH_PAR_MIN,
  BANDIT_EVERY_FULL,
  BANDIT_EVERY_ONE,
  BANDIT_FIRST_FULL,
  BANDIT_FIRST_ONE,
  BANDITS_FULL,
  BANDITS_ONE,
  BEARING_JITTER,
  SPOIL_FOOD,
  SPOIL_HEART,
} from '@/constants/ambush'
import { HEARTS } from '@/constants/siege'
import { byStage } from '@/lib/arcade-stage'
import { parValues, rngFor } from '@/machines/arcade'
import { type Grid } from '@/modes'

// An ambush: the bandits standing on a way, and what a press does to them.
//
// Pure, like machines/arcade.ts and machines/siege.ts and for the same reason: no pixels,
// no React and no clock. The hook owns the one timer and calls in here for every rule, so a
// fight can be replayed from a seed and tested without a render.
//
// Two things here are deliberately unlike a siege, and they are most of what makes a road
// feel different from a wall:
//
// A band is whole from the first frame. Nobody is reinforced, there is no gate and no
// cadence — every bandit is already walking when the camera lands, each at its own distance,
// so what the player reads in the first second is the whole of what is coming. A siege is a
// thing that keeps arriving; an ambush is a thing that is already here.
//
// And a bandit takes one hit. A tower stands for several and takes a new number with each,
// which is what makes a wall several journeys across the dial; a man is answered once and is
// gone. A band of them at two or three presses apiece is journeys enough.

const TAU = Math.PI * 2

export type Bandit = {
  id: string
  value: number
  // Which way out from the hero it is standing, in radians, and how far — nought on top of
  // the hero and one at the edge of the ground. The distance is its arrival read backwards:
  // see `newAmbush`.
  bearing: number
  from: number
  // When it set off and how long it takes to reach the hero. A position rather than a
  // progress, so nothing has to tick: the screen reads the clock it already runs and works
  // the rest out on the UI thread. The same arrangement a warrior has.
  spawnedAt: number
  walkMs: number
}

// A bandit cut down, kept for as long as it takes to draw it.
//
// Here for the reason the siege's `Blow` is: the man is out of the band the instant the
// press lands, and something has to be left behind to play his going. Where he was standing
// and what he was answering to, which is everything the field needs.
export type Cut = {
  // Counts up over the fight, so the screen can key one effect on it and two cuts a moment
  // apart are two effects rather than one restarting.
  id: number
  // Where he was: the bearing he was coming in on, how far out he started, and how much of
  // that he had walked. The three of them are where he fell.
  bearing: number
  from: number
  at: number
  value: number
}

export type Ambush = {
  // The crossroad the ambushed way leads to. The map is a tree, so that names the road —
  // and it is also what the randomness is keyed on, which is what makes a road the same
  // road every time it is walked.
  at: string
  // The stage the band was laid out at — see lib/arcade-stage.ts. How many men are on the
  // road, how soon the first of them arrives and how far behind the rest are, all come off
  // it, and it is kept here so that a road the hero is driven off is the road it was.
  stage: number
  seed: number
  bandits: readonly Bandit[]
  // Every bandit of this road that is down: the ones cut on an earlier meeting and the ones
  // cut on this one. Folded back into the map when the fight ends, either way — a road the
  // hero was driven off is thinner the next time by exactly this much.
  fallen: readonly string[]
  cut: Cut | null
}

// What clearing a road pays. Three outcomes and no fourth: food, a heart, or the road
// itself and nothing else.
export type Spoil = 'food' | 'heart' | 'nothing'

// How many men are on a road at this stage.
//
// One figure for the whole band rather than a roll per road: the first thing a player reads
// when the camera lands is how many numbers there are, and a count that wandered between
// roads would make that unreadable without making it interesting.
export const banditCount = (stage: number): number =>
  Math.round(byStage(BANDITS_ONE, BANDITS_FULL, stage))

// Where every bandit of a road stands, before any of them have been cut down.
//
// The band is laid out from its arrivals rather than from its distances, and that is the one
// idea the whole encounter rests on: the nearest man is the one due first *because* near and
// soon are the same fact here. One walks in at the stage's own `first`, the next its `every`
// behind it, and so on down the band — then each one's distance is read
// back off its own walk as a share of the longest. So a player who looks at the ground knows
// the order they have to answer in, and no second number has to agree with the first.
//
// Bearings are slots round the circle, shuffled before they are handed out. Evenly spread,
// so two men never come in on one line however many there are; shuffled, so the band is not
// a spiral with the nearest man always next to the second nearest.
function band(at: string, stage: number, seed: number): readonly Omit<Bandit, 'value'>[] {
  const rng = rngFor(seed, `ambush:${at}`)
  const count = banditCount(stage)
  const first = byStage(BANDIT_FIRST_ONE, BANDIT_FIRST_FULL, stage)
  const every = byStage(BANDIT_EVERY_ONE, BANDIT_EVERY_FULL, stage)
  const longest = first + every * Math.max(0, count - 1)

  const slot = TAU / count
  const slots = Array.from({ length: count }, (_, i) => i)
  // Fisher–Yates, the whole way: which slot a man gets is the only thing shuffled here, and
  // a partial shuffle would leave the tail of the band in order.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = slots[i]
    const b = slots[j]
    if (a === undefined || b === undefined) continue
    slots[i] = b
    slots[j] = a
  }

  return slots.map((at_, i) => {
    const walkMs = first + every * i
    return {
      id: `b${i}`,
      bearing: (at_ + 0.5) * slot + (rng() - 0.5) * slot * BEARING_JITTER,
      // Against the full band's longest walk rather than the survivors', so a man stands
      // where he stood last time however many of his fellows are missing.
      from: longest <= 0 ? 1 : walkMs / longest,
      spawnedAt: 0,
      walkMs: Math.round(walkMs),
    }
  })
}

// The road as the hero finds it.
//
// `cutDown` is what the map remembers of an earlier meeting: those men are not dealt again.
// Everything else about a survivor — his bearing, his distance, his pace — comes off the
// road's own seed and so is exactly what it was, which is what makes a second run at a road
// the same fight one man shorter rather than a new fight of the same size.
//
// The numbers are the one thing drawn fresh, and that is the same decision a siege makes:
// numbers fixed when the map was grown would be reachable from the grid the hero happened
// to be holding then and nowhere near reachable from the one it is holding now.
export function newAmbush(
  at: string,
  stage: number,
  seed: number,
  grid: Grid,
  cutDown: readonly string[],
): Ambush {
  const standing = band(at, stage, seed).filter((bandit) => !cutDown.includes(bandit.id))
  const rng = rngFor(seed, `ambush:values:${at}`)
  const values = parValues(grid, standing.length, rng, {
    min: AMBUSH_PAR_MIN,
    max: AMBUSH_PAR_MAX,
  })
  return {
    at,
    stage,
    seed,
    // A man the grid has no number for is a man who cannot be answered, so he is not dealt.
    // It cannot happen on this dial — the band stretches until it finds enough — but a
    // bandit with an `undefined` number would be an ambush nobody could finish.
    bandits: standing.flatMap((bandit, i) => {
      const value = values[i]
      return value === undefined ? [] : [{ ...bandit, value }]
    }),
    fallen: cutDown,
    cut: null,
  }
}

// The fight starting: every man sets off at once.
//
// Stamped here rather than when the ambush was built, and the difference is the camera
// coming down — a little under a second in which the dial answers nothing. Counted from the
// build, the nearest bandit would have spent a fifth of his walk before the player could
// press a key, so the grace the stage's first gap names would not be the grace they get. The
// same reasoning, and the same beat, as the siege's `opened`.
export function sprung(ambush: Ambush, now: number): Ambush {
  return {
    ...ambush,
    bandits: ambush.bandits.map((bandit) => ({ ...bandit, spawnedAt: now })),
  }
}

// How far along his walk a man has got, nought where he started and one on top of the hero.
// The one thing the screen cannot work out for itself once he is gone.
export const walked = (bandit: Bandit, now: number): number =>
  Math.min(1, Math.max(0, (now - bandit.spawnedAt) / bandit.walkMs))

export type AmbushHit = {
  ambush: Ambush
  bandit: Bandit | null
  // True only on the press that cuts the last man standing.
  cleared: boolean
}

// A press, resolved against the band.
//
// The sum is what matters, not the keys: a press changes the grid, the grid gives a sum, and
// arriving at a live number is the hit. Hence the first guard — `pressGrid` always moves the
// sum, but `setGrid` can write a digit the value it already held, and without this that
// would cut whatever man the sum is standing on a second time.
export function land(
  ambush: Ambush,
  prevSum: number,
  nextSum: number,
  now: number,
): AmbushHit {
  const miss: AmbushHit = { ambush, bandit: null, cleared: false }
  if (nextSum === prevSum) return miss

  const cut = ambush.bandits.find((bandit) => bandit.value === nextSum)
  if (cut === undefined) return miss

  const bandits = ambush.bandits.filter((bandit) => bandit.id !== cut.id)
  return {
    ambush: {
      ...ambush,
      bandits,
      fallen: [...ambush.fallen, cut.id],
      cut: {
        id: (ambush.cut?.id ?? 0) + 1,
        bearing: cut.bearing,
        from: cut.from,
        at: walked(cut, now),
        value: cut.value,
      },
    },
    bandit: cut,
    cleared: bandits.length === 0,
  }
}

// When the next thing in this fight happens: the soonest man to reach the hero.
//
// Null when there is nobody left to arrive, and that is not a formality. An ambush has no
// gate and so has no second clock to fall back on the way a siege does — a figure handed
// back here for an empty band would arm a timer against a fight that is already over, and
// `Infinity` would arm one that never fires. The hook reads the null and arms nothing.
export function nextEvent(ambush: Ambush): number | null {
  let due: number | null = null
  for (const bandit of ambush.bandits) {
    const at = bandit.spawnedAt + bandit.walkMs
    if (due === null || at < due) due = at
  }
  return due
}

// Resolve exactly one event, and say whether it cost a heart.
//
// Only ever one thing can happen in an ambush, which is a man reaching the hero — so unlike
// a siege there is nothing to order and nothing to catch up on. He is taken off the ground
// as he lands: he is standing on the hero, and a man drawn there is a man covering the one
// thing the player is watching.
//
// He is *not* added to `fallen`. He was not cut down — he won — and a road the hero is
// driven off keeps every man it did not lose.
export function advance(ambush: Ambush, now: number): { ambush: Ambush; lost: boolean } {
  let arrived: Bandit | null = null
  for (const bandit of ambush.bandits) {
    const at = bandit.spawnedAt + bandit.walkMs
    if (at > now) continue
    if (arrived === null || at < arrived.spawnedAt + arrived.walkMs) arrived = bandit
  }
  if (arrived === null) return { ambush, lost: false }
  const gone = arrived
  return {
    ambush: {
      ...ambush,
      bandits: ambush.bandits.filter((bandit) => bandit.id !== gone.id),
    },
    lost: true,
  }
}

// Every clock in the fight moved forward by however long the player was away.
//
// What makes a pause resumable: a man three quarters of the way in is three quarters of the
// way in when the player comes back, because his `spawnedAt` moved with the pause and his
// `walkMs` did not. The same trick the run's own beat uses, and the siege's.
export function shift(ambush: Ambush, byMs: number): Ambush {
  return {
    ...ambush,
    bandits: ambush.bandits.map((bandit) => ({
      ...bandit,
      spawnedAt: bandit.spawnedAt + byMs,
    })),
  }
}

// What this road pays for being cleared.
//
// On a stream of its own, keyed on the road, so a road always pays what that road pays —
// a player driven off one and coming back to it is walking toward a known prize, and two
// roads in a run are not the same prize twice by accident.
export function spoilOf(at: string, seed: number): Spoil {
  const roll = rngFor(seed, `spoil:${at}`)()
  if (roll < SPOIL_FOOD) return 'food'
  if (roll < SPOIL_HEART) return 'heart'
  return 'nothing'
}

// And what it actually pays, which is not quite the same question.
//
// A heart handed to a hero already carrying three is nothing at all, and nothing at all
// after a fight that long would read as the game having forgotten to pay. So a full hero is
// paid in food instead — the one thing the bar can always take more of.
export function paidAs(spoil: Spoil, hearts: number): Spoil {
  if (spoil === 'heart' && hearts >= HEARTS) return 'food'
  return spoil
}
