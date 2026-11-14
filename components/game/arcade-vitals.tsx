import { View } from 'react-native'

import { HeartIcon } from '@/components/game/heart-icon'
import { EMPTY_LOAF, SatietyLoaves } from '@/components/game/satiety-loaves'
import { HEARTS } from '@/constants/siege'

// ADVENTURE's row under the top bar: the hearts the hero has left, and how fed it is.
export function ArcadeVitals({
  hearts,
  satiety,
  starving,
}: {
  hearts: number
  // How fed the hero is, nought to one — see machines/satiety.ts.
  satiety: number
  starving: boolean
}) {
  return (
    <>
      {/* The hearts, in the row the game screen keeps them in and drawn by the same
        component. Nothing on the way itself can take one — a strike costs a
        crossroad, not a life — so for most of a run these sit full and say only
        that there is something here to lose. The first warrior through makes them
        the thing being watched.

        Counted off `HEARTS` rather than written out, which the game screen is free
        to do because its own count can be infinite and a literal there is a
        deliberate ceiling. Here there is one tuning constant and a bar that would
        quietly stop matching the run if it were changed. */}
      {/* And the loaves, in the same row at the other end of it: the hearts on the
        left under ADVENTURE, how fed the hero is on the right under the way out. The two
        belong in one row because they are one reading — the hearts are what is left
        to lose, and the loaves are how long before losing them starts.

        Two counts, and neither carries a label. The hearts never wanted one — three
        hearts are three hearts in every game ever made — and the loaves stopped
        needing one when they stopped being a bar: a draining rule could be a clock, a
        charge or a score, which is why the word SATIETY used to sit over it, and five
        loaves could not be any of the three. The name lives on the row itself now,
        for anyone the drawing does not reach. See satiety-loaves.tsx.

        `items-center` rather than `items-end`, which is what the caption used to want:
        with the label gone there are two rows of icons here and nothing to sit them
        on a shared baseline for. */}
      <View className="mt-1.5 flex-row items-center justify-between">
        <View className="flex-row gap-1">
          {Array.from({ length: HEARTS }, (_, i) => (
            <HeartIcon key={i} filled={i < hearts} emptyColor={EMPTY_LOAF} />
          ))}
        </View>
        <SatietyLoaves satiety={satiety} starving={starving} />
      </View>
    </>
  )
}
