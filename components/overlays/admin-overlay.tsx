import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import {
  findProfileByNickname,
  listRoledProfiles,
  setUserRole,
  type RoledProfile,
} from '@/lib/admin-roles'
import { cn } from '@/lib/cn'
import type { NameFactors } from '@/lib/name-gradient'
import { ROLES, type Role } from '@/lib/role'

const ROLE_LABEL: Record<Role, string> = {
  tester: 'TESTER',
  developer: 'DEVELOPER',
  admin: 'ADMIN',
}

// NONE first — taking a role away is a legal move and the picker reads left to right in
// rising order otherwise, which would bury the one option that undoes the other three.
const PICKER_OPTIONS: readonly (Role | null)[] = [null, ...ROLES]

function RolePicker({
  current,
  busy,
  onPick,
}: {
  current: Role | null
  busy: boolean
  onPick: (role: Role | null) => void
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {PICKER_OPTIONS.map((option) => {
        const active = option === current
        return (
          <TrackedPressable
            id="admin.row"
            key={option ?? 'none'}
            disabled={busy || active}
            onPress={() => {
              onPick(option)
            }}
            className={cn(
              'rounded-lg border px-2.5 py-1',
              active ? 'border-strong bg-strong' : 'border-dim/30',
              busy && !active && 'opacity-40',
            )}
          >
            <Text
              selectable={false}
              className={cn(
                'font-mono text-[9px] font-black tracking-[1px]',
                active ? 'text-on-strong' : 'text-dim',
              )}
            >
              {option === null ? 'NONE' : ROLE_LABEL[option]}
            </Text>
          </TrackedPressable>
        )
      })}
    </View>
  )
}

function ProfileRow({
  profile,
  factors,
  busy,
  onPick,
}: {
  profile: RoledProfile
  // What this profile's name is coloured by, from the list's one lookup. A player is
  // the same colour here as on a board row, and the handful of people who open this
  // screen are the ones most likely to recognise each other by it.
  factors: NameFactors
  busy: boolean
  onPick: (role: Role | null) => void
}) {
  return (
    <View className="gap-1.5 border-b border-dim/10 py-3">
      {/* A profile with no nickname is not a name to draw — it is this screen saying
          there is nothing there, so it stays in the plain ink the rest of the row is in
          rather than wearing a gradient belonging to somebody. */}
      {profile.nickname === null ? (
        <Text
          selectable={false}
          className="font-mono text-[12px] font-black tracking-[0.5px] text-primary"
        >
          <Trans>(no nickname)</Trans>
        </Text>
      ) : (
        <GradientName
          nickname={profile.nickname}
          avgAccuracy={factors.avgAccuracy}
          avgSpeed={factors.avgSpeed}
          numberOfLines={1}
          className="font-mono text-[12px] font-black tracking-[0.5px]"
        />
      )}
      <RolePicker current={profile.role} busy={busy} onPick={onPick} />
    </View>
  )
}

// Every profile that holds a role, and a search to find one that does not yet and hand it
// one. The list is read once on open and patched in place on every change here — the
// screen's own writes are the only thing that can move a row on or off it, so there is
// nothing to poll for.
export function AdminOverlay({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<RoledProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<RoledProfile | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)

  // One lookup for every name on screen — the list, and whoever the search box turned
  // up. Asked for all of them at once rather than per row, which is what keeps a list of
  // twenty names one request. See `usePlayerFactors`: the answer is not kept live,
  // because a career average does not move far enough to change a colour.
  const shownIds =
    searchResult === null || rows.some((row) => row.id === searchResult.id)
      ? rows.map((row) => row.id)
      : [...rows.map((row) => row.id), searchResult.id]
  const factorsOf = usePlayerFactors(shownIds.length === 0 ? EMPTY_IDS : shownIds)

  useEffect(() => {
    void (async () => {
      const res = await listRoledProfiles()
      setRows(res.rows)
      setListError(res.error)
      setLoading(false)
    })()
  }, [])

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (trimmed === '') return
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)
    const res = await findProfileByNickname(trimmed)
    setSearching(false)
    if (res.error !== null) {
      setSearchError(res.error)
    } else if (res.row === null) {
      setSearchError('No profile with that nickname.')
    } else {
      setSearchResult(res.row)
    }
  }

  // Shared by the search result and every row in the list below: write the role, then
  // patch whichever of the two places shows this profile rather than reloading either —
  // the list is a snapshot, and a role granted from the search box belongs on it too.
  const handlePick = async (profile: RoledProfile, role: Role | null) => {
    setBusyId(profile.id)
    const res = await setUserRole(profile.id, role)
    setBusyId(null)
    if (res.error !== null) return
    const updated: RoledProfile = { ...profile, role }
    setSearchResult((current) => (current?.id === profile.id ? updated : current))
    setRows((current) => {
      const withoutRole = role === null
      const existed = current.some((row) => row.id === profile.id)
      if (withoutRole) return current.filter((row) => row.id !== profile.id)
      if (existed) return current.map((row) => (row.id === profile.id ? updated : row))
      return [...current, updated]
    })
  }

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>ADMIN</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-4 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>WHO HOLDS A ROLE, AND WHO SHOULD</Trans>
      </Text>

      <View className="mb-2 flex-row gap-2">
        <TextInput
          value={query}
          onChangeText={(next) => {
            setQuery(next)
            setSearchError(null)
          }}
          placeholder="nickname"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            void handleSearch()
          }}
          className="flex-1 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        />
        <TrackedPressable
          id="admin.set_role"
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
          <ProfileRow
            profile={searchResult}
            factors={factorsOf(searchResult.id)}
            busy={busyId === searchResult.id}
            onPick={(role) => {
              void handlePick(searchResult, role)
            }}
          />
        </View>
      )}

      <Text
        selectable={false}
        className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>EVERYONE WITH A ROLE</Trans>
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
            <ProfileRow
              profile={item}
              factors={factorsOf(item.id)}
              busy={busyId === item.id}
              onPick={(role) => {
                void handlePick(item, role)
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
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

      <TrackedPressable
        id="admin.done"
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </ScreenLayer>
  )
}
