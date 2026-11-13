import type { SchemeKind } from '@/modes/types'
import type { TargetBand } from '@/types/game'

// Brand + value-tint palettes shared across the game UI.

// The screen background. Anything that needs to hide what is behind it — the
// announcement sweep, a curtain — paints in this.
export const SURFACE = '#F5F0F6'

// The splash spectrum washed out to a background: each stop of SPECTRUM about 9% of the
// way from white, run the same corner to corner. SURFACE is roughly its average, so a
// knockout painted in SURFACE still sits on it without a seam you can find.
export const SURFACE_WASH = ['#EFF3FF', '#F2F2FB', '#FAF1F4', '#FDF0EF'] as const

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

// The ink on a pill filled with a colour of its own — white on every one of the gallery
// filter's four, which are all dark enough to carry it.
export const ON_TINT_INK = '#FFFFFF'

// The `--color-muted` token as JavaScript, for the same reason DIM_INK is: the dot menu
// takes its colour as a prop rather than as a class. Never text — this is the hairline
// weight, well under the contrast a word needs.
export const MUTED_INK = '#D4D0C8'

// `--color-card`, for the one place it has to be a hex: the challenge gallery's tiles,
// whose gradient ends on the plain tile colour.
export const CARD_INK = '#E8E4DC'

// The `--color-fortune` token as JavaScript, for the bubble under the profile's fortune,
// whose border takes its colour as a style rather than as a class.
export const FORTUNE_INK = '#a82a22'

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

// The still green dot on a challenge with a session in the queue, beside the red
// `LiveDot` of one on now. The public-visibility green, not `ACHIEVEMENT_SCALE`, which is
// kept for what a player keeps.
export const PLANNED_INK = VISIBILITY_INK.public

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

// ─── Schemes ─────────────────────────────────────────────────────────────────

// The two colours of an MS-DOS screen: the blue of its background and the white of its
// text. The `dos` scheme and BINARY's card are made of these and nothing else.
export const DOS_BLUE = '#0000AA'
export const DOS_WHITE = '#FFFFFF'

// The colours the game screen is played under for a run — its **scheme** (`SchemeKind` in
// modes/types.ts). Applied the way the painted game-over screens above re-bind theirs:
// `vars()` over the game screen's subtree, so every class on it re-inks itself, plus the
// few inks a component computes in JS and so cannot reach through a class.
//
// `day` re-binds nothing. Its tokens are the app's own `@theme`, read where they live
// rather than copied here, so the two can never disagree.
type SchemeToken = keyof typeof GOLD_SCREEN_TOKENS | '--color-fortune' | '--font-mono'

type SchemeInks = {
  // The top of the score readout's ramp — `SCORE_COLORS.high` on day, which is the text
  // colour and would vanish on a dark ground.
  score: string
  // The line round a key drawn black (`DialSpec.blackout`), so a black key on a dark
  // screen is still a key. Transparent on day, where nothing draws one.
  keyRim: string
  // The status bar's icons over this scheme: dark on day, light on dark.
  statusBar: 'dark' | 'light'
  // The screen's ground and the text drawn on it, for a colour computed in JS that has to
  // be checked against the scheme rather than re-bound by it — a mode's own accent in the
  // top bar, which `readableOn` keeps where it reads and swaps for `ink` where it does not.
  ground: string
  ink: string
  // The gradient the screen is painted on — `SurfaceWash`'s stops. A hex gradient rather
  // than a token, so it is one of the inks.
  wash: readonly string[]
  // A **monochrome** scheme's one ink, or null. Set, every colour a game component
  // computes in JS — a heart, a countdown ring, a floating point, a best-score cell — is
  // drawn in it instead, through `useLegible`; nothing on the screen keeps an accent of
  // its own. `dos` is the one that sets it.
  mono: string | null
  // The one ink everything in the game's top bar is drawn in, where the scheme has one: the
  // run's name, NINE and the pause button, which would otherwise wear the mode's colours.
  // Null to leave them theirs.
  bar: string | null
  // The ink a target's number turns to as a hit lets it out of its disc, or null to keep the
  // disc's own. Set where the ground is dark enough to lose the disc's dark numeral.
  hit: string | null
  // A neon corona drawn round the text and icons of the game's top bar and the sum, or null for
  // none: the colour of the glow, which is the light the scheme burns.
  glow: string | null
  // The keys, where the scheme draws them its own way rather than in `DIAL_COLORS` and the
  // mode's gradient: the ramp's two ends, the digit, the digit on a key at its top, and the
  // pair a key at its top is filled with. Its shape too, since a scheme's keys need not be
  // the dial's discs: the corner's radius, and how much thicker the rim is along the foot,
  // which is what makes a flat rounded square read as a key standing on a keyboard. Null to
  // keep the dial's own.
  keys: {
    low: string
    high: string
    text: string
    peakText: string
    peak: readonly [string, string]
    radius: number
    foot: number
    // Whether the keys are drawn as the reels of a slot machine: a cylinder of cream with the
    // digits either side of the one showing peeking in at its top and foot, and a blur of
    // digits as it spins. See `ReelFace`.
    reel?: boolean
    // Whether each key is a painted tile — a pattern of its own behind the digit, which sits in a
    // roundel of glaze at its middle. See `TileFace`.
    tile?: boolean
  } | null
}

