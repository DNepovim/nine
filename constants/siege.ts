// A siege's own timings, counts and sizes, in one table for the same reason
// constants/arcade.ts is one: the camera closing, the hero stopping short of the gate and
// the first warrior leaving it are one movement, and a beat tuned in one place and not the
// others would read as three things happening at once.

// Hearts a run carries. The same three every scored mode gives, and the same three hearts
// the player already knows — a siege is the only thing in arcade that spends them.
export const HEARTS = 3

// The walls: how many towers a siege has and how many hits each takes, at the start of a
// run and at the deepest a siege is asked to be.
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
// the same line.
export const LANE_SPREAD = 0.9

// The camera closing on the walls and opening out again, and how far in it goes.
export const CLOSE_MS = 760
export const OPEN_MS = 620
export const SIEGE_ZOOM = 2.4

// Where the hero stops along the way in: short of the gate, with the walls above it.
export const STANDOFF = 0.82

// The beat the last tower buys, and the beat the last heart buys.
export const TAKEN_MS = 900
export const OVERRUN_MS = 900
