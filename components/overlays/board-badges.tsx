import { useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import {
  CHALLENGE_WORD,
  darkGradientOf,
  DIFFICULTIES,
  gradientOf,
  isChallenge,
  lerpColor,
  runLabel,
  runSubmode,
  type Difficulty,
  type ModeId,
} from '@/modes'

// Lifted off the screen the way every other gradient pill here is — the pill itself
// carries the colour, the shadow says it sits above the copy around it. On the outer
// view, not the clipped one: `overflow-hidden` is what keeps the gradient inside the
// corners, and a clipped layer casts no shadow.
const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 6,
  elevation: 3,
}

// Which board the run was played on, worn the way the menu wears it: the mode and its
// difficulty as gradient pills, the same white-on-mode-gradient the selectors give the
// option you picked. There they are the choice; here they are the record of it, so
// they take the colour and none of the interaction.
export function BoardBadges({
  gameMode,
  difficulty,
  tutorial = false,
}: {
  gameMode: ModeId
  // Left out by a run with no difficulty to record. Trainee has no selector and takes
  // the Easy pace whatever the menu last had selected, so a pill naming one there would
  // be reporting a choice the player never made.
  difficulty?: Difficulty
  // The run is the tutorial, so the first pill names that rather than the mode under it.
  // Default off: the two screens that report a *board* — game over, and the challenge
  // being offered — are never showing one.
  tutorial?: boolean
}) {
  const { t } = useLingui()
  const mode = t(runLabel(gameMode, runSubmode(tutorial)))
  // What the run was, as pills. Three shapes, and which one is drawn says what kind of
  // thing the player just played:
  //
  //   **A challenge** — CHALLENGE, then its own name. Two pills because the name alone
  //   does not say what it is: FOUR KEYS is a mode nobody has seen before and will not
  //   see again after today, and on the screens that stop a run there is nothing else
  //   left to say so. A challenge pins its own rung, so the second slot is free.
  //
  //   **A mode with a rung** — the mode, then the rung.
  //
  //   **A mode that pins its own rung, or a run with none** — the mode alone.
  const labels = isChallenge(gameMode)
    ? [t(CHALLENGE_WORD), mode]
    : difficulty === undefined
      ? [mode]
      : [mode, t(DIFFICULTIES[difficulty].label)]

  // What each pill is painted in: **one gradient across both of them**.
  //
  // The pair is the mode's own, and the two pills divide it — the first runs from its
  // opening stop to the middle, the second from that middle to its closing stop. So the
  // row reads as one ramp interrupted by the gap between the pills rather than as two
  // separate labels that happen to share a palette, which is what it was when each pill
  // carried the whole gradient.
  //
  // Split at the middle rather than by width. The pills are rarely the same size —
  // CHALLENGE beside FOUR KEYS, ACCURACY beside HARD — so a true continuation would
  // divide the ramp in proportion to how wide each one measured. The halves meet on the
  // same colour either way, which is the part the eye follows; what differs is how fast
  // each pill gets there, and that is not a thing anybody can see across an 8pt gap.
  //
  // A **challenge** takes its darkened pair rather than its bright one. Its first stop is
  // the near-black every challenge shares, so the row opens the same whichever was
  // played and arrives at that challenge's own colour — and both ends carry white, where
  // the bright stop is the arc's light end and would put white on about 1.7:1.
  const [from, to] = isChallenge(gameMode)
    ? darkGradientOf(gameMode)
    : gradientOf(gameMode)
  const middle = lerpColor(from, to, 0.5)

  const pillPair = (index: number): readonly [string, string] => {
    // A lone pill is the whole ramp: there is no second half for it to hand on to.
    if (labels.length < 2) return [from, to]
    return index === 0 ? [from, middle] : [middle, to]
  }

  return (
    <View className="mb-5 flex-row items-center gap-2">
      {labels.map((label, index) => (
        <View
          key={label}
          className="rounded-lg"
          // The opaque ground iOS draws the shadow from: a transparent view has no
          // shape to cast one, and this is the gradient's own first stop, so nothing
          // of it shows past the pill on top.
          style={{ ...shadow, backgroundColor: pillPair(index)[0] }}
        >
          <LinearGradient
            colors={[...pillPair(index)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="overflow-hidden rounded-lg px-3 py-1"
          >
            <Text selectable={false} className={cn(TYPE.quietAction, 'text-white')}>
              {label}
            </Text>
          </LinearGradient>
        </View>
      ))}
    </View>
  )
}
