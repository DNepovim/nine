import AsyncStorage from '@react-native-async-storage/async-storage'
import { isNonEmptyArray, isOneOf } from 'narrowland'

import { ACHIEVEMENT_IDS, type AchievementId } from '@/constants/achievements'
import { ACHIEVEMENTS_KEY } from '@/constants/storage'

// One achievement the player holds.
//
// `earnedAt` is the moment it was earned, never the moment it synced — the achievements
// screen dates each row with it, and a reinstall that restored them all with today's date
// would quietly rewrite the player's history.
export type EarnedAchievement = {
  id: AchievementId
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
  const merged = new Map<AchievementId, EarnedAchievement>()
  for (const entry of [...local, ...remote]) {
    const held = merged.get(entry.id)
    if (held === undefined) {
      merged.set(entry.id, entry)
      continue
    }
    merged.set(entry.id, {
      id: entry.id,
      earnedAt: held.earnedAt < entry.earnedAt ? held.earnedAt : entry.earnedAt,
      // Synced if either side says so: the server having it is the only thing `synced`
      // claims, and one of the two sides just came from there.
      synced: held.synced || entry.synced,
    })
  }
  // Catalogue order, so everything downstream — the chips, the screen, the count — reads
  // in one order without sorting it again.
  return ACHIEVEMENT_IDS.flatMap((id) => merged.get(id) ?? [])
}

// Adds newly earned achievements, keeping anything already held exactly as it was.
//
// Returns the store it was given when there is nothing new, so a caller can tell there is
// nothing to write by identity.
export function addEarned(
  store: AchievementStore,
  ids: readonly AchievementId[],
  at: string,
): AchievementStore {
  const fresh = ids.filter((id) => !store.some((entry) => entry.id === id))
  if (!isNonEmptyArray(fresh)) return store
  return mergeEarned(
    store,
    fresh.map((id) => ({ id, earnedAt: at, synced: false })),
  )
}

export const idsOf = (store: AchievementStore): AchievementId[] =>
  store.map((entry) => entry.id)

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
    return parsed.flatMap((entry: unknown) => (isEntry(entry) ? [entry] : []))
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
