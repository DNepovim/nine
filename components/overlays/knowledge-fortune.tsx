import { Trans } from '@lingui/react/macro'

import { KnowledgeFormula } from '@/components/overlays/knowledge-formula'
import { KnowledgeNote } from '@/components/overlays/knowledge-note'
import { KnowledgeSection } from '@/components/overlays/knowledge-section'
import { list } from '@/lib/admin/knowledge-figures'
import { WIN_PERIODS, WIN_RANKS, winFactor } from '@/lib/winnings'
import { DIFFICULTIES, DIFFICULTY_ORDER } from '@/modes'

export function KnowledgeFortune() {
  const weights = list(DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].scoreWeight))
  // The two shares `winFactor` multiplies, read back out of it at Hard, where the
  // difficulty half is ×1.
  const periods = list(WIN_PERIODS.map((period) => winFactor(period, 'hard', 1)))
  const places = list(WIN_RANKS.map((rank) => winFactor('week', 'hard', rank)))

  return (
    <>
      <KnowledgeSection title={<Trans>FORTUNE</Trans>}>
        <KnowledgeFormula>
          <Trans>Σ runs (score × w) + Σ sessions ((best + bonus) × w) + Σ winnings</Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            w = {weights} for Easy / Hard / Extreme. Runs: every finished Accuracy or
            Speed run, not only the best. Nothing else adds.
          </Trans>
        </KnowledgeNote>
      </KnowledgeSection>

      <KnowledgeSection title={<Trans>SESSION BONUS</Trans>}>
        <KnowledgeFormula>
          <Trans>bonus = best × 1 / 0.5 / 0.2 for 1st / 2nd / 3rd</Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            best = the player's best run of the session. Paid 10 minutes after the close,
            automatically.
          </Trans>
        </KnowledgeNote>
      </KnowledgeSection>

      <KnowledgeSection title={<Trans>WINNINGS</Trans>}>
        <KnowledgeFormula>
          <Trans>winning = score in window × w × period × place</Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            period = {periods} for day / week. place = {places} for 1st / 2nd / 3rd. Joins
            the fortune only after CLAIM.
          </Trans>
        </KnowledgeNote>
      </KnowledgeSection>
    </>
  )
}
