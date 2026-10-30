import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { DialMark } from '@/components/overlays/dial-mark'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { listChallengeRatings, type ChallengeRating } from '@/lib/admin/ratings'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { spanStatus, type SpanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import type { OpenSession } from '@/lib/session-board'
import { dialOf, gradientOf, measureOf } from '@/modes'
import { CHALLENGES } from '@/modes/challenges/catalog'
import { challengeInk } from '@/modes/challenges/palette'

// The session a row speaks for, in order of what matters most: one on now, then the
// next one booked, then the last one there was. The line under the name and the dialog
// the play button opens both read this, so the two always mean the same session.
function shownSession(
  sessions: readonly AdminSession[],
  now: number,
): AdminSession | null {
  const of = (status: SpanStatus) =>
    sessions.filter((session) => spanStatus(session, now) === status)
  const live = of('live')[0]
  if (live !== undefined) return live
  const next = of('upcoming').sort((a, b) => a.opensAt - b.opensAt)[0]
  if (next !== undefined) return next
  return of('expired').sort((a, b) => b.closesAt - a.closesAt)[0] ?? null
}

function SessionLine({ session, now }: { session: AdminSession | null; now: number }) {
  if (session === null) return <Trans>NO SESSION YET</Trans>
  const status = spanStatus(session, now)
  if (status === 'live') {
    const until = formatDayTime(session.closesAt)
    return <Trans>SESSION IS LIVE UNTIL {until}</Trans>
  }
  if (status === 'upcoming') {
    const opens = formatDayTime(session.opensAt)
    return <Trans>SESSION IS PLANNED FOR {opens}</Trans>
  }
  const closed = formatDayTime(session.closesAt)
  return <Trans>LAST SESSION WAS {closed}</Trans>
}

// What players made of the challenge, over every session of it — the figure an admin
// reads when deciding whether it comes back. Nothing at all for a challenge nobody has
// rated, and nothing for a tester, whose read of it is refused: a line saying "no
// ratings" would be wrong for the second and noise for the first.
function RatingLine({ rating }: { rating: ChallengeRating }) {
  const average = rating.average.toFixed(1)
  return (
    <>
      <Trans>RATED {average}</Trans>
      {' · '}
      <Plural value={rating.ratings} one="# RATING" other="# RATINGS" />
    </>
  )
}

// The planner's row in the shape the challenge dialog reads. What the planner does not
// carry is filled with what a dialog cannot tell apart: no leader (the dialog reads the
// standings themselves), and the measure the challenge's rules give.
const asOpenSession = (session: AdminSession): OpenSession => ({
  id: session.id,
  modeId: session.modeId,
  opensAt: session.opensAt,
  closesAt: session.closesAt,
  extendedAt: session.extendedAt,
  leader: null,
  measure: measureOf(session.modeId),
})

// Every challenge ever written, playable on demand regardless of whether its window is
// open — the registry's own `openModes` is what the intro uses to hide the ones that
// are not, and this screen exists precisely to reach the ones that are. No leaderboard
// anywhere here: a challenge is outside `SCORED_MODES`, so the run this starts submits
// nothing — see lib/score-submission.ts.
//
// Behind the `challengeLab` feature, which is the key `dev` became: the link that opens
// this screen now appears for anybody holding any dev feature, of which this is the
// first. See `DEV_FEATURES` in constants/features.ts.
const TITLE = msg`CHALLENGES LAB`

// The square each row's mark is drawn in: about the height of the name and the first line
// under it, so the mark sits beside the block rather than towering over the name alone.
const LAB_MARK_SIZE = 28

export function DevOverlay({
  onOpenChallenge,
  onClose,
}: {
  onOpenChallenge: (modeId: string, session: OpenSession | null) => void
  onClose: () => void
}) {
  const { t } = useLingui()
  const [openedAt] = useState(() => Date.now())
  const [sessions, setSessions] = useState<readonly AdminSession[]>([])
  const [ratings, setRatings] = useState<ReadonlyMap<string, ChallengeRating>>(new Map())

  // Read once on open, and failures are swallowed on purpose: the sessions are extra
  // information about a list that is already complete without them. A tester who cannot
  // reach the server should still be able to deal themselves a challenge.
  useEffect(() => {
    void (async () => {
      const res = await listSessions()
      setSessions(res.rows)
    })()
    // The same bargain for the ratings, which only an admin is given at all.
    void (async () => {
      setRatings(await listChallengeRatings())
    })()
  }, [])

  // One row per challenge, in the planner's own table without its date column: the
  // name in its own colours with what it is, where its session stands and — for an admin
  // — what players made of it under it, and nothing beside it. Pressing a row deals the challenge.
  const rows: readonly AdminTableRow[] = CHALLENGES.map((mode) => {
    const shown = shownSession(
      sessions.filter((session) => session.modeId === mode.id),
      openedAt,
    )
    const dial = dialOf(mode.id)
    const rating = ratings.get(mode.id)
    return {
      key: mode.id,
      cells: [
        // Padded here rather than in `AdminTable`, whose rows every admin list shares:
        // three lines to a row read as one block without air above and below them.
        //
        // The mark beside it is the one the intro's card wears — the challenge's own dial
        // as dots, in the bright end of its pair — so a tester recognises the row by the
        // same thing a player recognises the card by.
        <View className="flex-row items-center gap-3 py-3">
          {dial !== null && (
            <DialMark
              dial={dial}
              color={challengeInk(gradientOf(mode.id)[1])}
              size={LAB_MARK_SIZE}
            />
          )}
          <View className="flex-1">
            <ChallengeTitle modeId={mode.id} />
            <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
              {t(mode.description)}
            </Text>
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <SessionLine session={shown} now={openedAt} />
            </Text>
            {rating !== undefined && (
              <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                <RatingLine rating={rating} />
              </Text>
            )}
          </View>
        </View>,
      ],
      onPress: () => {
        onOpenChallenge(mode.id, shown === null ? null : asOpenSession(shown))
      },
    }
  })

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton
          id="dev.done"
          tone="quiet"
          onPress={onClose}
          label={<Trans>DONE</Trans>}
        />
      }
    >
      <Text selectable={false} className={cn(TYPE.caption, 'mb-2.5 text-dim')}>
        <Trans>EVERY CHALLENGE, ANY WINDOW — NO BOARD KEPT</Trans>
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminTable
          rowId="dev.run"
          columns={[{ label: 'CHALLENGE', tone: 'name' }]}
          rows={rows}
          empty={<Trans>No challenges have been written yet.</Trans>}
        />
      </ScrollView>
    </AdminScreen>
  )
}
