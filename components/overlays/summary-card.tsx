import { Plural, Trans } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { ChallengeName } from '@/components/overlays/challenge-name'
import { SummaryPlaceRow } from '@/components/overlays/summary-place'
import { mono } from '@/constants/theme'
import { READOUT, TYPE } from '@/constants/typography'
import type { SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { groupDigits } from '@/lib/group-digits'
import type { OpenSession } from '@/lib/session-board'
import { sessionFigure } from '@/lib/session-figure'
import type { SessionSummary } from '@/lib/session-summary'
import { darkGradientOf } from '@/modes'

// What one closed **session** came to, as a page of the launch popup.
//
// The podium first, because that is the question — who took it. The player's own line
// under it only when they are not already on it: a player reading their own name in gold
// does not need to be told again underneath in smaller type, and a page that repeated
// itself for the winner would be saying the same thing twice to the one person who most
// deserves it said once. Where they *are* on it, the place itself carries a YOU.
//
// **No title of its own**, like `WinningsCard` and `RecapCard` beside it: the dialog's
// heading asks the question this page answers — see `popupTitle`. What this page does
// carry is the **challenge's name**, because unlike those two it is about one mode rather
// than about the game as a whole, and the name is the only thing saying *which* contest
// has just ended.
//
// **Never drawn with an empty podium.** A summary nobody is on is filtered out by
// `summaryOwed` before it ever reaches a card, so there is no bare-medal state to design
// around — see the note there.

export function SummaryCard({
  summary,
  invite,
}: {
  summary: SessionSummary
  // The next session the start screen is allowed to speak about, or none. Resolved by the
  // hook through `cardSession`, so this page can never announce a challenge ahead of its
  // own **teaser** — see `summaryInvite`. The card's *face* comes with it, because the
  // clock under the name counts towards a different instant for each.
  invite: SessionCard<OpenSession>
}) {
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
      <View className="items-center">
        <ChallengeName modeId={summary.modeId} className={TYPE.screenTitle} />
        <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1.5 text-dim')}>
          <Trans>THE WINDOW HAS CLOSED</Trans>
        </Text>
        {/* How many it was won against — the figure the standings were settled among, and
            the one thing here that says whether the podium above was a crowd or three
            people. Counted off the board, so it is players with a nickname: the same set
            the podium is drawn from, rather than a larger number nobody could place. */}
        <Text selectable={false} className={cn(TYPE.hint, 'mt-1 text-dim')}>
          <Plural value={summary.players} one="# PLAYER" other="# PLAYERS" />
        </Text>
      </View>

      <View className="mt-5 items-center">
        <SummaryPlaceRow
          place={gold}
          measure={summary.measure}
          size="lead"
          isMine={summary.mine.rank === 1}
          digitFont={digitFont}
        />
        {/* Silver left and bronze right, under the gold they are behind. The row keeps
            its two halves whichever of them exists, so a podium of two does not slide
            its silver into the middle and read as a gold. */}
        {(silver !== undefined || bronze !== undefined) && (
          <View className="mt-5 w-full flex-row items-start justify-center gap-10">
            <View className="w-24 items-center">
              {silver !== undefined && (
                <SummaryPlaceRow
                  place={silver}
                  measure={summary.measure}
                  size="rest"
                  isMine={summary.mine.rank === 2}
                  digitFont={digitFont}
                />
              )}
            </View>
            <View className="w-24 items-center">
              {bronze !== undefined && (
                <SummaryPlaceRow
                  place={bronze}
                  measure={summary.measure}
                  size="rest"
                  isMine={summary.mine.rank === 3}
                  digitFont={digitFont}
                />
              )}
            </View>
          </View>
        )}
      </View>

      {/* Where the player came, for everybody the podium did not already name. The rank
          is only printed where there is one: a player with no nickname is off the
          standings and has no place to be told, but their score is still theirs. The
          count it used to be read against is now above the podium, where it speaks for
          the whole page rather than only for this line. */}
      {!onPodium && (
        <View className="mt-6 items-center">
          <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
            {summary.mine.rank === null ? (
              <Trans>YOUR SCORE</Trans>
            ) : (
              <Trans>YOU CAME {summary.mine.rank}</Trans>
            )}
          </Text>
          {/* A rung below the podium's own lead figure. This is the reader's result, not
              the page's headline — the gold at the top is that — and at the same size the
              two competed for the eye. */}
          <Text
            selectable={false}
            className={cn(READOUT.best, 'mt-1 text-score')}
            style={{ fontFamily: digitFont }}
          >
            {mine}
          </Text>
        </View>
      )}

      {/* What the place paid. Only for the three it pays — off the podium there is
          nothing to add and a line saying nought would be the page rubbing it in.

          The fortune's own colour, which is the one hue a fortune is ever written in, and
          the figure the server says it paid. **Not a mirror of it** — the client worked
          this out for one pass and was already wrong, printing a bonus for sessions that
          closed before the podium began paying. `session_podium_bonus` decides, and this
          prints what it decided, so there is nothing here that can drift from the money. */}
      {summary.mine.bonus > 0 && (
        <View className="mt-5 items-center">
          <Text selectable={false} className={cn(TYPE.hint, 'text-fortune')}>
            <Trans>+{groupDigits(summary.mine.bonus)} TO YOUR FORTUNE</Trans>
          </Text>
        </View>
      )}

      {/* The way on, over two lines: the label, then the name in its own colours. On one
          line the gradient word sat on the end of a dim sentence and the eye read the
          label and stopped. Named where the start screen is already allowed to name it,
          general where it is not — a line promising a challenge that is not booked would
          be the page writing a cheque the planner has not signed. */}
      <View className="mt-7 items-center">
        {invite === null ? (
          <Text selectable={false} className={cn(TYPE.hint, 'text-center text-dim')}>
            <Trans>ANOTHER CHALLENGE IS ON ITS WAY</Trans>
          </Text>
        ) : (
          <>
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              {invite.state === 'teaser' ? <Trans>NEXT UP</Trans> : <Trans>ON NOW</Trans>}
            </Text>
            <ChallengeName
              modeId={invite.session.modeId}
              className={cn(TYPE.cardTitleSm, 'mt-1')}
            />
            {/* The clock under the name, counting towards whichever instant that face is
                about: a teased session towards its open, a live one towards its close.
                The label above says which, so the figure needs no second one of its own —
                NEXT UP is a thing starting, ON NOW is a thing ending.

                The same split-flap board the challenge card and the score strip both
                draw, in this challenge's own dark pair, so a window running down looks
                the same wherever the app shows one. */}
            <View className="mt-2">
              <ChallengeCountdown
                until={
                  invite.state === 'teaser'
                    ? invite.session.opensAt
                    : invite.session.closesAt
                }
                gradient={darkGradientOf(invite.session.modeId)}
                flip
              />
            </View>
          </>
        )}
      </View>
    </View>
  )
}
