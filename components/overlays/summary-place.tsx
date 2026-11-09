import { Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { MEDAL_FILL } from '@/constants/colors'
import { GLYPH, READOUT, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { rankMedal } from '@/lib/rank-emoji'
import { sessionFigure } from '@/lib/session-figure'
import type { SummaryPlace } from '@/lib/session-summary'
import { lerpColor, type Measure } from '@/modes'

// One **place** on a closed session's podium: the medal, the name set over it, the figure
// under it.
//
// The medal is the ground rather than a mark above the text — drawn large and let through
// to the challenge's gradient, so the podium reads as three metals before it reads as three
// names. The name sits on a pill in that place's own metal, in the player's own colours,
// and the figure is a small line beneath: the name is what the page is for.
//
// Three sizes rather than three components. Gold leads the page and the other two stand
// under it, which is the podium drawn as a podium — three equal rows would be a table, and
// a table is what the **session board** already is. Silver is a little larger than bronze:
// second is nearer first. Otherwise the same parts in the same order, so the eye reads the
// shape once.
//
// `rankMedal` rather than three emoji typed here. The podium is shared with the board, the
// multiplayer results and the game-over screen, and the one place it lives is
// `lib/rank-emoji.ts` — so the three metals cannot drift apart between the screens that
// draw them.
//
// The figure is the **seven-segment face**, not the app's mono voice. Everywhere else a
// settled figure is mono and a *live* one is DSEG7 — but this page is a scoreboard being
// read after the fact, and the podium is the one place on it where three numbers are to be
// compared. `READOUT` is the role set for that face.
const SIZES = {
  lead: {
    medal: GLYPH['7xl'],
    box: 'h-28 w-full',
    name: TYPE.podiumNameLead,
    figure: READOUT.best,
  },
  second: {
    medal: GLYPH['6xl'],
    box: 'h-24 w-full',
    name: TYPE.podiumName,
    figure: READOUT.row,
  },
  third: {
    medal: GLYPH['5xl'],
    box: 'h-24 w-full',
    name: TYPE.podiumName,
    figure: READOUT.row,
  },
} as const

// How much of the metal comes through the gradient behind it.
const MEDAL_OPACITY = 0.45

// How far towards white the metal goes for its edge.
const EDGE_LIGHTEN = 0.6

// The light the name is shadowed in: white, not the metal's own shade, which was too close
// to the pill to be seen.
const NAME_SHADOW = 'rgba(255,255,255,0.9)'

export type PlaceSize = keyof typeof SIZES

export function SummaryPlaceRow({
  place,
  measure,
  size,
  digitFont,
}: {
  place: SummaryPlace
  // Which of the two figures this session is ordered by. The page prints the one its
  // standings were settled on and never both — see `measureOf`.
  measure: Measure
  size: PlaceSize
  // DSEG7 once it has loaded, the mono voice until then. Resolved by the card above so
  // every figure on the page changes face in the same commit rather than one at a time.
  digitFont: string
}) {
  const type = SIZES[size]
  const figure = sessionFigure(measure, place)
  // A lighter shade of the place's metal, for the border of every pill.
  const edge = lerpColor(MEDAL_FILL[place.rank], '#FFFFFF', EDGE_LIGHTEN)

  return (
    <View className="w-full items-center">
      <View className={cn('items-center justify-center', type.box)}>
        <Text
          selectable={false}
          className={type.medal}
          style={{ opacity: MEDAL_OPACITY }}
        >
          {rankMedal(place.rank)}
        </Text>
        <View className="absolute inset-0 items-center justify-center">
          {/* The pill is the place's own metal, so gold, silver and bronze read even where
              the medal behind is faint. The name keeps its own colours on it, which is the
              point — it is the player's, wherever they are written. */}
          <View
            className="rounded-xl border-2 px-1.5 py-1"
            style={{ backgroundColor: MEDAL_FILL[place.rank], borderColor: edge }}
          >
            <GradientName
              nickname={place.nickname}
              avgAccuracy={place.avgAccuracy}
              avgSpeed={place.avgSpeed}
              className={type.name}
              // No `numberOfLines`: a nickname is shown whole, never cut or ellipsised. The
              // type roles are sized to hold ten characters — see `podiumName`.
              // A light shadow round the letters, so the name stays lifted off the metal
              // whatever its own colours are. React Native has no text stroke; a shadow
              // with no offset is the nearest thing to an outline.
              style={{
                textShadowColor: NAME_SHADOW,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 4,
              }}
            />
          </View>
        </View>
      </View>
      <Text
        selectable={false}
        className={cn(type.figure, 'text-white')}
        style={{ fontFamily: digitFont }}
      >
        {figure}
      </Text>
    </View>
  )
}
