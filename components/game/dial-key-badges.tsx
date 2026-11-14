import type { SharedValue } from 'react-native-reanimated'

import { DialBadge } from '@/components/game/dial-badge'
import { DIAL_COLORS, GRAYSCALE } from '@/constants/colors'
import { DIAL_CORNERS, type DialCorners, type DialHint } from '@/constants/dial-hints'

// The badges' ring, constant regardless of mode or theme — a mode-coloured border
// tied it to whichever pair a button happened to be animating through, which read
// as noise next to the badge's own fill. Lightest of the greyscale: legible on both
// surfaces without competing with the digit it is labelling.
const BADGE_BORDER_COLOR = GRAYSCALE[3]

// Trainee's weight and max badges — small discs riding the pill's own rim rather
// than text stacked inside it, so they read off a chip built for contrast instead
// of fighting the pill's own animated fill colour.
//
// MIN still has to hold up on the smallest phones the dial ships on — an 81pt cell
// there, going by useDialMetrics, and the pill now fills all of it rather than 61pt of
// it — so a MIN-sized badge keeps well clear of the digit, and raising the floor along
// with the ratio makes every device's badge bigger rather than only the roomy ones.
const BADGE_MIN = 22
const BADGE_MAX = 34
const BADGE_RATIO = 0.28
const BADGE_FONT_SIZE = 12
const BADGE_BORDER = 1

// The same discs on the dial a lesson is given on, drawn larger.
//
// Not a second opinion about the badge: it is the same chip, and the lesson is asking a
// different thing of it. In a practice run the corner numbers are a reference beside a
// game the player is already playing, and small is right — in the tutorial they *are* the
// lesson, and the player is being asked to read them before they know what they mean.
// A notch under half the key, which is as far as a disc can grow before it starts
// crowding the digit it is labelling.
const TAUGHT_BADGE_MIN = 28
const TAUGHT_BADGE_MAX = 44
const TAUGHT_BADGE_RATIO = 0.36
const TAUGHT_BADGE_FONT_SIZE = 16

// What each hint prints. The weight wears its × so it cannot be mistaken for one of the
// three sums around it — those are all in the same units as the target, and this one is
// not. `room` and `giving` always add up to `ceiling`, which is the whole lesson.
const HINT_LABEL = {
  weight: (_value, weight) => `${weight}×`,
  ceiling: (_value, weight, top) => `${top * weight}`,
  giving: (value, weight) => `${value * weight}`,
  room: (value, weight, top) => `${(top - value) * weight}`,
} as const satisfies Record<
  DialHint,
  // `top` is the highest digit the key takes, which is the board's to say — a dial whose
  // keys only count to five has a different ceiling and a different room left.
  (value: number, weight: number, top: number) => string
>

// Trainee's corner numbers on one key — see `DialButton`, which draws them only on a
// trainee layout.
export function DialKeyBadges({
  value,
  weight,
  digits,
  size,
  bigHints,
  corners,
  peakFrom,
  peakTo,
  rampProgress,
  peakProgress,
  scale,
}: {
  value: number
  weight: number
  digits: number
  size: number
  bigHints: boolean
  corners: DialCorners
  peakFrom: string
  peakTo: string
  rampProgress: SharedValue<number>
  peakProgress: SharedValue<number>
  scale: SharedValue<number>
}) {
  // The pill fills its box, so its radius is simply half of it. There used to be 10pt
  // of padding here, reserving room for the shadow and for the badges to straddle. It
  // also sat inside every button, which put 20pt on top of the 12pt gap the dial lays
  // out — the space between two pills read as 32, and the gap in the layout was not
  // the gap on the screen.
  const radius = size / 2
  const badgeSize = bigHints
    ? Math.min(
        TAUGHT_BADGE_MAX,
        Math.max(TAUGHT_BADGE_MIN, Math.round(size * TAUGHT_BADGE_RATIO)),
      )
    : Math.min(BADGE_MAX, Math.max(BADGE_MIN, Math.round(size * BADGE_RATIO)))
  // Where a badge centred on the pill's rim, on the diagonal toward a corner, lands:
  // the distance from that corner in to the circle — a circle's closest approach to its
  // bounding square's corner is radius short of it on both axes, by Math.SQRT1_2
  // (cos/sin 45°). Expressed as a top/left (or, mirrored, bottom/right) offset from the
  // box so the badge's own centre, not its corner, sits exactly on the rim. It stays
  // positive at every size the dial produces for the small badge — and can go a little
  // negative for the lesson's larger one, where the disc is wide enough that its centre on
  // the rim would put its edge outside the box. Held at the corner there instead, which
  // rests the badge a hair outside the rim rather than hanging it off the key.
  const badgeOffset = Math.max(0, radius * (1 - Math.SQRT1_2) - badgeSize / 2)

  return (
    <>
      {/* The corner numbers, as facts pinned to the pill's rim rather than stacked
            with the digit. Each rides the corner it is about: what the key is worth
            top-left, what it could still add top-right, what it gives now bottom-left,
            and its ceiling bottom-right, on the corner the value climbs toward. */}
      {DIAL_CORNERS.flatMap((corner) => {
        const hint = corners[corner]
        return hint === null ? [] : [{ corner, hint }]
      }).map(({ corner, hint }) => (
        <DialBadge
          key={corner}
          label={HINT_LABEL[hint](value, weight, digits - 1)}
          size={badgeSize}
          fontSize={bigHints ? TAUGHT_BADGE_FONT_SIZE : BADGE_FONT_SIZE}
          offset={badgeOffset}
          corner={corner}
          low={DIAL_COLORS.low}
          high={DIAL_COLORS.high}
          text={DIAL_COLORS.text}
          peakText={DIAL_COLORS.peakText}
          peakFrom={peakFrom}
          peakTo={peakTo}
          borderColor={BADGE_BORDER_COLOR}
          borderWidth={BADGE_BORDER}
          rampProgress={rampProgress}
          peakProgress={peakProgress}
          scale={scale}
        />
      ))}
    </>
  )
}
