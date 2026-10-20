import { PRIMARY_INK } from '@/constants/colors'

// What a challenge is painted in.
//
// Every mode carries its own two stops (see `modes/palette.ts`), and the four permanent
// ones are a chain: accuracy's end is speed's start, speed's is arcade's. A challenge
// cannot join that chain. There are twenty-odd of them, each on the app for a day, and a
// hue handed out along a spectrum of four would either repeat a mode's colour or run out
// of spectrum — so a challenge is built the other way about, and the result is a third
// shape of mode pair rather than a fifth link.
//
// **The first stop is the same for every challenge** and is the app's own near-black. It
// is what says *this is a challenge* at a glance, before the eye has read the hue beside
// it: no permanent mode starts dark, so the pair reads as a different kind of thing
// rather than as a mode nobody recognises. Trainee being two shades of one blue is the
// same instinct one step less far — see the design-guide.
//
// **The second stop is the challenge's own**, and is the only thing that varies.
//
// The dark stop is `PRIMARY_INK` rather than a near-black of this file's own. That is the
// same hex as `--color-strong`, which is the ground every primary button in the app
// already stands on — a fourth spelling of it here is how a palette grows three blacks
// that are almost the same. It is also what the card reads as its *ink*: `gradientOf(id)
// [0]` is what `challenge-card.tsx` already colours the name and the mark with, so the
// title comes out in the app's own text colour and needs no separate ink beside the
// scale the way gold and the achievement green both do.

// The arc the second stop is drawn from: violet through to magenta.
//
// Not an arbitrary window. Every other hue in the app already means something — blue,
// indigo, pink, red and amber are the mode chain, 43° is the gold of a record you hold,
// 96–136° the green of an achievement you keep, 175° the teal of multiplayer — and a
// challenge wearing one of those would be saying two things at once. This is the one
// wide run nothing else owns, with about fourteen degrees of clearance from indigo below
// it and from pink above.
const ARC_FROM = 255
const ARC_WIDTH = 75

// Where in the arc a challenge lands, by its position in the catalog.
//
// The golden ratio rather than an even division, because the number of challenges is not
// known in advance: dividing the arc by however many there are today would move every
// existing colour the moment a new one is written. Stepping by an irrational fraction
// instead puts each new challenge in the largest gap left by the ones before it — four
// challenges sit about 18° apart, eight about 7°, and nothing ever has to move.
//
// Keyed on the **index** rather than on a hash of the slug, which is what makes it
// stable: the catalog is append-only by design — "nothing is deleted from it" — so an
// index is a permanent fact about a challenge. A hash would have been stable too, but it
// packs far worse: hashing eight plausible slugs put two of them 1.5° apart, which is one
// colour wearing two names.
const PHI = 0.618033988749895

export const challengeHue = (index: number): number =>
  ARC_FROM + ((index * PHI) % 1) * ARC_WIDTH

// The arc's own bounds, for the test that holds this to the hues the app has spoken for.
export const CHALLENGE_ARC = { from: ARC_FROM, to: ARC_FROM + ARC_WIDTH } as const

