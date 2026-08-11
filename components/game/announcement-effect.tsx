import type { ReactElement } from 'react'

import { Confetti } from '@/components/game/confetti'
import { Fireworks } from '@/components/game/fireworks'
import { Hyperspace } from '@/components/game/hyperspace'
import { Implosion } from '@/components/game/implosion'
import { announcementStyle } from '@/lib/announcement-style'
import type { AnnouncementId } from '@/lib/announcements'
import type { Mode } from '@/machines/modes'

// One effect per announcement. Your own records escalate — confetti, gold confetti,
// fireworks, the jump to lightspeed. A rival merely raising a board record gets no
// effect at all: it is news, not a moment, and the bar alone should carry it. Losing a
// record you held gets the jump run backwards.
//
// A value map rather than a switch, so the exhaustiveness check makes a new
// announcement id impossible to add without deciding what it plays.
const EFFECTS = {
  record: (colors) => <Confetti colors={colors} />,
  today: (colors) => <Confetti colors={colors} />,
  week: (colors) => <Fireworks colors={colors} />,
  ever: (colors) => <Hyperspace colors={colors} />,

  todayRaised: () => null,
  weekRaised: () => null,
  everRaised: () => null,

  todayLost: (colors) => <Implosion colors={colors} />,
  weekLost: (colors) => <Implosion colors={colors} />,
  everLost: (colors) => <Implosion colors={colors} />,
} as const satisfies Record<
  AnnouncementId,
  (colors: readonly [string, ...string[]]) => ReactElement | null
>

export function AnnouncementEffect({ id, mode }: { id: AnnouncementId; mode: Mode }) {
  return EFFECTS[id](announcementStyle(id, mode).colors)
}
