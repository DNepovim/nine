import { z } from 'zod'

import { TUTORIAL_STEP_COUNT } from '@/constants/tutorial'

// The persisted shape. `step` is absent once the tutorial is done with — finishing
// and skipping both drop it and set the flag.
const progressSchema = z.object({
  finished: z.boolean().optional(),
  step: z.number().optional(),
})

export type TutorialProgress = { finished: boolean; step: number | null }

export const NO_PROGRESS: TutorialProgress = { finished: false, step: null }
export const FINISHED_PROGRESS: TutorialProgress = { finished: true, step: null }

export const clampStep = (step: number): number =>
  Math.min(Math.max(Math.trunc(step), 0), TUTORIAL_STEP_COUNT - 1)

function safeJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return null
  }
}

// Anything unreadable degrades to "never started" rather than throwing — a
// corrupt value shouldn't be able to keep the app off the menu.
export function parseTutorialProgress(raw: string | null): TutorialProgress {
  if (raw === null) return NO_PROGRESS

  const parsed = progressSchema.safeParse(safeJson(raw))
  if (!parsed.success) return NO_PROGRESS
  if (parsed.data.finished === true) return FINISHED_PROGRESS

  const { step } = parsed.data
  if (step === undefined || !Number.isFinite(step)) return NO_PROGRESS
  return { finished: false, step: clampStep(step) }
}

export function serializeTutorialProgress(progress: TutorialProgress): string {
  if (progress.step === null) return JSON.stringify({ finished: progress.finished })
  return JSON.stringify({ finished: progress.finished, step: progress.step })
}

export type TutorialLaunch = 'hidden' | 'fresh' | 'resume'

// What the app does with the tutorial once the splash clears. Both open states
// start on the first screen; `resume` additionally offers a jump to the stored
// step and treats everything before it as already cleared.
export function tutorialLaunch(progress: TutorialProgress): TutorialLaunch {
  if (progress.finished) return 'hidden'
  return progress.step === null ? 'fresh' : 'resume'
}