// One hue at one lightness, as a hex stop.
//
// Saturation and lightness are fixed rather than varied per challenge: the hue is already
// doing the distinguishing, and a second axis moving with it would make one challenge
// read as louder than another when the only difference is which was written first.
function stop(hue: number, saturation: number, lightness: number): string {
  const a = saturation * Math.min(lightness, 1 - lightness)
  const channel = (n: number): string => {
    const k = (n + hue / 30) % 12
    const v = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

// The hue inside a stop this file made, read back out.
//
// The honest inverse of `stop` above, and it exists because the one thing a drawing
// needs from a challenge is its hue, while the only thing a mode carries is its pair of
// hexes. Resolving the hue from the catalog index instead would mean every caller
// knowing a challenge's place in a list, which is the one fact about a challenge nothing
// outside this file should have to hold.
//
// Grey in, nought out — a hue is meaningless without saturation, and nought is as good
// an answer as any for a colour that has none.
export function hueOf(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const span = max - Math.min(r, g, b)
  if (span === 0) return 0
  const sixth =
    max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4
  return (sixth * 60 + 360) % 360
}

// The discs a **drilled** run's targets are drawn on: one pale tint each, all of them
// this challenge's own colour.
//
// A drill is the same nine targets every run, so the thing a player learns is *which
// card is which* — and a colour is read before a number is. Nine tints make the board a
// shape to memorise rather than nine grey circles to read in turn. The band tint every
// other mode wears says something different and useful there (which hundred the target
// is in) and nothing here: on a fixed nine, the player knows.
//
// Spread around the challenge's own hue rather than across the wheel, so nine different
// cards still read as one challenge. The walk is wide enough to tell neighbours apart and
// narrow enough to stay inside a family — and it alternates either side of the hue, so
// the three or four on screen together are never three steps of the same drift.
//
// Pale, at the lightness `TARGET_BAND_TRACK` already sits at, because the numeral on top
// is the app's near-black and these have to carry it. `palette.test.ts` holds the floor.
const TINT = { saturation: 0.45, lightness: 0.84 }
const TINT_SPREAD = 150

export const challengeTints = (hue: number, count: number): readonly string[] =>
  Array.from({ length: count }, (_, index) => {
    // Alternating outward: 0, +1, −1, +2, −2 … so adjacent indices are never adjacent
    // hues and the first few dealt are plainly different from each other.
    const step = Math.ceil(index / 2) * (index % 2 === 0 ? 1 : -1)
    const walk = count <= 1 ? 0 : (step / count) * TINT_SPREAD
    return stop((hue + walk + 360) % 360, TINT.saturation, TINT.lightness)
  })

// The pair the card and the title wear. Tuned to the vividness of the mode stops beside
// it, so a challenge looks like it belongs to this app rather than to a colour picker.
const BRIGHT = { saturation: 0.62, lightness: 0.58 }

// The pair a button wears, dark enough to carry white text. Measured: white on the
// darkest of these is about 11.5:1 and on the lightest about 14.8:1, across the whole
// arc — see `palette.test.ts`, which holds the floor rather than trusting the numbers.
const DARK = { saturation: 0.58, lightness: 0.24 }

// The pair for one hue. What a challenge naming its own colour goes through, so it names
// a *hue* and not two hexes — the near-black, the two saturations and the two lightnesses
// stay this file's business, and a hand-picked challenge comes out built the same way as
// a generated one.
export const challengePairFor = (hue: number): readonly [string, string] => [
  PRIMARY_INK,
  stop(hue, BRIGHT.saturation, BRIGHT.lightness),
]

export const challengeDarkPairFor = (hue: number): readonly [string, string] => [
  PRIMARY_INK,
  stop(hue, DARK.saturation, DARK.lightness),
]

export const challengeGradient = (index: number): readonly [string, string] =>
  challengePairFor(challengeHue(index))

export const challengeDarkGradient = (index: number): readonly [string, string] =>
  challengeDarkPairFor(challengeHue(index))

// ─── Hues a challenge may ask for by name ────────────────────────────────────

// Turquoise at its blue end, which `four-keys` wears.
//
// Outside the generated arc, and deliberately — a challenge may name a hue the sequence
// would never reach.
//
// **190° and not 174°**, which is where this started. The greener turquoise sat one
// degree off `MULTIPLAYER_GRADIENT`'s teal at 175°, and the two were the same colour in
// the way navy and sky are: told apart only by weight, that teal being dark and nearly
// fully saturated on a filled card behind white text while this is light on a 2px rule.
// Leaning it towards blue was asked for on its own merits and settles that as well — 15°
// of clearance rather than one, and 32° from trainee's blue on the other side, which is
// about as much room as there is between the two.
//
// The generated arc still refuses this whole neighbourhood and `palette.test.ts` holds it
// to that. An override is a decision somebody made, which is a different thing from a
// sequence wandering in.
//
// **Its bright stop cannot carry text**, measuring well under the bar on the card: cyan
// is an intrinsically light hue, so the vivid version of it is pale. `challengeInk`
// answers that by darkening it to about 5.1:1, which means the edge and the name are two
// shades of it rather than one. That is the same bargain gold has always struck here —
// `GOLD_SCALE` fills, `GOLD_INK` writes, because `#FFD166` is 1.26:1 on the surface — so
// it is the system working rather than an exception to it.
export const TURQUOISE = 190

// The challenge's own colour as **text**.
//
// Same split the app already makes twice: `GOLD_INK` beside `GOLD_SCALE`, and
// `ACHIEVEMENT_INK` beside `ACHIEVEMENT_SCALE`. A scale is tuned to *be* a colour — to
// fill an edge, a bar, a button — and the shade that reads best as a fill is not the
// shade that carries a word on a near-white card. Reaching into the gradient for a text
// colour is the mistake all three of these exist to stop.
//
// The arc makes this unavoidable rather than merely tidy. The bright stop on the card's
// white is about 5.3:1 at the arc's violet end and about 3.4:1 at its magenta end,
// because magenta is a lighter hue at the same lightness — so a name drawn in the raw
// stop would be comfortably readable for one challenge and under the bar for the next,
// with nothing in the code to say which. This is the same hue at whatever lightness
// clears 4.5:1 on both grounds, which comes out near 5.1:1 for every challenge.
//
// 4.5:1 and not 3:1 because `TYPE.cardTitleSm` is 14px bold, which WCAG counts as normal
// text rather than large — see the note on that role.
//
// **Takes the stop rather than the index**, which is the difference between this being
// right and being right most of the time: a challenge may name its own `gradient`, and an
// ink derived from its catalog position would then be a hue the card does not use
// anywhere. Given the stop, an overridden pair gets an ink that matches it.
const INK_FLOOR = 4.5

// The two grounds a challenge's name is ever drawn on: the card's own white and the
// screen behind it. The white is the tighter of the two, being the lighter.
const CARD = '#FDFCFA'
const SURFACE = '#F3EFE9'

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  )
}

