import type { ReactElement } from 'react'

import { Confetti } from '@/components/game/confetti'
import { Fireworks } from '@/components/game/fireworks'
import { Hyperspace } from '@/components/game/hyperspace'
import { ANNOUNCEMENT_COLORS } from '@/constants/colors'
import type { AnnouncementId } from '@/lib/announcements'

// One celebration per announcement, escalating with the record: confetti for your own
// best, gold confetti for the day, fireworks for the week, and the jump to lightspeed
// for all time. A value map rather than a switch, so the exhaustiveness check makes a
// new announcement id impossible to add without deciding how it celebrates.
//
// Colours come from ANNOUNCEMENT_COLORS, shared with the bar behind the message.
const EFFECTS = {
  record: (colors) => <Confetti colors={colors} />,
  today: (colors) => <Confetti colors={colors} />,
  week: (colors) => <Fireworks colors={colors} />,
  ever: (colors) => <Hyperspace colors={colors} />,
} as const satisfies Record<
  AnnouncementId,
  (colors: readonly [string, ...string[]]) => ReactElement
>

export function AnnouncementEffect({ id }: { id: AnnouncementId }) {
  return EFFECTS[id](ANNOUNCEMENT_COLORS[id])
}
