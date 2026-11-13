import { Trans } from '@lingui/react/macro'

import type { Challenge } from '@/lib/next-challenge'
import type { Difficulty, ModeId } from '@/modes'

import { CardButton } from './run-screen'

// The dare the screen offers next to playing again: the same run one rung harder, one
// rung easier, or the other mode at the same rung. A component of its own because the
// words are a rung or a mode name dropped into a sentence, and which half a sentence puts
// first is the translation's business.
export function GameOverChallenge({
  challenge,
  rungName,
  modeName,
  onChallenge,
}: {
  challenge: Challenge
  rungName: string
  modeName: string
  onChallenge: (mode: ModeId, difficulty: Difficulty) => void
}) {
  return (
    <CardButton
      onPress={() => {
        onChallenge(challenge.mode, challenge.difficulty)
      }}
      label={
        challenge.kind === 'stepUp' ? (
          <Trans>STEP UP TO {rungName}</Trans>
        ) : challenge.kind === 'stepDown' ? (
          <Trans>STEP DOWN TO {rungName}</Trans>
        ) : (
          <Trans>TRY {modeName}</Trans>
        )
      }
    />
  )
}
