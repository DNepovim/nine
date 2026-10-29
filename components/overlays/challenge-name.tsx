import { useLingui } from '@lingui/react/macro'

import { GradientText } from '@/components/gradient-text'
import { gradientOf, labelOf, type ModeId } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// A challenge's name in its own colours, which is the one treatment both names on the
// summary share — the contest that has just ended, and the one offered next.
//
// `challengeInk` is what makes that safe: a challenge's bright stop is tuned to *be* a
// colour rather than to carry text, and this walks it down until it can. The same pair
// the challenge card draws its own name from, so one challenge is one colour wherever it
// is written.
//
// Its own file since the **rating** dialog asked for it too: the session it asks about is
// named the way the summary before it named the same session.
export function ChallengeName({
  modeId,
  className,
}: {
  modeId: ModeId
  className: string
}) {
  const { t } = useLingui()
  const [from, to] = gradientOf(modeId)
  return (
    <GradientText
      text={t(labelOf(modeId))}
      from={challengeInk(from)}
      to={challengeInk(to)}
      className={className}
    />
  )
}
