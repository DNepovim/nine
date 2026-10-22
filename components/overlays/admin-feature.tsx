import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminChip, AdminTable } from '@/components/overlays/admin-table'
import {
  AdminVisibilityPicker,
  VisibilityChip,
} from '@/components/overlays/admin-visibility-picker'
import { PrimaryButton } from '@/components/primary-button'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import {
  listFeatures,
  loadFeatureReach,
  setFeature,
  type AdminFeature as Feature,
  type FeatureReach,
} from '@/lib/admin/features'
import { cn } from '@/lib/cn'

// The one key whose switch nobody may move, in either direction: hiding it locks every
// admin out of the only screen that could put it back, and making it public puts the
// ADMIN link in front of every player. The database refuses both too — a check
// constraint on `features`, because it has to hold against a migration as well as
// against this screen — and this is only so the switch does not look pressable.
export const PROTECTED_FEATURE = 'admin'

// The note field's floor — the 44 a thumb aims at — and the `py-2` around its text, which
// the content size it reports does not include.
const NOTE_MIN_H = 44
const NOTE_PAD_Y = 16

// One feature's row as the server holds it now, and who it reaches.
async function readFeature(key: string) {
  const [all, mine] = await Promise.all([listFeatures(), loadFeatureReach(key)])
  return {
    row: all.rows.find((r) => r.key === key) ?? null,
    reach: mine.reach,
    error: all.error ?? mine.error,
  }
}

// One feature: its visibility, its note, and — while it is private — who it reaches.
//
// The visibility was a button on the list row that raised a dialog. It lives here now,
// over the names it decides about: the reader about to move the switch can see the roles
// and the people it will move, which a pair of counts on the row never said.
export function AdminFeature({
  feature,
  onChanged,
  onBack,
}: {
  feature: Feature
  onChanged: () => void
  onBack: () => void
}) {
  // Held here rather than read off `feature`, which is the row the list handed over and
  // never hears about a write.
  const [row, setRow] = useState<Feature>(feature)
  const [note, setNote] = useState(feature.note ?? '')
  const [noteHeight, setNoteHeight] = useState(0)
  const [reach, setReach] = useState<FeatureReach>({ roles: [], people: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locked = row.key === PROTECTED_FEATURE

  // The row and who it reaches, read together: a visibility write changes both.
  const read = async () => {
    const res = await readFeature(feature.key)
    if (res.row !== null) setRow(res.row)
    setReach(res.reach)
    return res.error
  }

  useEffect(() => {
    void (async () => {
      const res = await readFeature(feature.key)
      if (res.row !== null) setRow(res.row)
      setReach(res.reach)
      setError(res.error)
      setLoading(false)
    })()
    // Read once on open, keyed on the feature. Every write below reloads deliberately.
  }, [feature.key])

  // Visibility and note go to the server as one write, so each sends the other's current
  // value — the draft note, not the one the row was opened with.
  const write = async (visibility: Feature['visibility'], nextNote: string) => {
    setBusy(true)
    // The switch moves on the confirm. A write and a read stand between the press and
    // the truth, and a control that shows nothing until both land is one you press again.
    setRow((current) => ({ ...current, visibility }))
    const res = await setFeature(row.key, visibility, nextNote === '' ? null : nextNote)
    const readError = await read()
    setError(res.error ?? readError)
    setBusy(false)
    if (res.error === null) onChanged()
  }

  return (
    <AdminScreen
      error={error}
      heading={
        <View className="mb-2.5 flex-row items-center justify-between gap-3">
          <Text
            selectable={false}
            numberOfLines={1}
            className={cn(TYPE.cardTitle, 'shrink text-primary')}
          >
            {row.key}
            {locked ? ' 🔒' : ''}
          </Text>
          <VisibilityChip visibility={row.visibility} />
        </View>
      }
      footer={
        <PrimaryButton id="admin.done" onPress={onBack} label={<Trans>DONE</Trans>} />
      }
    >
      {/* The note is a text field, and a tap that only puts the keyboard away is the
          tap somebody counts as the first of two. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!row.inBuild && (
          <Text selectable={false} className={cn(TYPE.hint, 'mb-2 text-red-500')}>
            {/* A row the database holds and this build does not: a key left behind by
                a migration, or a device older than the server. */}
            ⚠ <Trans>not in this build</Trans>
          </Text>
        )}

        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
          <Trans>VISIBILITY</Trans>
        </Text>
        <AdminVisibilityPicker
          // Keyed on what the server holds, so a refused confirm read back as the old
          // position starts the choice over from there.
          key={row.visibility}
          visibility={row.visibility}
          disabled={busy || loading || locked}
          onConfirm={(next) => {
            void write(next, note)
          }}
        />
        {locked && (
          <Text selectable={false} className={cn(TYPE.hint, 'mt-1.5 text-dim')}>
            <Trans>
              This screen. It stays private: it cannot be hidden or made public.
            </Trans>
          </Text>
        )}

        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 mt-4 text-dim')}>
          <Trans>NOTE</Trans>
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => {
            if (note !== (row.note ?? '')) void write(row.visibility, note)
          }}
          editable={!busy}
          placeholder="why"
          placeholderTextColor={DIM_INK}
          multiline
          // As tall as what is written in it, so the whole note is read without
          // scrolling inside the field. A multiline field is a fixed height on web and
          // scrolls its own text; its content size is the height to take instead.
          scrollEnabled={false}
          onContentSizeChange={(event) => {
            setNoteHeight(event.nativeEvent.contentSize.height)
          }}
          style={{ height: Math.max(NOTE_MIN_H, noteHeight + NOTE_PAD_Y) }}
          className={cn(
            TYPE.value,
            'rounded-xl border border-muted bg-surface px-2.5 py-2 text-primary',
          )}
        />

        <Reach visibility={row.visibility} reach={reach} loading={loading} />
      </ScrollView>
    </AdminScreen>
  )
}

