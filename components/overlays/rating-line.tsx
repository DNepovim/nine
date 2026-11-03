import { Plural, Trans } from '@lingui/react/macro'

import type { ChallengeRating } from '@/lib/admin/ratings'

// What players made of the challenge, over every session of it — the figure an admin
// reads when deciding whether it comes back. The caller draws nothing at all for a
// challenge nobody has rated, and nothing for a tester, whose read of it is refused: a
// line saying "no ratings" would be wrong for the second and noise for the first.
//
// Its own file since the lab's row and the challenge's page both print it.
export function RatingLine({ rating }: { rating: ChallengeRating }) {
  const average = rating.average.toFixed(1)
  return (
    <>
      <Trans>RATED {average}</Trans>
      {' · '}
      <Plural value={rating.ratings} one="# RATING" other="# RATINGS" />
    </>
  )
}
