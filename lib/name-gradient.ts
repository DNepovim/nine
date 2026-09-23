import { NAME_INK } from '@/constants/colors'
import { lerpColor } from '@/machines/modes'

// A nickname, coloured by how the player plays.
//
// The name runs across a two-stop gradient, one character per step, the way the intro
// screen draws NINE. What is new is where the two stops come from: the front of the name
// is Accuracy's hue and the back is Speed's, and each end keeps only as much of its
// colour as the player's lifetime average in that factor. So a name says two things at a
// glance — an exact player's front end is vivid, a fast player's back end is, and someone
// who is neither wears their name in grey.
//
// This reverses a decision `ProfileName` used to carry, which said a name should stay
// mode-neutral because "a player is not a mode". That held while the only thing a colour
// could have meant was *which mode they play*, which is a choice rather than a fact about
// them. These two averages are not a choice — every run pays into both, in either mode,
// so the pair describes how somebody plays rather than what they picked off a menu.

// The two hues the name travels between: Accuracy's opening stop and Speed's closing
// one, in the theme's own ink.
//
// Not each mode's own first stop, which is what the mode headings lower down the profile
// use. Accuracy opens on violet and Speed opens on the pink that Accuracy *ends* on, so
// that pair is a third of the spectrum and across six characters reads as one colour
// rather than as a gradient. Taking the outer end of each mode's pair spends the widest
// span the two modes can honestly claim, and the pink they share still falls in the
// middle of it — so the name crosses both modes' territory rather than skipping over it.
//
// Read from `NAME_INK` rather than from `MODE_GRADIENT` directly, because at 10px these
// hues *are* the text: see that constant for the contrast this costs and buys.
export const nameInk = (scheme: NameScheme): readonly [string, string] => NAME_INK[scheme]

// Which theme the name is being drawn in. Read off `NAME_INK`'s own keys rather than
// imported from the theme hook, so nothing in lib/ reaches into React.
export type NameScheme = keyof typeof NAME_INK

// What a player's lifetime averages are, as percentages. Null where no hit has been
// counted — which `saturationFor` reads as zero rather than as a state of its own.
export type NameFactors = {
  avgAccuracy: number | null
  avgSpeed: number | null
}

// The average that earns a hue at full strength. Averages can exceed this — the speed
// factor pays a bonus above the fast band and `averagePercent` deliberately does not
// clamp — but there is no colour past the hue itself, so the scale tops out here.
const FULL_AVERAGE = 100

// How much of its hue an end of the name keeps, from its factor's lifetime average.
//
// A player with no hits counted reads as zero rather than as an unknown. They are drawn
// the same as a player who has hit badly, which is the honest reading: both have shown
// the boards nothing.
export const saturationFor = (average: number | null): number => {
  if (average === null || average <= 0) return 0
  return Math.min(1, average / FULL_AVERAGE)
}

// A hue with some of its colour taken out, fading toward the grey that is exactly as
// bright as it is rather than toward white or black.
//
// That is the whole reason this is not a plain HSL saturation cut. Contrast against a
// background is a function of relative luminance alone, so a grey matched on relative
// luminance has *identical* contrast to the hue it came from — which means a name reads
// just as well at a blank career as at a perfect one, and `NAME_INK` only has to be
// checked at the hue itself for the whole range to hold.
//
// Matched in gamma-decoded space, not on the raw bytes. The naive weighted mean of the
// sRGB channels is not luminance — it is off by the transfer function — and a grey
// picked that way drifts by enough to cost a name most of a contrast point.
export function desaturate(hex: string, saturation: number): string {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  // Rec. 709 weights over gamma-decoded channels: the eye reads green as far brighter
  // than blue, and the decode is what makes the number a luminance rather than a mean.
  const luminance = channels.reduce<number>(
    (sum, channel, index) =>
      sum +
      (LUMINANCE_WEIGHTS[index] ?? 0) *
        (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4),
    0,
  )
  // Back through the transfer function to find the grey that carries that luminance.
  const grey =
    luminance <= 0.0031308 ? luminance * 12.92 : 1.055 * luminance ** (1 / 2.4) - 0.055
  const byte = Math.round(grey * 255)
    .toString(16)
    .padStart(2, '0')
  return lerpColor(`#${byte}${byte}${byte}`, hex, saturation)
}

const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const

// The two ends of one player's name, in the theme it is being drawn in.
export function nameStops(
  { avgAccuracy, avgSpeed }: NameFactors,
  scheme: NameScheme,
): [string, string] {
  const [accuracy, speed] = nameInk(scheme)
  return [
    desaturate(accuracy, saturationFor(avgAccuracy)),
    desaturate(speed, saturationFor(avgSpeed)),
  ]
}

// The name split into characters, each with the colour it is drawn in.
//
// Split per character rather than run through a gradient fill because React Native has
// no text gradient — the title on the intro screen solves it the same way, which is why
// the two look like the same idea rather than two attempts at it.
//
// The walk is `Array.from` rather than a spread or `.split('')`: it steps code points, so
// a nickname carrying an emoji or a combining mark keeps its characters whole instead of
// having a surrogate pair torn in half and its halves coloured separately.
export function nameColors(
  nickname: string,
  factors: NameFactors,
  scheme: NameScheme,
): { char: string; color: string }[] {
  const [from, to] = nameStops(factors, scheme)
  const letters = Array.from(nickname)
  // A one-character name has no distance to travel, so it wears the opening stop whole
  // rather than dividing by zero and rendering as NaN.
  const last = Math.max(1, letters.length - 1)
  return letters.map((char, index) => ({
    char,
    color: lerpColor(from, to, index / last),
  }))
}
