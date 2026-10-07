// A siege's own timings, counts and sizes, in one table for the same reason
// constants/arcade.ts is one: the camera closing, the hero stopping short of the gate and
// the first warrior leaving it are one movement, and a beat tuned in one place and not the
// others would read as three things happening at once.

// Hearts a run carries. The same three every scored mode gives, and the same three hearts
// the player already knows — a siege is the only thing in arcade that spends them.
export const HEARTS = 3

// The walls: how many towers a siege has and how many hits each takes, at the start of a
// run and at the deepest a siege is asked to be.
//
// Both counts are even, and that is the gate's doing rather than a round number: the towers
// stand in the middle of equal bays along the wall, so an even count always leaves a bay
// straddling the middle of it and an odd one always stands a tower there — on top of the
// one opening the men have to come out of. `towerCount` steps between these two in twos for
// the same reason. What carries the ramp smoothly is the hits.
export const TOWERS_SHALLOW = 4
export const TOWERS_DEEP = 6
export const TOWER_HITS_SHALLOW = 3
export const TOWER_HITS_DEEP = 5

// How many crossroads deep a siege is at its hardest. Past it nothing more is added — a
// run that climbs forever should not meet a wall that grows forever with it.
export const SIEGE_DEPTH_FULL = 24

// The press band every number in a siege is drawn from. Cheaper than a fan's three to
// four, because a crossroad asks for one number and a siege asks for dozens.
export const SIEGE_PAR_MIN = 2
export const SIEGE_PAR_MAX = 3

// Warriors: how many may be on the ground at once, how long one takes to cross it, when
// the first leaves the gate and how long the gap between them starts at.
//
// The last two are bases: both are run through the same decay everything in the app that
// tightens uses, counting warriors-already-sent plus the depth of the siege. So a fight
// speeds up as it drags on *and* starts faster the deeper it is.
export const WARRIORS_LIVE_MAX = 3
export const WARRIOR_WALK_MS = 7000
export const SPAWN_FIRST_MS = 2600
export const SPAWN_EVERY_MS = 5200

// How wide the warriors' lanes fan out below the gate, in radians, so two never come down
// the same line, and how far off the straight that carries a man at the middle of his walk.
//
// `LANE_REACH` is the one number that turns the lane into points: at the two ends of the
// spread two men pass four or five men apart, well out towards the sides of the ground. See
// the note in siege-warrior.tsx for why it is in points rather than in walks.
export const LANE_SPREAD = 0.9
export const WARRIOR_SIZE = 15
export const LANE_REACH = (WARRIOR_SIZE * 5) / LANE_SPREAD

// The camera closing on the walls and opening out again.
export const CLOSE_MS = 760
export const OPEN_MS = 620

// And how far in it goes. Two, rather than the two and a half a siege used to be looked at
// under: a ring of towers round a village had only itself to fit, where a wall has to hold
// six of them, their numbers and a gate between the middle two across the width of a phone
// — and at the closer zoom the numbers on a deep wall stood shoulder to shoulder with none
// of the wall showing between them. What it gives up is a fifth off the size of a man, who
// has room to spare on it; what it buys is the wall reading as a wall.
export const SIEGE_ZOOM = 2

// How the fight is framed on the canvas.
//
// A siege is not a village looked at from above. It is the ground in front of one wall, and
// almost all of what the player watches is the ground — so the camera does not sit the
// village in the middle of the sheet the way every other beat of a run does. It lifts the
// wall to the top of the canvas and leaves everything under it empty for the men coming out
// of the gate.
//
// `WALL_AT` is how far down the canvas the wall's foot line stands and `HERO_AT` is how far
// down the hero does. The ground between them is whatever the two leave over, and the
// stand-off is worked backwards from it rather than named — see `siegeFrame` in
// lib/arcade-layout.ts. Shares of the canvas rather than points, so the same fight fills a
// tall phone and a short one the same way.
export const WALL_AT = 0.26
export const HERO_AT = 0.84

// How much room the wall keeps above its own foot line before the camera will raise it any
// further: the tallest tower, the rise of the wall's ends, and air over the merlons. In map
// points, because that is what those three are drawn in — a tower is a fixed size however
// tall the canvas is, and so takes more of a short one. On a small phone this is the figure
// that wins and the field is what gives.
export const SKY = 50

// The least ground a fight is fought over, in screen points. Nothing on a phone reaches it;
// it is the floor that keeps the gate from being set on top of the hero if anything did.
export const FIELD_MIN = 120

// The wall itself: how far it runs past the canvas on either side, how far its ends stand
// back from its middle, and the gate in the middle of it.
//
// The span is the canvas, overhung at both edges — a besieged village is bigger than the
// screen, and what is on the screen is one stretch of its near wall, so the wall has to
// leave the sheet on both sides rather than end on it. The ends standing back is what says
// the stretch is an arc of something much larger: the middle of the wall is the nearest part
// of it, which is where the gate is and what the hero is standing in front of.
export const WALL_OVER = 12
export const WALL_BOW = 14
export const GATE_WIDE = 15

// How far out of the gate a man is standing when he appears. Enough that he is never dealt
// inside the arch he came through, nor on top of the number a tower beside it answers to.
export const GATE_DROP = 13

// A blow, and how long each part of it takes.
//
// Both shots travel, and that is the point of the numbers: a tower is not simply shorter
// and a man is not simply gone — something was loosed at it, crossed the ground, and landed.
// The arrow is quick because an arrow is; the stone is slow because it is thrown in an arc
// by a machine, and the tower waits for it before it gives, so the hit is the cause of the
// damage rather than a thing that happened at the same time.
export const ARROW_MS = 170
export const STONE_MS = 300

// What each shot leaves: dust off the stone, blood off the arrow. Longer than the shot by
// some way — the shot is the event and this is it settling.
export const DUST_MS = 760
export const BLOOD_MS = 620

// How long a blow is kept on the screen before it is dropped. The longest of the above,
// with a beat to spare, so nothing is ever unmounted mid-fade.
export const BLOW_MS = STONE_MS + DUST_MS + 120

// The beat the last tower buys, and the beat the last heart buys.
export const TAKEN_MS = 900
export const OVERRUN_MS = 900
