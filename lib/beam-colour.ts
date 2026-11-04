import { LIGHTS_OUT } from '@/constants/colors'
import { mixHex } from '@/lib/mix-hex'

// The colour of a flashlight's beam as its battery runs down, which is how a `flashlit`
// target shows its clock: warm white when fresh, orange at half, deep red at the end.
//
// In steps rather than continuously, because a gradient's stops cannot be animated on the UI
// thread: the beam is redrawn once per step. Enough of them that no single change reads as
// a jump, and few enough that a target costs a couple of dozen renders in its life.
const STEPS = 24

// Which step the clock is on, from `STEPS` at full to nought when it has run out.
export const beamStep = (progress: number): number => {
  'worklet'
  return Math.ceil(progress * STEPS)
}

export function beamColour(step: number): string {
  const left = step / STEPS
  return left >= 0.5
    ? mixHex(LIGHTS_OUT.beamLow, LIGHTS_OUT.beam, (left - 0.5) * 2)
    : mixHex(LIGHTS_OUT.beamOut, LIGHTS_OUT.beamLow, left * 2)
}
