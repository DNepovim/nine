import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { GradientName } from '@/components/gradient-name'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { DialMark } from '@/components/overlays/dial-mark'
import { GradientFrame } from '@/components/overlays/gradient-frame'
import { TrackedPressable } from '@/components/tracked-pressable'
import { mono } from '@/constants/theme'
import { GLYPH, READOUT, TYPE } from '@/constants/typography'
import type { SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { rankMedal } from '@/lib/rank-emoji'
import type { OpenSession } from '@/lib/session-board'
import { darkGradientOf, descriptionOf, dialOf, gradientOf, labelOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// A challenge that is on, or about to be — the first row of the ALONE panel, above the
// mode pills.
//
// Above them because it is the thing that goes away and the three below it are not.
// Inside the paging panel because a challenge is played alone, so it should slide off
// with everything else when the player asks about playing with friends.
//
// Two lines, two states, one press target. The whole card is the button: a chevron on a
// card this size reads as an affordance rather than as a second thing to hit, and a
// separate button beside the text would have given the row two.
//
// **Live** — the challenge's name and the time left, then who leads and with what.
// **Teaser** — the name and the time until it opens, then its one-line description,
// because there is no leader yet and saying so would waste the line that is meant to
// make somebody want to come back.

export function ChallengeCard({
  card,
  onPress,
}: {
  card: NonNullable<SessionCard<OpenSession>>
  onPress: () => void
}) {
  const { t } = useLingui()
  const { state, session } = card
  // The first stop of the challenge's pair, which for a challenge is the app's own
  // near-black — see `modes/challenges/palette.ts`. So this is an *ink* rather than an
  // accent now: the name and the mark are drawn in the colour text is drawn in, and the
  // challenge's own hue does its work on the edge around them instead.
  //
  // That is the right way round for this card. A title in a mid-tone hue on the white box
  // was the one thing here that had to fight for contrast; the hue on the edge has the
  // whole rule to be seen on and nothing to be legible against.
  // The challenge's own hue, at the shade that carries a word on the card's white. Taken
  // from the pair's second stop rather than from the challenge's index, so a challenge
  // that named its own colours gets an ink matching them — see `challengeInk`.
  const ink = challengeInk(gradientOf(session.modeId)[1])
  // The dial this challenge is played on, drawn as its mark. Null for a session naming a
  // mode this build does not have — which `useSessionCard` already filters out before a
  // card is made, so the fallback is for the type rather than for a case that happens.
  const dial = dialOf(session.modeId)
  // The height of the words, so the mark can stand the same. Measured rather than
  // computed from the two roles' line heights: those are the type scale's business, and a
  // sum of them here would be a third place that has to be edited when either moves.
  const [textHeight, setTextHeight] = useState(0)
  // The seven-segment face the app's figures are set in. Falls back to the mono voice
  // until it has loaded, which is the same bargain every other readout makes — a figure
  // in the wrong face for a frame beats a row that is not there.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })

  return (
    // The pressable is outside the frame rather than inside it, so the edge is part of
    // the button: the whole card is one press target, which is the thing the note above
    // says. Its padding lives on the frame's white box, where the words are.
    <TrackedPressable id="menu.challenge" onPress={onPress} className="w-full">
      {/* Singular: the box holds one challenge, which is the whole of what the card is
        — the plural named a section of a list it is not in.

        The window rides the rule beside it rather than standing inside the card. A board
        of flaps counting down is read as a clock without being told it is one, and up
        here it is read before the card rather than in competition with it: what the box
        is on the left of the rule, how long it is there for on the right, and the
        challenge itself in the white underneath.

        Two figures — 7:38 while there are hours, 49:42 once there are not — and a colon
        between them, because this is a clock face rather than a measured length; see
        `lib/duration.ts`. The flaps are painted in this challenge's own CTA pair, so the
        card wears one hue while its digits sit on the one scale in the app darkened to
        carry them. */}
      <GradientFrame
        legend={<Trans>CHALLENGE</Trans>}
        badge={
          <ChallengeCountdown
            until={state === 'live' ? session.closesAt : session.opensAt}
            gradient={darkGradientOf(session.modeId)}
            flip
          />
        }
        // Thinner than it was (`px-3.5 py-3`). The row is one name over one line of
        // detail, and the card sits above the mode pills rather than standing alone — the
        // padding it opened with was a dialog's, on a thing that is a row.
        inner="px-3 py-2"
        // The challenge's own pair, turning. The default spectrum band is the app
        // speaking; a challenge has something of its own to say now — see the note on
        // `edge` in GradientFrame for why a two-stop edge turns rather than slides.
        edge={gradientOf(session.modeId)}
      >
        <View className="flex-row items-center gap-2.5">
          {/* The mark: this challenge's own dial, drawn as dots, as tall as the words
            beside it. It replaced a bolt every challenge shared, which marked the
            *category* on a card whose own edge already says CHALLENGE — so it said the one
            thing the card did not need twice, and said nothing about which challenge this
            is. Four keys is four dots.

            Held back until the words have been measured. One frame with no mark is not
            worth animating around: the card is itself arriving, and the row it lands in
            reserves no space for it either way. */}
          {dial !== null && textHeight > 0 && (
            <DialMark dial={dial} color={ink} size={textHeight} />
          )}

          {/* The words: what the challenge is called, and the one line about it. All the
            width the mark leaves, now that the clock has gone up into the rule — the one
            thing above them is the countdown's chip at the right, which hangs a couple of
            points into this row's first line and is why a long name would meet it there
            before it met the card's own edge. */}
          <View
            className="shrink grow gap-0.5"
            onLayout={(e) => {
              setTextHeight(Math.round(e.nativeEvent.layout.height))
            }}
          >
            <Text
              selectable={false}
              className={cn(TYPE.cardTitleSm, 'shrink')}
              style={{ color: ink }}
            >
              {t(labelOf(session.modeId))}
            </Text>
            {state === 'teaser' ? (
              <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
                {t(descriptionOf(session.modeId))}
              </Text>
            ) : session.leader === null ? (
              <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
                <Trans>Nobody has played it yet.</Trans>
              </Text>
            ) : (
              // Who is ahead, with the medal that says what being ahead *is*. The same
              // glyph `BoardMedals` puts under a run's score and the leaderboard puts
              // beside rank one, so first place looks like first place wherever it is
              // read — rather than this card inventing a third way of saying it.
              //
              // A row rather than the medal inside the sentence: the glyph has to sit on
              // the line's own baseline, and an emoji inside a `Trans` is a character the
              // translation has to carry and could lose.
              <View className="flex-row items-center gap-1">
                <Text selectable={false} className={cn(GLYPH.sm, 'leading-[14px]')}>
                  {rankMedal(1)}
                </Text>
                <Text
                  selectable={false}
                  className={cn(TYPE.value, 'shrink', 'text-dim')}
                  numberOfLines={1}
                >
                  <Trans>
                    <GradientName
                      nickname={session.leader.nickname}
                      avgAccuracy={session.leader.avgAccuracy}
                      avgSpeed={session.leader.avgSpeed}
                    />{' '}
                    leads with{' '}
                    <Text
                      selectable={false}
                      className={cn(READOUT.row, 'text-score')}
                      style={{ fontFamily: dsegLoaded ? 'DSEG7' : mono }}
                    >
                      {session.leader.score}
                    </Text>
                  </Trans>
                </Text>
              </View>
            )}
          </View>
        </View>
      </GradientFrame>
    </TrackedPressable>
  )
}
