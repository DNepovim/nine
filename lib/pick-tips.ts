// Takes a few tips at random, without repeats.
//
// The rotating panel shows a handful rather than the whole list: five tips at six
// seconds each is half a minute of reading parked above the PLAY button, and a player
// who sees the same five in the same order every visit stops reading them at all. A
// short random set makes the panel worth glancing at again.
//
// Rolls come in as parameters rather than being drawn inside, the same way the
// announcement and praise pools do it: the choice stays pure and testable, and the
// randomness lives at the call site where it can be taken once per mount instead of on
// every render.
export function pickTips(
  tips: readonly string[],
  count: number,
  rolls: readonly number[],
): string[] {
  // A partial shuffle: each pick comes out of the pool, so the same tip cannot appear
  // twice however the rolls fall.
  const pool = [...tips]
  const taken: string[] = []
  const wanted = Math.min(count, pool.length)

  for (let i = 0; i < wanted; i++) {
    const roll = rolls[i] ?? 0
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
    const [picked] = pool.splice(index, 1)
    if (picked !== undefined) taken.push(picked)
  }

  return taken
}
