import type { TargetBand } from '@/types/game'

// Brand + value-tint palettes shared across the game UI.

// The screen background. Anything that needs to hide what is behind it — the
// announcement sweep, a curtain — paints in this.
export const SURFACE = '#F3EFE9'

export const APP_BLUE = '#4C7EFF'
export const APP_RED = '#E5534B'

// The violet mid-point of the spectrum. It is the manifest `theme_color` and the
// Android adaptive-icon background, so it is the app's own hue for the rare
// element that speaks for the app rather than for a mode.
export const APP_VIOLET = '#7273D2'

// The game's full spectrum, as seen on the splash and the app icon: the app's own blue
// through to the red of its fastest mode.
//
// No longer the span of the mode gradients, which it was until trainee took a second
// blue for its end stop instead of the violet accuracy starts from — these four stops
// are the identity arc, and three of the four modes still chain along it.
export const SPECTRUM = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B'] as const

// Gold marks the three board records. Needs dark ink — white on it is about 1.5:1.
export const GOLD_SCALE = ['#FFD166', '#FF8C00', '#FFE8A3', '#F4A261'] as const

// Gold as *text*, which GOLD_SCALE cannot be: the scale is a background palette, and
// #FFD166 on the surface is about 1.26:1 — invisible. So the mark that says a record is
// yours carries its own ink.
//
// As yellow as the parchment surface allows. Yellow is a light hue by nature, so on
// #F3EFE9 it runs out of contrast long before it runs out of brightness: this goldenrod
// is about 2.9:1, and anything more vivid stops being a mark and starts being a smudge.
export const GOLD_INK = '#B8860B'

// The `--color-dim` token as JavaScript, for the places a colour is computed instead of
// classed: an icon's `color` prop, a text input's placeholder, a worklet interpolating
// between two inks. The value is the one in global.css and must move with it — before
// this existed the same hex was copied into a dozen components.
//
// About 7.7:1 on the surface and 7.0:1 on the card above it — AAA on the first and a
// hair under it on the second, where the bar for ordinary text is 4.5:1.
//
// It was #6A655C, which cleared that bar at 5.1:1 and 4.6:1 and read, on a screen with a
// lot of it, as a page written in pencil. The admin screens were where that showed worst
// because nearly every line on them is secondary, but the ink is the app's and so is the
// change. Secondary text is still the quietest voice here; `--color-primary` is 15:1 and
// twice as loud, which is the distance that makes a hierarchy.
export const DIM_INK = '#4E4A43'

// The `--color-muted` token as JavaScript, for the same reason DIM_INK is: the dot menu
// takes its colour as a prop rather than as a class. Never text — this is the hairline
// weight, well under the contrast a word needs.
export const MUTED_INK = '#D4D0C8'

// The `--color-primary` token as JavaScript, and the same bargain as the two above: a
// framed digit takes its colour as a prop, because the box around it is already computing
// one. Primary text, so it is the darkest ink the app owns — identical to `--color-strong`,
// which is the same near-black doing the other job.
export const PRIMARY_INK = '#1C1928'

// The `--color-on-strong` token as JavaScript, and the fourth of these mirrors. The admin
// lists tick a feature on with an `Ionicons` checkmark, and an icon takes its colour as a
// prop — so the ink that goes on `bg-strong` has to exist as a value as well as a class.
// Must move with its definition in global.css, like the three above it.
export const ON_STRONG_INK = '#D8D2F4'

// Earning an achievement: the one hue the app had left. Modes own blue through amber,
// gold marks a board record you *currently hold*, teal means multiplayer and grey means a
// record just left you. An achievement is permanent and belongs to nobody else, so it
// takes the green nothing else does — gold is held, green is kept.
//
// A background palette like GOLD_SCALE, with the same limitation: needs dark ink, since
// white on #8DE86B is about 1.4:1.
export const ACHIEVEMENT_SCALE = ['#8DE86B', '#3FBF5F', '#C6F5A6', '#1E9448'] as const

// Dark ink for text sitting *on* ACHIEVEMENT_SCALE — about 7.8:1 on its darkest stop.
export const ACHIEVEMENT_BAR_INK = '#12210F'

