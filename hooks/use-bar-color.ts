import { useEffect, useId } from 'react'
import { Platform } from 'react-native'

import { SURFACE } from '@/constants/colors'

// The colour the phone paints its own chrome in: Safari's top bar, and the status bar
// over an installed app. The `theme-color` tag declared in app/+html.tsx is the only say
// we get over it, and the phone re-reads it whenever it changes — so the bar is ours to
// move mid-run, not just once per launch.
//
// Why a module-level registry and not a context: nothing renders differently for this.
// The bar is one string on one tag outside React's tree, and a provider would re-render
// the app to write it. `components/screen.tsx` keeps its own live-screen count the same
// way and for the same reason.
//
// The arrangement is a base and a stack of claims over it. The base is the app's surface
// and never moves. A screen painted in something else claims that colour for as long as it
// is mounted, and the newest claim wins; releasing is automatic, so a screen cannot leave
// the bar behind it.
//
// The change is a snap, not a fade. Safari cross-fades its own bar and an installed app
// does not, and there is no way to drive it from a worklet without a DOM write per frame
// — so a claim is best taken and released at a moment the screen underneath is already
// changing, where a snap reads as part of the cut.

type Claim = { readonly id: string; readonly color: string }

// The same value app/+html.tsx declares on the tag, so the registry and the document
// agree from the first frame, whatever a claim does in the meantime.
const base = SURFACE
let claims: readonly Claim[] = []

function paint() {
  // Native has no tag to write. Android's status bar is drawn by the system under
  // edge-to-edge and iOS has no status-bar background at all, so there is nothing here
  // for a native build to do — production is the web app, and this is where its bar is.
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  const tag = document.querySelector('meta[name="theme-color"]')
  if (tag instanceof HTMLMetaElement) tag.content = claims.at(-1)?.color ?? base
}

// Claim the bar for as long as this component is mounted. `null` claims nothing, so a
// screen that is only sometimes painted can call this unconditionally.
export function useBarColor(color: string | null) {
  const id = useId()

  useEffect(() => {
    if (color === null) return
    claims = [...claims.filter((claim) => claim.id !== id), { id, color }]
    paint()
    return () => {
      claims = claims.filter((claim) => claim.id !== id)
      paint()
    }
  }, [id, color])
}
