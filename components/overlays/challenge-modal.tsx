import { Ionicons } from '@expo/vector-icons'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { GameOverTitle } from '@/components/overlays/game-over-title'
import { LegendBox } from '@/components/overlays/legend-box'
import { ModalCard } from '@/components/overlays/modal-card'
import { ScoreColumns } from '@/components/overlays/score-columns'
import { TabPanel } from '@/components/overlays/tab-panel'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK, ON_STRONG_INK } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { useSessionBoard } from '@/hooks/use-session-card'
import { useViewport } from '@/hooks/use-viewport'
import { spanStatus, type SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { labelRows } from '@/lib/label-rows'
import type { OpenSession } from '@/lib/session-board'
import { strikeRuleOf } from '@/lib/strike-rule'
import {
  darkGradientOf,
  descriptionOf,
  gradientOf,
  headlineOf,
  labelOf,
  measureOf,
  runRules,
} from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// What a session board says when nobody has posted to it.
//
// Its own line rather than one of the thirty-six in `lib/empty-board.ts`: those are
// written per board × period, and a session has neither. They also all mourn a span
// that has passed — "A WEEK, NOT ONE CLEAN RUN" — and a live session's empty board is
// the opposite of that. It is an invitation.
const NOBODY_YET = msg`— NOBODY HAS SCORED HERE —`

// A challenge's name is drawn a word per row — see `labelRows`.
//
// The letters are a pinned 56px — the glass pane's whole geometry is measured down from
// it — so a name is not something that can simply be set smaller to fit. FOUR KEYS on one
// row ran off both edges of the dialog, and its space came out as an empty cell between
// them. A word per row is the answer that keeps every letter full size, and it is how the
// game-over title has always worked: two words, two rows. A word too long for one row
// says where it breaks with a soft hyphen of its own.

// The challenge, in full: what it is, what it asks, where everyone stands, and the way
// in. The card on the intro is the teaser; this is the thing it was teasing.
//
// A `ModalCard` rather than a screen. The player pressed a row on the start screen and
// is deciding whether to play — a dialog over the screen they came from keeps that
// decision reversible in a way a screen replacing it does not.
// What the dialog is opened on. The intro's card is one session, live or teased. The dev
// screen asked for the third: any challenge, with whichever of its sessions that screen
// names beside it, or none — ACCEPT always plays, and plays outside every session, so a
// lab run never posts to standings a player is competing on.
export type ChallengeModalCard =
  | NonNullable<SessionCard<OpenSession>>
  | { state: 'lab'; modeId: string; session: OpenSession | null }

export function ChallengeModal({
  card,
  userId,
  nickname,
  onStart,
  onDismiss,
}: {
  card: ChallengeModalCard
  userId: string | null
  nickname: string | null
  // Deals the run. Called from a live session with its id, from the lab with none — a
  // teaser's button is dead.
  onStart: (modeId: string, sessionId: string | null) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const { state, session } = card
  const modeId = card.state === 'lab' ? card.modeId : card.session.modeId
  const measure = session?.measure ?? measureOf(modeId)
  // Whether the window is running now — for the lab, read off the session it was handed.
  const live =
    state === 'live' || (session !== null && spanStatus(session, Date.now()) === 'live')
  const { width } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  // Whether the window has yet to open — a teaser, or a lab row whose session is still
  // planned. Such a session has no standings and cannot have any, so the dialog neither
  // reads them nor draws an empty table promising that nobody has scored yet.
  const upcoming =
    state === 'teaser' ||
    (session !== null && spanStatus(session, Date.now()) === 'upcoming')
  const { board } = useSessionBoard(upcoming ? null : (session?.id ?? null), userId)
  // The challenge's own pair: its hue on the card's border, and the readable shade of
  // that hue wherever a word is drawn in it. Same split the banner makes — see
  // `challengeInk`.
  const edge = gradientOf(modeId)
  const accent = challengeInk(edge[1])
  // The rules a run of this challenge is played under. A challenge may pin its own rung,
  // so the difficulty handed in is the one the intro holds and `runRules` ignores it
  // wherever the challenge said otherwise.
  const rules = runRules(modeId, 'hard')
  // The rung the challenge pinned. The standings' own colour scale is read off the board
  // they belong to — see `TabPanel`.
  const difficulty = rules.difficulty
  // What builds the multiplier here, which is the one rule a player cannot read off the
  // dial. Null for a challenge whose streak is `none`, and then the row is simply absent.
  const strike = strikeRuleOf(rules.scoring.streak)
  // Named once and handed to both the header and the panel, because the two have to be
  // the same number: a header the width of the card over rows held to 280 is a header
  // whose columns line up with nothing under them.
  const boardWidth = Math.min(width - 96, 280)

  return (
    <ModalCard
      // Just what kind of thing this is. The challenge's own name is the wordmark below,
      // in its own colours and its own letters — printing it up here as well was the same
      // word twice, once quietly.
      title={<Trans>CHALLENGE</Trans>}
      edge={edge}
      // The dialog ends in its own pair of actions below, so the card's stock CLOSE would
      // be a third button under them. The quiet one at the foot is this dialog's own.
      closeButton={false}
      onDismiss={onDismiss}
    >
      {(close) => (
        <>
          {/* The name, drawn the way NINE is on the intro: letters that float and cycle
            their colour, here through this challenge's pair rather than a mode's. It is
            the loudest thing in the dialog, which is right — it is the one thing the
            player opened it to see. */}
          <View className="mb-3 w-full items-center">
            <GameOverTitle gameMode={modeId} words={labelRows(t(labelOf(modeId)))} />
          </View>

          {/* Held to the board's own width, so it breaks on the same column the standings
            under it stand in rather than on the card's full span.

            `self-center` as well as `text-center`, and the two are different things: the
            second centres the words inside the box, the first centres the box inside the
            card. The card's content is a column that stretches its children, and a child
            with a width of its own opts out of that and falls to the start — so without
            this the text was centred inside a box sitting against the left edge. */}
          <Text
            selectable={false}
            className={cn(TYPE.prose, 'mb-4 self-center text-center text-primary')}
            style={{ width: boardWidth }}
          >
            {t(descriptionOf(modeId))}
          </Text>

          {/* How much of the window is left, under the line that says what the challenge
            is. The one figure a player needs before pressing ACCEPT and the one the dialog
            did not carry: the card they came from has it, and the strip has it once the
            run is going, so the only moment it went missing was the moment of deciding.

            **Live only.** A session not yet open gets its own, larger clock below —
            counting to the start rather than the end — in place of the strike rule.

            The flaps rather than the plain figure, as the card and the strip both draw
            it: a window running down is the one thing in this app that is literally a
            clock. */}
          {live && session !== null && (
            <View className="mb-4 items-center gap-1.5">
              <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
                <Trans>CLOSES IN</Trans>
              </Text>
              <ChallengeCountdown
                until={session.closesAt}
                gradient={darkGradientOf(modeId)}
                flip
              />
            </View>
          )}

          {/* How a strike is built here, under the line that says what the challenge is.

            Printed in the dialog because How to Play cannot print it: the guide has a
            card per permanent mode spelling out that mode's streak rule, and the
            challenges chapter is deliberately vague about rules for the reason the
            comment there gives — a challenge may change any of them. So this is the one
            place the rule of *this* challenge is written down, and the player reads it
            before pressing ACCEPT rather than working it out from a multiplier that came
            and went.

            The same box Trainee's tips stand in — `LegendBox`, named on its own rule —
            because it is the same kind of thing: one short paragraph that has to read as
            an aside beside what the screen is actually about. Its edge is the challenge's
            own ink where the tips card's is Trainee's blue.

            Held to the same width as the description above it and the standings below,
            and `self-center` for the same reason — see the note on the description. */}
          {/* A session that has not opened yet: the wait, large, where the strike rule
            would stand. Until the window opens there is nothing to press and nothing to
            play, so how a strike is built can wait too — the one thing worth telling a
            player here is when. It also stands in for the button the dialog would end on,
            which is why the foot below has no OPENS IN of its own. */}
          {upcoming && session !== null && (
            <View className="mb-4 items-center gap-2">
              <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
                <Trans>OPENS IN</Trans>
              </Text>
              <ChallengeCountdown
                until={session.opensAt}
                gradient={darkGradientOf(modeId)}
                flip
                large
              />
            </View>
          )}

          {!upcoming && strike !== null && (
            <View className="mb-4 self-center" style={{ width: boardWidth }}>
              <LegendBox
                legend={<Trans>STRIKE</Trans>}
                color={accent}
                className="px-4 pb-4 pt-4"
              >
                <Text
                  selectable={false}
                  className={cn(TYPE.prose, 'text-center text-dim')}
                >
                  {t(strike)}
                </Text>
              </LegendBox>
            </View>
          )}
          {/* The standings, drawn by the same panel every board in the app is drawn by —
          one period, no tabs, and its own line for an empty one. `tab` is still handed
          over because the panel's signature wants one; `emptyLine` is what makes it
          moot. */}
          {board !== null && (
            // `items-center` for the reason the description carries `self-center`: both
            // children below are held to `boardWidth`, which takes them out of the
            // column's stretch and drops them against the left edge of the card.
            <View className="w-full items-center">
              {/* The same three column names every other board in the app carries. The
                session board was drawn by `TabPanel` directly and so arrived without
                them — on the one screen where the table is unfamiliar. */}
              <ScoreColumns width={boardWidth} measure={measure} />
              <TabPanel
                data={board}
                tab="forever"
                emptyLine={NOBODY_YET}
                headline={headlineOf(modeId)}
                difficulty={difficulty}
                accentColor={accent}
                // The server's own answer, stamped on the session when it was booked —
                // not `measureOf(modeId)` resolved a second time here. A session is
                // measured by what it was booked as, which is what its standings have
                // meant since the first run posted to them.
                measure={measure}
                userId={userId}
                nickname={nickname}
                width={boardWidth}
                digitFont={dsegLoaded ? 'DSEG7' : mono}
              />
            </View>
          )}

          {/* The way in, and the way out. Full width, stacked: there is one thing to do
            here and one way to decline it, and a 200pt button in the middle of a 460pt
            card read as a third option beside the whitespace either side of it.

            Only ACCEPT is a CTA. CLOSE is the quiet way out under it — the app's own
            pattern for a dialog that offers an action and a refusal, rather than two
            buttons of equal weight asking the player to choose which they meant. */}
          <View className="mt-5 w-full gap-1">
            {card.state !== 'teaser' && (
              <PrimaryButton
                id="challenge.start"
                onPress={() => {
                  // Through the card's own `close`, so the dialog plays its exit rather
                  // than being unmounted out from under it by the run arriving.
                  close()
                  onStart(modeId, card.state === 'lab' ? null : card.session.id)
                }}
                label={<Trans>ACCEPT</Trans>}
                icon={<Ionicons name="rocket-outline" size={14} color={ON_STRONG_INK} />}
              />
            )}

            {/* The quiet way out, in the voice this app's links speak in: an icon, a
              10pt label, no underline. The pattern is `email-code-modal`'s RESEND and the
              intro's own footer — see the link rule in the design-guide skill. */}
            <TrackedPressable
              id="shared.dialog_close"
              onPress={close}
              className="w-full flex-row items-center justify-center gap-1 py-3"
            >
              <Ionicons name="close-outline" size={10} color={DIM_INK} />
              <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                <Trans>CLOSE</Trans>
              </Text>
            </TrackedPressable>
          </View>
        </>
      )}
    </ModalCard>
  )
}
