import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { GradientFrame } from '@/components/overlays/gradient-frame'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import type { SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { groupDigits } from '@/lib/group-digits'
import type { OpenSession } from '@/lib/session-board'
import { darkGradientOf, descriptionOf, gradientOf, labelOf } from '@/modes'

// How big the bolt is drawn. Sized against the name beside it rather than against the
// row: the two are one label, and an icon shorter than its own title reads as a bullet
// point in front of it.
const ICON = 20

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
  // The challenge's own colour, so the card reads as belonging to the thing it names
  // rather than as a notice the app is showing. Its first stop only — the card is a
  // quiet row, not a CTA, and a gradient here would outshout PLAY GAME below it.
  const accent = gradientOf(session.modeId)[0]

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
        inner="px-3.5 py-3"
      >
        <View className="flex-row items-center gap-3">
          {/* The mark that says what kind of thing this is, in the challenge's own
            colour — the same ink as its name beside it, so the two read as one label
            rather than as an icon and a title.

            A bolt and not a clock: the rule above already carries one, and the icon's job
            is the other half of what a challenge is — one mode, on for a day, not the
            three that are always there. Nothing else in the app wears this glyph. */}
          <Ionicons name="flash-outline" size={ICON} color={accent} />

          {/* The words: what the challenge is called, and the one line about it. All the
            width the bolt leaves, now that the clock has gone up into the rule — the one
            thing above them is the countdown's chip at the right, which hangs a couple of
            points into this row's first line and is why a long name would meet it there
            before it met the card's own edge. */}
          <View className="shrink grow gap-1">
            <Text
              selectable={false}
              className={cn(TYPE.cardTitle, 'shrink')}
              style={{ color: accent }}
            >
              {t(labelOf(session.modeId))}
            </Text>
            <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
              {state === 'teaser' ? (
                t(descriptionOf(session.modeId))
              ) : session.leader === null ? (
                <Trans>Nobody has played it yet.</Trans>
              ) : (
                <Trans>
                  {session.leader.nickname} leads · {groupDigits(session.leader.score)}
                </Trans>
              )}
            </Text>
          </View>
        </View>
      </GradientFrame>
    </TrackedPressable>
  )
}
