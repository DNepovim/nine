// How far round a key has spun as an edge sweeps the screen, for a dial seen in a mirror: a
// key turns over as the edge reaches it, and ends back to front.
//
// `sweep` is how far along its way the edge has come and `at` where the key stands on that way,
// both as fractions of it. Eased at both ends, so a key sets off and lands rather than snapping.

// How much of the sweep one key's turn takes, centred on the edge reaching it.
const SPAN = 0.22

export const keySpinDegrees = (sweep: number, at: number): number => {
  'worklet'
  const turned = Math.min(1, Math.max(0, (sweep - at) / SPAN + 0.5))
  return turned * turned * (3 - 2 * turned) * 180
}
