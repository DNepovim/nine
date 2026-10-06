import { FLAGS, type Flag } from '@/constants/features'

// The pure half of the feature system: what the device does with the answer the server
// gives it, and what the admin screen does with one row of that answer. Everything that
// decides *which* features a person reaches lives in SQL — see the migration — because
// a second copy of those rules is how a screen and an app come to disagree.

const KNOWN: ReadonlySet<string> = new Set(FLAGS)

// What `my_features()` hands back, filtered to what this build can act on.
//
// A key the server knows and this build does not is dropped rather than carried. The
// drop is the safe direction and it is not merely defensive: a device can be older than
// the server for weeks, and an unknown key opens nothing here, because nothing here
// asks about it. This is `parseRole`'s instinct, which the ladder took with it.
export function knownFeatures(keys: readonly string[]): Set<Flag> {
  return new Set(keys.filter((key): key is Flag => KNOWN.has(key)))
}

// Returns true when the two sets spell the same thing, so a caller can keep the set it
// already has rather than swap in a new object saying the same thing. React effects key
// on identity, not contents, and the analytics opt-out in app/(tabs)/index.tsx runs in
// one of them — a set rebuilt on every render would leave that effect never settling.
export function sameFeatures(
  previous: ReadonlySet<Flag>,
  next: ReadonlySet<Flag>,
): boolean {
  if (previous.size !== next.size) return false
  for (const key of next) if (!previous.has(key)) return false
  return true
}

// One person's override of one feature. Null is the third state and the usual one —
// no row, so whatever the role says.
export type Override = boolean | null

// What a tap on a feature row does. Three states, so the cycle has to pass through all
// of them: inherit, force on, force off, back to inherit.
export function cycleOverride(current: Override): Override {
  if (current === null) return true
  if (current) return false
  return null
}

// Where a row's answer came from, which is the thing that makes the person screen
// debuggable rather than merely editable.
export type FeatureSource =
  'inactive' | 'role-on' | 'role-off' | 'override-on' | 'override-off'

export function sourceOf({
  override,
  inRoleStack,
  active,
}: {
  override: Override
  inRoleStack: boolean
  active: boolean
}): FeatureSource {
  // Reported before either of the others because it beats both: an inactive feature is
  // unreachable however the stack and the override are set, and a screen that showed
  // "on, from role" for something nobody can see would be lying.
  if (!active) return 'inactive'
  if (override === null) return inRoleStack ? 'role-on' : 'role-off'
  return override ? 'override-on' : 'override-off'
}
