import * as Updates from 'expo-updates'

// Start the app over, from its first line.
//
// A restore swaps who is signed in, and every persisted hook in the app hydrates once on
// mount: scores, career, achievements, stats, the saved run. Clearing their keys under a
// live tree empties the disk and leaves every one of them still holding the previous
// player's numbers in memory, with no reset path to call — so the honest way to rehydrate
// under a new identity is not to rehydrate at all, but to boot.
//
// `reloadAsync` restarts the JS, not the device: the splash plays once and the intro comes
// back up greeting whoever was just restored. The web variant is in app-reload.web.ts.
export async function reloadApp(): Promise<void> {
  await Updates.reloadAsync()
}
