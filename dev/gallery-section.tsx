import { Pressable, Text, View } from 'react-native'

import { GalleryButton } from '@/dev/gallery-button'
import type { Entry } from '@/dev/gallery-entry'
import { cn } from '@/lib/cn'

// One folding section of the picker.
//
// Folded by default, and only one is open at a time. The list is seventeen sections deep,
// and left open they run to several screens of scrolling — which the headings make worse
// rather than better, since a heading that has scrolled off takes the meaning of every
// label under it with it (`short · three` says nothing without SCORE STRIP above it).
// Folded, the whole index fits in the column at once and the heading is always in view.
//
// The count sits in the header because it is what says whether a section is worth opening:
// GUIDE has one entry, GAME OVER has eleven.
export function GallerySection({
  title,
  items,
  open,
  shown,
  onToggle,
  onPress,
}: {
  title: string
  items: Entry[]
  open: boolean
  // The key of the screen currently on show, whether or not it came from in here. Marks
  // the heading of the section it did come from, so a fold closed over a screen still
  // says where that screen went.
  shown: string | null
  onToggle: () => void
  onPress: (entry: Entry) => void
}) {
  const holdsShown = items.some((entry) => entry.key === shown)

  return (
    <View className="gap-1.5">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-1.5 rounded-lg px-1 py-0.5"
      >
        <Text
          selectable={false}
          className={cn(
            'font-mono text-[10px] font-black',
            holdsShown ? 'text-primary' : 'text-dim',
          )}
        >
          {open ? '▾' : '▸'}
        </Text>
        <Text
          selectable={false}
          className={cn(
            'flex-1 font-mono text-[11px] font-black tracking-[1.5px]',
            holdsShown ? 'text-primary' : 'text-dim',
          )}
        >
          {title}
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold text-dim opacity-60"
        >
          {items.length}
        </Text>
      </Pressable>

      {open && (
        <View className="flex-row flex-wrap gap-1.5">
          {items.map((entry) => (
            <GalleryButton
              key={entry.key}
              label={entry.label}
              selected={entry.key === shown}
              onPress={() => {
                onPress(entry)
              }}
            />
          ))}
        </View>
      )}
    </View>
  )
}
