import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'

import { ARCADE_INK, MAP_INK, SURFACE } from '@/constants/colors'
import { SLOT_CARD } from '@/constants/intro-slot'
import { mapLabel } from '@/constants/theme'
import { drawFeature } from '@/lib/map-marks'
import type { LandFeature } from '@/machines/arcade-land'

// What ARCADE says to a player who cannot play it yet.
//
// The pill is on the intro for everyone — it wears SOON, and PLAY GAME under it is dead.
// A tab that does nothing and says nothing is worse than no tab at all: the player has
// been told there is something here and then left to guess what. This is the answer, and
// it stands in the slot Trainee's tips stand in, so the screen's shape does not change
// when the pill is pressed.
//
// Deliberately about the *place* rather than the rules, and deliberately short. Nobody
// needs the scoring of a mode they cannot start — what makes a teaser worth reading is the
// picture it leaves behind, and a picture survives being brief better than a lesson does.
//
// So it is drawn as a page of the map rather than as a card about one. No border, no
// heading, no label: a range in the map's own ink over two lines in the map's own hand,
// which is the whole of what the mode looks like. COMING SOON is gone with the frame — the
// pill above it already wears SOON, and a card that opened by saying it twice spent its
// first line on the one thing the player had just read.

// The map's lettering, the same way `arcade-dawn.tsx` takes it: the platform's own serif,
// which costs nothing to load. A teaser set in mono would be a screen about arcade; set in
// this it is a piece of it.
const CARD_FONT = { fontFamily: mapLabel } as const

// A range of three, drawn by the hand that draws every mountain in the mode — `drawFeature`
// off a feature of the same shape the generator makes, rather than a glyph of a mountain
// from somewhere else. The tallest stands last so it knocks the flanking two out, which is
// the trick the whole sheet is legible by.
//
// Hand-written rather than generated: `featureIn` answers with whatever its cell rolls, and
// a teaser that was a wood on some launches would be a teaser about trees. The numbers are
// `RIDGE_BIG`'s own ranges — see `machines/arcade-regions.ts` — so this is a range the
// mountains region could actually have dealt.
const RIDGE: LandFeature = {
  kind: 'ridge',
  key: 'arcade-teaser',
  at: 0,
  peaks: [
    { x: 0.1, y: 0, height: 0.14, width: 0.085, form: 'round', flip: false, seed: 7 },
    {
      x: 0.44,
      y: 0.004,
      height: 0.12,
      width: 0.08,
      form: 'round',
      flip: false,
      seed: 95,
    },
    { x: 0.26, y: 0.01, height: 0.2, width: 0.105, form: 'round', flip: false, seed: 31 },
  ],
  bumps: [],
  trees: [],
}

// Points per pitch. The game draws the land at 132; this is near twice that, because a mark
// that is the only picture on a card is looked at rather than walked past — at the sheet's
// own scale the range came out smaller than the two lines under it and read as a bullet.
const RIDGE_PITCH = 240

// Drawn once at module scope. The feature never changes, and `drawFeature` is deterministic
// — running it per render would be the same path string built sixty times a second.
const RANGE = drawFeature(RIDGE, RIDGE_PITCH)

// The weights the map inks itself at, kept the same as `land-mark.tsx` so the range reads as
// a piece of the same sheet rather than as an illustration of one.
const INK_WIDTH = 1.05
const HACHURE_WIDTH = 0.75

function ArcadeRange() {
  return (
    <Svg width={RANGE.width} height={RANGE.height}>
      {/* Body then hachures, one peak at a time: all the bodies first would put the far
          peak's shading back on top of the near peak's face. The fill is the ground's own
          colour, so it is invisible except where it covers the peak behind. */}
      {RANGE.marks.map((mark, i) => (
        <G key={i}>
          <Path
            d={mark.body}
            fill={SURFACE}
            stroke={MAP_INK.line}
            strokeWidth={INK_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Path
            d={mark.detail}
            fill="none"
            stroke={MAP_INK.hatch}
            strokeWidth={HACHURE_WIDTH}
            strokeLinecap="round"
          />
        </G>
      ))}
    </Svg>
  )
}

export function ArcadeTeaser() {
  return (
    // The tips card's own box, to the pixel — its width, its height, and the air it leaves
    // under itself for Trainee's dots. The two stand one pill apart and a player tries both
    // in the same second: a box that changed shape between them would move PLAY GAME under
    // a thumb already on its way to it. `constants/intro-slot.ts` holds the measurements and
    // says where the height comes from.
    //
    // Centred both ways, because the height is the slot's and not this copy's: three short
    // lines pinned to the top of a box sized for a leaderboard read as a card that failed to
    // finish loading.
    <View
      className="mb-8 w-full max-w-3xs items-center justify-center gap-3 self-center px-2"
      style={{ height: SLOT_CARD.height }}
    >
      <ArcadeRange />
      {/* Two sentences and a question. It was four paragraphs explaining the mode, which
          is the wrong thing to hand someone who cannot play it — a teaser is a picture,
          not a manual.

          Centred, which mono prose in this app is not: a line of serif under a drawing is a
          caption, and a caption hangs off the middle of what it is captioning. 13px because
          a serif sets smaller than a mono at the same size, and no tracking at all — wide
          letter-spacing is a caps device here, and a serif carries its own rhythm. */}
      <Text
        selectable={false}
        style={CARD_FONT}
        className="text-center text-[13px] leading-[19px] text-primary"
      >
        <Trans>
          Same dial, new adventures. Set out on the path of multiplication and conquest.
        </Trans>
      </Text>
      {/* The same question the mode's own dawn card ends on, in the amber arcade's label is
          in everywhere else. */}
      <Text
        selectable={false}
        style={[CARD_FONT, { color: ARCADE_INK }]}
        className="text-center text-[13px] leading-[19px]"
      >
        <Trans>How far can you go?</Trans>
      </Text>
    </View>
  )
}
