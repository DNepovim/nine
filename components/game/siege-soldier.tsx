import Svg, { Circle, Path } from 'react-native-svg'

import { WARRIOR_SIZE } from '@/constants/siege'

// One of the village's men, drawn: a round shield with his number on it, and the soldier
// behind it.
//
// A drawing and nothing else — no clock, no animation, no state. Two things need it and
// they need it to be the same drawing: the man crossing the ground (siege-warrior.tsx) and
// the copy of him that stands for the beat it takes to fall (the `Falling` part of
// siege-blow.tsx). He was a bare disc in both, written out twice, and a man who changed
// shape as the arrow reached him would read as two different men.
//
// Drawn in the map's own hand, like the walls and the towers: a filled body knocking out
// what is behind it, then the line over the top. The order the parts are laid down in is
// the whole of why it reads — head, legs, sword arm, and only then the shield, which is
// in front of the man and hides the middle of all three.

// The shield, which is the disc the number has always been in: its size is unchanged, so
// three digits clear the inside of it exactly as they did before. Everything else is
// measured off its radius, so the figure holds together if `WARRIOR_SIZE` is ever retuned.
const STROKE = 1.2
const R = WARRIOR_SIZE / 2 - STROKE / 2

// The canvas the whole man needs, which is wider and a good deal taller than the shield.
// The sword reaches up past his head on one side and his legs reach down below the shield
// on the other, and SVG clips whatever leaves the box.
const W = R * 3.4
const H = R * 3.7

// Where the shield sits inside that canvas. Everything above it is head and sword; below
// it is legs. `SiegeSoldier` offsets itself by this so the shield's centre lands on the
// point it is positioned at — which is the point the walk, the lane and the arrow all
// aim at, and none of them should have to know a man has legs now.
const CX = W / 2
const CY = R * 1.68

// The head, set high enough to clear the shield's top edge and low enough to overlap it.
// Overlap is what makes the shield read as being *in front of* him rather than beside him.
const HEAD_R = R * 0.34
const HEAD_CY = CY - R * 1.2

// The legs: hips under the shield, feet splayed a little wider. Mid-stride rather than
// standing — they are walking at the hero the whole time they are on the ground.
const HIP_Y = CY + R * 0.78
const FOOT_Y = CY + R * 1.88
const HIP_X = R * 0.3
const FOOT_X = R * 0.66
const FOOT = R * 0.26

// The sword arm, out to his right: shoulder behind the shield, hand clear of it, and the
// blade running up past his head. Long enough to be a sword — a short one at this size is
// a stick.
const SHOULDER = { x: CX + R * 0.66, y: CY - R * 0.3 }
const HAND = { x: CX + R * 1.42, y: CY - R * 0.62 }
const TIP = { x: CX + R * 1.78, y: CY - R * 2.5 }

// The crossguard, across the blade just above the hand, and the fist on the grip below it.
const GUARD = R * 0.42
const FIST = R * 0.2

// Where the blade leaves the hand, a touch up the line toward the tip so the guard has
// something to sit on.
const HILT = { x: HAND.x + (TIP.x - HAND.x) * 0.1, y: HAND.y + (TIP.y - HAND.y) * 0.1 }

// The guard runs across the blade, so it is the blade's own direction turned a quarter
// turn. Worked out once at module level rather than per man: every soldier holds the same
// sword at the same angle.
const BLADE = Math.atan2(TIP.y - HILT.y, TIP.x - HILT.x)
const ACROSS = { x: Math.cos(BLADE + Math.PI / 2), y: Math.sin(BLADE + Math.PI / 2) }

const BODY = [
  // The legs, from under the shield down, with a foot turned out at the end of each.
  `M${CX - HIP_X} ${HIP_Y} L${CX - FOOT_X} ${FOOT_Y} L${CX - FOOT_X - FOOT} ${FOOT_Y}`,
  `M${CX + HIP_X} ${HIP_Y} L${CX + FOOT_X} ${FOOT_Y} L${CX + FOOT_X + FOOT} ${FOOT_Y}`,
  // The sword arm, shoulder to hand.
  `M${SHOULDER.x} ${SHOULDER.y} L${HAND.x} ${HAND.y}`,
  // And the blade out of it.
  `M${HILT.x} ${HILT.y} L${TIP.x} ${TIP.y}`,
  // The crossguard across the blade.
  `M${HILT.x - ACROSS.x * GUARD} ${HILT.y - ACROSS.y * GUARD} L${HILT.x + ACROSS.x * GUARD} ${HILT.y + ACROSS.y * GUARD}`,
].join(' ')

// The man, with the shield's centre at the origin of whatever is positioning him.
export function SiegeSoldier({ line, face }: { line: string; face: string }) {
  return (
    <Svg
      width={W}
      height={H}
      // Offset so the shield's centre — not the canvas's — lands on the point this is
      // drawn at. The parent still positions a `WARRIOR_SIZE` box and still centres the
      // number in it, so nothing outside this file had to learn the new shape.
      style={{
        position: 'absolute',
        left: WARRIOR_SIZE / 2 - CX,
        top: WARRIOR_SIZE / 2 - CY,
      }}
    >
      {/* The head first, so the shield can cover what of it hangs below. */}
      <Circle
        cx={CX}
        cy={HEAD_CY}
        r={HEAD_R}
        fill={face}
        stroke={line}
        strokeWidth={STROKE}
      />
      {/* Then the legs, the arm and the sword, all one stroke. */}
      <Path
        d={BODY}
        fill="none"
        stroke={line}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The fist on the grip. Small and filled, so the sword reads as held rather than
          as growing out of his arm. */}
      <Circle cx={HAND.x} cy={HAND.y} r={FIST} fill={line} />
      {/* And the shield over all of it, filled, which is what hides his middle. The
          number goes on this — see the `Text` the parent keeps centred. */}
      <Circle cx={CX} cy={CY} r={R} fill={face} stroke={line} strokeWidth={STROKE} />
    </Svg>
  )
}
