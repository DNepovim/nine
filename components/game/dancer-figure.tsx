import Svg, { Ellipse, Path } from 'react-native-svg'

// A dancer seen from directly above, without the head: shoulders as a wide ellipse, and two arms in
// a hold — one out to the side with the hand raised, the other bent round to the front — facing up
// the figure's own box. The head is the target's disc, drawn over the middle of this, so the
// number stands where a head would.
//
// Drawn in a 100-unit box, the head's disc being about 29 units in radius at its middle (see `SPREAD`
// in `dancer-target.tsx`): the shoulders are set low and wide so they show beneath and beside it.
const SKIN = '#F1C9A5'

export function DancerFigure({ side, outfit }: { side: number; outfit: string }) {
  return (
    <Svg width={side} height={side} viewBox="0 0 100 100">
      <Path
        d="M10 62 Q1 44 8 26"
        stroke={outfit}
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M90 62 Q99 38 70 25"
        stroke={outfit}
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={8} cy={24} rx={5} ry={5.5} fill={SKIN} />
      <Ellipse cx={68} cy={23} rx={5} ry={5.5} fill={SKIN} />
      <Ellipse cx={50} cy={62} rx={43} ry={26} fill={outfit} />
    </Svg>
  )
}