type Scheme = {
  tokens: Partial<Record<SchemeToken, string>>
  inks: SchemeInks
}

const GLASS_TOKENS = {
  '--color-surface': '#D9E6EE',
  '--color-card': '#C9DAE5',
  '--color-elevated': '#F2F8FB',
  '--color-muted': '#B3C8D5',
  '--color-dim': '#3F5666',
  '--color-primary': '#1B2F3D',
  '--color-strong': '#1B2F3D',
  '--color-on-strong': '#E6F2F9',
  '--color-score': '#1F6A92',
  '--color-fortune': '#8F2219',
  '--color-dial': '#1B2F3D',
  '--color-factor': '#5E7585',
  '--color-pie': '#171421',
}

// The drawing board — FOUR KEYS': paper, graphite, and technical lettering. The figures are
// the paper's and the graphite's two weights (`ink` for what is drawn, `bar` for the rows
// above the dial, written lighter), and a pencil red kept for the one figure that is not a
// drawing's: the fortune.
const DRAFT_PAPER = '#F4F2EA'
const DRAFT_INK = '#2B2B30'
const DRAFT_BAR = '#3B3B40'

// The technical monospace the top bar is lettered in under `draftingBar`: loaded from
// `assets/fonts/ShareTechMono-Regular.ttf` by `SchemeProvider` while that scheme is worn.
// Bound to `--font-mono`, so every `font-mono` class under it is set in it.
export const DRAFTING_LETTERING = 'ShareTechMono'

const DRAFTING_TOKENS = {
  '--color-surface': DRAFT_PAPER,
  '--color-card': '#EAE7DD',
  '--color-elevated': '#FAF8F2',
  '--color-muted': '#CFCBBE',
  '--color-dim': '#55555A',
  '--color-primary': DRAFT_INK,
  '--color-strong': DRAFT_INK,
  '--color-on-strong': DRAFT_PAPER,
  '--color-score': DRAFT_INK,
  '--color-fortune': '#9A3B32',
  '--color-dial': DRAFT_INK,
  '--color-factor': '#6B6A66',
  '--color-pie': '#171421',
}

// The azulejo panel — FOUR BY FOUR's: white glaze, and everything on it painted in cobalt. `ink`
// is the paint for what stands on the wall, `bar` the one blue the rows above the dial wear, and
// a terracotta, the colour of the clay showing at a chipped edge, is kept for the fortune.
export const AZULEJO = {
  glaze: '#F6F4EC',
  cobalt: '#1F3F8F',
  joint: '#C9D3EA',
} as const

// Neutral on purpose: the tiles are painted in the challenge's own colour, which a scheme cannot
// name, so what is written on the glaze is a deep slate that sits with any of them.
const AZULEJO_INK = '#1F2A33'

const AZULEJO_TOKENS = {
  '--color-surface': AZULEJO.glaze,
  '--color-card': '#F0EFE8',
  '--color-elevated': '#FBFAF5',
  '--color-muted': '#CFCFC6',
  '--color-dim': '#4A5560',
  '--color-primary': AZULEJO_INK,
  '--color-strong': AZULEJO_INK,
  '--color-on-strong': AZULEJO.glaze,
  '--color-score': AZULEJO_INK,
  '--color-fortune': '#A9502F',
  '--color-dial': AZULEJO_INK,
  '--color-factor': '#66707A',
  '--color-pie': '#171421',
}

// The parquet — HABIT's dance floor: honey oak laid in a herringbone, everything on it in dark
// brown, as the ink of a shoe on a polished floor. `seam` is what shows between the planks, `planks`
// the stains they are cut from, `bar` the one ink the rows above the dial wear, and `lamp` the pale
// light the opening throws across it.
export const PARQUET = {
  floor: '#C58B49',
  seam: '#B58045',
  planks: ['#CB9250', '#C0873F', '#D39C5B', '#BA7F3C', '#C78D49'],
  ink: '#2B1708',
  bar: '#3A200C',
  lamp: '#FFE7B3',
} as const

const PARQUET_TOKENS = {
  '--color-surface': PARQUET.floor,
  '--color-card': '#D9A869',
  '--color-elevated': '#E4B97E',
  '--color-muted': '#B57E3F',
  '--color-dim': '#5A3716',
  '--color-primary': PARQUET.ink,
  '--color-strong': PARQUET.ink,
  '--color-on-strong': '#F5E3C0',
  '--color-score': PARQUET.ink,
  '--color-fortune': '#8E2B1A',
  '--color-dial': '#1C1928',
  '--color-factor': '#6B4520',
  '--color-pie': '#171421',
}

// The lava lamp — DRIFT's: a blush-pink glass with wax in it. `cool` and `hot` are the two ends of the
// scale a lump of wax is coloured on by the number it shows, purple at nothing and pink at the board's
// ceiling (`waxColor`): 6.6:1 and 3.0:1 against the glass, which is enough for a shape and not for
// text, so a number is never drawn in either — it sits on a pale tint of its lump. `glow` is the
// light at the lamp's foot, `bar` the one ink the rows above the dial wear.
export const LAVA = {
  glass: '#F9CFE2',
  wash: ['#FBD9E8', '#F9CFE2', '#F5BCD6', '#F7C5DC'],
  ink: '#3A0B33',
  bar: '#4A1140',
  cool: '#5B2A9E',
  hot: '#D92D86',
  glow: '#FF8FC4',
  // A number on the wax: white, 9.6:1 on the purple end and 4.2:1 on the pink end, which a numeral
  // this big carries.
  numeral: '#FFFFFF',
} as const

