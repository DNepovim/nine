import type { Target } from '@/machines/game'

export type Position = { x: number; y: number }

// A machine target augmented with its on-screen placement and exit-animation flag.
export type DisplayTarget = Target & { exiting: boolean; position: Position }
