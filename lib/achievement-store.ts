import AsyncStorage from '@react-native-async-storage/async-storage'
import { isNonEmptyArray, isOneOf } from 'narrowland'

import {
  achievement,
  ACHIEVEMENT_IDS,
  type AchievementId,
  type StageAxis,
} from '@/constants/achievements'
import { ACHIEVEMENTS_KEY } from '@/constants/storage'
import {
  awardKey,
  awardsOf,
  STAGE_AXES,
  type Award,
  type Stage,
} from '@/lib/achievements'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/modes'

// Every stage any axis can name, for reading a stored award back. A device that has run
// a newer build can hold a stage this one has never heard of; it is dropped rather than
// carried, the same way an unknown id is.
const ALL_STAGES = [...DIFFICULTY_ORDER, ...SCORED_MODES] as const

// One achievement the player holds.
//
// `earnedAt` is the moment it was earned, never the moment it synced — the achievements
// screen dates each row with it, and a reinstall that restored them all with today's date
// would quietly rewrite the player's history.
export type EarnedAchievement = {
  id: AchievementId
  // The stage it was cleared on, for a staged achievement; null for the rest. A staged
  // achievement holds one of these per stage, each with its own moment — a harder board
  // never stands in for an easier one, and neither mode stands in for the other.
  stage: Stage | null
  earnedAt: string // ISO 8601
  // Whether the server has it. The device is what the app reads; this is the queue.
  synced: boolean
}

export type AchievementStore = readonly EarnedAchievement[]

export const EMPTY_STORE: AchievementStore = []

// A stored id this build has never heard of is dropped rather than carried.
//
// It can only come from a newer build — an achievement added, then the app downgraded, or
// a row written by another device running ahead of this one. Keeping it would mean every
// count on screen including something with no name, no emblem and no row to sit in.
// Dropping it is safe because the server still has it: this device simply stops
// mentioning it until it catches up.
export const isKnownAchievement = (id: string): id is AchievementId =>
  isOneOf(id, ACHIEVEMENT_IDS)

// What a boardless award becomes when its achievement has since been staged.
//
// The two axes answer this differently because only one of them is ordered. Difficulty
// has a floor: we know the player did it, we do not know on which board, and Easy is the
// honest least it can have been — the other two stages are still theirs to clear. Mode
// has no floor. Neither Accuracy nor Speed is the lesser one, so naming either would be
// inventing a fact about a player's history; every stage is granted instead, which is
// the reading that takes nothing back.
const GRANDFATHERED = {
  difficulty: ['easy'],
  mode: SCORED_MODES,
} as const satisfies Record<StageAxis, readonly Stage[]>

// What a stored award means under this build's catalogue.
//
// Staging an achievement that used to be cleared once renames what the player holds —
// `flawlessTen` becomes `flawlessTen:easy`, and a boardless award nobody can name any
// more is an achievement quietly taken back. Nothing is ever taken back, so such an award
// is re-read onto the stages above. Unstaging runs the same way in reverse, and a stage
// belonging to the other axis — an achievement restaged from difficulty to mode — is
// re-read the same way, since `intoTheDeep:easy` names a board this build cannot place
// either. All of them are marked unsynced so the server hears the award under its new
// name rather than keeping the old one for ever.
const restage = (entry: EarnedAchievement): EarnedAchievement[] => {
  const axis = achievement(entry.id).staged
  if (axis === undefined) {
    return entry.stage === null ? [entry] : [{ ...entry, stage: null, synced: false }]
  }
  if (entry.stage !== null && isOneOf(entry.stage, STAGE_AXES[axis])) return [entry]
  return GRANDFATHERED[axis].map((stage) => ({ ...entry, stage, synced: false }))
}

// Merges two sets of earned achievements, keeping the earlier moment for anything in
// both.
//
// A union, always. An achievement is never revoked, so there is no case where one side
// knowing about something and the other not means it should go — which is what makes
// this the whole conflict rule, rather than the first of several.
export function mergeEarned(
  local: AchievementStore,
  remote: AchievementStore,
): AchievementStore {
  const merged = new Map<string, EarnedAchievement>()
  for (const entry of [...local, ...remote].flatMap(restage)) {
    const key = awardKey(entry)
    const held = merged.get(key)
    if (held === undefined) {
      merged.set(key, entry)
      continue
    }
    merged.set(key, {
      id: entry.id,
      stage: entry.stage,
      earnedAt: held.earnedAt < entry.earnedAt ? held.earnedAt : entry.earnedAt,
      // Synced if either side says so: the server having it is the only thing `synced`
      // claims, and one of the two sides just came from there.
      synced: held.synced || entry.synced,
    })
  }
  // Catalogue order, then easiest board first, so everything downstream — the chips, the
  // screen, the count — reads in one order without sorting it again.
  return ACHIEVEMENT_IDS.flatMap((id) =>
    awardsOf(id).flatMap((award) => merged.get(awardKey(award)) ?? []),
  )
}

