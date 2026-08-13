import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRef } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'

import { MenuButton } from '@/components/game/menu-button'
import { GAME_SCALE } from '@/constants/colors'
import { TIPS } from '@/constants/tips'
import { useTheme } from '@/hooks/use-theme'
import { MODE_DESCRIPTIONS, MODE_GRADIENT, MODES, type Mode } from '@/machines/game'

// The cell weights, row-major: value × (row+1) × (col+1). Mirrors computeSum.
const WEIGHTS = [
  [1, 2, 3],
  [2, 4, 6],
  [3, 6, 9],
]

type IoniconName = keyof typeof Ionicons.glyphMap

// The guide's sections, in the order they appear. One table drives both the contents
// list at the top and the headers down the page, so a section can never be listed and
// missing — or present and unlisted. Colours step along the game scale.
const SECTIONS = {
  goal: { icon: 'flag', title: 'THE GOAL', color: GAME_SCALE[0] },
  controls: { icon: 'hand-left', title: 'CONTROLS', color: GAME_SCALE[1] },
  targets: { icon: 'timer', title: 'TARGETS & THE CLOCK', color: GAME_SCALE[1] },
  modes: { icon: 'grid', title: 'MODES', color: GAME_SCALE[2] },
  multiplayer: { icon: 'people', title: 'MULTIPLAYER', color: GAME_SCALE[3] },
  tips: { icon: 'bulb', title: 'TIPS & TRICKS', color: GAME_SCALE[4] },
} as const satisfies Record<string, { icon: IoniconName; title: string; color: string }>

type SectionKey = keyof typeof SECTIONS

// What each mode asks of you, in one mark: Trainee teaches, Accuracy is about landing
// on the spot, Speed is about the clock. They sit where the hearts used to — a life
// count says nothing about a mode that a card full of facts doesn't already say, and
// multiplayer runs these same two modes with no lives at all.
const MODE_ICONS = {
  trainee: 'school',
  accuracy: 'locate',
  speed: 'flash',
} as const satisfies Record<Mode, IoniconName>

const SECTION_ORDER = [
  'goal',
  'controls',
  'targets',
  'modes',
  'multiplayer',
  'tips',
] as const satisfies readonly SectionKey[]

// ── Reusable building blocks ────────────────────────────────────────────────