// The achievement green as *text*, which ACHIEVEMENT_SCALE cannot be — same reason and
// same shape as GOLD_INK. The scale is tuned to carry ink, not to be it: #3FBF5F on the
// parchment surface is about 2.3:1. So the mark that says an achievement is earned
// carries its own ink: about 5.4:1 on #F3EFE9.
export const ACHIEVEMENT_INK = '#217A3D'

// A player's nickname, which is drawn in a gradient from Accuracy's hue to Speed's with
// each end faded by that player's lifetime average in the factor — see
// lib/name-gradient.ts for the colour, and the profile modal for where it explains
// itself.
//
// Its own pair for the same reason GOLD_INK and ACHIEVEMENT_INK are their own inks: the
// mode scale is tuned to *be* a colour, not to carry text at 10px. `gradientOf('speed')[1]`
// on the card is about 2.9:1, under the 4.5:1 the app's own `text-dim` holds.
//
// So these are the two mode stops taken 23% toward black. Both hues move by the same
// amount, which is what keeps the gradient between them even — shifting one stop alone
// would put a bend in the middle of every name.
//
// Only the hues themselves are tuned, because `desaturate` fades toward a grey of equal
// relative luminance and contrast is a function of luminance alone: a name at a blank
// career has the same contrast as one at a perfect career. The worst case across both
// surfaces is about 4.53:1, and `name-gradient.test.ts` holds every saturation to it.
//
// The ordering matches `nameStops`: accuracy first, speed second.
export const NAME_INK = ['#5859a2', '#b0403a'] as const satisfies readonly [
  string,
  string,
]

// Losing a record you held: the colour drained out. Kept to mid-tones with the app's
// faint violet cast.
export const GRAYSCALE = ['#5F5C6E', '#7A7688', '#95919F', '#B0ACB8'] as const

// The map an arcade run is drawn on: three weights of one ink.
//
// Its own named palette and deliberately *not* `GRAYSCALE` — those four greys mean a record
// that was taken off you, and a map drawn in the colour of loss would be saying something it
// does not mean.
//
// Most-present to least-present, so the ramp runs dark to light on the parchment surface.
// `line` carries outlines and buildings, `hatch` the hachures and shading, `faint` the
// graticule. The knockout a mark fills itself with before it is inked is the `surface`
// token itself, so it is invisible by construction.
export const MAP_INK = { line: '#6A655C', hatch: '#8E8A80', faint: '#BDB8AC' } as const

// A way the hero has not walked yet, which is the one thing on the sheet drawn in earth
// rather than in the map's own grey. Beside `MAP_INK` rather than inside it, because the
// difference is the point: the country is drawn in `line` and the roads through it are
// drawn in this, so a fan reads as the thing to answer and the land reads as the place it
// crosses. A little more present than `line` — 5.5:1 on the parchment against its 5:1,
// which is the right way round for the only mark on the sheet a player is choosing between
// — and nowhere near the amber a walked way is lit in, which is 2:1 and could never be
// mistaken for it.
export const WAY_INK = '#7A5A3A'

// Arcade's amber as *text*, which `gradientOf('arcade')` cannot be — same reason and same
// shape as GOLD_INK. #FF8C00 on the parchment surface is about 2:1: a fine stroke, a fine
// fill, and an invisible label. So the one place arcade's colour has to *be* the text —
// the ARCADE label on its own screen, and the depth under it — carries its own ink, the
// amber taken down toward brown: about 5.3:1 on #F3EFE9. That is as yellow as this
// surface allows before a label stops being a colour and starts being a smudge.
export const ARCADE_INK = '#9A4F06'

