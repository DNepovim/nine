import { useCallback, useEffect, useRef, useState } from 'react'

import type { Announcement } from '@/lib/announcements'

// The announcement the best-scores strip is showing, held past the moment it clears so
// its wipe can play out — and whether it is on its way out.
export function usePinnedAnnouncement(announcement: Announcement | null) {
  // The bar has to outlive the announcement: when it clears, the last one stays on
  // screen in `shown` while its sweep wipes it away, and is dropped on onExited.
  const [pinned, setPinned] = useState<Announcement | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (announcement !== null) {
      setPinned(announcement)
      setLeaving(false)
      return
    }
    setLeaving(true)
  }, [announcement])

  // The next announcement is timed to take the bar exactly as this one's wipe lands, so
  // the two can arrive in either order by a frame. Read through a ref because the bar
  // holds this callback for the length of an animation, and a stale closure here would
  // drop a pin that had already been replaced.
  const announcementRef = useRef(announcement)
  announcementRef.current = announcement

  // Stable identity: the bar restarts its wipe whenever this changes, and an inline
  // arrow would hand it a new one on every render — which is every score change.
  const handleExited = useCallback(() => {
    // Something took the bar while this one was leaving. Unpinning now would throw it
    // away unshown, and nothing would put it back.
    if (announcementRef.current !== null) return
    setPinned(null)
    setLeaving(false)
  }, [])

  return { pinned, leaving, handleExited }
}
