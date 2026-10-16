// An ambush's own counts, timings and sizes, in one table for the same reason
// constants/siege.ts is one: the camera coming down on the road, the hero stopping partway
// along it and the first bandit reaching it are one movement, and a beat tuned in one place
// and not the others would read as three things happening at once.
//
// What is *not* here is the close, the open and the zoom. An ambush is framed by the same
// camera a siege is — see CLOSE_MS, OPEN_MS and SIEGE_ZOOM in constants/siege.ts, which
// this reuses rather than copies. Two fights that closed at different speeds would read as
// two cameras rather than as one game picking a fight out of the map.

// How often a fan offers a way with bandits on it, at the first stage and at the stage the
// ramp tops out on. Like every pair in this file it is read off a **stage** rather than off
// how deep the run has got — see lib/arcade-stage.ts.
//
// Both ends below FORT_CHANCE, and that is the balance between the two fights rather than a
// guess: a walled village is announced before it is chosen and an ambush is not, so the
// unannounced one has to be the rarer. The first stage is well below it again — with two to
// four ways to a fan and the guards in `openCrossroad` on top, a sixth comes to an ambush
// about every twentieth leg, which is a road that bites often enough to be learned from and
// seldom enough that an early run is mostly walking.
export const AMBUSH_CHANCE_ONE = 0.16
export const AMBUSH_CHANCE_FULL = 0.4

// How many bandits are standing on a road, at the first stage and at the last.
//
// One figure for the whole band rather than a roll per road: what the player is reading in
// the first second of a fight is how many numbers there are, and a count that wandered
// would make that unreadable without making it interesting.
export const BANDITS_ONE = 3
export const BANDITS_FULL = 9

// The press band every number in an ambush is drawn from. Cheap, because a fight asks for
// ten numbers where a crossroad asks for one.
//
// Written out rather than taken from constants/siege.ts, which it happens to equal today.
// The two are the same figure by choice and not by identity — what a wall asks for and what
// a road asks for are different questions, and tying them together would mean an ambush
// could never be made dearer than a siege without making a siege dearer too.
export const AMBUSH_PAR_MIN = 2
export const AMBUSH_PAR_MAX = 3

// When the nearest bandit reaches the hero, and how long after it each of the others does.
//
// The whole of the band's geometry comes off these two. A bandit's distance is its arrival
// read backwards — the one due last is standing at the edge of the ground and the rest are
// placed in proportion — so "the nearest one is the clock" is true by construction rather
// than by a second number agreeing with the first.
//
// Both are read off the stage. So a late ambush closes faster *and* has more men in it,
// which is the same double escalation a late siege gets. At the first stage three men come
// in nine seconds apart — slow enough that the band can be read before it is answered,
// which is the one thing the old figures never gave a player.
export const BANDIT_FIRST_ONE = 9000
export const BANDIT_FIRST_FULL = 5000
export const BANDIT_EVERY_ONE = 4500
export const BANDIT_EVERY_FULL = 3000

// How far round the circle a bandit may stand off the place its slot gave it, as a share of
// a slot. Under a half, so a jitter can never carry one man into his neighbour's slot
// however many of them there are — what this is for is that a band should not read as a
// clock face, not that two should ever share a bearing.
export const BEARING_JITTER = 0.4

// Where along the way the ambush is sprung, nought at the crossroad the hero left and one
// at the village it was walking to.
//
// Short of halfway on purpose. Far enough out that the fight is plainly on the road rather
// than at either end of it, and near enough that being driven back is a shorter journey
// than the one the hero was making — a player who loses here has lost a leg, not two.
export const AMBUSH_ALONG = 0.45

// How far down the canvas the hero stands while it is fought. The middle, because unlike a
// siege — which is the ground in front of one wall, and so has a near side and a far one —
// an ambush comes from every side at once, and anywhere but the middle would give one of
// those sides less room than the others.
export const AMBUSH_AT = 0.5

// The ground the fight is fought over: how far the furthest bandit stands from the hero.
//
// Worked out of the canvas rather than written down — see `ambushFrame` — because what has
// to be true is that the band fits on the screen it is drawn on. These two are the margin
// it keeps inside the canvas and the floor it will not go under. In map points, which is
// what everything on the sheet is drawn in; the camera is what turns them into screen
// points, at twice the size.
//
// The margin is as small as the men themselves allow — half of WARRIOR_SIZE and a couple of
// points of air — so the band comes in off the *edges* of the screen rather than off a ring
// drawn comfortably inside it. That ring is the whole of the warning an ambush gives, and a
// quarter of the canvas left empty outside it was a quarter of the warning thrown away.
export const GROUND_MARGIN = 12
export const GROUND_MIN = 50

// How long a cut bandit stays on the screen after it has left the band: long enough for the
// mark to go down and fade, and no longer. The siege's own figure for the same beat.
export const CUT_MS = 620

// The beat the last bandit buys: the camera opening out, the spoil read, and the hero
// walking the rest of the way it was on. The same length as the beat a fallen wall buys —
// one fight ending should take as long as the other.
export const CLEARED_MS = 900

// What clearing a road pays, as the two cuts of one roll: under the first is food, under
// the second is a heart, and the rest is nothing. Weighted toward food because food is what
// a band of men on a road would actually be carrying, and because a heart is the larger
// gift of the two and should be the rarer.
export const SPOIL_FOOD = 0.5
export const SPOIL_HEART = 0.7

// How much of the bar the food fills.
//
// A third, against the whole bar a walled village gives. The difference is the point and it
// is the one number in here worth arguing about: satiety was built on a village being the
// only food on the map, which is what turns the fight a careful player avoids into the one
// they have to walk toward. Bandits carry stores, not a granary — an ambush is worth
// clearing when you are hungry, and it is never worth walking past a village for.
export const SPOIL_BITE_BACK = 0.3
