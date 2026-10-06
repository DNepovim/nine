import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { useArcadeDev } from '@/dev/arcade-dev-state'
import { GalleryButton } from '@/dev/gallery-button'

// The arcade dev tools, as one more section of the picker's list.
//
// They started out beside it — a second column, one either side of the phone, each with its
// own width, border and heading. Which cost the frame a couple of hundred pixels it was
// supposed to be centred in, and put the thing you press to open a siege further from the
// list of screens than either is from the game.
//
// Dressed as a tier rather than built out of `Tier` and `Section`, because the catalogue in
// gallery.tsx is a module-level constant and these eight buttons are live: what they do
// to, and whether they can be pressed at all, comes off a run in progress. The headings and
// the buttons are the picker's own, so it reads as one list either way.
//
// Unfolded, alone in the column: the other seventeen sections fold because a folded index
// fits on a desk at once, and the arcade rows are the opposite case — they are pressed in
// sequence while a fight is on screen, and only one fold is open at a time, so folding
// these would mean reopening one to reach the other mid-siege.
//
// Absent entirely with no run, rather than drawn greyed out with a line about how to get
// one: the way in — ARCADE on the intro, behind the `arcade` flag — is in the list above it,
// and a section of dead buttons is worth less than the space it takes.
//
// Bare English, like the rest of dev/: a surface behind `__DEV__` is folded out of a
// shipped build, so there is nothing here for a catalog to carry.

const DEPTH_STEPS = [1, 10, 24]
const HEARTS = [1, 2, 3]

// A section heading under the tier, minus the caret and the count — there is no fold to
// turn and nothing worth counting in a row of three.
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text
        selectable={false}
        className="px-1 font-mono text-[11px] font-black tracking-[1.5px] text-dim"
      >
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-1.5">{children}</View>
    </View>
  )
}

export function ArcadeSection() {
  const dev = useArcadeDev()
  if (dev === null) return null

  return (
    <View className="gap-1.5">
      {/* The tier's heading, with the run's four figures in the slot BAR and RUN put their
          condition in. Which is the same thing it is here: what has to be true for any of
          this to do anything, except that this one can say where the run actually stands. */}
      <View className="flex-row items-baseline gap-1.5 border-b border-muted pb-1">
        <Text
          selectable={false}
          className="font-mono text-[12px] font-black tracking-[2px] text-primary"
        >
          ARCADE
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          {`${dev.phase.toUpperCase()} · DEPTH ${dev.depth} · ${dev.hearts}♥`}
        </Text>
      </View>

      <Group title="SIEGE">
        <GalleryButton
          label="SIEGE NOW"
          disabled={!dev.canSiege}
          onPress={dev.actions.siegeNow}
        />
        <GalleryButton label="RAZE" disabled={!dev.inSiege} onPress={dev.actions.raze} />
      </Group>

      <Group title="DEPTH">
        {DEPTH_STEPS.map((steps) => (
          <GalleryButton
            key={steps}
            label={`+${steps}`}
            onPress={() => {
              dev.actions.deepenBy(steps)
            }}
          />
        ))}
      </Group>

      <Group title="HEARTS">
        {HEARTS.map((hearts) => (
          <GalleryButton
            key={hearts}
            label={`${hearts}♥`}
            onPress={() => {
              dev.actions.setHearts(hearts)
            }}
          />
        ))}
      </Group>

      {!dev.canSiege && !dev.inSiege && (
        // The one refusal worth explaining rather than greying out in silence: at the first
        // crossroad there is no way in for a besieged hero to be drawn on, and it would be
        // drawn falling into the mouth instead. +1 is the way out of it.
        <Text
          selectable={false}
          className="px-1 font-mono text-[8px] font-medium leading-3 tracking-[0.5px] text-dim"
        >
          SIEGE NOW needs a crossroad behind the hero, and a beat that is listening. Press
          +1 first.
        </Text>
      )}
    </View>
  )
}