// Who the feature reaches. Listed only while it is private: hidden is nobody and public
// is everybody, and either way a list of names would be answering a question the switch
// above has already answered.
function Reach({
  visibility,
  reach,
  loading,
}: {
  visibility: Feature['visibility']
  reach: FeatureReach
  loading: boolean
}) {
  if (visibility !== 'private') {
    return (
      <Text selectable={false} className={cn(TYPE.prose, 'mt-4 text-dim')}>
        {visibility === 'hidden' ? (
          <Trans>Nobody sees this feature, whatever a role or an override says.</Trans>
        ) : (
          <Trans>Everybody sees this feature, except anyone it is revoked for.</Trans>
        )}
      </Text>
    )
  }

  return (
    <View>
      <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 mt-4 text-dim')}>
        <Trans>ROLES</Trans>
      </Text>
      <AdminTable
        loading={loading}
        columns={[
          { label: 'ROLE', tone: 'name' },
          { label: 'HOLDING', width: 62, align: 'right' },
        ]}
        rows={reach.roles.map((role) => ({
          key: role.key,
          cells: [role.label, String(role.personCount)],
        }))}
        empty={<Trans>No role's stack holds this feature.</Trans>}
      />

      <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 mt-4 text-dim')}>
        <Trans>PEOPLE</Trans>
      </Text>
      <AdminTable
        loading={loading}
        columns={[
          { label: 'PLAYER', tone: 'name' },
          { label: 'WHERE FROM', width: 110, align: 'right' },
        ]}
        rows={reach.people.map((person) => ({
          key: person.id,
          cells: [
            person.nickname ?? '—',
            // From a role, named — the chip says which stack to open to change it. From
            // an override, said so: that one is changed on the person, not the role.
            person.via === 'role' ? (
              <AdminChip label={person.roleLabel ?? '—'} tone="strong" />
            ) : (
              <AdminChip label="OVERRIDE" tone="filled" />
            ),
          ],
        }))}
        empty={<Trans>Nobody reaches this feature.</Trans>}
      />
    </View>
  )
}