const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

// A hex back to the hue and saturation it was built from, so the ink can be the same
// colour at a different lightness rather than the same colour mixed with black — which
// would drag every hue towards the same muddy middle on its way down.
function hueAndSaturation(hex: string): { hue: number; saturation: number } {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  const lightness = (max + min) / 2
  if (span === 0) return { hue: 0, saturation: 0 }
  const hue =
    max === r
      ? 60 * (((g - b) / span) % 6)
      : max === g
        ? 60 * ((b - r) / span + 2)
        : 60 * ((r - g) / span + 4)
  return {
    hue: ((hue % 360) + 360) % 360,
    saturation: span / (1 - Math.abs(2 * lightness - 1)),
  }
}

// Walked down in small steps rather than solved, because the relationship between
// lightness and contrast is not one an inverse of this function would be shorter than.
// A handful of iterations, once per render of one card, is not a cost worth being clever
// about.
export function challengeInk(brightStop: string): string {
  // A stop that already carries a word is returned untouched. Rebuilding it from its own
  // hue and saturation would land within a step or two of 255 of where it started, which
  // is a colour nobody asked for in place of one that was already right — and the card
  // would be drawing a hair off the hue on its own edge.
  if (
    contrast(brightStop, CARD) >= INK_FLOOR &&
    contrast(brightStop, SURFACE) >= INK_FLOOR
  ) {
    return brightStop
  }

  const { hue, saturation } = hueAndSaturation(brightStop)
  for (let lightness = 0.58; lightness > 0.08; lightness -= 0.005) {
    const candidate = stop(hue, saturation, lightness)
    if (
      contrast(candidate, CARD) >= INK_FLOOR &&
      contrast(candidate, SURFACE) >= INK_FLOOR
    ) {
      return candidate
    }
  }
  // Reached only by a stop so light that no shade of its hue clears the floor — a white
  // or near-white override. Near-black of the same hue is the honest answer there.
  return stop(hue, saturation, 0.1)
}
