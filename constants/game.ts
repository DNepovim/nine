import Constants from 'expo-constants'

export const MAX_TARGET = 324 // 9 × (sum of row×col weights)
export const SWIPE_THRESHOLD = 20

// Target card / countdown pie geometry (the card footprint is the pie itself).
export const PIE_SIZE = 80
export const CARD_GAP = 10

// Spawn cadence while playing.
export const SPAWN_INTERVAL = 5000

// Build identifier shown on the intro screen. EXPO_PUBLIC_BUILD_ID is injected
// at build time (git sha + timestamp); falls back to "dev" during `expo start`.
export const BUILD_LABEL = `v${Constants.expoConfig?.version ?? '?'} · ${process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev'}`
