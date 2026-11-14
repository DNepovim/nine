import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { CardSection } from '@/components/overlays/card-section'
import { BOARD_COLUMNS, ProfileBoardRow } from '@/components/overlays/profile-board-row'
import { ProfileColumnHead } from '@/components/overlays/profile-column-head'
import { TYPE } from '@/constants/typography'
import type { BoardRow } from '@/lib/player-profile'
import { codeOf, gradientOf, headlineOf, SCORED_MODES, type Headline } from '@/modes'

// What each mode is judged on — the second line of both of its factor columns, the
// average and the best alike.
//
// Keyed by the factor and read through `headlineOf`, rather than keyed by the mode. The
// two coincide today only because both scored modes are named after the thing they
// measure; a mode scored on the route but called something else would still want ACC in
// this column. Which is also why it is not `codeOf` — a board code names the board, and
// this names the question the column is asking.
export const FACTOR_CODE = {
  acc: msg`ACC`,
  spd: msg`SPD`,
} as const satisfies Record<Headline, MessageDescriptor>

// The BOARDS card on a profile: a table per scored mode, its difficulties under it.
export function ProfileBoards({ rows }: { rows: readonly BoardRow[] }) {
  const { t } = useLingui()
  return (
    <>
      {/* Both boards on one card, the way the comparison draws its own two
        blocks: a mode heading and three difficulties under it is a table, and
        two tables with nothing behind them read as six loose rows with a
        coloured word every fourth. The tile is what says where one table ends.

        One tile rather than two, because the heading inside each already names
        its mode — a card apiece would be drawing the same boundary twice. */}
      <CardSection label={t`BOARDS`}>
        {SCORED_MODES.map((mode) => (
          <View key={mode}>
            {/* Taller than the rows under it, because these headings are two
              lines where a row is one. */}
            <View className="h-9 flex-row items-end">
              {/* The board code rather than the mode spelled out. The
                rows under it are the thing being read, and the four columns
                of figures they need are what a narrow phone has room for —
                ACC over them says as much as ACCURACY did, in the register
                the medal line and the reign rows already name a board in.

                Three points over the difficulty codes under it, which is
                what makes it read as the head of them rather than as a
                fourth row of the same list. Two codes a point apart in the
                same weight is two rows; three points apart is a heading and
                its rows. The colour was already saying mode where they say
                difficulty — this says which of the two is being announced.

                Its own width, with the slack pushed into the spacer beside
                it, rather than a `flex-1` cell. Stretched across the gap the
                code was the one thing in this row that could be asked to
                give way, and a clipped board code is three letters short of
                unreadable — it has no second half to guess the rest from the
                way a spelled word does. Everything right of it is a fixed
                width, so the slack has to live somewhere, and a spacer is
                the one place it cannot cost anything. */}
              <Text
                selectable={false}
                className={TYPE.button}
                style={{ color: gradientOf(mode)[0] }}
              >
                {t(codeOf(mode))}
              </Text>
              <View className="flex-1" />
              <ProfileColumnHead width={BOARD_COLUMNS.runs} bottom={t`RUNS`} />
              <ProfileColumnHead
                width={BOARD_COLUMNS.best}
                top={t`BEST`}
                bottom={t`SCORE`}
              />
              {/* The mode's own factor twice: how it usually goes, then
                the once it all landed. Both second lines come from the same
                message, so the pair can never end up asking about two
                different things. */}
              <ProfileColumnHead
                width={BOARD_COLUMNS.average}
                top={t`AVG`}
                bottom={t(FACTOR_CODE[headlineOf(mode)])}
              />
              <ProfileColumnHead
                width={BOARD_COLUMNS.bestFactor}
                top={t`BEST`}
                bottom={t(FACTOR_CODE[headlineOf(mode)])}
              />
            </View>
            {rows
              .filter((row) => row.mode === mode)
              .map((row) => (
                <ProfileBoardRow
                  key={row.difficulty}
                  mode={row.mode}
                  difficulty={row.difficulty}
                  runs={row.runs}
                  best={row.best}
                  average={row.average}
                  bestFactor={row.bestFactor}
                  medals={row.medals}
                />
              ))}
          </View>
        ))}
      </CardSection>
    </>
  )
}
