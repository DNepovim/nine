import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { ModalCard } from '@/components/overlays/modal-card'
import { TabPanel } from '@/components/overlays/tab-panel'
import { PrimaryButton } from '@/components/primary-button'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { useSessionBoard } from '@/hooks/use-session-card'
import { useViewport } from '@/hooks/use-viewport'
import type { SessionCard } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import type { OpenSession } from '@/lib/session-board'
import { descriptionOf, gradientOf, headlineOf, labelOf, runRules } from '@/modes'

// What a session board says when nobody has posted to it.
//
// Its own line rather than one of the thirty-six in `lib/empty-board.ts`: those are
// written per board × period, and a session has neither. They also all mourn a span
// that has passed — "A WEEK, NOT ONE CLEAN RUN" — and a live session's empty board is
// the opposite of that. It is an invitation.
const NOBODY_YET = msg`— NOBODY HAS SCORED HERE —`

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
  const accent = gradientOf(session.modeId)[0]
  // The rung the challenge pinned. A challenge may pin one, and the standings' own
  // colour scale is read off the board it belongs to — see `TabPanel`.
  const difficulty = runRules(session.modeId, 'hard').difficulty

  return (
    <ModalCard
      title={t(labelOf(session.modeId))}
      titleColor={accent}
      onDismiss={onDismiss}
    >
      {(close) => (
        <>
          <Text selectable={false} className={cn(TYPE.prose, 'mb-1 text-primary')}>
            {t(descriptionOf(session.modeId))}
          </Text>
          <Text selectable={false} className={cn(TYPE.labelSm, 'mb-4 text-dim')}>
            <Trans>ONE WINDOW, ONE SET OF STANDINGS</Trans>
          </Text>

          {/* The standings, drawn by the same panel every board in the app is drawn by —
          one period, no tabs, and its own line for an empty one. `tab` is still handed
          over because the panel's signature wants one; `emptyLine` is what makes it
          moot. */}
          {board !== null && (
            <TabPanel
              data={board}
              tab="forever"
              emptyLine={NOBODY_YET}
              headline={headlineOf(session.modeId)}
              difficulty={difficulty}
              accentColor={accent}
              userId={userId}
              nickname={nickname}
              width={Math.min(width - 96, 280)}
              digitFont={dsegLoaded ? 'DSEG7' : mono}
            />
          )}

          <View className="mt-5 items-center gap-2">
            {state === 'live' ? (
              <PrimaryButton
                id="challenge.start"
                onPress={() => {
                  // Through the card's own `close`, so the dialog plays its exit rather
                  // than being unmounted out from under it by the run arriving.
                  close()
                  onStart(session.modeId, session.id)
                }}
                style={{ width: 200 }}
                label={<Trans>START</Trans>}
              />
            ) : (
              // A teaser has nothing to start. The button stays, wearing the countdown, so
              // the dialog ends on when rather than on nothing — and so the shape of the
              // card does not change the moment it opens.
              <View
                className="w-[200px] items-center rounded-2xl bg-card py-4 opacity-60"
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
          </View>
        </>
      )}
    </ModalCard>
  )
}
