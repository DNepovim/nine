import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import {
  AdminChip,
  AdminTable,
  type AdminColumn,
  type AdminTableRow,
} from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import {
  findPersonByNickname,
  listAdminPeople,
  type AdminPerson,
} from '@/lib/admin/people'
import { cn } from '@/lib/cn'
import type { NameFactors } from '@/lib/name-gradient'

// Everybody who holds a role or carries an override, and a search to find somebody who
// does neither yet. The list is read once on open, and again whenever a detail screen
// says it changed something — `epoch` is that signal.
//
// Three columns, named at the top and the same three on the row the search turns up:
// who they are, what role they hold, and how many features they end up with. That last
// pair used to be one string with a star in it.

// The columns, written once and handed to both tables — the list, and the one row above
// it a search puts there. Two tables with the same columns rather than one with a gap in
// it: a found person is not a row of this list, and drawing them inside it would say they
// were.
// The name column is `flex-1` and the other two are as narrow as their contents: the
// name is the thing a row is read by, it carries a chip beside it on one row of the list,
// and it was the column being squeezed — ROLE at 68 and FEATURES at 60 left the YOU chip
// hanging off the end of its own cell. A role key is short and a count is two digits, so
// the room belongs to the name.
const COLUMNS: readonly AdminColumn[] = [
  { label: 'PLAYER', tone: 'name' },
  { label: 'ROLE', width: 52 },
  { label: 'FEAT', width: 34, align: 'right' },
]

// The name cell: a player's own colour wherever the app writes their name, and plain ink
// for a profile that has not got one yet — there is no name there to colour, and a
// gradient would be this screen wearing somebody else's.
// Exported for the analytics screen's lists of players, which draw a name the same way.
export function NameCell({
  person,
  factors,
  me,
}: {
  person: Pick<AdminPerson, 'nickname'>
  // What this person's name is coloured by, from the list's one lookup. A player is the
  // same colour here as on a board row, and the handful of people who open this screen
  // are the ones most likely to recognise each other by it.
  factors: NameFactors
  // Whether this row is the person reading it. This screen is the one place in the app
  // where somebody can take a feature off a player, and the player they are most able to
  // lock out of it is themselves — so the list says which row is theirs before they open
  // it rather than after.
  //
  // Said with the chip and nothing else. The row used to be lifted onto a card with a
  // coloured bar down its edge as well, which was three marks for one fact — and the two
  // that were not the chip both cost the row its alignment with the rest of the list. It
  // is also the **first row** now, which is a stronger statement than any of them.
  me: boolean
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      {person.nickname === null ? (
        <Text selectable={false} className={cn(TYPE.prose, 'shrink text-dim')}>
          <Trans>(no nickname)</Trans>
        </Text>
      ) : (
        <GradientName
          nickname={person.nickname}
          avgAccuracy={factors.avgAccuracy}
          avgSpeed={factors.avgSpeed}
          numberOfLines={1}
          className={cn(TYPE.prose, 'shrink')}
        />
      )}
      {me && <AdminChip label={<Trans>YOU</Trans>} />}
    </View>
  )
}

export function AdminPeople({
  epoch,
  viewerId,
  onOpenPerson,
}: {
  epoch: number
  // Who is reading. Null before the profile has opened, which is the same thing as nobody
  // on this list being them.
  viewerId: string | null
  onOpenPerson: (person: AdminPerson) => void
}) {
  const [rows, setRows] = useState<AdminPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<AdminPerson | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // One lookup for every name on screen — the list, and whoever the search box turned
  // up. Asked for all of them at once rather than per row, which is what keeps a list of
  // twenty names one request. See `usePlayerFactors`: the answer is not kept live,
  // because a career average does not move far enough to change a colour.
  const shownIds =
    searchResult === null || rows.some((row) => row.id === searchResult.id)
      ? rows.map((row) => row.id)
      : [...rows.map((row) => row.id), searchResult.id]
  const factorsOf = usePlayerFactors(shownIds.length === 0 ? EMPTY_IDS : shownIds)

  // Only the first read blanks the list. `epoch` bumps every time a detail screen
  // changes something, and swapping the rows for a spinner on the way back from one was
  // the screen flashing for a change it already knew about.
  useEffect(() => {
    void (async () => {
      const res = await listAdminPeople()
      setRows(res.rows)
      setListError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  // The reader's own row first, and the server's order kept under it. The list comes back
  // ordered by role and then by nickname, which is the right order for everybody except
  // the one person who is going to open their own row — and that row is the one this
  // screen exists to be careful with.
  const ordered =
    viewerId === null
      ? rows
      : [...rows].sort((a, b) => (a.id === viewerId ? -1 : b.id === viewerId ? 1 : 0))

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (trimmed === '') return
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)
    const res = await findPersonByNickname(trimmed)
    setSearching(false)
    if (res.error !== null) {
      setSearchError(res.error)
    } else if (res.row === null) {
      setSearchError('No profile with that nickname.')
    } else {
      setSearchResult(res.row)
    }
  }

  const toRow = (person: AdminPerson): AdminTableRow => ({
    key: person.id,
    cells: [
      <NameCell
        person={person}
        factors={factorsOf(person.id)}
        me={person.id === viewerId}
      />,
      person.role ?? '—',
      // The count is features in effect, and the star marks somebody whose count is not
      // their role's — the one thing a list of people can usefully say about an override
      // without opening anybody.
      `${person.featureCount}${person.hasOverrides ? ' ✦' : ''}`,
    ],
    onPress: () => {
      onOpenPerson(person)
    },
  })

  return (
    <View className="flex-1">
      <View className="mb-2.5 flex-row gap-2">
        <TextInput
          value={query}
          onChangeText={(next) => {
            setQuery(next)
            setSearchError(null)
          }}
          placeholder="nickname"
          placeholderTextColor={DIM_INK}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            void handleSearch()
          }}
          className="h-9 flex-1 rounded-xl border border-muted bg-elevated px-2.5 font-mono font-bold tracking-[1px] text-primary"
        />
        <PrimaryButton
          id="admin.find"
          variant="compact"
          onPress={() => {
            void handleSearch()
          }}
          disabled={searching || query.trim() === ''}
          label={<Trans>FIND</Trans>}
        />
      </View>

      {searching && <ActivityIndicator className="mb-2" />}
      {searchError !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {searchError}
        </Text>
      )}
      {searchResult !== null && (
        <AdminTable
          className="mb-2.5"
          rowId="admin.person"
          columns={COLUMNS}
          rows={[toRow(searchResult)]}
        />
      )}

      <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
        <Trans>EVERYONE WITH A ROLE OR AN OVERRIDE</Trans>
      </Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AdminTable
          rowId="admin.person"
          columns={COLUMNS}
          rows={ordered.map(toRow)}
          loading={loading}
          error={listError}
          empty={<Trans>Nobody holds a role yet.</Trans>}
        />
      </ScrollView>
    </View>
  )
}
