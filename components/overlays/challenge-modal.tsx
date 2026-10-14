import { Ionicons } from '@expo/vector-icons'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { GameOverTitle } from '@/components/overlays/game-over-title'
import { ModalCard } from '@/components/overlays/modal-card'
import { ScoreColumns } from '@/components/overlays/score-columns'
import { TabPanel } from '@/components/overlays/tab-panel'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { useSessionBoard } from '@/hooks/use-session-card'
import { useViewport } from '@/hooks/use-viewport'
import type { SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import type { OpenSession } from '@/lib/session-board'
import { descriptionOf, gradientOf, headlineOf, labelOf, runRules } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// What a session board says when nobody has posted to it.
//
// Its own line rather than one of the thirty-six in `lib/empty-board.ts`: those are
// written per board × period, and a session has neither. They also all mourn a span
// that has passed — "A WEEK, NOT ONE CLEAN RUN" — and a live session's empty board is
// the opposite of that. It is an invitation.
const NOBODY_YET = msg`— NOBODY HAS SCORED HERE —`

// A challenge's name as the rows the wordmark draws it in: one word per row.
//
// The letters are a pinned 56px — the glass pane's whole geometry is measured down from
// it — so a name is not something that can simply be set smaller to fit. FOUR KEYS on one
// row ran off both edges of the dialog, and its space came out as an empty cell between
// them. A word per row is the answer that keeps every letter full size, and it is how the
// game-over title has always worked: two words, two rows.
//
// Collapses runs of whitespace and drops the empties, so a name typed with two spaces
// does not produce a blank row.
const nameRows = (label: string): string[] =>
  label.split(/\s+/).filter((word) => word.length > 0)

// The challenge, in full: what it is, what it asks, where everyone stands, and the way
// in. The card on the intro is the teaser; this is the thing it was teasing.
//
// A `ModalCard` rather than a screen. The player pressed a row on the start screen and
// is deciding whether to play — a dialog over the screen they came from keeps that
// decision reversible in a way a screen replacing it does not.
export function ChallengeModal({
  card,
  userId,
  nickname,
  onStart,
  onDismiss,
}: {
  card: NonNullable<SessionCard<OpenSession>>
  userId: string | null
  nickname: string | null
  // Deals the run. Only ever called from a live session — a teaser's button is dead.
  onStart: (modeId: string, sessionId: string) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const { state, session } = card
  const { width } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const { board } = useSessionBoard(session.id, userId)
  // The challenge's own pair: its hue on the card's border, and the readable shade of
  // that hue wherever a word is drawn in it. Same split the banner makes — see
  // `challengeInk`.
  const edge = gradientOf(session.modeId)
  const accent = challengeInk(edge[1])
  // The rung the challenge pinned. A challenge may pin one, and the standings' own
  // colour scale is read off the board it belongs to — see `TabPanel`.
  const difficulty = runRules(session.modeId, 'hard').difficulty
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
            <GameOverTitle
              gameMode={session.modeId}
              words={nameRows(t(labelOf(session.modeId)))}
            />
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
            {t(descriptionOf(session.modeId))}
          </Text>
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
              <ScoreColumns width={boardWidth} />
              <TabPanel
                data={board}
                tab="forever"
                emptyLine={NOBODY_YET}
                headline={headlineOf(session.modeId)}
                difficulty={difficulty}
                accentColor={accent}
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

            Only START is a CTA. CLOSE is the quiet way out under it — the app's own
            pattern for a dialog that offers an action and a refusal, rather than two
            buttons of equal weight asking the player to choose which they meant. */}
          <View className="mt-5 w-full gap-1">
            {state === 'live' ? (
              <PrimaryButton
                id="challenge.start"
                onPress={() => {
                  // Through the card's own `close`, so the dialog plays its exit rather
                  // than being unmounted out from under it by the run arriving.
                  close()
                  onStart(session.modeId, session.id)
                }}
                label={<Trans>START</Trans>}
              />
            ) : (
              // A teaser has nothing to start. The row stays, wearing the countdown, so
              // the dialog ends on when rather than on nothing — and so the shape of the
              // card does not change the moment it opens.
              <View
                className="w-full items-center rounded-2xl bg-card py-4 opacity-60"
                pointerEvents="none"
              >
                <View className="flex-row items-center gap-1.5">
                  <Text selectable={false} className={cn(TYPE.button, 'text-dim')}>
                    <Trans>OPENS IN</Trans>
                  </Text>
                  <ChallengeCountdown until={session.opensAt} className="text-dim" />
                </View>
              </View>
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
