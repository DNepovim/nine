// Whether this launch is the reload a service-worker update ends in — a web-only idea.
// The real implementation is in update-reload.web.ts; this variant exists so the native
// bundle never reaches for sessionStorage.
//
// Only the answer is here. Leaving the note is `markUpdateReload`, which lives in the web
// module and is called from the web-only update hook: native updates arrive through the
// store or expo-updates, and neither reloads the page out from under the player, so there
// is never anything to remember.
export const consumeUpdateReload = (): boolean => false
