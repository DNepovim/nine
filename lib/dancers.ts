// What makes one dancer not another: which way it faces on the floor and what it wears. From the
// target's sequence number alone, so a drilled run — the same nine, every time — dresses and turns
// the same nine dancers every time, and a card put back from storage looks as it did.

// The outfits, in colours that stand out from honey oak and from one another.
export const OUTFITS = ['#B23A48', '#2E6F95', '#6A4C93', '#2F7D5B', '#C26A1B'] as const

export type Dancer = {
  // Degrees the dancer is turned from facing up the screen.
  turn: number
  outfit: (typeof OUTFITS)[number]
  // Which way it sways first: the dancers on a floor are not in step with each other.
  leads: 1 | -1
}

// A step that is co-prime with 360 and the palette, so neighbours in the deal do not face alike.
const TURN_STEP = 67

export function dancerOf(seq: number): Dancer {
  const index = ((seq % OUTFITS.length) + OUTFITS.length) % OUTFITS.length
  return {
    turn: (((seq * TURN_STEP) % 360) + 360) % 360,
    outfit: OUTFITS[index] ?? OUTFITS[0],
    leads: seq % 2 === 0 ? 1 : -1,
  }
}
