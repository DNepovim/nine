import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { FACTOR_CODE } from '@/components/overlays/profile-boards'
import { StatCell } from '@/components/overlays/stat-cell'
import { ACHIEVEMENT_COUNT } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { compactText } from '@/lib/compact-number'
import { formatCareerTime } from '@/lib/duration'
import type { Lifetime } from '@/lib/player-profile'

// A career in five cells, and the achievements under them — the profile card's figures.
export function ProfileStatCells({
  lifetime,
  avgAccuracy,
  avgSpeed,
  shownAchievements,
}: {
  lifetime: Lifetime
  avgAccuracy: number | null
  avgSpeed: number | null
  // How many achievements the server counts, held to this build's catalogue.
  shownAchievements: number
}) {
  const { t } = useLingui()
  const percent = (value: number | null): string => (value === null ? '—' : `${value}%`)

  return (
    <>
      {/* Five cells rather than four, so the gap comes in a step: RUNS and
        HITS count what happened, TIME says over how long, and the two
        averages say how well. Which of the two a cell is comes off its own
        kicker line rather than out of its label, so the labels are five bare
        codes and the row reads as the two groups it is.

        Back at the run stats' gap-5 now the labels have shed a word. It was
        cut to gap-4 for the Czech, where PRŮM PŘES and PRŮM RYCH sat side by
        side and ran the row out of room on a narrow phone; PŘES and RYCH
        under a shared PRŮM are a third of that, and CELKEM over HRY is no
        wider than ZÁSAHY already was. */}
      <View className="w-full flex-row items-start justify-center gap-5">
        {/* Shortened past a thousand, the way the fortune above them
          already is: a career of 6 214 runs and 58 900 hits written out in
          full would make those two cells several times as wide as the three
          beside them, and the row is laid out to fit five. A lifetime total
          is read for its size, not its last three digits. */}
        <StatCell label={t`RUNS`} kicker={t`TOTAL`} value={compactText(lifetime.runs)} />
        <StatCell label={t`HITS`} kicker={t`TOTAL`} value={compactText(lifetime.hits)} />
        {/* A career with nothing counted says 0, not 0″. On the pause and
          game over screens a duration of zero seconds is a real answer about
          a real run; here it means no run has been timed yet, and a unit mark
          on it dresses an absence as a measurement. The overhang goes with
          the mark — a bare 0 has nothing hanging out, and pulling it left
          anyway would sit it off centre over its own label.

          Coarse, not the run stats' format: the largest unit a career has
          reached and the one under it — 10ᵈ07ʰ — because nobody reads the
          seconds of 247ʰ38′12″ and a figure that long would be what sizes
          the row. Two units and not one, so the cell says something that
          moves between two visits rather than the same word for a day. */}
        <StatCell
          label={t`TIME`}
          kicker={t`TOTAL`}
          value={lifetime.timeMs > 0 ? formatCareerTime(lifetime.timeMs) : '0'}
          overhang={lifetime.timeMs > 0}
        />
        {/* The same ACC and SPD the per-board table heads its factor
          columns with, now that the kicker carries the AVG — one word for
          what both of them are, said once above them. */}
        <StatCell
          label={t(FACTOR_CODE.acc)}
          kicker={t`AVG`}
          value={percent(avgAccuracy)}
        />
        <StatCell label={t(FACTOR_CODE.spd)} kicker={t`AVG`} value={percent(avgSpeed)} />
      </View>

      {/* Counted against the whole catalogue, the way the player's own
        achievements screen counts it — and in the green nothing but an
        achievement wears, so the one number here that cannot be taken away
        does not read as another board stat. The server's count, even on your
        own profile: what a device has earned but not yet synced is the
        achievements screen's business, and a profile is what anyone tapping
        the name would see. */}
      <Text selectable={false} className={cn(TYPE.caption, 'text-center text-dim')}>
        <Trans>
          <Text style={{ color: ACHIEVEMENT_INK }}>{shownAchievements}</Text> OF{' '}
          {ACHIEVEMENT_COUNT} ACHIEVEMENTS
        </Trans>
      </Text>
    </>
  )
}
