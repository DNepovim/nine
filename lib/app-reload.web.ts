// The web half of `reloadApp` — see app-reload.ts for why a restore ends in one.
//
// `location.reload()` rather than expo-updates, which has no web implementation. The
// promise never settles, and deliberately: the page is going away, and a caller that
// carried on afterwards would be drawing a frame of the app as somebody it is no longer
// signed in as. Awaiting this is the last thing a restore does.
export function reloadApp(): Promise<void> {
  return new Promise(() => {
    window.location.reload()
  })
}
