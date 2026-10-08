import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import {
  findPersonByNickname,
  listAdminPeople,
  type AdminPerson,
} from '@/lib/admin/people'
import { cn } from '@/lib/cn'
import type { NameFactors } from '@/lib/name-gradient'

// The row that is the person reading it.
//
// This screen is the one place in the app where somebody can take a feature off a player,
// and the player they are most able to lock out of it is themselves. So the list says which
// row is theirs before they open it rather than after.
//
// A tag beside the name rather than a column of its own: the name cell shrinks to make room
// on the one row that needs it, so the role and the count stay in line down the whole list
// and nobody else's row pays for the mark.
function You() {
  return (
    <View className="rounded border border-dim/30 px-1 py-px">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-black tracking-[1px] text-dim"
      >
        <Trans>YOU</Trans>
      </Text>
    </View>
  )
}

function PersonRow({
  person,
  factors,
  me,
  onPress,
}: {
  person: AdminPerson
  // What this person's name is coloured by, from the list's one lookup. A player is the
  // same colour here as on a board row, and the handful of people who open this screen
  // are the ones most likely to recognise each other by it.
  factors: NameFactors
  // Whether this row is the person reading it.
  me: boolean
  onPress: () => void
}) {
  return (
    <TrackedPressable
      id="admin.person"
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-2 py-2.5',
        // Lifted out of the list as a card rather than tinted in place: a card is how the
        // rest of the app raises a thing worth noticing, and it carries its own separation,
        // so the row gives up the hairline the others are divided by.
        me ? '-mx-2 rounded-lg bg-card px-2' : 'border-b border-dim/10',
      )}
    >
      <View className="flex-1 flex-row items-center gap-1.5">
        {/* A profile with no nickname is not a name to draw — it is this screen saying
            there is nothing there, so it stays in the plain ink the rest of the row is in
            rather than wearing a gradient belonging to somebody. */}
        {person.nickname === null ? (
          <Text
            selectable={false}
            className="shrink font-mono text-[12px] font-black tracking-[0.5px] text-primary"
          >
            <Trans>(no nickname)</Trans>
          </Text>
        ) : (
          <GradientName
            nickname={person.nickname}
            avgAccuracy={factors.avgAccuracy}
            avgSpeed={factors.avgSpeed}
            numberOfLines={1}
            className="shrink font-mono text-[12px] font-black tracking-[0.5px]"
          />
        )}
        {me && <You />}
      </View>
      <Text
        selectable={false}
        className="w-20 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {person.role ?? ''}
      </Text>
      {/* The count is features in effect, and the star marks somebody whose count is not
          their role's — the one thing a list of people can usefully say about an
          override without opening anybody. */}
      <Text
        selectable={false}
        className="w-8 text-right font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {person.featureCount}
        {person.hasOverrides ? ' ✦' : ''}
      </Text>
    </TrackedPressable>
  )
}

// Everybody who holds a role or carries an override, and a search to find somebody who
// does neither yet. The list is read once on open, and again whenever a detail screen
// says it changed something — `epoch` is that signal.
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

  return (
    <View className="flex-1">
      <View className="mb-2 flex-row gap-2">
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
          className="flex-1 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        />
        <TrackedPressable
          id="admin.find"
          onPress={() => {
            void handleSearch()
          }}
          disabled={searching || query.trim() === ''}
          className={cn(
            'items-center justify-center rounded-lg bg-strong px-4',
            (searching || query.trim() === '') && 'opacity-40',
          )}
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1px] text-on-strong"
          >
            <Trans>FIND</Trans>
          </Text>
        </TrackedPressable>
      </View>

      {searching && <ActivityIndicator className="my-2" />}
      {searchError !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {searchError}
        </Text>
      )}
      {searchResult !== null && (
        <View className="mb-4 rounded-xl border border-dim/20 px-3">
          <PersonRow
            person={searchResult}
            factors={factorsOf(searchResult.id)}
            me={searchResult.id === viewerId}
            onPress={() => {
              onOpenPerson(searchResult)
            }}
          />
        </View>
      )}

      <Text
        selectable={false}
        className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>EVERYONE WITH A ROLE OR AN OVERRIDE</Trans>
      </Text>
      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : listError !== null ? (
        <Text selectable={false} className="font-mono text-[11px] font-bold text-red-500">
          {listError}
        </Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <PersonRow
              person={item}
              factors={factorsOf(item.id)}
              me={item.id === viewerId}
              onPress={() => {
                onOpenPerson(item)
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text
              selectable={false}
              className="font-mono text-[12px] font-medium text-dim"
            >
              <Trans>Nobody holds a role yet.</Trans>
            </Text>
          }
        />
      )}
    </View>
  )
}
