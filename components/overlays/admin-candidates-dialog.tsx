import { Plural, Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { challengeOptions } from '@/components/overlays/admin-challenge-options'
import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminSelect } from '@/components/overlays/admin-select'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import type { PastRuns } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'

// A session's two candidates, asked for in a dialog: PLAN SESSION opens it empty and EDIT
// CHALLENGE opens it pre-filled. A dialog and not a screen — it asks two things and the
// list behind it is what the answer changes.
//
// Both are needed for a new session; an existing one that has only one candidate (the
// auto-planner's) may stay that way, since a session being edited is not obliged to grow a
// ballot.
//
// `discards` is what makes the edit ask first: the caller says how many votes the change
// would throw away, and where that is more than none the dialog puts the figure to the
// admin before it saves. KEEP goes back to the form rather than closing it.
export function AdminCandidatesDialog({
  title,
  pastRuns,
  now,
  pending,
  initial,
  discards,
  onSave,
  onDismiss,
}: {
  title: ReactNode
  pastRuns: ReadonlyMap<string, PastRuns>
  now: number
  pending: ReadonlySet<string>
  // The candidates already on the session, for an edit. Absent for a new one.
  initial?: { first: string; second: string | null }
  discards?: (first: string, second: string | null) => number
  onSave: (first: string, second: string | null) => Promise<{ error: string | null }>
  onDismiss: () => void
}) {
  const [first, setFirst] = useState<string | null>(initial?.first ?? null)
  const [second, setSecond] = useState<string | null>(initial?.second ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The votes the change would throw away, once the admin has pressed SAVE and been told.
  const [asking, setAsking] = useState<number | null>(null)

  // A single stays optional only where it already was one; a new session needs both.
  // (`undefined` for a new session is not `null`, so only a real single counts.)
  const wasSingle = initial?.second === null
  const needsSecond = !wasSingle
  const same = first !== null && first === second
  const canSave = first !== null && (second !== null || !needsSecond) && !same && !busy
  // A new session has nothing to compare with, so any choice is a change.
  const was = initial ?? { first: null, second: null }
  const changed = first !== was.first || second !== was.second

  const keep = initial?.first
  const options = challengeOptions({ pastRuns, now, pending, keep })
  const optionsB = challengeOptions({ pastRuns, now, pending, keep: initial?.second })

  const write = async () => {
    if (first === null) return
    setBusy(true)
    const res = await onSave(first, second)
    setBusy(false)
    setAsking(null)
    if (res.error !== null) {
      setError(res.error)
      return
    }
    onDismiss()
  }

  const save = () => {
    if (first === null) return
    const lost = discards?.(first, second) ?? 0
    if (lost > 0) setAsking(lost)
    else void write()
  }

  if (asking !== null) {
    return (
      <AdminDialog title={<Trans>CHANGE A CANDIDATE?</Trans>} onDismiss={onDismiss}>
        <Text selectable={false} className={cn(TYPE.hint, 'mb-2.5 text-dim')}>
          <Plural
            value={asking}
            one="# vote for the challenge you are replacing will be discarded. Votes for the other stay."
            other="# votes for the challenge you are replacing will be discarded. Votes for the other stay."
          />
        </Text>
        <View className="gap-2">
          <PrimaryButton
            id="admin.session_edit_confirm"
            tone="danger"
            disabled={busy}
            onPress={() => {
              void write()
            }}
            label={<Trans>CHANGE CANDIDATE</Trans>}
          />
          <PrimaryButton
            id="admin.session_edit_keep"
            tone="quiet"
            onPress={() => {
              setAsking(null)
            }}
            label={<Trans>KEEP</Trans>}
          />
        </View>
      </AdminDialog>
    )
  }

  return (
    <AdminDialog title={title} onDismiss={onDismiss} held>
      <View className="gap-2.5">
        <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
          <Trans>FIRST CANDIDATE</Trans>
        </Text>
        <AdminSelect
          title={<Trans>FIRST CANDIDATE</Trans>}
          placeholder={<Trans>CHOOSE A CHALLENGE</Trans>}
          value={first}
          onSelect={setFirst}
          disabled={busy}
          options={options}
        />
        <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
          <Trans>SECOND CANDIDATE</Trans>
        </Text>
        <AdminSelect
          title={<Trans>SECOND CANDIDATE</Trans>}
          placeholder={<Trans>CHOOSE A CHALLENGE</Trans>}
          value={second}
          onSelect={setSecond}
          disabled={busy}
          options={optionsB}
        />
        {(same || error !== null) && (
          <Text selectable={false} className={cn(TYPE.hint, 'text-red-500')}>
            {same ? <Trans>Pick two different challenges.</Trans> : error}
          </Text>
        )}
        <PrimaryButton
          id="admin.session_candidates_save"
          disabled={!canSave || !changed}
          onPress={save}
          label={<Trans>SAVE</Trans>}
        />
        <PrimaryButton
          id="admin.session_candidates_cancel"
          tone="quiet"
          onPress={onDismiss}
          label={<Trans>CANCEL</Trans>}
        />
      </View>
    </AdminDialog>
  )
}
