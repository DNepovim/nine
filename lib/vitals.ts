// What NO SLIP's heart monitor reads off the run: a patient's vitals, each made from a figure
// of how the run is going. Decorative, but not made up — a player who plays faster sees a
// faster pulse, and one who plays cleaner sees a better oxygen level.

// How the run stands. Accuracy and speed are the run's averages, nought to a hundred, and
// nought where nothing has been hit yet.
export type RunFigures = {
  accuracy: number
  speed: number
  streak: number
  hits: number
  lives: number
}

export type Vitals = {
  // Beats a minute: the run's speed.
  heartRate: number
  // Systolic over diastolic, which climb with the pulse.
  pressure: readonly [number, number]
  // Blood oxygen, in per cent: the run's accuracy.
  oxygen: number
  // Breaths a minute: the streak.
  respiration: number
  // Degrees: warms with every target taken.
  temperature: number
}

// The patient at rest: before the run has hit anything.
export const RESTING: RunFigures = { accuracy: 0, speed: 0, streak: 0, hits: 0, lives: 3 }

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

export function vitalsOf({ accuracy, speed, streak, hits }: RunFigures): Vitals {
  const heartRate = Math.round(60 + clamp(speed, 0, 100) * 0.9)
  const systolic = Math.round(90 + heartRate * 0.35)
  return {
    heartRate,
    pressure: [systolic, Math.round(systolic * 0.65)],
    // A run that has not hit anything has no accuracy to read: it is simply well.
    oxygen: hits === 0 ? 98 : Math.round(85 + clamp(accuracy, 0, 100) * 0.14),
    respiration: 12 + Math.min(streak, 12),
    temperature: Math.round((36.5 + Math.min(hits, 100) * 0.02) * 10) / 10,
  }
}

// A reading's restlessness: nought-centred noise in -1 … 1, the same for the same beat of the
// monitor and unrelated to the one before it. A hash, not a generator, so a reading is a
// function of its beat and needs no state.
const noise = (beat: number, channel: number): number => {
  const x = Math.sin(beat * 12.9898 + channel * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

// The vitals as the monitor shows them on `beat`: a real patient's figures are never still, so
// each wanders a little round the value the run gives it — a few beats either way for the
// pulse, a point of oxygen — and never off the scale a monitor would show.
export function livingVitals(vitals: Vitals, beat: number): Vitals {
  const systolic = vitals.pressure[0] + Math.round(noise(beat, 1) * 3)
  return {
    heartRate: vitals.heartRate + Math.round(noise(beat, 0) * 2),
    pressure: [systolic, vitals.pressure[1] + Math.round(noise(beat, 2) * 2)],
    oxygen: Math.min(100, vitals.oxygen + Math.round(noise(beat, 3))),
    respiration: vitals.respiration + Math.round(noise(beat, 4)),
    temperature: Math.round((vitals.temperature + noise(beat, 5) * 0.1) * 10) / 10,
  }
}
