import { Trans } from '@lingui/react/macro'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'

import {
  AdminChip,
  AdminTable,
  type AdminTableRow,
} from '@/components/overlays/admin-table'
import { AdminVisibilityModal } from '@/components/overlays/admin-visibility-modal'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { listFeatures, setFeature, type AdminFeature } from '@/lib/admin/features'
import { cn } from '@/lib/cn'
import { type Visibility } from '@/lib/features'

// The one key whose switch nobody may move, in either direction: hiding it locks every
// admin out of the only screen that could put it back, and making it public puts the
// ADMIN link in front of every player. The database refuses both too — a check
// constraint on `features`, because it has to hold against a migration as well as
// against this screen — and this is only so the switch does not look tappable.
const PROTECTED = 'admin'

// What each position says on the row's own button, and how solid it is drawn. The three
// read as a scale of how far a feature has got out: outlined faintly for nobody, outlined
// for whoever holds it, filled for everybody. Filled is the loudest because public is the
// one position that cannot be undone quietly.
//
// Deliberately not translated, the way the key beside it is not: the people who open this
// screen are the people who write the catalog. The sentence under each of them, in the
// dialog this button opens, is copy and is extracted.
const CHIP: Record<Visibility, 'quiet' | 'strong' | 'filled'> = {
  hidden: 'quiet',
  private: 'strong',
  public: 'filled',
}

const CHIP_LABEL: Record<Visibility, string> = {
  hidden: 'HIDDEN',
  private: 'PRIVATE',
  public: 'PUBLIC',
}

// A fixed width, because the three labels are three lengths and a column that resized
// itself every time one row changed read as the list redrawing rather than as one switch
// moving.
const SWITCH_W = 76

