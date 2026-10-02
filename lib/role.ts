// What a player is allowed to be shown — the ladder, and the two questions asked of it.
//
// Null is the ordinary player: no role, the column's default, and all but a few rows.
// The three named roles are ranked rather than independent, so a flag names the lowest
// role that may see it and every role above inherits it. A developer never has to be
// listed beside a tester to get what a tester gets.
//
// The column this reads is `profiles.role` — see the migration for who may write it, and
// for why this is about what a player is *shown* rather than what a player may do.

// Exported for the admin screen's role picker, the one place outside this file that
// needs to enumerate the ladder rather than just check a rung against it. `parseRole` is
// still the only thing that should be reading an untrusted string against this list.
export const ROLES = ['tester', 'developer', 'admin'] as const

export type Role = (typeof ROLES)[number]

// What a flag may be floored at: one of the roles, or nobody at all. `nobody` sits above
// the top of the ladder rather than below its bottom — it is not "the ordinary player",
// which is what a null role is, but "no player, whatever they hold", an admin included.
// It is what a feature is floored at while it is off the app rather than merely unfinished:
// the doors stay shut for everyone, and no row in `profiles` can be edited to open them.
export type Floor = Role | 'nobody'

const ROLE_RANK = {
  tester: 1,
  developer: 2,
  admin: 3,
} as const satisfies Record<Role, number>

// What comes back from the server is a string this build has never heard of until it has
// been checked — the column is `text`, and a device can be talking to a server newer than
// itself. `find` rather than a cast: a role nobody here knows is an ordinary player,
// which is a wrong answer in the safe direction. A cast would make it a promotion.
export function parseRole(value: unknown): Role | null {
  return ROLES.find((role) => role === value) ?? null
}

// Whether a player on `role` reaches a flag floored at `floor`.
export function holds(role: Role | null, floor: Floor): boolean {
  if (floor === 'nobody') return false
  if (role === null) return false
  return ROLE_RANK[role] >= ROLE_RANK[floor]
}
