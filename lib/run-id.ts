// A v4-shaped id for one finished run.
//
// It exists so `record_run` can count a run exactly once: the id travels with the run
// from the device that played it, and the server keeps a receipt of every id it has
// already counted. A retry after a response was lost therefore adds nothing, which
// matters because a counter — unlike a best score — cannot notice or repair a run added
// twice.
//
// `crypto.randomUUID` where the platform has it, which is the web build and any native
// runtime that ships it. The fallback is not a security primitive and does not need to
// be: the ids only have to be distinct from the handful of other runs one device has in
// flight, and 122 random bits are far more than that asks for.
const RANDOM_HEX = (digits: number): string => {
  let out = ''
  while (out.length < digits) {
    out += Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0')
  }
  return out.slice(0, digits)
}

// The two fixed fields of a v4 uuid: the version nibble, and the variant bits that make
// the next digit one of 8, 9, a or b.
const VARIANTS = ['8', '9', 'a', 'b'] as const

export function newRunId(): string {
  // Read through a type that admits the generator might not be there. The lib types
  // promise `crypto.randomUUID` on every platform; a React Native runtime without it is
  // what this whole fallback exists for, so the promise is the thing to work around.
  const platform: { crypto?: { randomUUID?: () => string } } = globalThis
  const randomUUID = platform.crypto?.randomUUID
  if (typeof randomUUID === 'function') return randomUUID.call(platform.crypto)

  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)] ?? '8'
  return [
    RANDOM_HEX(8),
    RANDOM_HEX(4),
    `4${RANDOM_HEX(3)}`,
    `${variant}${RANDOM_HEX(3)}`,
    RANDOM_HEX(12),
  ].join('-')
}