function SectionHeader({
  section,
  onMeasure,
}: {
  section: SectionKey
  // Reports where this header sits inside the scroll content, so the contents list
  // can jump to it. Measured rather than estimated: the sections are prose and their
  // heights move with every copy edit.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { icon, title, color } = SECTIONS[section]
  return (
    <View
      className="mb-3 mt-8 flex-row items-center gap-2.5"
      onLayout={(e) => {
        onMeasure(section, e.nativeEvent.layout.y)
      }}
    >
      <View
        className="h-7 w-7 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}26` }}
      >
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text
        selectable={false}
        className="font-mono text-[15px] font-black tracking-[2px] text-primary"
      >
        {title}
      </Text>
    </View>
  )
}

// What the guide covers, in order, straight under the title — so a player sees the
// shape of it before scrolling and knows the multiplayer part exists at all. Set inline
// and wrapping rather than stacked: six titles down the page would push the guide
// itself below the fold, which is the opposite of what a contents list is for.
//
// Each entry carries its section's icon and colour — the same pair its header wears
// further down, so the list reads as the page in miniature and a title is recognised
// again on arrival. The icons also do the separating that dots used to, one mark at
// the start of every entry, so nothing sits between them but space.
function Contents({ onJump }: { onJump: (section: SectionKey) => void }) {
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-x-3.5 gap-y-2">
      {SECTION_ORDER.map((key) => (
        <Pressable
          key={key}
          onPress={() => {
            onJump(key)
          }}
          hitSlop={8}
          className="flex-row items-center gap-1.5"
        >
          <Ionicons name={SECTIONS[key].icon} size={11} color={SECTIONS[key].color} />
          <Text
            selectable={false}
            className="font-mono text-[10px] font-bold tracking-[1.5px]"
            style={{ color: SECTIONS[key].color }}
          >
            {SECTIONS[key].title}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

// Primary, not dim: this is the one screen a player reads rather than glances at, and
// paragraphs of dim text at 12px asked too much of them. Dim stays for the labels and
// captions around the graphics, where it separates aside from prose.
function Body({ children }: { children: string }) {
  return (
    <Text
      selectable={false}
      className="font-mono text-[12px] font-medium leading-[19px] text-primary"
    >
      {children}
    </Text>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <View className="mt-3 rounded-2xl bg-card p-4">{children}</View>
}

function Bullet({ color, children }: { color: string; children: string }) {
  return (
    <View className="mt-2.5 flex-row gap-2.5">
      <View
        className="mt-[6px] h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Text
        selectable={false}
        className="flex-1 font-mono text-[12px] font-medium leading-[19px] text-primary"
      >
        {children}
      </Text>
    </View>
  )
}

// ── Graphics ────────────────────────────────────────────────────────────────

// The 3×3 grid of cell weights with row / column order headers, so it reads as
// weight = row order × column order (bottom-right ×9 is the coarsest knob).
function WeightGrid() {
  const ORDER = ['1', '2', '3']
  const header = (label: string) => (
    <Text
      selectable={false}
      className="font-mono text-[11px] font-black tracking-[0.5px] text-dim"
    >
      {label}
    </Text>
  )
  return (
    <View className="items-center">
      {/* Column-order headers (left-padded to clear the row-header column). */}
      <View className="mb-2 flex-row items-center gap-2">
        <View className="w-12 items-center">{header('R×C')}</View>
        {ORDER.map((n) => (
          <View key={n} className="w-14 items-center">
            {header(`COL ${n}`)}
          </View>
        ))}
      </View>

      {WEIGHTS.map((row, r) => (
        <View key={r} className="mb-2 flex-row items-center gap-2">
          <View className="w-12 items-center">{header(`ROW ${ORDER[r] ?? ''}`)}</View>
          {row.map((w, c) => {
            const t = w / 9
            return (
              <View
                key={c}
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: `rgba(114,115,210,${0.14 + t * 0.6})` }}
              >
                <Text
                  selectable={false}
                  className="font-mono text-[16px] font-black"
                  style={{ color: t > 0.55 ? '#FFFFFF' : '#3A3760' }}
                >
                  {w}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
      <Text
        selectable={false}
        className="mt-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        WEIGHT = ROW ORDER × COLUMN ORDER
      </Text>
    </View>
  )
}

// A single dial button surrounded by its gesture hints.
function ControlsDiagram() {
  const hint = (label: string) => (
    <Text
      selectable={false}
      className="font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
    >
      {label}
    </Text>
  )
  return (
    <View className="items-center py-1">
      {/* Tap takes the slot swipe up used to hold — it is the gesture that does that
          job, and one label per direction keeps the diagram readable. */}
      {hint('TAP  +1')}
      <View className="my-1.5 flex-row items-center gap-3">
        {hint('◀ SET 0')}
        <View className="h-16 w-16 items-center justify-center rounded-full bg-strong">
          <Text
            selectable={false}
            className="font-mono text-[26px] font-medium text-on-strong"
          >
            5
          </Text>
        </View>
        {hint('SET 9 ▶')}
      </View>
      {hint('SWIPE DOWN  −1')}
    </View>
  )
}

function ModeCard({ mode, facts }: { mode: Mode; facts: string[] }) {
  const [from, to] = MODE_GRADIENT[mode]
  const [line1, line2] = MODE_DESCRIPTIONS[mode].split('\n')
  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-card">
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="flex-row items-center justify-between px-4 py-2.5"
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          {MODES[mode].label}
        </Text>
        <Ionicons name={MODE_ICONS[mode]} size={15} color="#FFFFFF" />
      </LinearGradient>
      <View className="px-4 pb-3 pt-2.5">
        <Text
          selectable={false}
          className="mb-1 font-mono text-[11px] font-bold italic tracking-[0.5px] text-dim"
        >
          {line1?.trim()} {line2?.trim()}
        </Text>
        {facts.map((f) => (
          <Bullet key={f} color={from}>
            {f}
          </Bullet>
        ))}
      </View>
    </View>
  )
}

// ── Overlay ─────────────────────────────────────────────────────────────────

// A drag that starts within this much of the left edge and pulls right closes the
// guide — the back gesture every mobile browser has trained into the thumb. The
// origin is what makes it safe: a horizontal drag anywhere else is ignored, so the
// gesture cannot fire while someone is reading. Measured from where the finger
// landed rather than where it ended, which is why the check subtracts the travel.
const EDGE_ZONE = 32
const CLOSE_DISTANCE = 80
const CLOSE_VELOCITY = 800

// A jumped-to header lands this far below the top edge rather than flush against it,
// so it reads as a heading with a page under it instead of a cropped line.
const JUMP_MARGIN = 20

export function HowToPlayOverlay({ onClose }: { onClose: () => void }) {
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'

  const scrollRef = useRef<ScrollView>(null)
  // Filled by each header as it lays out. A ref, not state: these positions are read
  // on a tap and never rendered, so storing them in state would re-render the whole
  // guide six times on mount for nothing.
  const offsets = useRef<Partial<Record<SectionKey, number>>>({})

  const measure = (section: SectionKey, y: number) => {
    offsets.current[section] = y
  }

  const jump = (section: SectionKey) => {
    const y = offsets.current[section]
    // Nothing measured yet — the tap came before layout, so there is nowhere to go.
    if (y === undefined) return
    scrollRef.current?.scrollTo({ y: Math.max(0, y - JUMP_MARGIN), animated: true })
  }

  // activeOffsetX waits for real horizontal intent; failOffsetY hands the touch back
  // to the ScrollView the moment it turns into a scroll, so reading still works.
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX(24)
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet'
      if (e.absoluteX - e.translationX > EDGE_ZONE) return
      if (e.translationX < CLOSE_DISTANCE && e.velocityX < CLOSE_VELOCITY) return
      scheduleOnRN(onClose)
    })

  return (
    <GestureDetector gesture={edgeSwipe}>
      <View className="absolute inset-0 bg-surface">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 64,
            paddingBottom: 56,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text
            selectable={false}
            className="font-mono text-[22px] font-black tracking-[3px] text-primary"
          >
            HOW TO PLAY
          </Text>
          <Text
            selectable={false}
            className="mt-1 font-mono text-[11px] font-bold tracking-[1px] text-dim"
          >
            DIAL THE GRID · MATCH THE NUMBER
          </Text>

          <Contents onJump={jump} />

          {/* Goal */}
          <SectionHeader section="goal" onMeasure={measure} />
          <Body>
            {
              'A glowing target number floats onto the board. Turn the nine dial buttons so the whole grid adds up to exactly that number, and the target pops — a hit.\n\nEvery button holds a digit 0–9, but where it sits decides how much it counts. Each button’s weight is its row order × its column order — rows numbered 1–3 top to bottom, columns 1–3 left to right — so it adds row × column × value to the total.'
            }
          </Body>
          <Card>
            <WeightGrid />
          </Card>
          <Body>
            {
              '\nSo the bottom-right button (row 3 × column 3 = 9) moves the total in big leaps, while the top-left (1 × 1 = 1) nudges it by exactly its digit — perfect for fine-tuning the last few points.'
            }
          </Body>

          {/* Controls */}
          <SectionHeader section="controls" onMeasure={measure} />
          <Card>
            <ControlsDiagram />
          </Card>
          <Body>
            {
              '\nTap to count up — 9 wraps back to 0 — swipe down to step back one, and swipe left or right to jump straight to 0 or 9. Tip: turn on “Show sum in buttons” under Options to see each button’s live contribution.'
            }
          </Body>

          {/* Targets & clock */}
          <SectionHeader section="targets" onMeasure={measure} />
          <Body>
            {
              'Each target carries a shrinking ring — its countdown. Land the sum before the ring empties. The colour behind the ring tells you the target’s hundreds at a glance: plain grey under 100, violet in the 100s, rose in the 200s, amber in the 300s — so 223 never passes for 123. Several targets can share the board at once (up to 3, or 4 on Extreme), and new ones keep arriving, so pick your order wisely. In Speed, each new target arrives with a slightly shorter ring than the last — the squeeze eases off as it goes, so a long run gets tighter without ever running away from you.'
            }
          </Body>

          {/* Modes — scoring and lives live here too: both only mean anything per
              mode, and as their own sections they repeated what the cards say. */}
          <SectionHeader section="modes" onMeasure={measure} />
          <Body>
            {
              'Same grid, different pressure. Difficulty (Easy / Hard / Extreme) tightens the clock and adds targets.\n\nA hit is worth up to 100 points, blended from two factors and weighted by the mode:'
            }
          </Body>
          <Card>
            <Bullet color={GAME_SCALE[0]}>
              Accuracy — how close to the fewest possible moves you were.
            </Bullet>
            <Bullet color={GAME_SCALE[3]}>
              Speed — how much time was left on the ring. Land it with most of the ring
              intact and it pays a bonus on top.
            </Bullet>
            <Bullet color={GAME_SCALE[4]}>
              Streak — consecutive perfect plays multiply your points ×2 → ×4 → ×8. One
              imperfect hit and you start again.
            </Bullet>
          </Card>
          <Body>
            {
              '\nAccuracy and Speed give you three hearts each, and lose one when a target’s ring runs out. All three gone ends the run. Trainee is unscored practice with unlimited lives, so take your time.'
            }
          </Body>
          <ModeCard
            mode="trainee"
            facts={[
              'Pure practice — no lives, no score, and a relaxed clock.',
              'Buttons show their weight and max, so you can learn the math.',
              'A coach line under the stat row says when a move was wasted, and what a hit cost.',
            ]}
          />
          <ModeCard
            mode="accuracy"
            facts={[
              'Score rewards precision: solve each target in the fewest moves.',
              'Waste too many moves on a hit (under 20% accuracy) and you lose a life.',
              'Let a target’s ring run out and you lose one too — precision still has a clock.',
              'Matching every target in its optimal move count builds your streak.',
            ]}
          />
          <ModeCard
            mode="speed"
            facts={[
              'A shorter clock — the sooner you hit, the more it scores.',
              'The clock keeps tightening as your run goes on, less and less each time.',
              'Hit while most of the ring is left to build your combo streak.',
              'A slow hit breaks the streak; let a target run out and you lose a life.',
            ]}
          />

          <Body>
            {
              '\nAccuracy leans almost entirely on precision; Speed on the clock. Each keeps its own streak: Accuracy wants the fewest moves, Speed wants you early on the ring.'
            }
          </Body>

          {/* Multiplayer */}
          <SectionHeader section="multiplayer" onMeasure={measure} />
          <Body>
            {
              'Pick “With friends” on the start screen. Create a game and share the four-digit code, or type a friend’s code to join. Two players are enough to start, and the one who created the room starts it.\n\nEveryone dials the same ten targets, one at a time, on their own grid. There are no lives — every target scores, and how it scores is the mode the host picked:'
            }
          </Body>
          {/* The same cards as the modes section, so a mode reads the same wherever
              it is met — only the badge and the facts change, because multiplayer
              keeps no lives and scores by rank rather than by points. */}
          <ModeCard
            mode="accuracy"
            facts={[
              'Ten seconds a target, the same one for everybody.',
              'Everyone who hits is ranked by how few moves it took.',
              'The best takes the most points; the last to land it takes none.',
            ]}
          />
          <ModeCard
            mode="speed"
            facts={[
              'Seven seconds a target — the clock everyone races.',
              'Only the first player to land it scores.',
              'One point, winner takes all — everyone else gets nothing.',
            ]}
          />
          <Body>
            {
              '\nAfter the tenth target everyone’s score goes up on one list. The host can pick a mode and deal another game to the same room, so nobody has to swap codes again.'
            }
          </Body>

          {/* Tips */}
          <SectionHeader section="tips" onMeasure={measure} />
          {/* Shared with the rotating panel in Trainee's menu slot — see
            constants/tips.ts. Editing there updates both. */}
          {TIPS.map((tip) => (
            <Bullet key={tip} color={SECTIONS.tips.color}>
              {tip}
            </Bullet>
          ))}

          {/* Done */}
          <Pressable
            onPress={onClose}
            className="mt-10 items-center self-center rounded-2xl bg-strong py-4"
            style={{ width: 224 }}
          >
            <Text
              selectable={false}
              className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
            >
              GOT IT
            </Text>
          </Pressable>
        </ScrollView>

        {/* Close — same 5-dot cross + CLOSE label and position as the pause menu. */}
        <MenuButton
          visible
          paused
          onToggle={onClose}
          color={dotColor}
          style={{ position: 'absolute', top: 12, right: 18, zIndex: 20 }}
        />
      </View>
    </GestureDetector>
  )
}
