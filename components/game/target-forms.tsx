import type { ComponentProps, ComponentType, ReactNode } from 'react'

import { TargetCard } from '@/components/game/target-card'
import { TerminalBoard, TerminalTarget } from '@/components/game/terminal-board'
import type { OpeningTake, TargetForm } from '@/modes'

// What a **target form** is drawn with: what stands around the targets, and each target.
//
// A table so the screen asks for a form by name and never learns what any of them are, the
// way `GLYPHS` draws a mark and `OPENINGS` a scene. Both cards keep one contract, so the
// screen hands either the same props.
type BoardProps = {
  runId: string
  take: OpeningTake
  held: boolean
  children: ReactNode
}

// Discs stand wherever they were dealt, with nothing around them.
function DiscBoard({ children }: BoardProps) {
  return <>{children}</>
}

export const TARGET_FORMS = {
  discs: { Board: DiscBoard, Card: TargetCard },
  lines: { Board: TerminalBoard, Card: TerminalTarget },
} as const satisfies Record<
  TargetForm,
  {
    Board: ComponentType<BoardProps>
    Card: ComponentType<ComponentProps<typeof TargetCard>>
  }
>