// The three readings of an arcade run's satiety bar: fed, low, and about to go. The bands
// themselves are `SATIETY_LOW` and `SATIETY_DIRE` in machines/satiety.ts, which owns what a
// satiety figure means; this is only what each one is drawn in.
//
// A palette of its own rather than three stops of the game scale, because the thing it says
// is not "which mode" — it is one bar getting worse. It begins on arcade's own ink and ends
// on the app red every other alarm in the app uses, so the ladder is two colours the player
// has already been taught plus one between them.
//
// That middle one is measured against the bar's track (`--color-muted`, #D4D0C8) rather than
// against the surface, the track being what a fill of any length actually sits on: 2.53:1,
// where `fed` is 3.91:1 and `spent` is 2.41:1. So the ladder darkens-to-brightens evenly and
// the warning is never the faintest of the three — which is the trap here, a bar that lights
// up by *fading*. None of the three reaches the 3:1 a control that carries its meaning in
// colour would owe, and they do not have to: the reading is the bar's **width**, and the
// colour is emphasis on top of it. See rule 1 in the design guide's accessibility notes —
// hue is never the only carrier here, and the one state hue could not carry on its own, an
// empty bar, is the one that pulses.
export const SATIETY_INK = { fed: ARCADE_INK, low: '#CC6410', spent: APP_RED } as const

// What every strike is drawn in, whichever mode fired it — the sniper's beam, the burst's
// rounds, a drilled run's chain and a challenge's flames under the dial. One palette rather
// than each mode's own colour, because a strike is the same news in every mode: a hit that
// landed on a live multiplier. The shot's *shape* is what says which streak it was.
//
// `hot` is the brightest stop of the gold the app already marks records in, `cool` the
// app's own red — a beam runs from one to the other along its length, and a lone mark
// wears whichever end suits it. Both are mid-tone, so they read against the surface a
// shot is fired over.
export const STRIKE_COLORS = { hot: GOLD_SCALE[0], cool: APP_RED } as const

// A feature's visibility on the admin screens, one hue per position: red for nobody,
// orange for whoever their role or override says, green for everybody. The one place on
// those screens a standing is told by hue rather than by how solid its chip is — asked
// for, because a list of twenty features is scanned for the odd one out, and three
// weights of one ink did not jump. Each is dark enough to carry `VISIBILITY_ON_INK` at
// chip size: about 6.5, 5.0 and 5.0 to one.
export const VISIBILITY_INK = {
  hidden: '#B42318',
  private: '#B45309',
  public: '#15803D',
} as const

// The label on a filled visibility chip.
export const VISIBILITY_ON_INK = '#FDFCFA'

// The game's whole scale, blue through to the arcade amber — every mode's colour at
// once.
export const GAME_SCALE = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B', '#FF8C00'] as const

// The countdown pie's track — the part revealed as the arc drains — tints by the
// target's hundreds band, so the band reads as area rather than as a digit you have
// to parse. The numeral sits directly on this, so these stay near the plain track's
// lightness. Band 0 keeps the untinted track, which makes "no colour" the sub-100 signal.
// The countdown numeral's ink as a value, for the one place that has to animate away
// from it: a lost target's number crossfades to white. Mirrors `--color-pie` in
// global.css — the token still paints it everywhere else, and the two are one colour.
export const PIE_INK = '#171421'

// Bands 1 to 3 are the game's own arc at tint strength — accuracy's violet, speed's
// pink, arcade's amber, each taken to around 85% lightness. Bands 4 to 9 carry that walk
// on round the wheel, through lime, green, teal and sky to a blue that stops short of
// coming back to band 1.
//
// **And they deepen as they climb**, 83% down to 73%, which the first four do not need
// and these six do: six pale tints at one lightness are more than the eye separates, and
// the two cues together mean a band differs from its neighbour in hue *and* in weight.
// It also says the right thing — the heaviest track is the biggest number. The deepest
// of them still carries the numeral at 7.2:1.
//
// Only a dial that reaches that high ever draws them: 324 is the ceiling of the nine
// every permanent mode is played on, so bands 4 and up belong to the four-by-four
// challenge and to whatever dial comes after it.
export const TARGET_BAND_TRACK = {
  0: MUTED_INK,
  1: '#CFCBEE',
  2: '#EBC7D2',
  3: '#F2DCB4',
  4: '#E9EEBA',
  5: '#C7E6B7',
  6: '#AFDEBF',
  7: '#A8DCDA',
  8: '#9FC5DF',
  9: '#96A0DE',
} as const satisfies Record<TargetBand, string>

type Palette = { low: string; high: string }

