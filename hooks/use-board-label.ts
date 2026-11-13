import { useLingui } from '@lingui/react/macro'

import { codeOf, DIFFICULTIES, type Difficulty, type ScoredMode } from '@/modes'

// A board's name in the tables: the mode's code and the rung's, as the medal line has it.
export function useBoardLabel() {
  const { t } = useLingui()
  return (mode: ScoredMode, difficulty: Difficulty) =>
    `${t(codeOf(mode))} · ${t(DIFFICULTIES[difficulty].code)}`
}
