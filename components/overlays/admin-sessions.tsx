import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'

import { AdminSession } from '@/components/overlays/admin-session'
import { AdminSessionRow } from '@/components/overlays/admin-session-row'
import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { TYPE } from '@/constants/typography'
import { listSessions, type AdminSession as Session } from '@/lib/admin/sessions'
import { cn } from '@/lib/cn'

// When a challenge is on: every session ever planned, newest start first.
//
// The second half of the admin hub, and the half that did not exist before — a
// challenge's window used to be two timestamps in the bundle. Nothing here resolves a
// session into the rules a run is played under; that is the next phase. What this screen
// decides is only what the server holds.
//
// The form is state here rather than a screen of its own for the reason `AdminAccess`
// holds its person and its role: a session is reached from this list and goes back to
// it, and one BACK has to work for both a new session and an existing one.
//
// `'new'` rather than a second flag. The form is one form — plan and edit differ in
// whether there is a row behind it, and in nothing a reader can see.
type Editing = Session | 'new' | null

export function AdminSessions({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)

  // One counter, the way every other admin list has one: the list is a snapshot, and a
  // write on the form behind it has to be able to tell this to read again.
  const [epoch, setEpoch] = useState(0)

  // Read once per open rather than per render, the same way the intro reads `openedAt`
  // and the challenge lab reads its own: a window closing while this screen is up would
  // otherwise relabel a row under a thumb already travelling towards it.
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    void (async () => {
      const res = await listSessions()
      setRows(res.rows)
      setError(res.error)
      setLoading(false)
    })()
    // `epoch` bumps after the form's writes as well. Only the first read has nothing to
    // draw, and `loading` is never set back to true, so a save does not blank the list.
  }, [epoch])

  if (editing !== null) {
    return (
      <AdminSession
        session={editing === 'new' ? null : editing}
        onChanged={() => {
          setEpoch((n) => n + 1)
        }}
        onBack={() => {
          setEditing(null)
        }}
      />
    )
  }

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-1 text-primary')}>
        <Trans>CHALLENGES</Trans>
      </Text>
      <Text selectable={false} className={cn(TYPE.label, 'mb-4 text-dim')}>
        <Trans>WHEN A CHALLENGE IS ON</Trans>
      </Text>

      <PrimaryButton
        id="admin.session_new"
        variant="compact"
        onPress={() => {
          setEditing('new')
        }}
        className="mb-3 self-start"
        label={<Trans>PLAN SESSION</Trans>}
      />

      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <AdminSessionRow session={item} now={openedAt} onOpen={setEditing} />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
              <Trans>No sessions planned yet.</Trans>
            </Text>
          }
        />
      )}

      <View className="mt-4 items-center">
        <PrimaryButton
          id="admin.back"
          onPress={onBack}
          style={{ width: 224 }}
          label={<Trans>BACK</Trans>}
        />
      </View>
    </ScreenLayer>
  )
}