// Dial buttons tint by value across an on-brand cool gradient: 0 → 8 rides the
// low → high ramp (pale lavender → periwinkle), then 9 wears the mode's dark CTA
// gradient (DARK_MODE_GRADIENT) with the digit in `peakText` — so the maximum reads
// as its own state, not one more step. The peak background lives with the modes; only
// its ink is here.
//
// Trainee's weight and max badges reuse `low` + `text` as a fixed chip rather
// than inking text straight onto the ramp: that was tried first and measured as
// low as ~1.5:1 contrast, because a translucent hint and the animated fill it
// sat on faded in and out of contrast together. `low` + `text` is the one pairing
// already proven to read well on its own — DialButton just holds it still while
// everything around it keeps animating.
type DialPalette = Palette & {
  text: string
  peakText: string
}

// A very light wash of APP_RED (#E5534B lifted to ~86% lightness): warm enough
// to read as the brand red, light enough to sit on the dark gradient at ~10:1.
const PEAK_RED = '#FFC0B8'

export const DIAL_COLORS = {
  low: '#ECEAF7',
  high: '#8296FF',
  text: '#1C1928',
  peakText: PEAK_RED,
} as const satisfies DialPalette

// The score above the dial transitions from the target numbers' background
// color (APP_BLUE, the pie fill) up to the standard text color.
export const SCORE_COLORS = { low: APP_BLUE, high: '#1C1928' } as const satisfies Palette

// The all-time record turns the whole game-over screen gold, which means every semantic
// token has to be re-bound for that subtree: GOLD_SCALE is a background palette, and the
// app's own tokens are tuned for the parchment surface — laid straight onto gold the
// quieter ones stop separating. Applied with `vars()` so the screen's existing classes
// re-ink themselves rather than every component growing a prop for one case.
//
// The scale supplies the surfaces; the inks are chosen against #FFD166: near-black for
// primary (about 12:1), a dark goldenrod for secondary (about 4.6:1 — still clearly
// softer than primary, and no longer the 3.4:1 it was, which is a line you could see was
// there and not quite read).
// The gold screen's secondary ink, for the few places a colour is computed in JS
// instead of coming from a class — those cannot see the re-bound tokens.
export const GOLD_DIM_INK = '#715919'

export const GOLD_SCREEN_TOKENS = {
  '--color-surface': GOLD_SCALE[0],
  '--color-card': GOLD_SCALE[2],
  '--color-elevated': '#FFF6DC',
  '--color-muted': '#E0A94A',
  '--color-dim': GOLD_DIM_INK,
  '--color-primary': '#1C1928',
  '--color-strong': '#1C1928',
  '--color-on-strong': '#FFE8A3',
  '--color-score': '#147A32',
  '--color-dial': '#1C1928',
  '--color-factor': GOLD_DIM_INK,
  '--color-pie': '#1C1928',
} as const

// A mode's Extreme all-time screen is painted in that mode's own colours, darkened —
// DARK_MODE_GRADIENT rather than MODE_GRADIENT. The bright pair is the same mid-tone
// the title letters and the score are drawn in, so at full strength it would swallow
// them; the darkened pair is the app's existing answer to "this colour, carrying text".
//
// Its inks are light, against a background that is dark whatever else is on screen.
export const MODE_SCREEN_TOKENS = {
  '--color-surface': 'transparent',
  '--color-card': 'rgba(255, 255, 255, 0.12)',
  '--color-elevated': 'rgba(255, 255, 255, 0.18)',
  '--color-muted': 'rgba(255, 255, 255, 0.25)',
  '--color-dim': 'rgba(255, 255, 255, 0.7)',
  '--color-primary': '#FFFFFF',
  '--color-strong': 'rgba(0, 0, 0, 0.35)',
  '--color-on-strong': '#FFFFFF',
  '--color-score': '#FFFFFF',
  '--color-dial': '#FFFFFF',
  '--color-factor': 'rgba(255, 255, 255, 0.6)',
  '--color-pie': '#FFFFFF',
} as const

// Particles for the all-time celebration once it is playing over gold. The gold scale
// itself would disappear into its own background, so this is the pale end of it plus
// white — decoration is allowed to sit lighter than text.
export const PALE_GOLD = ['#FFF6DC', '#FFFFFF', '#FFE8A3', '#FFEFC2'] as const
