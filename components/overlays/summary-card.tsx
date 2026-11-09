import { Ionicons } from '@expo/vector-icons'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { SummaryPlaceRow } from '@/components/overlays/summary-place'
import { PrimaryButton } from '@/components/primary-button'
import { mono } from '@/constants/theme'
import { READOUT, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { groupDigits } from '@/lib/group-digits'
import { sessionFigure } from '@/lib/session-figure'
import type { SessionSummary } from '@/lib/session-summary'
import { labelOf } from '@/modes'

// What one closed **session** came to, as the first step of the rating dialog.
//
// The podium first, because that is the question — who took it. The player's own line
// under it only when they are not already on it: a player reading their own name on a
// medal does not need to be told again underneath, and a page that repeated itself for the
// winner would be saying the same thing twice to the one person who most deserves it said
// once. Where they *are* on it, the place itself carries a pill behind the name.
//
// **No title of its own**: the dialog's heading asks the question this page answers. What
// this page does carry is the **challenge's name**, because it is about one mode and the
// name is the only thing saying *which* contest has just ended.
//
// Drawn on the challenge's own gradient, which the dialog paints, so everything here is
// white — the name too, which is a gradient everywhere else and would be a gradient on a
// gradient here.
//
// **No invitation to the next session.** The page used to end on NEXT UP and a clock. The
// dialog's last step is the vote on what comes next, which says it better and asks.
//
// **Never drawn with an empty podium.** A summary nobody is on is filtered out by
// `summaryOwed` before it ever reaches a card, so there is no bare-medal state to design
// around — see the note there.
export function SummaryCard({
  summary,
  onNext,
}: {
  summary: SessionSummary
  // The button: on to the rating. CLAIM where the place paid, though the bonus is already
  // the player's — the server paid it when the window shut, and pressing only turns the
  // page, exactly as the winnings page's button does once its reward is settled.
  onNext: () => void
}) {
  const { t } = useLingui()
  // The seven-segment face, or the mono voice until it has loaded. Resolved once here and
  // handed down, so every figure on the page turns over in the same commit — a podium
  // where one number changed face a frame before the others would read as a glitch.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const digitFont = dsegLoaded ? 'DSEG7' : mono

  const gold = summary.places.find((place) => place.rank === 1)
  const silver = summary.places.find((place) => place.rank === 2)
  const bronze = summary.places.find((place) => place.rank === 3)
  // On the podium already, so the line below would be a second telling.
  const onPodium = summary.mine.rank !== null && summary.mine.rank <= 3
  const mine = sessionFigure(summary.measure, summary.mine)

  // Unreachable: `summaryOwed` drops a summary with no places. Guarded rather than
  // asserted, because a page is not worth a crash.
  if (gold === undefined) return null

  return (
    <View>
      {/* Set well down from the dialog's heading, which sits close above this. */}
      <View className="items-center pt-5">
        <Text
          selectable={false}
          className={cn(TYPE.screenTitle, 'text-center text-white')}
        >
          {t(labelOf(summary.modeId))}
        </Text>
        <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1.5 text-white')}>
          <Trans>THE WINDOW HAS CLOSED</Trans>
        </Text>
        {/* How many it was won against — the figure the standings were settled among, and
            the one thing here that says whether the podium below was a crowd or three
            people. Counted off the board, so it is players with a nickname: the same set
            the podium is drawn from, rather than a larger number nobody could place. */}
        <Text selectable={false} className={cn(TYPE.hint, 'mt-1 text-white')}>
          <Plural value={summary.players} one="# PLAYER" other="# PLAYERS" />
        </Text>
      </View>

      <View className="mt-4 items-center">
        {/* Gold a little to the right of the middle, so the silver on its left has the
            room to stand higher without the two reading as one column. */}
        <View className="w-full" style={{ transform: [{ translateX: 14 }] }}>
          <SummaryPlaceRow
            place={gold}
            measure={summary.measure}
            size="lead"
            digitFont={digitFont}
          />
        </View>
        {/* The two are staggered by more than a name's height, so that a long nickname,
            wider than its half of the row, passes the other's instead of meeting it.

            Silver left and bronze right, under the gold they are behind, and silver a
            step higher than bronze — second is nearer first. The row keeps its two halves
            whichever of them exists, so a podium of two does not slide its silver into the
            middle and read as a gold. */}
        {(silver !== undefined || bronze !== undefined) && (
          <View className="w-full flex-row items-start justify-center gap-1">
            <View className="-mt-3 flex-1 items-center">
              {silver !== undefined && (
                <SummaryPlaceRow
                  place={silver}
                  measure={summary.measure}
                  size="second"
                  digitFont={digitFont}
                />
              )}
            </View>
            <View className="mt-11 flex-1 items-center">
              {bronze !== undefined && (
                <SummaryPlaceRow
                  place={bronze}
                  measure={summary.measure}
                  size="third"
                  digitFont={digitFont}
                />
              )}
            </View>
          </View>
        )}
      </View>

      {/* Where the player came, for everybody the podium did not already name. The rank
          is only printed where there is one: a player with no nickname is off the
          standings and has no place to be told, but their score is still theirs. */}
      {!onPodium && (
        <View className="mt-4 items-center">
          <Text selectable={false} className={cn(TYPE.labelSm, 'text-white')}>
            {summary.mine.rank === null ? (
              <Trans>YOUR SCORE</Trans>
            ) : (
              <Trans>YOU CAME {summary.mine.rank}</Trans>
            )}
          </Text>
          {/* A rung below the podium's own lead figure. This is the reader's result, not
              the page's headline — the gold above is that. */}
          <Text
            selectable={false}
            className={cn(READOUT.best, 'mt-1 text-white')}
            style={{ fontFamily: digitFont }}
          >
            {mine}
          </Text>
        </View>
      )}

      {/* What the place paid, set the way the winnings page sets what it paid: the figure
          at headline size over a caption saying what it is. Only for the three places that
          pay — off the podium there is nothing to add and a line saying nought would be the
          page rubbing it in.

          White rather than `text-fortune`, which is a dark red that carries on a card and
          sinks into a challenge's near-black gradient. And **not a mirror of the server**:
          `session_podium_bonus` decides what was paid, and this prints what it decided. */}
      {summary.mine.bonus > 0 && (
        <View className="mt-5 items-center">
          <Text selectable={false} className={cn(TYPE.figureLarge, 'text-white')}>
            {groupDigits(summary.mine.bonus)}
          </Text>
          <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1.5 text-white')}>
            <Trans>ADDED TO YOUR FORTUNE</Trans>
          </Text>
        </View>
      )}

      <View className="mt-5">
        <PrimaryButton
          id="summary.next"
          onPress={onNext}
          label={summary.mine.bonus > 0 ? <Trans>CLAIM</Trans> : <Trans>NEXT</Trans>}
          icon={
            <Ionicons
              name={summary.mine.bonus > 0 ? 'checkmark' : 'arrow-forward'}
              size={14}
              color="#d8d2f4"
            />
          }
        />
      </View>
    </View>
  )
}
