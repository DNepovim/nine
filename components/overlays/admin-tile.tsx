import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import type { ComponentProps, ReactNode } from 'react'
import { Text, View } from 'react-native'

import { UnreadDot } from '@/components/overlays/unread-dot'
import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { MUTED_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The admin hub's tile, and the challenge gallery's — one square so the two grids read
// as one. Lifted out of `admin-overlay.tsx` when the gallery asked for the same shape.

// Tiles two to a row, in the order they were listed.
const pairs = <T,>(items: readonly T[]): T[][] =>
  items.reduce<T[][]>((rows, item, index) => {
    if (index % 2 === 0) rows.push([item])
    else rows[rows.length - 1]?.push(item)
    return rows
  }, [])

// A grid of tiles, two to a row. A lone last tile keeps its width by sharing the row with
// an empty square of the same shape.
export function TileGrid({ tiles }: { tiles: readonly ReactNode[] }) {
  return (
    <View className="gap-2.5">
      {pairs(tiles).map((row, index) => (
        <View key={index} className="flex-row gap-2.5">
          {row}
          {/* Sized as a tile is, not just `flex-1`: an empty view beside a square one
              does not split the row evenly, and the lone tile came out wider than the
              tiles above it. */}
          {row.length === 1 && <View className="aspect-square flex-1" />}
        </View>
      ))}
    </View>
  )
}

// One tile: a square, a name, and what is behind it.
//
// Square and two to a row, which is the shape that fits four doors on a phone without
// scrolling and gives each of them room for two lines of figures. A column of wide rows
// fitted three and pushed the fourth under the fold — and a hub you have to scroll is a
// hub that has stopped being a map.
//
// **No colour on it.** Each tile wore a bar of its section's own hue down the leading
// edge for a while. Four squares on one card stock with four words on them do not need
// telling apart by colour — the words do that — and the bar was the only thing on these
// screens asking a reader to learn a key. The gallery is the exception, and only in its
// own marks and names: a challenge *is* its colour everywhere else it appears.
//
// An icon over the name, in the muted ink, lighter than the name under it: a shape to
// find a door by before the word is read.
export function Tile({
  id = 'admin.section',
  icon,
  mark,
  label,
  heading,
  note,
  unread = 0,
  corner,
  wash,
  onPress,
}: {
  id?: ButtonId
  icon?: ComponentProps<typeof Ionicons>['name']
  // Drawn in place of `icon`. The gallery's caller asked for it: a challenge is found by
  // its own mark, in its own colour.
  mark?: ReactNode
  // The name, drawn in the hub's one title role and ink.
  label?: ReactNode
  // Drawn in place of `label`, for a name that brings its own ink — the gallery's
  // `ChallengeTitle`.
  heading?: ReactNode
  note: ReactNode
  // How many things behind this nobody has looked at. Nought draws no badge.
  unread?: number
  // A mark in the top corner instead of the badge: the gallery's live and planned dots.
  corner?: ReactNode
  // A diagonal gradient behind everything, top-left to bottom-right, in place of the plain
  // card. The gallery's caller asked for it: each challenge's tile starts in a pale shade
  // of its own colour and settles into the card colour every other tile wears.
  wash?: readonly [string, string]
  onPress: () => void
}) {
  return (
    <TrackedPressable
      id={id}
      onPress={onPress}
      // `aspect-square` rather than a height: the tiles are half the screen wide less the
      // gap, and a fixed height would be wrong on every display but the one it was typed
      // on.
      className="relative aspect-square flex-1 justify-between overflow-hidden rounded-2xl bg-card p-3"
    >
      {wash !== undefined && (
        <LinearGradient
          colors={[...wash]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          className="absolute inset-0"
        />
      )}
      <View className="gap-2">
        <View className="flex-row items-start justify-between">
          {mark ??
            (icon === undefined ? null : (
              <Ionicons name={icon} size={22} color={MUTED_INK} />
            ))}
          {corner ?? (unread > 0 && <UnreadDot count={unread} />)}
        </View>
        {/* `cardTitleSm` — the role for a card title where the card is a row rather than
            the whole screen, which is exactly what a tile is, and the largest role that
            fits. The ceiling is set by one word on one phone: CHALLENGES is ten
            characters, and a tile on a 320px display is 115px wide inside its padding, so
            14px at 1.5 tracking comes to about 99px and the 17px `cardTitle` to about
            122 — a wrapped CHALLEN/GES on the narrowest phone the app runs on. */}
        {heading ?? (
          <Text selectable={false} className={cn(TYPE.cardTitleSm, 'text-primary')}>
            {label}
          </Text>
        )}
      </View>
      <View>{note}</View>
    </TrackedPressable>
  )
}

// What a tile says under its name, one item to a line, in the one role the tiles share.
//
// `proseSm` — prose, a step down so the lines leave the name room to wrap — rather than a
// label or a hint role, and it is the right one for what these
// lines actually are: short phrases with figures in them, which is what prose carries a
// leading for. Here the line *is* the content: it is the reason to open the tile, or the
// reason not to.
//
// **A line per item rather than items joined by dots.** Three counts strung along one
// line with `·` between them wrapped wherever the tile's width happened to fall, so the
// second line began mid-item and a figure was parted from its word. One to a line, each
// held to one line, keeps every count beside the word it counts.
export function Note({ lines }: { lines: readonly ReactNode[] }) {
  return (
    <View>
      {lines.map((line, index) => (
        <Text
          key={index}
          selectable={false}
          numberOfLines={1}
          className={cn(TYPE.proseSm, 'text-dim')}
        >
          {line}
        </Text>
      ))}
    </View>
  )
}