const LAVA_TOKENS = {
  '--color-surface': LAVA.glass,
  '--color-card': '#FCE0EC',
  '--color-elevated': '#FFF0F6',
  '--color-muted': '#E7A4C3',
  '--color-dim': '#6B2A5C',
  '--color-primary': LAVA.ink,
  '--color-strong': LAVA.ink,
  '--color-on-strong': '#FFE9F3',
  '--color-score': LAVA.ink,
  '--color-fortune': '#A3124F',
  '--color-dial': '#1C1928',
  '--color-factor': '#7A3A6A',
  '--color-pie': '#171421',
}

// The one blue everything above the dial wears under `glass` — see `glassBar` in `SCHEMES`.
const GLASS_BAR = '#1F6A92'

// The storm's tokens, shared with `stormBar`, and the one ink everything above its dial wears.
const STORM_TOKENS = {
  '--color-surface': '#0A1428',
  '--color-card': '#12213D',
  '--color-elevated': '#1B2D50',
  '--color-muted': '#2A3F66',
  '--color-dim': '#A9BCDD',
  '--color-primary': '#EAF2FF',
  '--color-strong': '#EAF2FF',
  '--color-on-strong': '#0A1428',
  '--color-score': '#5BD27D',
  '--color-fortune': '#FF8A80',
  '--color-dial': '#101C33',
  '--color-factor': '#8FA3C7',
  '--color-pie': '#0E1A30',
}

const STORM_BAR = '#A9BCDD'

// FREEZE's tokens, shared with `frostBar`, and the one ink everything above its dial wears.
const FROST_TOKENS = {
  '--color-surface': '#EAF6FB',
  '--color-card': '#DCEEF6',
  '--color-elevated': '#FFFFFF',
  '--color-muted': '#BFDCEA',
  '--color-dim': '#3C6577',
  '--color-primary': '#0F3347',
  '--color-strong': '#0F3347',
  '--color-on-strong': '#EAF6FB',
  '--color-score': '#0E7C9A',
  '--color-fortune': '#B03A2E',
  '--color-dial': '#0F3347',
  '--color-factor': '#5E8799',
  '--color-pie': '#171421',
}

const FROST_BAR = '#1E6F8C'

// NO SLIP's heart monitor, shared with `monitorBar`: a screen gone black-green, the text in
// the phosphor green of a trace, and the one ink everything above its dial wears.
const MONITOR_TOKENS = {
  '--color-surface': '#04100B',
  '--color-card': '#0A1B13',
  '--color-elevated': '#10261B',
  '--color-muted': '#1F4A35',
  '--color-dim': '#7FD9A6',
  '--color-primary': '#7DFFB4',
  '--color-strong': '#7DFFB4',
  '--color-on-strong': '#04100B',
  '--color-score': '#7DFFB4',
  '--color-fortune': '#FF6B6B',
  '--color-dial': '#7DFFB4',
  '--color-factor': '#4FB883',
  '--color-pie': '#171421',
}

const MONITOR_BAR = '#6DEBA0'

// LIFTOFF's sky, shared with `skyBar`: a light blue day, the text in a deep navy, and the one
// ink everything above its dial wears.
const SKY_TOKENS = {
  '--color-surface': '#CDE9FA',
  '--color-card': '#E3F3FC',
  '--color-elevated': '#FFFFFF',
  '--color-muted': '#A9D2EC',
  '--color-dim': '#3E6C8F',
  '--color-primary': '#10304F',
  '--color-strong': '#10304F',
  '--color-on-strong': '#E8F5FD',
  '--color-score': '#1B6FB8',
  '--color-fortune': '#C0392B',
  '--color-dial': '#10304F',
  '--color-factor': '#5B84A3',
  '--color-pie': '#171421',
}

const SKY_BAR = '#12507F'

// SCRAMBLE's casino, shared with `casinoBar`: red velvet gone nearly black, the text in gold, and
// the one ink everything above its dial wears.
const CASINO_TOKENS = {
  '--color-surface': '#2A0A0F',
  '--color-card': '#3A1218',
  '--color-elevated': '#4A1A22',
  '--color-muted': '#6B2A33',
  '--color-dim': '#E6C77A',
  '--color-primary': '#FFE29A',
  '--color-strong': '#FFE29A',
  '--color-on-strong': '#2A0A0F',
  '--color-score': '#FFD36B',
  '--color-fortune': '#FF8A7A',
  '--color-dial': '#2A0A0F',
  '--color-factor': '#C9A25A',
  '--color-pie': '#171421',
}

const CASINO_BAR = '#F6D27A'

