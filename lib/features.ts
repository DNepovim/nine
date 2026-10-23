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
// no row, so whatever is inherited.
export type Override = boolean | null

// A feature's own switch, and the three positions it has:
//
//   hidden   nobody reaches it, whatever any stack or override says.
//   private  whoever their role's stack, or their own override, says.
//   public   everybody, role or no role.
//
// The resolve itself is in SQL — see `effective_features` in the migration — because a
// second copy of those rules is how a screen and an app come to disagree. What is here
// is what the admin screen does with one row of the answer.
export type Visibility = 'hidden' | 'private' | 'public'

// What the column says, narrowed. A value this build has never heard of reads as
// `private`, which is the same instinct `knownFeatures` has about an unknown key: the
// player path never sees this column — `my_features()` resolves server-side — so the
// only cost of the fallback is the admin screen describing an unfamiliar switch as the
// ordinary one rather than refusing to draw the row at all.
export function parseVisibility(value: string): Visibility {
  return value === 'hidden' || value === 'public' ? value : 'private'
}

// Whether somebody reaches this feature without a row of their own naming them. Public
// is the second source of that: before it, inheriting meant the role's stack and nothing
// else, and the two call sites below both used to read `inRoleStack` directly.
const inherits = ({
  inRoleStack,
  visibility,
}: {
  inRoleStack: boolean
  visibility: Visibility
}) => visibility === 'public' || inRoleStack

// What a tap on a feature row does. Two answers, not three: on or off. The third state
// is where the answer *comes from*, not an answer of its own — so a tap asks for the
// opposite of what the person reaches today, and keeps the override only when what they
// inherit does not already say that. Cycling through all three instead made the stop that
// agrees with the inherited answer indistinguishable from inheriting it: same dot, same
// reach, one extra press.
//
// Takes the row rather than a boolean, because "what is inherited" stopped being one
// column the day public arrived, and a caller passing the wrong one of the two would be
// writing an override that silently repeats what it meant to change.
export function toggleOverride(row: {
  override: Override
  inRoleStack: boolean
  visibility: Visibility
}): Override {
  const inherited = inherits(row)
  const wanted = !(row.override ?? inherited)
  return wanted === inherited ? null : wanted
}

// A feature key as the admin screens print it: capitalised, and otherwise exactly the key.
// Every screen that names a feature prints it through this, so a key reads one way across
// the FEATURES list, a role's stack, a person and the feature's own screen — and the rest
// of it stays the key, which is what the code and the guards in SQL are written against.
export const featureLabel = (key: string): string =>
  key.charAt(0).toUpperCase() + key.slice(1)

// Where a row's answer came from, which is the thing that makes the person screen
// debuggable rather than merely editable.
export type FeatureSource =
  'hidden' | 'public' | 'role-on' | 'role-off' | 'override-on' | 'override-off'

export function sourceOf({
  override,
  inRoleStack,
  visibility,
}: {
  override: Override
  inRoleStack: boolean
  visibility: Visibility
}): FeatureSource {
  // Reported before all the others because it beats all of them: a hidden feature is
  // unreachable however the stack and the override are set, and a screen that showed
  // "on, from role" for something nobody can see would be lying.
  if (visibility === 'hidden') return 'hidden'
  // Public next, and so above the override: a public feature reaches everybody, and no
  // override takes it from anyone. Same order the resolve reads in — see
  // 20261023010000_public_beats_override.sql.
  if (visibility === 'public') return 'public'
  if (override !== null) return override ? 'override-on' : 'override-off'
  return inRoleStack ? 'role-on' : 'role-off'
}
