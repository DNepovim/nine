import { Trans, useLingui } from '@lingui/react/macro'
import { ScrollView, Text, View } from 'react-native'

import { CardSection } from '@/components/overlays/card-section'
import { CompareBoardRow } from '@/components/overlays/compare-board-row'
import { CompareHead } from '@/components/overlays/compare-head'
import { CompareSkeleton } from '@/components/overlays/compare-skeleton'
import { CompareStatRow } from '@/components/overlays/compare-stat-row'
import { CompareWonRow } from '@/components/overlays/compare-won-row'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { useChampionsContext } from '@/hooks/use-champions'
import { usePlayerProfile } from '@/hooks/use-player-profile'
import { useViewport } from '@/hooks/use-viewport'
import { championMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { boardTallyOf, compareProfiles, tallyOf, verdictOf } from '@/lib/compare'
import { verdictLine } from '@/lib/compare-lines'
import { lifetimeOf, nameFactorsOf, type PlayerProfile } from '@/lib/player-profile'

// A player with no nickname cannot be on a board and so cannot be on this table either —
// the type still allows it, so this is what the header would print if one ever arrived.
const NO_NAME = '…'

// The two careers side by side, opened from the bottom of a profile.
//
// It takes the profile it was opened over rather than fetching it again: the numbers in the
// right-hand column are the numbers on the card behind this one, and a second read is a
// second chance for the two to disagree. Only the viewer's own profile is fetched here —
// usually from the session cache the profile hook keeps, so the table is up before the
// card has finished arriving.
export function CompareOverlay({
  viewerId,
  theirId,
  theirProfile,
  onClose,
}: {
  // Who is looking. The left column, and the one profile this modal has to go and get.
  viewerId: string
  // Who they are looking at. Carried beside their profile rather than read off it: a
  // profile is what a player has done, and has never held the id of the player who did it.
  // The header needs one to ask whether they hold a board.
  theirId: string
  theirProfile: PlayerProfile
  onClose: () => void
}) {
  const { t } = useLingui()
  const { height } = useViewport()
  const { profile: myProfile, loading, error, reload } = usePlayerProfile(viewerId)
  // Read from the context rather than fetched here, the way the profile card reads it: the
  // two Extreme leaders are already known and kept live off the board connection, so a
  // mark on this table cannot contradict the one on the card it opened from.
  const champions = useChampionsContext()

  const comparison = myProfile === null ? null : compareProfiles(myProfile, theirProfile)
  // Two counts, and they are not the same figure. `tally` is the whole table and seeds the
  // sentence under the header; `boardTally` is the six boards alone and is the row drawn at
  // the foot of them.
  const tally = comparison === null ? null : tallyOf(comparison)
  const boardTally = comparison === null ? null : boardTallyOf(comparison)
  // The six boards as one list, where the comparison keeps them in a block per mode. The
  // table draws them under a single label — the row writes its own board as a code — and
  // the WON row under them needs to know how many came before it to take its turn arriving.
  const boards =
    comparison === null
      ? []
      : comparison.boards.flatMap((block) =>
          block.rows.map((row) => ({ mode: block.mode, ...row })),
        )
  // What the table came to, as one word, decided once. The header draws its pair of animals
  // from it and the sentence below picks its phrasing from it — two readings of one table
  // rather than two tables read twice.
  const verdict = comparison === null ? null : verdictOf(comparison)

  // Each name is drawn in the gradient that player's own averages earn them — the same
  // colour it wore on the card this table opened from, and on the row that opened that. The
  // two averages behind it are the AVG ACC and AVG SPD rows of this very table, which is as
  // close as the colour ever gets to explaining itself outside the profile.
  const myFactors =
    myProfile === null
      ? null
      : nameFactorsOf(lifetimeOf(myProfile.totals, myProfile.winnings))
  const theirFactors = nameFactorsOf(
    lifetimeOf(theirProfile.totals, theirProfile.winnings),
  )

  // `replacing`: this table only ever opens from the bottom of a profile card, and it
  // opens under that card. It is covered for the length of the profile's exit, so it is
  // there in full the moment that card clears rather than fading up through it.
  return (
    <ModalCard
      title={t`WHO IS BETTER?`}
      onDismiss={onClose}
      maxHeight={height * 0.85}
      replacing
    >
      {(close) => (
        <View className="shrink gap-3">
          {/* A career that could not be read is never drawn as a career of zeroes — the
              same call the profile makes, and for the same reason: a table that quietly
              awards every row to the other player because one side failed to load is worse
              than a table that says it failed. The header waits on the same read, so a
              failed one shows no names rather than one name and a blank. */}
          {myProfile === null && error !== null && (
            <View className="items-center gap-3 py-4">
              <Text
                selectable={false}
                className={cn(TYPE.proseSm, 'text-center text-dim')}
              >
                <Trans>Your profile could not be loaded.</Trans>
              </Text>
              <TrackedPressable
                id="compare.try_again"
                onPress={reload}
                className="items-center rounded-2xl bg-card px-6 py-3"
              >
                <Text selectable={false} className={cn(TYPE.heading, 'text-primary')}>
                  <Trans>TRY AGAIN</Trans>
                </Text>
              </TrackedPressable>
            </View>
          )}

          {/* The table's own shape while the viewer's career is being read, rather than a
              word on a card a fraction of the height the table comes to. */}
          {myProfile === null && error === null && loading && <CompareSkeleton />}

          {comparison !== null &&
            tally !== null &&
            boardTally !== null &&
            verdict !== null &&
            myProfile !== null &&
            myFactors !== null && (
              <>
                {/* Each side's best claim in each mode, from the profile that was read for
                    it — the same reduction the intro puts under the title and the profile
                    card under the nickname, never derived a second time here. */}
                <CompareHead
                  myId={viewerId}
                  myNickname={myProfile.nickname ?? NO_NAME}
                  myAvgAccuracy={myFactors.avgAccuracy}
                  myAvgSpeed={myFactors.avgSpeed}
                  myMark={championMark(viewerId, champions)}
                  myMedals={myProfile.medals}
                  theirId={theirId}
                  theirNickname={theirProfile.nickname ?? NO_NAME}
                  theirAvgAccuracy={theirFactors.avgAccuracy}
                  theirAvgSpeed={theirFactors.avgSpeed}
                  theirMark={championMark(theirId, champions)}
                  theirMedals={theirProfile.medals}
                  verdict={verdict}
                />

                {/* What the table came to, in a sentence. Thirteen rows of figures answer
                    the question in full and answer it slowly; this is the same answer at a
                    glance, and it is the only line on the card written as prose — sentence
                    case and narrow tracking, like the motto and the announcement bar, since
                    the house's wide caps would make a sentence read as a heading.

                    Seeded on the two players and the score between them, so closing the
                    table and opening it again says the same thing, and only a board
                    actually changing hands changes the words. */}
                <Text
                  selectable={false}
                  className={cn(TYPE.proseSm, 'px-2 text-center text-dim')}
                >
                  {verdictLine(
                    verdict,
                    `${viewerId}:${theirId}:${tally.mine}-${tally.theirs}`,
                    t,
                  )}
                </Text>

                {/* The same shape the profile card uses: the scroll gives way inside the
                    card's height cap while a short table stays its own height. The header
                    and the verdict stay above it — they are what the card is, and a reader
                    who has scrolled to the boards should still be able to see whose they
                    are. */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 1 }}
                >
                  <View className="gap-3">
                    <CardSection label={t`CAREER`}>
                      {comparison.lifetime.map((row, index) => (
                        <CompareStatRow
                          key={row.stat}
                          stat={row.stat}
                          mine={row.mine}
                          theirs={row.theirs}
                          leader={row.leader}
                          index={index}
                        />
                      ))}
                    </CardSection>

                    {/* Six rows under one label, where the boards used to be two blocks of
                        three under a mode name apiece. The row writes its own board as a
                        code, so nothing has to be said above it. */}
                    <CardSection label={t`BOARDS`}>
                      {boards.map((row, index) => (
                        <CompareBoardRow
                          key={`${row.mode}-${row.difficulty}`}
                          mode={row.mode}
                          difficulty={row.difficulty}
                          mine={row.mine}
                          theirs={row.theirs}
                          leader={row.leader}
                          index={comparison.lifetime.length + index}
                        />
                      ))}

                      {/* What the six above came to. It arrives last, which is the order it
                          is read in — the row counts the carets over it, so it has nothing
                          to say until they are all there. */}
                      <CompareWonRow
                        mine={boardTally.mine}
                        theirs={boardTally.theirs}
                        index={comparison.lifetime.length + boards.length}
                      />
                    </CardSection>
                  </View>
                </ScrollView>
              </>
            )}

          {/* The way out, at the end of the table as well as in the card's corner. A
              comparison is read top to bottom, and by the last board the 5-dot cross in
              the header has scrolled a thumb's length out of reach. */}
          <PrimaryButton
            id="compare.close"
            onPress={close}
            label={<Trans>CLOSE</Trans>}
          />
        </View>
      )}
    </ModalCard>
  )
}