// `dark` — a near-black of the app's own violet cast, the screen's text in the parchment
// it is usually drawn on. The keys and the target discs keep their light faces, so the
// inks drawn on *them* (`--color-dial`, `--color-pie`) stay dark: only what sits on the
// screen itself turns over.
export const SCHEMES = {
  day: {
    tokens: {},
    inks: {
      score: SCORE_COLORS.high,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: SURFACE,
      ink: SCORE_COLORS.high,
      wash: SURFACE_WASH,
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  dark: {
    tokens: {
      '--color-surface': '#110F18',
      '--color-card': '#1F1C2A',
      '--color-elevated': '#2A2638',
      '--color-muted': '#3A3648',
      '--color-dim': '#B8B3C7',
      '--color-primary': '#F3EFE9',
      '--color-strong': '#F3EFE9',
      '--color-on-strong': '#1C1928',
      '--color-score': '#5BD27D',
      '--color-fortune': '#FF8A80',
      '--color-dial': '#1C1928',
      '--color-factor': '#9A96A8',
      '--color-pie': '#171421',
    },
    inks: {
      score: '#F3EFE9',
      keyRim: 'rgba(243, 239, 233, 0.28)',
      statusBar: 'light',
      ground: '#110F18',
      ink: '#F3EFE9',
      // The day wash's four stops, carried down to the dark surface with the same faint
      // cool-to-warm drift across the screen.
      wash: ['#0E0D17', '#110F19', '#15101A', '#171119'],
      mono: null,
      // The same grey as `--color-dim` above, which the word under the run's name wears.
      bar: '#B8B3C7',
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `storm` — GLIMPSE's night: a deep navy of rain-heavy cloud, the text in a cold white.
  // Like `dark`, the keys and target discs keep their light faces, so the inks drawn on
  // *them* stay dark and only what sits on the screen itself turns over.
  storm: {
    tokens: STORM_TOKENS,
    inks: {
      score: '#EAF2FF',
      keyRim: 'rgba(234, 242, 255, 0.28)',
      statusBar: 'light',
      ground: '#0A1428',
      ink: '#EAF2FF',
      // Cloud-dark at the top, a little lighter where the rain gathers at the foot.
      wash: ['#08101F', '#0A1428', '#0C1830', '#0E1B36'],
      mono: null,
      bar: STORM_BAR,
      // The bolt's own colour (`STORM.bolt`, defined below this table), so a hit number is the
      // flash it was struck by.
      hit: '#FFF7B8',
      glow: null,
      keys: null,
    },
  },
  // `stormBar` — the rows above a `storm` dial: **monochrome** in the cold blue-white the name and
  // NINE already wear, so the hearts, the score and the multiplier match them. Worn from the first
  // frame of the run; see `OPENING_BAR_WAITS`.
  stormBar: {
    tokens: {
      ...STORM_TOKENS,
      '--color-dim': STORM_BAR,
      '--color-primary': STORM_BAR,
      '--color-strong': STORM_BAR,
      '--color-score': STORM_BAR,
      '--color-fortune': STORM_BAR,
      '--color-factor': STORM_BAR,
    },
    inks: {
      score: STORM_BAR,
      keyRim: 'transparent',
      statusBar: 'light',
      ground: '#0A1428',
      ink: STORM_BAR,
      wash: ['#08101F', '#0A1428', '#0C1830', '#0E1B36'],
      mono: STORM_BAR,
      bar: STORM_BAR,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `frost` — FREEZE's lake: a white-cyan of new ice, the text in a deep cold teal. The keys
  // are blocks of ice: pale and rounded, warming to a deep water-blue at their top. Paler and
  // whiter than `glass`, MIRROR's silver-blue, so the two never pass for each other.
  frost: {
    tokens: FROST_TOKENS,
    inks: {
      score: '#0E7C9A',
      keyRim: 'rgba(255, 255, 255, 0.95)',
      statusBar: 'dark',
      ground: '#EAF6FB',
      ink: '#0F3347',
      wash: ['#E3F3FA', '#EAF6FB', '#F0F9FD', '#E6F4FA'],
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: {
        low: '#F7FCFF',
        high: '#A6D4E6',
        text: '#0F3347',
        peakText: '#EAF6FB',
        peak: ['#0F3347', '#1E8FB3'],
        radius: 14,
        foot: 3,
      },
    },
  },
  // `frostBar` — the rows above a `frost` dial: **monochrome** in the deep water-blue, so the
  // name, NINE, the hearts, the figures and the bests are one colour. Worn from the first
  // frame of the run; see `OPENING_BAR_WAITS`.
  frostBar: {
    tokens: {
      ...FROST_TOKENS,
      '--color-dim': FROST_BAR,
      '--color-primary': FROST_BAR,
      '--color-strong': FROST_BAR,
      '--color-score': FROST_BAR,
      '--color-fortune': FROST_BAR,
      '--color-factor': FROST_BAR,
    },
    inks: {
      score: FROST_BAR,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: '#EAF6FB',
      ink: FROST_BAR,
      wash: ['#E3F3FA', '#EAF6FB', '#F0F9FD', '#E6F4FA'],
      mono: FROST_BAR,
      bar: FROST_BAR,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `monitor` — NO SLIP's heart monitor: near-black with a green cast, the text in the green of
  // a trace. The keys are green rings; the target discs keep their light faces, so the ink on
  // them stays dark.
  monitor: {
    tokens: MONITOR_TOKENS,
    inks: {
      score: '#7DFFB4',
      keyRim: 'rgba(125, 255, 180, 0.85)',
      statusBar: 'light',
      ground: '#04100B',
      ink: '#7DFFB4',
      wash: ['#030D09', '#04100B', '#051410', '#04110C'],
      mono: null,
      bar: MONITOR_BAR,
      // The trace's own green (`MONITOR.line`, defined below this table), so a hit number is
      // the line it was drawn by.
      hit: '#5CFFA0',
      glow: null,
      // Round keys in the trace's green: clear at nought, filling to solid by nine, which
      // then lights to the bright green with a dark digit. The rim is what a clear key is.
      keys: {
        low: 'rgba(23, 121, 74, 0)',
        high: '#17794A',
        text: '#7DFFB4',
        peakText: '#04100B',
        peak: ['#4FE090', '#9BFFC8'],
        radius: 999,
        foot: 1.5,
      },
    },
  },
  // `monitorBar` — the rows above a `monitor` dial: **monochrome** in the green the name and
  // NINE already wear. Worn from the first frame of the run; see `OPENING_BAR_WAITS`.
  monitorBar: {
    tokens: {
      ...MONITOR_TOKENS,
      '--color-dim': MONITOR_BAR,
      '--color-primary': MONITOR_BAR,
      '--color-strong': MONITOR_BAR,
      '--color-score': MONITOR_BAR,
      '--color-fortune': MONITOR_BAR,
      '--color-factor': MONITOR_BAR,
    },
    inks: {
      score: MONITOR_BAR,
      keyRim: 'transparent',
      statusBar: 'light',
      ground: '#04100B',
      ink: MONITOR_BAR,
      wash: ['#030D09', '#04100B', '#051410', '#04110C'],
      mono: MONITOR_BAR,
      bar: MONITOR_BAR,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `sky` — LIFTOFF's little plane: a light blue day, deeper at the top and paling to the
  // horizon. The one key is a white disc with a navy digit that fills to a bright
  // blue as it climbs to nine.
  sky: {
    tokens: SKY_TOKENS,
    inks: {
      score: '#1B6FB8',
      keyRim: 'rgba(255, 255, 255, 0.95)',
      statusBar: 'dark',
      ground: '#CDE9FA',
      ink: '#10304F',
      wash: ['#B4DDF6', '#CDE9FA', '#DDF0FB', '#E8F6FD'],
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: {
        low: '#FFFFFF',
        high: '#A9D2EC',
        text: '#10304F',
        peakText: '#FFFFFF',
        peak: ['#1E6FD9', '#4DA3FF'],
        radius: 999,
        foot: 3,
      },
    },
  },
  // `skyBar` — the rows above a `sky` dial: **monochrome** in the deep blue the name and NINE
  // already wear. Worn from the first frame of the run; see `OPENING_BAR_WAITS`.
  skyBar: {
    tokens: {
      ...SKY_TOKENS,
      '--color-dim': SKY_BAR,
      '--color-primary': SKY_BAR,
      '--color-strong': SKY_BAR,
      '--color-score': SKY_BAR,
      '--color-fortune': SKY_BAR,
      '--color-factor': SKY_BAR,
    },
    inks: {
      score: SKY_BAR,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: '#CDE9FA',
      ink: SKY_BAR,
      wash: ['#B4DDF6', '#CDE9FA', '#DDF0FB', '#E8F6FD'],
      mono: SKY_BAR,
      bar: SKY_BAR,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `casino` — SCRAMBLE's slot machine: red velvet, the text in gold. The keys are the reels'
  // windows: cream cylinders with a red digit, lighting to gold at nine, and the target discs
  // keep their light faces, so the ink on them stays dark.
  casino: {
    tokens: CASINO_TOKENS,
    inks: {
      score: '#FFD36B',
      keyRim: 'rgba(255, 214, 102, 0.9)',
      statusBar: 'light',
      ground: '#2A0A0F',
      ink: '#FFE29A',
      wash: ['#220709', '#2A0A0F', '#330D13', '#2C0A10'],
      mono: null,
      bar: CASINO_BAR,
      // The gold of the bulbs, so a number leaving its disc is drawn in the light it came from.
      hit: '#FFE29A',
      glow: 'rgba(255, 214, 102, 0.95)',
      keys: {
        low: '#FBF6E6',
        high: '#FBF6E6',
        text: '#D2232A',
        peakText: '#D2232A',
        peak: ['#FFE27A', '#FFC93C'],
        radius: 14,
        foot: 4,
        reel: true,
      },
    },
  },
  // `casinoBar` — the rows above a `casino` dial: **monochrome** in the gold the name and NINE
  // already wear. Worn from the first frame of the run; see `OPENING_BAR_WAITS`.
  casinoBar: {
    tokens: {
      ...CASINO_TOKENS,
      '--color-dim': CASINO_BAR,
      '--color-primary': CASINO_BAR,
      '--color-strong': CASINO_BAR,
      '--color-score': CASINO_BAR,
      '--color-fortune': CASINO_BAR,
      '--color-factor': CASINO_BAR,
    },
    inks: {
      score: CASINO_BAR,
      keyRim: 'transparent',
      statusBar: 'light',
      ground: '#2A0A0F',
      ink: CASINO_BAR,
      wash: ['#220709', '#2A0A0F', '#330D13', '#2C0A10'],
      mono: CASINO_BAR,
      bar: CASINO_BAR,
      hit: null,
      glow: 'rgba(255, 214, 102, 0.95)',
      keys: null,
    },
  },
  // `dos` — an MS-DOS screen: its blue and white, and nothing else, BINARY's.
  //
  // **Monochrome**: every token is one of the two, and `mono` makes every colour computed
  // in JS white too. The keys invert, the way a DOS selection does: an unlit key is the
  // blue with a white rim and a white digit, a lit one is white with a blue digit.
  dos: {
    tokens: {
      '--color-surface': DOS_BLUE,
      '--color-card': DOS_BLUE,
      '--color-elevated': DOS_BLUE,
      '--color-muted': DOS_WHITE,
      '--color-dim': DOS_WHITE,
      '--color-primary': DOS_WHITE,
      '--color-strong': DOS_WHITE,
      '--color-on-strong': DOS_BLUE,
      '--color-score': DOS_WHITE,
      '--color-fortune': DOS_WHITE,
      '--color-dial': DOS_WHITE,
      '--color-factor': DOS_WHITE,
      '--color-pie': DOS_WHITE,
    },
    inks: {
      score: DOS_WHITE,
      keyRim: DOS_WHITE,
      statusBar: 'light',
      ground: DOS_BLUE,
      ink: DOS_WHITE,
      wash: [DOS_BLUE, DOS_BLUE],
      mono: DOS_WHITE,
      bar: DOS_WHITE,
      hit: null,
      glow: null,
      keys: {
        low: DOS_BLUE,
        high: DOS_BLUE,
        text: DOS_WHITE,
        peakText: DOS_BLUE,
        peak: [DOS_WHITE, DOS_WHITE],
        radius: 12,
        foot: 4,
      },
    },
  },
  // `glass` — a mirror: pale silver-blue, its ink a dark slate of the same blue, and frosted
  // keys with a bright rim, warming to the deep blue of the glass's edge at their top.
  glass: {
    tokens: GLASS_TOKENS,
    inks: {
      score: '#1F6A92',
      keyRim: 'rgba(255, 255, 255, 0.9)',
      statusBar: 'dark',
      ground: '#D9E6EE',
      ink: '#1B2F3D',
      wash: ['#D3E2EB', '#D9E6EE', '#DFEAF1', '#D6E4EC'],
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: {
        low: '#F2F8FB',
        high: '#8DB4CC',
        text: '#1B2F3D',
        peakText: '#E6F2F9',
        peak: ['#1B2F3D', '#2F7FA8'],
        radius: 999,
        foot: 1.5,
      },
    },
  },
  // `glassBar` — the rows above a `glass` dial: the same glass, **monochrome** in its blue, so
  // the name, NINE, the hearts, the figures and the bests are one colour. Worn from the first
  // frame of the run rather than from the opening's switch; see `OPENING_BAR_WAITS`.
  glassBar: {
    tokens: {
      ...GLASS_TOKENS,
      '--color-dim': GLASS_BAR,
      '--color-primary': GLASS_BAR,
      '--color-strong': GLASS_BAR,
      '--color-score': GLASS_BAR,
      '--color-fortune': GLASS_BAR,
      '--color-factor': GLASS_BAR,
    },
    inks: {
      score: GLASS_BAR,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: '#D9E6EE',
      ink: GLASS_BAR,
      wash: ['#D3E2EB', '#D9E6EE', '#DFEAF1', '#D6E4EC'],
      mono: GLASS_BAR,
      bar: GLASS_BAR,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `drafting` — a drawing board: paper, and everything on it in pencil. The keys are parts of
  // a square ruled in graphite and grey by how much they hold — the low end is the paper's own
  // shade, the high end a soft pencil laid on — with no corners and no rim; the discs keep their
  // light faces, so the ink on them stays dark.
  drafting: {
    tokens: DRAFTING_TOKENS,
    inks: {
      score: DRAFT_INK,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: DRAFT_PAPER,
      ink: DRAFT_INK,
      wash: ['#F1EFE6', DRAFT_PAPER, '#F7F5EE', '#F2F0E7'],
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: {
        low: '#EEEDE8',
        high: '#B4B2AC',
        text: DRAFT_INK,
        peakText: DRAFT_INK,
        peak: ['#B4B2AC', '#B4B2AC'],
        radius: 0,
        foot: 0,
      },
    },
  },
  // `draftingBar` — the rows above a `drafting` dial: **monochrome** in graphite and lettered
  // in a technical monospace, so the name, NINE, the hearts, the figures and the bests are written, not
  // printed. Worn from the first frame of the run; see `OPENING_BAR_WAITS`.
  draftingBar: {
    tokens: {
      ...DRAFTING_TOKENS,
      '--color-dim': DRAFT_BAR,
      '--color-primary': DRAFT_BAR,
      '--color-strong': DRAFT_BAR,
      '--color-score': DRAFT_BAR,
      '--color-fortune': DRAFT_BAR,
      '--color-factor': DRAFT_BAR,
      '--font-mono': DRAFTING_LETTERING,
    },
    inks: {
      score: DRAFT_BAR,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: DRAFT_PAPER,
      ink: DRAFT_BAR,
      wash: ['#F1EFE6', DRAFT_PAPER, '#F7F5EE', '#F2F0E7'],
      mono: DRAFT_BAR,
      bar: DRAFT_BAR,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `azulejo` — a wall of glazed tiles: white glaze, cobalt paint. Each key is a tile, glaze at
  // the low end and cobalt at the high, with a small radius and a hairline of grout for a rim.
  azulejo: {
    tokens: AZULEJO_TOKENS,
    inks: {
      score: AZULEJO_INK,
      keyRim: AZULEJO.joint,
      statusBar: 'dark',
      ground: AZULEJO.glaze,
      ink: AZULEJO_INK,
      wash: ['#F3F1E8', AZULEJO.glaze, '#F9F7F0', '#F4F2EA'],
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: {
        low: '#FBFAF5',
        high: '#DCE3F3',
        text: AZULEJO.cobalt,
        // The digit sits in a glaze roundel on every tile, so it stays cobalt at the top too.
        peakText: AZULEJO.cobalt,
        peak: ['#162F73', '#1F3F8F'],
        radius: 0,
        foot: 0,
        tile: true,
      },
    },
  },
  // `azulejoBar` — the rows above an `azulejo` dial. Not monochrome of its own: a challenge's
  // top bar is worn in the challenge's colour wherever its scheme has none (`barTint`), which is
  // what puts the name, NINE, the hearts and the figures in the colour the tiles are painted in.
  azulejoBar: {
    tokens: AZULEJO_TOKENS,
    inks: {
      score: AZULEJO_INK,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: AZULEJO.glaze,
      ink: AZULEJO_INK,
      wash: ['#F3F1E8', AZULEJO.glaze, '#F9F7F0', '#F4F2EA'],
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `parquet` — HABIT's dance floor: honey oak, the text in dark brown. The keys and target discs keep
  // their light faces, which stand out from the wood as they do from `day`'s lilac.
  parquet: {
    tokens: PARQUET_TOKENS,
    inks: {
      score: PARQUET.ink,
      keyRim: 'rgba(43, 23, 8, 0.28)',
      statusBar: 'dark',
      ground: PARQUET.floor,
      ink: PARQUET.ink,
      // Planks of slightly different stain, lighter where the lamps fall.
      wash: ['#BD843F', PARQUET.floor, '#CF9753', '#C48A47'],
      mono: null,
      bar: PARQUET.bar,
      hit: '#7A1F12',
      glow: null,
      keys: null,
    },
  },
  // `parquetBar` — the rows above a `parquet` dial: **monochrome** in one dark brown, as the other
  // schemes' are. Worn from the first frame of the run; see `OPENING_BAR_WAITS`.
  parquetBar: {
    tokens: {
      ...PARQUET_TOKENS,
      '--color-dim': PARQUET.bar,
      '--color-primary': PARQUET.bar,
      '--color-strong': PARQUET.bar,
      '--color-score': PARQUET.bar,
      '--color-fortune': PARQUET.bar,
      '--color-factor': PARQUET.bar,
    },
    inks: {
      score: PARQUET.bar,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: PARQUET.floor,
      ink: PARQUET.bar,
      wash: ['#BD843F', PARQUET.floor, '#CF9753', '#C48A47'],
      mono: PARQUET.bar,
      bar: PARQUET.bar,
      hit: '#7A1F12',
      glow: null,
      keys: null,
    },
  },
  // `lava` — DRIFT's lamp: pink glass, the text in deep aubergine. The keys and the targets' discs keep
  // their light faces.
  lava: {
    tokens: LAVA_TOKENS,
    inks: {
      score: LAVA.ink,
      keyRim: 'rgba(58, 11, 51, 0.28)',
      statusBar: 'dark',
      ground: LAVA.glass,
      ink: LAVA.ink,
      wash: LAVA.wash,
      mono: null,
      bar: null,
      hit: null,
      glow: null,
      keys: null,
    },
  },
  // `lavaBar` — the rows above a `lava` dial: **monochrome** in one aubergine, as `parquetBar`'s are
  // in brown.
  lavaBar: {
    tokens: {
      ...LAVA_TOKENS,
      '--color-dim': LAVA.bar,
      '--color-primary': LAVA.bar,
      '--color-strong': LAVA.bar,
      '--color-score': LAVA.bar,
      '--color-fortune': LAVA.bar,
      '--color-factor': LAVA.bar,
    },
    inks: {
      score: LAVA.bar,
      keyRim: 'transparent',
      statusBar: 'dark',
      ground: LAVA.glass,
      ink: LAVA.bar,
      wash: LAVA.wash,
      mono: LAVA.bar,
      bar: LAVA.bar,
      hit: null,
      glow: null,
      keys: null,
    },
  },
} as const satisfies Record<SchemeKind, Scheme>

// The edge of the glass in MIRROR's **opening** (`components/game/openings/passing-edge.tsx`),
// and the fog and shine it leaves. The shine fades to its own colour at nothing rather than to
// `transparent`, which is black at nothing and would draw a grey edge on the way.
export const MIRROR_GLASS = {
  edge: '#FFFFFF',
  edgeGlow: 'rgba(255, 255, 255, 0.7)',
  glass: SCHEMES.glass.inks.ground,
  fog: '#EEF4F8',
  shine: 'rgba(255, 255, 255, 0.34)',
  shineClear: 'rgba(255, 255, 255, 0)',
  // A crack in the glass: a bright line, with a dark edge to lift it off anything pale.
  crack: 'rgba(255, 255, 255, 0.95)',
  crackShadow: 'rgba(27, 47, 61, 0.45)',
} as const

// The bulb in BLACKOUT's **opening** (`components/game/openings/lights-out.tsx`).
//
// A warm, pale lamp-light rather than any of the app's golds: `GOLD_SCALE` means a record
// held, and a bulb wearing it would be the scene claiming something it is not. Lit, the
// glass is the colour of the light it gives; out, it is the dark scheme's own card, so
// the dead bulb sits in the room it has just made dark.
export const LIGHTS_OUT = {
  glass: '#FFF1C9',
  glow: 'rgba(255, 236, 184, 0.55)',
  filament: '#F2A541',
  deadGlass: SCHEMES.dark.tokens['--color-card'],
  // The cord, the socket and the outline: the app's own ink, which reads on the light
  // screen the scene opens on and, at the rim, against the dark one it leaves.
  line: DIM_INK,
  // The flashlight's light on the wall as its battery goes: the bulb's own warm white, then
  // orange, then a red still bright enough to read the number by. And the number written
  // there, which is the app's ink: dark paint, seen only where the light falls.
  beam: '#FFF1C9',
  beamLow: '#FFA63D',
  beamOut: '#FF5A36',
  paint: PRIMARY_INK,
} as const

// GLIMPSE's storm (`components/game/openings/storm-front.tsx`, `struck-target.tsx`).
//
// Rain is the cold blue of the sky it falls from. Lightning is a light yellow with a deeper yellow edge, and
// is never any of the app's golds: gold is a record held, and a bolt wearing it would be
// the scene claiming something it is not.
export const STORM = {
  rain: 'rgba(170, 200, 255, 0.5)',
  bolt: '#FFF7B8',
  boltEdge: '#FFE45C',
  glow: 'rgba(255, 243, 160, 0.85)',
  veil: '#FFF6B8',
  // The flood behind the dial: the back wave dimmer and the front one a little brighter,
  // both translucent so the navy and the rain read through.
  waterBack: 'rgba(36, 92, 168, 0.55)',
  water: 'rgba(58, 128, 214, 0.5)',
  splash: 'rgba(200, 224, 255, 0.9)',
} as const

// STORM's target: a charged orb — a dark navy disc, an electric-blue rim and charge, the number in
// the night's cold white. See `orb` on `PieCountdown`.
export const STORM_ORB = {
  ground: '#0E1A33',
  rim: '#4F7DFF',
  charge: '#6FA2FF',
  ink: '#EAF2FF',
} as const

// FREEZE's snow globe (`components/game/openings/frost-creep.tsx`, `snow.tsx`). Ice is white
// at its edge and a cold cyan in its body; snow is white with a cold edge, so a flake reads
// on the pale ground too.
export const FROST = {
  rim: '#F4FBFF',
  body: '#BFE6F5',
  flake: '#FFFFFF',
  flakeEdge: '#9CCBE0',
  driftBack: '#D4EAF4',
  drift: '#FFFFFF',
  driftEdge: '#A9D3E6',
} as const

// NO SLIP's heart monitor (`components/game/openings/defibrillator.tsx`): the trace is a bright
// phosphor green with a wider, fainter glow of the same under it; the paper grid is barely
// there; the shock is a white flash.
export const MONITOR = {
  line: '#5CFFA0',
  glow: 'rgba(92, 255, 160, 0.28)',
  grid: 'rgba(92, 255, 160, 0.07)',
  shock: '#F2FFF8',
} as const

// LIFTOFF's sky (`components/game/openings/takeoff.tsx`): the plane, the clouds, the ground,
// and the fire when the plane meets it.
export const SKY = {
  cloud: 'rgba(255, 255, 255, 0.92)',
  grass: '#5DB85A',
  grassEdge: '#3F8F47',
  soil: '#8A5A33',
  body: '#E8473B',
  wing: '#B5291F',
  glass: '#BFE6FA',
  trim: '#FFFFFF',
  dark: '#2B2B33',
  fire: '#FFB020',
  flame: '#FF5A1F',
  smoke: 'rgba(58, 58, 66, 0.75)',
  // What stands on the ground.
  trunk: '#7A4A28',
  leaf: '#3E9B4A',
  leafDark: '#2F7D3A',
  wall: '#F4E2C0',
  roof: '#C0392B',
  cow: '#FFFFFF',
  spot: '#2B2B33',
} as const

// SCRAMBLE's casino (`components/game/openings/lever-pull.tsx`): the marquee's bulbs, the lever,
// and the coins a win throws up.
export const CASINO = {
  bulb: '#FFD76A',
  bulbGlow: 'rgba(255, 215, 106, 0.35)',
  rod: '#C9A25A',
  knob: '#E5322D',
  knobRim: '#FFB3A8',
  bulbOff: '#5A2A1E',
  bulbRim: '#8A5A2B',
  shade: 'rgba(70, 52, 24, 0.55)',
  digitEdge: '#3A0E12',
  digitRed: '#D2232A',
  coin: '#F6C445',
  coinEdge: '#B8860B',
  flash: '#FFF3C4',
} as const

// What a podium place is painted in where it needs a fill rather than an emoji: gold, silver
// and bronze, light enough to carry a nickname in its own colours and dark ink alike. The
// metals are the medals' own — `rankMedal` draws the emoji, this is the ground under the
// name on the same place.
export const MEDAL_FILL = {
  1: '#FFD166',
  2: '#D3D8E0',
  3: '#DDA16B',
} as const
