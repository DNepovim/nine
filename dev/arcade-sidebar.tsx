import { Pressable, ScrollView, Text, View } from 'react-native'

import { useArcadeDev } from '@/dev/arcade-dev-state'

// The arcade dev tools, on the desk beside the phone rather than inside it.
//
// Beside and not over, for the same reason the gallery's picker is: the thing being poked
// at is the screen, and a panel laid over it hides the half you are watching. A siege is
// four to six towers, three warriors and a camera 2.4× in — there is no spare room on that
// screen for a tool, and no moment during a fight when covering it would be welcome.
//
// Everything here is bare English. It is a developer surface behind `__DEV__`, folded out
// of a shipped build entirely, so there is nothing for a catalog to carry — see the same
// choice in dev/gallery.tsx.

// Wide enough for the two longest rows — the three depth steps, and the status line at its
// longest ("CLOSING · DEPTH 24 · 3♥"). Narrow enough to leave the frame its own room.
const WIDTH = 188

function DevButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-2 ${disabled ? 'bg-dim/20' : 'bg-strong'}`}
    >
      <Text
        selectable={false}
        className={`font-mono text-[10px] font-black tracking-[1px] ${
          disabled ? 'text-dim' : 'text-on-strong'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function ArcadeSidebar() {
  const dev = useArcadeDev()

  return (
    <View
      className="border-r border-dim/20 bg-card"
      style={{ width: WIDTH, paddingTop: 48 }}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>
        <Text
          selectable={false}
          className="mb-1 font-mono text-[13px] font-black tracking-[2px] text-primary"
        >
          ARCADE
        </Text>

        {dev === null ? (
          // Not an error and not a disabled panel: there is simply no run. Said plainly, so
          // a tool that looks dead is distinguishable from one that is.
          <Text
            selectable={false}
            className="font-mono text-[9px] font-medium leading-4 tracking-[0.5px] text-dim"
          >
            No run. Open ARCADE from the intro — the mode is behind the `arcade` flag.
          </Text>
        ) : (
          <>
            <Text
              selectable={false}
              className="mb-3 font-mono text-[9px] font-bold tracking-[1px] text-dim"
            >
              {`${dev.phase.toUpperCase()}\nDEPTH ${dev.depth} · ${dev.hearts}♥`}
            </Text>

            <View className="gap-2">
              <DevButton
                label="SIEGE NOW"
                onPress={dev.actions.siegeNow}
                disabled={!dev.canSiege}
              />
              <DevButton
                label="RAZE"
                onPress={dev.actions.raze}
                disabled={!dev.inSiege}
              />

              <Text
                selectable={false}
                className="mt-1 font-mono text-[8px] font-bold tracking-[1px] text-dim"
              >
                DEPTH
              </Text>
              <View className="flex-row gap-2">
                {[1, 10, 24].map((steps) => (
                  <DevButton
                    key={steps}
                    label={`+${steps}`}
                    onPress={() => {
                      dev.actions.deepenBy(steps)
                    }}
                  />
                ))}
              </View>

              <Text
                selectable={false}
                className="mt-1 font-mono text-[8px] font-bold tracking-[1px] text-dim"
              >
                HEARTS
              </Text>
              <View className="flex-row gap-2">
                {[1, 2, 3].map((hearts) => (
                  <DevButton
                    key={hearts}
                    label={`${hearts}♥`}
                    onPress={() => {
                      dev.actions.setHearts(hearts)
                    }}
                  />
                ))}
              </View>
            </View>

            {!dev.canSiege && !dev.inSiege && (
              // The one refusal worth explaining rather than greying out in silence: at the
              // first crossroad there is no way in for a besieged hero to be drawn on, and
              // it would be drawn falling into the mouth instead. +1 is the way out of it.
              <Text
                selectable={false}
                className="mt-3 font-mono text-[8px] font-medium leading-3 tracking-[0.5px] text-dim"
              >
                SIEGE NOW needs a crossroad behind the hero, and a beat that is listening.
                Press +1 first.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
