import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { GradientName } from '@/components/gradient-name'
import { GradientText } from '@/components/gradient-text'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { DialMark } from '@/components/overlays/dial-mark'
import { GradientFrame } from '@/components/overlays/gradient-frame'
import { TrackedPressable } from '@/components/tracked-pressable'
import { mono } from '@/constants/theme'
import { GLYPH, READOUT, TYPE } from '@/constants/typography'
import type { SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatRaceTime } from '@/lib/duration'
import { rankMedal } from '@/lib/rank-emoji'
import type { OpenSession } from '@/lib/session-board'
import { darkGradientOf, dialOf, gradientOf, labelOf } from '@/modes'
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
  onArrive,
}: {
  card: NonNullable<SessionCard<OpenSession>>
  onPress: () => void
  // Handed straight to the clock: a teaser that runs out has to become the live card on
  // that tick rather than on the next launch. Passed through rather than acted on here —
  // which card to draw is `cardSession`'s answer, and this is only the news that the
  // answer has changed.
  onArrive?: () => void
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
  // The challenge's pair as **ink**: both stops at a shade that carries a word on the
  // card's white, so the name can be drawn across them a character at a time.
  //
  // Not the raw pair. Its second stop is the arc's bright end and measures about 1.7:1
  // here, so a name lerped onto it would fade out as it was read — legible at the first
  // letter and gone by the last. The first stop needs nothing done to it, being the
  // near-black text is drawn in anyway, and `challengeInk` returns a stop that already
  // clears the bar untouched.
  //
  // The same bargain `NAME_INK` strikes for a nickname, which is the two mode stops taken
  // toward black for exactly this reason.
  const inkFrom = challengeInk(gradientOf(session.modeId)[0])
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
  // What the leader is ahead on: the clock on a race, which is what its places are
  // settled by, and the score everywhere else. Written the way the standings write it,
  // so the card and the table under START never show one run two ways.
  const leaderFigure =
    session.leader === null
      ? null
      : session.measure === 'score'
        ? session.leader.score
        : session.leader.timeMs === null
          ? '—'
          : formatRaceTime(session.leader.timeMs)

  // ─── Not open yet ───────────────────────────────────────────────────────────
  //
  // A line, not a card. The framed box is for a challenge the player can press START on
  // *now*; wearing it a day early gave the loudest thing on the intro to the one thing
  // on it that cannot be played, and the mode pills under it — which can — read as the
  // smaller offer. A sentence says the same thing and asks for none of that room.
  //
  // The name keeps its colour and the clock keeps its flaps, so the two halves a player
  // will recognise tomorrow are the two halves they meet today. Everything else goes:
  // the edge, the legend, the mark, the description.
  //
  // Still pressable, and to the same dialog. There is a board to read and a description
  // to find there even before it opens — only its START is dead.
  if (state === 'teaser') {
    return (
      <TrackedPressable
        id="menu.challenge"
        onPress={onPress}
        // Stacked: the sentence, then the clock on a line of its own. It used to be one
        // wrapping row, but the board is up to eight flaps wide once the window is more
        // than a day out and the line has 270pt to live in — so whether the clock stayed
        // beside the words or dropped under them hung on the name's length and the
        // language, and the card changed shape between challenges. Always under is the
        // one layout that never depends on either.
        className="mx-auto w-full max-w-[270px] items-center gap-1"
      >
        {/* The clock is a `View` of flaps and cannot sit inside a `Text`, so the sentence
          stops short of it rather than wrapping it — which is also why the clock is not a
          placeholder in the message. Czech puts the name first here too, so nothing is
          lost by the split. */}
        <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
          <Trans>
            <GradientText text={t(labelOf(session.modeId))} from={inkFrom} to={ink} />{' '}
            challenge starts in
          </Trans>
        </Text>
        <ChallengeCountdown
          until={session.opensAt}
          gradient={darkGradientOf(session.modeId)}
          flip
          onArrive={onArrive}
        />
      </TrackedPressable>
    )
  }

  return (
    // The pressable is outside the frame rather than inside it, so the edge is part of
    // the button: the whole card is one press target, which is the thing the note above
    // says. Its padding lives on the frame's white box, where the words are.
    // Capped and centred. The panel it stands in is the width of the screen, and the
    // banner read as the widest thing on the intro — wider than the mode switcher under
    // it, which is the row it is really in conversation with. `mx-auto` rather than
    // `self-center` because the cap and the centring are one decision about this box and
    // read better written as one.
    //
    // On the pressable rather than on the frame inside it, so the press target is the
    // card the player can see. A 270pt card inside a full-width button would take a tap
    // from the parchment either side of it.
    <TrackedPressable
      id="menu.challenge"
      onPress={onPress}
      className="mx-auto w-full max-w-[270px]"
    >
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
            // Always the close: a teaser never reaches this layout now — it is the
            // line above, which counts to the open instead.
            until={session.closesAt}
            gradient={darkGradientOf(session.modeId)}
            flip
          />
        }
        // Thinner than it was (`px-3.5 py-3`), and thinner than the mode switcher under
        // it. The row is one name over one line of detail, and the card sits above the
        // pills rather than standing alone — the padding it opened with was a dialog's,
        // on a thing that is a row.
        //
        // The switcher is the thing to be shorter than, and it is taller than it looks:
        // its pills are only about 22pt, but the block carries 8pt above them and a
        // 16pt line of mode description below, which comes to about 58. At `py-1.5` this
        // sits near 50 — plainly the lighter of the two rows without the challenge
        // reading as an afterthought above them.
        inner="px-3 py-1.5"
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
            <GradientText
              text={t(labelOf(session.modeId))}
              from={inkFrom}
              to={ink}
              className={cn(TYPE.cardTitleSm, 'shrink')}
            />
            {session.leader === null ? (
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
                      {leaderFigure}
                    </Text>
                  </Trans>
                </Text>
              </View>
            )}

            {/* Given more time, for the rest of the window.

                No seen-state and no dismissal: the flag is the session's own, so a player
                who opens the app an hour later still learns the window moved, and one who
                has already read it reads it again. That is the trade — the alternative
                needs a per-extension identity and a stored list of what each player has
                seen, which is the apparatus the what's-new popup carries, for news that
                outlives a window rather than news that dies with one.

                `TYPE.value` on `text-dim`, which is the role and the ink the leader line
                above already uses: this is the same kind of line in the same column, and
                a third size here would be the card growing a voice it does not need. It
                fades in rather than appearing, because nothing in this app appears. */}
            {session.extendedAt !== null && (
              <Animated.View entering={FadeIn.duration(260)}>
                <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
                  <Trans>Given more time.</Trans>
                </Text>
              </Animated.View>
            )}
          </View>
        </View>
      </GradientFrame>
    </TrackedPressable>
  )
}
