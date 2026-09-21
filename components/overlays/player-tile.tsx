import { AntDesign } from '@expo/vector-icons'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { isNonEmptyString } from 'narrowland'
import { Pressable, Text, View } from 'react-native'

import { DIM_INK } from '@/constants/colors'
import { useChampionsContext } from '@/hooks/use-champions'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import { useTheme } from '@/hooks/use-theme'
import { championMark } from '@/lib/champions'
import { rankMedal } from '@/lib/rank-emoji'

// A distinct, lively gradient per attendee slot (drawn from the app palette).
// Shared by the waiting room and the game-over screen so both grids match.
export const PLAYER_GRADIENTS = [
  ['#4C7EFF', '#7273D2'],
  ['#c36282', '#E5534B'],
  ['#E5534B', '#FF8C00'],
  ['#2FB35A', '#4C7EFF'],
] as const

const tileShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 8,
}

const WHITE = '#FFFFFF'

function ordinal(n: number): string {
  if (n === 1) return '1ST'
  if (n === 2) return '2ND'
  if (n === 3) return '3RD'
  return `${n}TH`
}

function Chip({ label }: { label: string }) {
  return (
    <View
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
    >
      <Text
        selectable={false}
        className="font-mono text-[8px] font-black tracking-[1px]"
        style={{ color: WHITE }}
      >
        {label}
      </Text>
    </View>
  )
}

// What the corner chip says when there is no medal to show instead. Rank first — a
// finished room is about where everyone came — then the room's two standing facts.
function chipLabel({
  rank,
  isHost,
  isMe,
  you,
}: {
  rank: number | undefined
  isHost: boolean
  isMe: boolean
  // Translated by the caller: this sits outside the component, where the macro's hook
  // cannot reach.
  you: string
}): string | null {
  if (rank !== undefined) return ordinal(rank)
  if (isHost) return 'HOST'
  return isMe ? you : null
}

// One attendee tile: a gradient card with an initial-avatar, a HOST/rank/YOU
// badge, and the nickname. In results mode it also shows rank + score + ready.
// An empty slot renders a dashed placeholder. Used in both the waiting room and
// the game-over screen so the two lists look identical.
export function PlayerTile({
  nickname,
  userId,
  gradient,
  isMe,
  isHost = false,
  rank,
  score,
  ready,
}: {
  nickname: string | undefined
  // Whose tile it is, so a champion carries the same mark here as on the board. Omitted
  // for an empty slot, which has nobody to mark.
  userId?: string | null
  gradient: readonly [string, string]
  isMe: boolean
  isHost?: boolean
  rank?: number
  score?: number
  ready?: boolean
}) {
  const { t } = useLingui()
  // Before the empty-slot return: hooks cannot sit behind a condition.
  const champions = useChampionsContext()
  const openProfile = useOpenProfile()
  const { colorScheme } = useTheme()
  // A tile is a name like any other, so it opens the same profile. An empty slot and a
  // room joined before ids were carried have nobody to open.
  const profileId = isNonEmptyString(userId) ? userId : null

  if (nickname === undefined) {
    return (
      <View style={{ width: '48%' }}>
        <View
          className="h-24 items-center justify-center rounded-2xl border-2 border-dashed"
          style={{ borderColor: DIM_INK[colorScheme] + '33' }}
        >
          <View className="h-2 w-2 animate-pulse rounded-full bg-dim" />
          <Text
            selectable={false}
            className="mt-2 font-mono text-[9px] font-bold tracking-[2px] text-dim"
          >
            <Trans>WAITING</Trans>
          </Text>
        </View>
      </View>
    )
  }

  const you = t(msg`YOU`)
  const initial = nickname.trim().charAt(0).toUpperCase() || '?'
  // The board's crown and birds follow a player into a room: the same two ids answer it
  // here, so a champion is recognisable wherever their name is drawn.
  const mark = championMark(userId ?? null, champions)
  // Medals only: a room can end with four or five players, and the board's mark for
  // last place is a joke about missing the cut, which does not apply here.
  const medal = rank === undefined ? null : rankMedal(rank)
  const cornerLabel = medal !== null ? null : chipLabel({ rank, isHost, isMe, you })

  return (
    <Pressable
      style={{ width: '48%' }}
      onPress={
        profileId === null
          ? undefined
          : () => {
              openProfile(profileId)
            }
      }
      disabled={profileId === null}
    >
      <LinearGradient
        colors={[gradient[0], gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="h-24 justify-between rounded-2xl p-3"
        style={[
          tileShadow,
          isMe ? { borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' } : undefined,
        ]}
      >
        <View className="flex-row items-center justify-between">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <Text
              selectable={false}
              className="font-mono text-[15px] font-black"
              style={{ color: WHITE }}
            >
              {initial}
            </Text>
          </View>
          {medal !== null ? (
            <Text selectable={false} style={{ fontSize: 22 }}>
              {medal}
            </Text>
          ) : (
            cornerLabel !== null && <Chip label={cornerLabel} />
          )}
        </View>

        <View className="flex-row items-end justify-between gap-1">
          <Text
            selectable={false}
            numberOfLines={1}
            className="flex-1 font-mono text-[13px] font-black tracking-[0.5px]"
            style={{ color: WHITE }}
          >
            {mark === null ? nickname : `${mark} ${nickname}`}
          </Text>
          {score !== undefined && (
            <View className="flex-row items-center gap-1">
              <Text
                selectable={false}
                className="font-mono text-[14px] font-black tracking-[0.5px]"
                style={{ color: WHITE }}
              >
                {score}
              </Text>
              {ready && <AntDesign name="check" size={12} color={WHITE} />}
            </View>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  )
}
