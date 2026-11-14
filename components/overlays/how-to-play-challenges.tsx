import { Trans, useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { GAME_SCALE } from '@/constants/colors'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's CHALLENGES section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayChallenges({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="challenges" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`\nEvery so often a challenge appears at the top of the start screen, with a clock running down beside it. It is a game of Nine with something changed — and what has changed is different every time.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            It is on for a window and then it is gone. The clock on the card is what is
            left of it.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            The rules are its own. The keys, the clock, the scoring, how many lives you
            get — any of it may be different, and the card says what before you start.
            Unless it says otherwise, it scores like Accuracy: the fewest moves build your
            streak, and a wasted move never costs a heart.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            One set of standings, shared by everyone playing it, and it never resets. Your
            best run is the one that counts. Where the standings are a race against the
            clock, only a run you finish counts at all — stop early, or let the window
            close on you, and it is not timed.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            Finish in the top three and you get the medal for it, and the place itself
            pays: first takes their score again, second half of it, third a fifth — on top
            of the points every run already adds to your fortune. A challenge keeps no
            board of its own, so there is nothing to lose it to afterwards.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            If the window closes while you are playing, the run ends there — and you are
            told how it finished.
          </Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      <HowToPlayBody>
        {t`If the same challenge comes round again it starts from nothing: a new window is a new contest, and the last one stays where it is.`}
      </HowToPlayBody>
    </>
  )
}
