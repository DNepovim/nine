// The note an update reload leaves for the launch that follows it.
//
// A waiting service worker takes over by reloading the page (see
// hooks/use-app-update.web.ts), and a reload is indistinguishable from a cold start by
// the time the app boots — so the splash played again over someone who had been looking
// at the app a second earlier. This is how the next launch knows to go straight to the
// intro.
//
// sessionStorage rather than localStorage: it survives a reload of this window and dies
// with it. A note left by a swap that never finished cannot resurface days later and
// silently skip the splash on a genuinely cold start.
const KEY = 'nine.update-reload.v1'

// Answered once per page load. Reading clears the note, so a second caller would be told
// no — and React may call a lazy state initialiser twice, which would put the splash
// back for exactly the launch this exists to spare.
let answer: boolean | null = null

export function markUpdateReload(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // Storage unavailable — Safari in private browsing throws on access rather than
    // returning null. The splash plays, which is where we were before.
  }
}

export function consumeUpdateReload(): boolean {
  if (answer !== null) return answer

  const read = (): boolean => {
    try {
      const found = sessionStorage.getItem(KEY) !== null
      sessionStorage.removeItem(KEY)
      return found
    } catch {
      return false
    }
  }

  answer = read()
  return answer
}
