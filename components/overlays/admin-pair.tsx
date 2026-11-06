import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { challengeOptions } from '@/components/overlays/admin-challenge-options'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSelect } from '@/components/overlays/admin-select'
import { WhenRow } from '@/components/overlays/admin-when-row'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import {
  cancelSession,
  editSession,
  type AdminSession as Session,
} from '@/lib/admin/sessions'
import type { PastRuns } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import type { DrawnPair } from '@/lib/session-pairs'

const TITLE = msg`CHALLENGES`

// One **pair** of the queue, as one item with one detail: both candidates, the one with
// more votes on top, each with its slot and its votes, and the two things an admin does to
// a pair — change a candidate and take the pair off the queue. Planned sessions have no
// scores, so nothing here is locked.
export function AdminPair({
  pair,
  pastRuns,
  now,
  pending,
  onChanged,
  onBack,
}: {
  pair: DrawnPair<Session>
  pastRuns: ReadonlyMap<string, PastRuns>
  now: number
  pending: ReadonlySet<string>
  onChanged: () => void
  onBack: () => void
}) {
  const { t } = useLingui()
  const [top, setTop] = useState(pair.top.modeId)
  const [bottom, setBottom] = useState(pair.bottom?.modeId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A write failed part-way. The first one has already re-packed the queue, so the pair on
  // this screen is no longer the pair on the server — everything is held until the admin
  // goes back to the list, which has read it again.
  const [stale, setStale] = useState(false)

  const sides = [
    { session: pair.top, votes: pair.topVotes, value: top, set: setTop },
    { session: pair.bottom, votes: pair.bottomVotes, value: bottom, set: setBottom },
  ]

  // Whether both are still different challenges, the one rule a pair has.
  const same = bottom !== null && top === bottom
  const changed =
    top !== pair.top.modeId || (pair.bottom !== null && bottom !== pair.bottom.modeId)

  // Each candidate that changed is re-pointed, then back to the list.
  const run = async (writes: readonly (() => Promise<{ error: string | null }>)[]) => {
    setBusy(true)
    for (const write of writes) {
      const res = await write()
      if (res.error !== null) {
        setError(res.error)
        setStale(true)
        setBusy(false)
        onChanged()
        return
      }
    }
    setBusy(false)
    onChanged()
    onBack()
  }

  const save = () => {
    const writes: (() => Promise<{ error: string | null }>)[] = []
    if (top !== pair.top.modeId) writes.push(() => editSession(pair.top.id, top))
    if (pair.bottom !== null && bottom !== null && bottom !== pair.bottom.modeId) {
      const id = pair.bottom.id
      writes.push(() => editSession(id, bottom))
    }
    void run(writes)
  }

  const remove = () => {
    const sessions = [pair.top, ...(pair.bottom === null ? [] : [pair.bottom])]
    void run(sessions.map((session) => () => cancelSession(session.id)))
  }

  return (
    <AdminScreen
      title={t(TITLE)}
      error={error}
      footer={
        <View className="gap-2">
          <PrimaryButton
            id="admin.session_save"
            disabled={busy || stale || !changed || same}
            onPress={save}
            label={<Trans>SAVE</Trans>}
          />
          <PrimaryButton
            id="admin.session_cancel"
            tone="danger"
            disabled={busy || stale}
            onPress={remove}
            label={<Trans>REMOVE FROM QUEUE</Trans>}
          />
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
        {sides.map(({ session, votes, value, set }, index) =>
          session === null ? null : (
            <View key={session.id} className={index === 0 ? undefined : 'mt-5'}>
              <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
                {index === 0 ? (
                  <Trans>FIRST CANDIDATE</Trans>
                ) : (
                  <Trans>SECOND CANDIDATE</Trans>
                )}
                {votes === null ? null : (
                  <>
                    {' · '}
                    <Plural value={votes} one="# VOTE" other="# VOTES" />
                  </>
                )}
              </Text>
              <AdminSelect
                title={<Trans>CHALLENGE</Trans>}
                placeholder={value ?? <Trans>CHOOSE A CHALLENGE</Trans>}
                value={value}
                onSelect={set}
                disabled={busy}
                options={challengeOptions({
                  pastRuns,
                  now,
                  pending,
                  keep: session.modeId,
                })}
              />
              <View className="mt-2 gap-2">
                <WhenRow
                  label={<Trans>STARTS</Trans>}
                  at={formatDayTime(session.opensAt)}
                />
                <WhenRow
                  label={<Trans>ENDS</Trans>}
                  at={formatDayTime(session.closesAt)}
                />
              </View>
            </View>
          ),
        )}
        {stale && (
          <Text selectable={false} className={cn(TYPE.hint, 'mt-3 text-dim')}>
            <Trans>
              The queue changed while saving. Go back and open the pair again.
            </Trans>
          </Text>
        )}
        {same && (
          <Text selectable={false} className={cn(TYPE.hint, 'mt-3 text-red-500')}>
            <Trans>Pick two different challenges.</Trans>
          </Text>
        )}
      </ScrollView>
    </AdminScreen>
  )
}