// What the note fields hold after a read. A draft beats what the server just said: a
// note being typed in one row has to survive a switch being flipped in another, and
// every write on this screen reads the whole list back.
const mergeNotes = (
  rows: readonly AdminFeature[],
  current: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(rows.map((row) => [row.key, current[row.key] ?? row.note ?? '']))

// One row with its switch already moved, for the optimistic half of a confirm.
const withVisibility = (
  rows: readonly AdminFeature[],
  key: string,
  visibility: Visibility,
): AdminFeature[] => rows.map((row) => (row.key === key ? { ...row, visibility } : row))

export function AdminFeatures({
  epoch,
  onChanged,
}: {
  epoch: number
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminFeature[]>([])
  const [loading, setLoading] = useState(true)
  // Which keys have a write in flight, rather than one flag for the screen. A single
  // `busy` dimmed every row at once and disabled all of them — which is what a tap on
  // one switch read as: the whole list flashing, and the next tap landing on nothing.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  // The same answer as `pending`, readable the moment it changes rather than on the next
  // render. Confirming a row's visibility blurs that row's note field in the same breath,
  // and the blur handler has to be able to see the write the confirm already sent.
  const inFlight = useRef<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  // The note is edited in place, so the field needs somewhere to live between keystrokes
  // that is not the row it came from.
  const [notes, setNotes] = useState<Record<string, string>>({})
  // Which row's visibility is being asked about. One dialog for the list rather than one
  // per row: only one can be open, and the row it is about is the whole of its state.
  const [asking, setAsking] = useState<AdminFeature | null>(null)

  // Only the first read has nothing to draw, so only the first read is allowed to blank
  // the list. `epoch` bumps after this screen's own writes as well, and swapping the
  // rows for a spinner on each of those was the screen flashing on every tap.
  useEffect(() => {
    void (async () => {
      const res = await listFeatures()
      setRows(res.rows)
      setNotes((current) => mergeNotes(res.rows, current))
      setError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  // Every write is the same three moves — mark that key busy, call, read the whole list
  // back — because a refused write has to put its row back to what the server holds.
  const write = async (key: string, call: () => Promise<{ error: string | null }>) => {
    inFlight.current.add(key)
    setPending((current) => new Set(current).add(key))
    const res = await call()
    setError(res.error)
    const reloaded = await listFeatures()
    setRows(reloaded.rows)
    setNotes((current) => mergeNotes(reloaded.rows, current))
    inFlight.current.delete(key)
    setPending((current) => {
      const left = new Set(current)
      left.delete(key)
      return left
    })
    if (res.error === null) onChanged()
  }

  const tableRows: readonly AdminTableRow[] = rows.map((row) => {
    const locked = row.key === PROTECTED
    const note = notes[row.key] ?? ''
    const busy = pending.has(row.key)
    return {
      key: row.key,
      cells: [
        `${row.key}${locked ? ' 🔒' : ''}`,
        // Roles granting it, then people who actually reach it — the second counts
        // overrides in, which is the number somebody about to move the switch wants. A
        // public feature has no such pair: it reaches a population that grows with every
        // player who opens the app, and the stack beside it has stopped deciding
        // anything.
        row.visibility === 'public' ? (
          <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
            <Trans>everyone</Trans>
          </Text>
        ) : (
          `${row.roleCount} · ${row.personCount}`
        ),
        // The row's own button, and the only way the switch moves now. It opens the
        // question rather than answering it — see `AdminVisibilityModal`.
        <TrackedPressable
          id="admin.feature_visibility"
          disabled={busy || locked}
          hitSlop={6}
          onPress={() => {
            setAsking(row)
          }}
          className={cn('w-full', (busy || locked) && 'opacity-40')}
        >
          <AdminChip
            label={CHIP_LABEL[row.visibility]}
            tone={CHIP[row.visibility]}
            className="w-full"
          />
        </TrackedPressable>,
      ],
      note: (
        <View>
          {!row.inBuild && (
            <Text selectable={false} className={cn(TYPE.hint, 'mb-1 text-red-500')}>
              {/* A row the database holds and this build does not: a key left behind by
                  a migration, or a device older than the server. Shown rather than
                  hidden — unseen configuration is how it goes stale. */}
              ⚠ <Trans>not in this build</Trans>
            </Text>
          )}
          <TextInput
            value={note}
            onChangeText={(next) => {
              setNotes((current) => ({ ...current, [row.key]: next }))
            }}
            onBlur={() => {
              // Confirming this row's visibility blurs this field, and that write
              // carried the draft below with it. Writing again from here would only send
              // the switch back to where it stood before the dialog.
              if (inFlight.current.has(row.key)) return
              if (note !== (row.note ?? '')) {
                void write(row.key, () =>
                  setFeature(row.key, row.visibility, note === '' ? null : note),
                )
              }
            }}
            placeholder="why"
            placeholderTextColor={DIM_INK}
            multiline
            className={cn(TYPE.value, 'leading-[15px] text-dim')}
          />
        </View>
      ),
    }
  })

  return (
    <View className="flex-1">
      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}
      {/* The notes are text fields in this very list, and a tap that only puts the
          keyboard away is the tap somebody counts as the first of two. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AdminTable
          rowId="admin.feature_visibility"
          loading={loading}
          columns={[
            { label: 'FEATURE', tone: 'name' },
            { label: 'ROLE · PPL', width: 62, align: 'right' },
            { width: SWITCH_W, align: 'right' },
          ]}
          rows={tableRows}
          empty={<Trans>No features in the database.</Trans>}
        />
      </ScrollView>

      {asking !== null && (
        <AdminVisibilityModal
          featureKey={asking.key}
          visibility={asking.visibility}
          onConfirm={(next) => {
            // The switch moves on the confirm. A write and a read stand between the
            // press and the truth, and a control that shows nothing until both land is a
            // control you press again.
            setRows((current) => withVisibility(current, asking.key, next))
            void write(asking.key, () =>
              setFeature(
                asking.key,
                next,
                (notes[asking.key] ?? '') === '' ? null : (notes[asking.key] ?? ''),
              ),
            )
          }}
          onDismiss={() => {
            setAsking(null)
          }}
        />
      )}
    </View>
  )
}
