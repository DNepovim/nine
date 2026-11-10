import type { ComponentProps, ComponentType, ReactNode } from 'react'

import { BlobTarget } from '@/components/game/blob-target'
import { DancerTarget } from '@/components/game/dancer-target'
import { DraftedTarget } from '@/components/game/drafted-target'
import { FlashlitTarget } from '@/components/game/flashlit-target'
import { HeartTarget } from '@/components/game/heart-target'
import { StruckTarget } from '@/components/game/struck-target'
import { TargetCard } from '@/components/game/target-card'
import { TerminalBoard, TerminalTarget } from '@/components/game/terminal-board'
import { TileBoard, TiledTarget } from '@/components/game/tiled-target'
import type { OpeningTake, TargetForm } from '@/modes'

// What a **target form** is drawn with: what stands around the targets, and each target.
//
// A table so the screen asks for a form by name and never learns what any of them are, the
// way `GLYPHS` draws a mark and `OPENINGS` a scene. Every card keeps one contract, so the
// screen hands either the same props.
type BoardProps = {
  runId: string
  take: OpeningTake
  held: boolean
  children: ReactNode
}

// Discs, struck, beating, drafted, blobs and flashlit numbers stand wherever they were dealt, with nothing around them.
function DealtBoard({ children }: BoardProps) {
  return <>{children}</>
}

export const TARGET_FORMS = {
  discs: { Board: DealtBoard, Card: TargetCard },
  flashlit: { Board: DealtBoard, Card: FlashlitTarget },
  struck: { Board: DealtBoard, Card: StruckTarget },
  beating: { Board: DealtBoard, Card: HeartTarget },
  drafted: { Board: DealtBoard, Card: DraftedTarget },
  dancers: { Board: DealtBoard, Card: DancerTarget },
  tiled: { Board: TileBoard, Card: TiledTarget },
  blobs: { Board: DealtBoard, Card: BlobTarget },
  lines: { Board: TerminalBoard, Card: TerminalTarget },
} as const satisfies Record<
  TargetForm,
  {
    Board: ComponentType<BoardProps>
    Card: ComponentType<ComponentProps<typeof TargetCard>>
  }
>
