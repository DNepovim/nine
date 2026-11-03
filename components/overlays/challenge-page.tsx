import { Plural, Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { ChallengeTitle, WhenBlock } from '@/components/overlays/admin-session-cells'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { RatingLine } from '@/components/overlays/rating-line'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import {
  listChallengeRemarks,
  listSessionLog,
  type ChallengeRemark,
  type SessionLogRow,
} from '@/lib/admin/challenge-page'
import type { ChallengeRating } from '@/lib/admin/ratings'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import { sessionFigure } from '@/lib/session-figure'
import { gradientOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// The gallery's **challenge page**: one challenge, and what an admin deciding whether it
// comes back wants in one place — what players made of it, what they said, and how often
// it has run and how many came. Opened from its tile on the CHALLENGES screen's GALLERY;
// PLAY deals a run of it, for whoever holds `challengeLab`.

// The mark beside the name in the heading: larger than a gallery tile's, since here it is
// the screen's own title.
const MARK_SIZE = 32

function RemarkBlock({ remark }: { remark: ChallengeRemark }) {
  const when = formatDayTime(remark.opensAt)
  return (
    <View className="mb-3 rounded-xl border border-muted bg-surface p-3">
      <Text selectable className={cn(TYPE.proseSm, 'text-primary')}>
        {remark.remark}
      </Text>
      <Text selectable={false} className={cn(TYPE.hint, 'mt-1.5 text-dim')}>
        {/* Out of nine, so the figure reads as a rating rather than as a count. Never a
            name: see `challenge_remarks`. */}
        {remark.rating === null ? when : `${String(remark.rating)}/9 · ${when}`}
      </Text>
    </View>
  )
}

export function ChallengePage({
  modeId,
  rating,
  onPlay,
  onBack,
}: {
  modeId: string
  // The figure the lab has already read for every challenge, so the page does not ask
  // again. Undefined for one nobody rated, and for a tester.
  rating: ChallengeRating | undefined
  // Absent for an admin without `challengeLab`, who is shown the page and no PLAY.
  onPlay?: () => void
  onBack: () => void
}) {
  const [remarks, setRemarks] = useState<{ remarks: ChallengeRemark[]; shown: boolean }>({
    remarks: [],
    shown: false,
  })
  const [log, setLog] = useState<SessionLogRow[]>([])
  const [loading, setLoading] = useState(true)

  // Read once on open. Neither read can fail loudly — see lib/admin/challenge-page.ts.
  useEffect(() => {
    void (async () => {
      const [read, rows] = await Promise.all([
        listChallengeRemarks(modeId),
        listSessionLog(modeId),
      ])
      setRemarks(read)
      setLog(rows)
      setLoading(false)
    })()
  }, [modeId])

  // One line per session: when it opened, the figure that won it — printed by the
  // session's own measure, so a race shows a time — and how many came.
  const logRows: readonly AdminTableRow[] = log.map((session) => ({
    key: session.id,
    cells: [
      <WhenBlock at={session.opensAt} />,
      // The figure is a string, so the column's `figure` tone draws it. The two nodes
      // below are not, and `AdminTable` passes a node through untouched — each carries its
      // own role, or it lands in the browser's default type.
      session.best === null ? (
        <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
          <Trans>NOBODY PLAYED</Trans>
        </Text>
      ) : (
        sessionFigure(session.measure, session.best)
      ),
      <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
        <Plural value={session.players} one="# PLAYER" other="# PLAYERS" />
      </Text>,
    ],
  }))

  const sessions = log.length

  return (
    <AdminScreen
      heading={
        <View className="flex-row items-center gap-3">
          <ChallengeMark
            modeId={modeId}
            color={challengeInk(gradientOf(modeId)[1])}
            size={MARK_SIZE}
          />
          <ChallengeTitle modeId={modeId} className={TYPE.screenTitle} />
        </View>
      }
      footer={
        <View className="gap-2">
          {onPlay !== undefined && (
            <PrimaryButton id="dev.run" onPress={onPlay} label={<Trans>PLAY</Trans>} />
          )}
          <PrimaryButton
            id="admin.back"
            tone="quiet"
            onPress={onBack}
            label={<Trans>BACK</Trans>}
          />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          {rating !== undefined && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <RatingLine rating={rating} />
            </Text>
          )}
          {!loading && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <Plural value={sessions} one="# SESSION" other="# SESSIONS" />
            </Text>
          )}
        </View>

        {remarks.shown && (
          <View className="mb-4">
            <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
              <Trans>REMARKS</Trans>
            </Text>
            {remarks.remarks.length === 0 ? (
              <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                <Trans>No remarks yet.</Trans>
              </Text>
            ) : (
              remarks.remarks.map((remark, index) => (
                <RemarkBlock
                  key={`${String(remark.opensAt)}-${String(index)}`}
                  remark={remark}
                />
              ))
            )}
          </View>
        )}

        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
          <Trans>SESSIONS</Trans>
        </Text>
        <AdminTable
          loading={loading}
          columns={[
            // The planner's width for the same block, which leaves room for the lane a
            // live dot takes there.
            { width: 47 },
            { label: 'WINNER', tone: 'figure' },
            { width: 80, align: 'right' },
          ]}
          rows={logRows}
          empty={<Trans>No sessions yet.</Trans>}
        />
      </ScrollView>
    </AdminScreen>
  )
}
