import { useEffect, useRef, useState } from 'react'
import { Text } from 'react-native'

import { FlipClock } from '@/components/overlays/flip-clock'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { formatCountdown } from '@/lib/duration'

// The time left of a session, ticking.
//
// A component of its own for one reason, and it is the whole reason the file exists:
// **the second hand must not re-render the start screen around it.** `menu-overlay.tsx`
// runs a repeating gradient worklet, a horizontally paging panel, a viewport
// measurement and four lists; a `setInterval` living there would wake all of it once a
// second for the sake of two digits. Here, the state that changes is this component's
// and nothing above it is touched.
//
// Which instant it counts towards is the caller's: the close of a live session, or the
// opening of a teased one. The arithmetic is the same and the label around it differs,
// so the two states share this.
export function ChallengeCountdown({
  until,
  className,
  flip = false,
  gradient,
  large = false,
  onArrive,
}: {
  // The instant being counted towards, ms since the epoch.
  until: number
  // Placement and colour only — the caller decides whether this reads as urgent. Never
  // the size: the role below is the one this figure has everywhere it appears.
  className?: string

  // Drawn as a split-flap board: every digit on its own near-black card, turning as it
  // changes. The challenge card asked for it — there the figure is a cell of its own with
  // its label stacked over it, and a window running down is the one thing in the app that
  // is literally a clock. It carries its own size, which is why there is no size prop
  // beside it; see components/overlays/flip-clock.tsx.
  flip?: boolean
  // The flaps' paint, where a class cannot say it: a pair of gradient stops resolved at
  // runtime. Only read when `flip` is set — a plain figure takes its ink from `className`,
  // which is a token everywhere one is drawn.
  gradient?: readonly [string, string]
  // The flaps at headline size — see `large` on `FlipClock`. Only read when `flip` is set.
  large?: boolean
  // Called once, on the tick that reaches `until`.
  //
  // The whole of what this component tells anybody else, and deliberately the whole: the
  // start screen needs to know that a teaser has run out — so the card can become the
  // live one without a restart — and it must *not* be told once a second. See the note at
  // the top of this file. One call at the boundary is one re-render above; `now` lifted
  // into a parent would be sixty an hour of the gradient worklet, the paging panel, the
  // viewport measurement and the four lists.
  onArrive?: () => void
}) {
  const [now, setNow] = useState(() => Date.now())

  // Held in a ref and synced, rather than named in the dependency array below. A caller
  // that rebuilds this closure every render — which is the ordinary way an inline arrow
  // behaves — would otherwise tear the interval down and re-arm it on every parent render,
  // which is the problem this file exists to not have.
  const announce = useRef(onArrive)
  useEffect(() => {
    announce.current = onArrive
  }, [onArrive])

  // Fired at most once, and deliberately *not* also gated on whether this clock began
  // with time left on it. That guard was here, on the reasoning that a card mounted past
  // `until` has nothing to announce because the read that placed it there already knew —
  // which is wrong in the one case that matters. `Date.now()` can cross `until` between
  // the read and this component's first render, and the guard then latched false, skipped
  // the interval, and never announced: a teaser stuck on "starts in 0ʰ" until the app was
  // relaunched, which is the exact failure this prop was added to prevent.
  //
  // Announcing on a mount already past the mark costs one `reckon` and one re-render that
  // may resolve to the same card. It cannot loop — `cardSession` reads the clock, so a
  // card still teasing has an `until` still ahead of it, and this ref stops a second call
  // either way. One wasted render against a permanently wrong card is not a close call.
  const arrived = useRef(false)

  useEffect(() => {
    // Stops once it has arrived. A card whose session has closed keeps saying 0:00 —
    // which is what `formatCountdown` clamps to — rather than running a timer forever
    // to count further into the past.
    if (now >= until) {
      if (!arrived.current) {
        arrived.current = true
        announce.current?.()
      }
      return
    }
    const tick = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(tick)
    }
    // `now` is a dependency so the interval is torn down on the tick that reaches the
    // end. Re-arming once a second is cheap — it is one timer — and it is what lets the
    // stop above be a plain comparison rather than a second piece of state.
  }, [now, until])

  // Read off `Date.now()` rather than counted down from a stored figure, so a device
  // that slept through an hour comes back with the right answer rather than an hour of
  // missed ticks.
  const text = formatCountdown(until - now)

  if (flip && gradient !== undefined) {
    return (
      <FlipClock text={text} gradient={gradient} large={large} className={className} />
    )
  }

  return (
    <Text selectable={false} className={cn(TYPE.figure, className)}>
      {text}
    </Text>
  )
}