// Adds newly earned achievements, keeping anything already held exactly as it was.
//
// Returns the store it was given when there is nothing new, so a caller can tell there is
// nothing to write by identity.
export function addEarned(
  store: AchievementStore,
  awards: readonly Award[],
  at: string,
): AchievementStore {
  const have = new Set(store.map(awardKey))
  const fresh = awards.filter((award) => !have.has(awardKey(award)))
  if (!isNonEmptyArray(fresh)) return store
  return mergeEarned(
    store,
    fresh.map(({ id, stage }) => ({ id, stage, earnedAt: at, synced: false })),
  )
}

// Every award the store holds, as `awardKey` names it — what the run filters against.
export const keysOf = (store: AchievementStore): string[] => store.map(awardKey)

// The achievements the store holds at least one stage of, for counting and for the list.
export const idsOf = (store: AchievementStore): AchievementId[] => [
  ...new Set(store.map((entry) => entry.id)),
]

// Which boards a staged achievement has been cleared on.
export const stagesOf = (store: AchievementStore, id: AchievementId): Stage[] =>
  store.flatMap((entry) => (entry.id === id && entry.stage !== null ? entry.stage : []))

export const unsyncedOf = (store: AchievementStore): EarnedAchievement[] =>
  store.filter((entry) => !entry.synced)

export const markSynced = (store: AchievementStore): AchievementStore =>
  store.map((entry) => (entry.synced ? entry : { ...entry, synced: true }))

// ─── The device's copy ─────────────────────────────────────────────────────────

// Anything at all that went wrong reading is an empty store rather than a throw. The
// worst an empty store costs is a re-announcement; a throw on launch costs the app.
export async function readAchievements(): Promise<AchievementStore> {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY)
    if (raw === null) return EMPTY_STORE
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_STORE
    return parsed.flatMap((entry: unknown) => (isEntry(entry) ? restage(entry) : []))
  } catch {
    return EMPTY_STORE
  }
}

const isEntry = (value: unknown): value is EarnedAchievement => {
  if (typeof value !== 'object' || value === null) return false
  const entry: Record<string, unknown> = { ...value }
  return (
    typeof entry.id === 'string' &&
    isKnownAchievement(entry.id) &&
    (entry.stage === null || isOneOf(entry.stage, ALL_STAGES)) &&
    typeof entry.earnedAt === 'string' &&
    typeof entry.synced === 'boolean'
  )
}

export async function writeAchievements(store: AchievementStore): Promise<void> {
  try {
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(store))
  } catch {
    // The player keeps what is on screen either way; the next write tries again.
  }
}

// The most recently achieved one, for the line on the intro screen.
//
// Ties are real and common: a run that crosses several at once stamps them all with the
// same instant, and "the latest" has to be one of them rather than whichever the array
// happened to hold last. Catalogue order breaks it, so the answer is stable across
// launches and the same on every device.
export function latestAchievement(store: AchievementStore): AchievementId | null {
  let best: EarnedAchievement | null = null
  for (const entry of store) {
    if (best === null || entry.earnedAt > best.earnedAt) {
      best = entry
      continue
    }
    if (entry.earnedAt !== best.earnedAt) continue
    const order = ACHIEVEMENT_IDS.indexOf(entry.id) - ACHIEVEMENT_IDS.indexOf(best.id)
    if (order > 0) best = entry
  }
  return best?.id ?? null
}

// When an achievement first landed — the earliest of its stages, for the one date the
// row shows. Null for one the store does not hold.
export function firstEarnedAt(store: AchievementStore, id: AchievementId): string | null {
  let first: string | null = null
  for (const entry of store) {
    if (entry.id !== id) continue
    if (first === null || entry.earnedAt < first) first = entry.earnedAt
  }
  return first
}
