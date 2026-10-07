import { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'

import { MenuButton } from '@/components/game/menu-button'
import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { ACHIEVEMENT_SCALE, GAME_SCALE, MUTED_INK } from '@/constants/colors'
import { TIPS } from '@/constants/tips'
import { useFlag } from '@/hooks/use-flags'
import {
  darkGradientOf,
  descriptionOf,
  gradientOf,
  labelOf,
  NINE_DIAL,
  weightRows,
  type Mode,
} from '@/modes'

// The weights the guide explains, laid out as the dial lays them out. Read off the board
// rather than copied here: the rule it prints — weight = row order × column order — is
// the board's own, and a second copy of the figures could drift from it.
const WEIGHTS = weightRows(NINE_DIAL)

type IoniconName = keyof typeof Ionicons.glyphMap

// The guide's sections, in the order they appear. One table drives both the contents
// list at the top and the headers down the page, so a section can never be listed and
// missing — or present and unlisted. Colours step along the game scale.
const SECTIONS = {
  goal: { icon: 'flag', title: msg`THE GOAL`, color: GAME_SCALE[0] },
  controls: { icon: 'hand-left', title: msg`CONTROLS`, color: GAME_SCALE[1] },
  targets: { icon: 'timer', title: msg`TARGETS & THE CLOCK`, color: GAME_SCALE[1] },
  modes: { icon: 'grid', title: msg`MODES`, color: GAME_SCALE[2] },
  champions: { icon: 'ribbon', title: msg`CHAMPIONS`, color: GAME_SCALE[2] },
  // The one section that steps off the game scale, because achievements are the one
  // reward that is not a place on a board — the green says so before the words do.
  achievements: { icon: 'trophy', title: msg`ACHIEVEMENTS`, color: ACHIEVEMENT_SCALE[3] },
  // Arcade's own amber, which is the last stop of the scale and the one the pill, the
  // hero and the lit way are all drawn in. Behind the `arcade` flag, like the chapter.
  arcade: { icon: 'git-network', title: msg`ARCADE`, color: GAME_SCALE[4] },
  multiplayer: { icon: 'people', title: msg`MULTIPLAYER`, color: GAME_SCALE[3] },
  tips: { icon: 'bulb', title: msg`TIPS & TRICKS`, color: GAME_SCALE[4] },
} as const satisfies Record<
  string,
  { icon: IoniconName; title: MessageDescriptor; color: string }
>

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

const ALL_SECTIONS = [
  'goal',
  'controls',
  'targets',
  'modes',
  'arcade',
  'champions',
  'achievements',
  'multiplayer',
  'tips',
] as const satisfies readonly SectionKey[]

// What the guide actually offers. Multiplayer and arcade each leave with the door that
// leads to them — a chapter telling a player to pick something the intro does not show is
// the guide being wrong, which is worse than the guide being short. Filtered in one place
// so the contents list and the page below it cannot disagree about what is here.
//
// A function rather than the constant it used to be: what the guide offers now depends on
// the reader's role, which is not known when this module is loaded.
function sectionOrder(
  showMultiplayer: boolean,
  showArcade: boolean,
): readonly SectionKey[] {
  return ALL_SECTIONS.filter((key) => {
    if (key === 'multiplayer') return showMultiplayer
    if (key === 'arcade') return showArcade
    return true
  })
}

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
  const { t } = useLingui()
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
        {t(title)}
      </Text>
    </View>
  )
}

// What the guide covers, in order, straight under the title — so a player sees the
// shape of it before scrolling and knows how far down the page goes. Set inline
// and wrapping rather than stacked: six titles down the page would push the guide
// itself below the fold, which is the opposite of what a contents list is for.
//
// Each entry carries its section's icon and colour — the same pair its header wears
// further down, so the list reads as the page in miniature and a title is recognised
// again on arrival. The icons also do the separating that dots used to, one mark at
// the start of every entry, so nothing sits between them but space.
function Contents({
  sections,
  onJump,
}: {
  // Handed down rather than worked out again here, so the list and the page below it
  // are filtered by one decision instead of two that agree until they don't.
  sections: readonly SectionKey[]
  onJump: (section: SectionKey) => void
}) {
  const { t } = useLingui()
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-x-3.5 gap-y-2">
      {sections.map((key) => (
        <TrackedPressable
          id="how_to_play.page"
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
            {t(SECTIONS[key].title)}
          </Text>
        </TrackedPressable>
      ))}
    </View>
  )
}

// Primary, not dim: this is the one screen a player reads rather than glances at, and
// paragraphs of dim text at 12px asked too much of them. Dim stays for the labels and
// captions around the graphics, where it separates aside from prose.
function Body({ children }: { children: ReactNode }) {
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

function Bullet({ color, children }: { color: string; children: ReactNode }) {
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

// The offer to stop reading and play, straight under the contents list. It wears
// Trainee's CTA gradient because that is the board it lands on, and it says what the
// tutorial takes off that board instead of repeating what the label already says.
//
// A row rather than the centred block it used to be: at the top of a page it has to
// hold its own against the title above it, so it takes the full width, puts the mark
// of a run on the left and the arrow out of the page on the right, and carries its own
// caption inside rather than hanging one underneath.
function TryItButton({ onPress }: { onPress: () => void }) {
  return (
    <TrackedPressable
      id="how_to_play.try_it"
      onPress={onPress}
      className="mt-5 overflow-hidden rounded-2xl"
    >
      <LinearGradient
        colors={[...darkGradientOf('trainee')]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="flex-row items-center gap-3 px-4 py-3.5"
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
        >
          <Ionicons name="play" size={15} color="#FFFFFF" />
        </View>
        <View className="flex-1">
          <Text
            selectable={false}
            className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
          >
            <Trans>TRY IT</Trans>
          </Text>
          {/* The one caption that cannot be text-dim: it sits on the gradient, not on
              the page, so it takes a thinned white instead of the page's grey. */}
          <Text
            selectable={false}
            className="mt-1 font-mono text-[9px] font-bold tracking-[1.5px]"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <Trans>ONE TARGET · NO CLOCK · NO LIVES</Trans>
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
      </LinearGradient>
    </TrackedPressable>
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
        <Trans>WEIGHT = ROW ORDER × COLUMN ORDER</Trans>
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
  const { t } = useLingui()
  const [from, to] = gradientOf(mode)
  const [line1, line2] = t(descriptionOf(mode)).split('\n')
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
          {t(labelOf(mode))}
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

export function HowToPlayOverlay({
  onClose,
  onTryTutorial,
}: {
  onClose: () => void
  // Deals the tutorial and closes the guide. The run a first launch opens on, and this
  // is the only other door to it — see constants/tutorial.ts.
  onTryTutorial: () => void
}) {
  const { t } = useLingui()

  // Read once and used twice — by the contents list and by the chapter itself — so the
  // list cannot offer a jump to a section that is not on the page.
  const showMultiplayer = useFlag('multiplayer')
  const showArcade = useFlag('arcade')
  const sections = useMemo(
    () => sectionOrder(showMultiplayer, showArcade),
    [showMultiplayer, showArcade],
  )

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
      <ScreenLayer>
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
            <Trans>HOW TO PLAY</Trans>
          </Text>
          <Text
            selectable={false}
            className="mt-1 font-mono text-[11px] font-bold tracking-[1px] text-dim"
          >
            <Trans>DIAL THE GRID · MATCH THE NUMBER</Trans>
          </Text>

          <Contents sections={sections} onJump={jump} />

          <TryItButton onPress={onTryTutorial} />

          {/* Goal */}
          <SectionHeader section="goal" onMeasure={measure} />
          <Body>
            {t`A glowing target number floats onto the board. Turn the nine dial buttons so the whole grid adds up to exactly that number, and the target pops — a hit.\n\nEvery button holds a digit 0–9, but where it sits decides how much it counts. Each button’s weight is its row order × its column order — rows numbered 1–3 top to bottom, columns 1–3 left to right — so it adds row × column × value to the total.`}
          </Body>
          <Card>
            <WeightGrid />
          </Card>
          <Body>
            {t`\nSo the bottom-right button (row 3 × column 3 = 9) moves the total in big leaps, while the top-left (1 × 1 = 1) nudges it by exactly its digit — perfect for fine-tuning the last few points.`}
          </Body>

          {/* Controls */}
          <SectionHeader section="controls" onMeasure={measure} />
          <Card>
            <ControlsDiagram />
          </Card>
          <Body>
            {t`\nTap to count up — 9 wraps back to 0 — swipe down to step back one, and swipe left or right to jump straight to 0 or 9.\n\nYou can keep going without lifting your finger. Drag across the dial and each button takes the direction you leave it by, so one sweep right along a row sets all three to 9. Change your mind on a button and only the way you leave it counts, and a button only answers to a finger that really crosses it — so brushing the edge of its neighbour on the way past costs you nothing. Tip: turn on “Show sum in buttons” under Options to see each button’s live contribution.`}
          </Body>

          {/* Targets & clock */}
          <SectionHeader section="targets" onMeasure={measure} />
          <Body>
            {t`Each target carries a shrinking ring — its countdown. Land the sum before the ring empties. The colour behind the ring tells you the target’s hundreds at a glance: plain grey under 100, violet in the 100s, rose in the 200s, amber in the 300s — so 223 never passes for 123. Several targets can share the board at once (up to 3, or 4 on Extreme), and new ones keep arriving, so pick your order wisely. Both scored modes tighten as you go, in opposite ways. In Speed each new target arrives with a slightly shorter ring than the last. In Accuracy the ring never shrinks — you always get the full time to think — but targets start arriving closer together, so the board fills up around you. Either squeeze eases off as it goes, so a long run gets harder without ever running away from you.`}
          </Body>

          {/* Modes — scoring and lives live here too: both only mean anything per
              mode, and as their own sections they repeated what the cards say. */}
          <SectionHeader section="modes" onMeasure={measure} />
          <Body>
            {t`Same grid, different pressure. Difficulty (Easy / Hard / Extreme) tightens the clock and adds targets.\n\nA hit is worth up to 100 points, blended from two factors and weighted by the mode:`}
          </Body>
          <Card>
            <Bullet color={GAME_SCALE[0]}>
              <Trans>Accuracy — how close to the fewest possible moves you were.</Trans>
            </Bullet>
            <Bullet color={GAME_SCALE[3]}>
              <Trans>
                Speed — how much time was left on the ring. Land it with most of the ring
                intact and it pays a bonus on top.
              </Trans>
            </Bullet>
            <Bullet color={GAME_SCALE[4]}>
              <Trans>
                Streak — consecutive perfect plays multiply your points ×2 → ×4 → ×8. One
                imperfect hit and you start again.
              </Trans>
            </Bullet>
          </Card>
          <Body>
            {t`\nAccuracy and Speed give you three hearts each, and lose one when a target’s ring runs out. All three gone ends the run. Trainee is unscored practice with unlimited lives, so take your time.`}
          </Body>
          <ModeCard
            mode="trainee"
            facts={[
              t`Pure practice — no lives, no score, and a relaxed clock.`,
              t`Buttons can show their weight, their ceiling, and what each is giving right now — pick which from MENU during a run.`,
              t`A coach line says when a move was wasted, and what a hit cost.`,
              t`Your hit count, the last hit’s accuracy and speed, the fewest moves each target needs, and the route you should have pressed — all off until you switch them on from MENU.`,
            ]}
          />
          <ModeCard
            mode="accuracy"
            facts={[
              t`Score rewards precision: solve each target in the fewest moves.`,
              t`Waste too many moves on a hit and you lose a life — the bar is 25% accuracy on Easy, 20% on Hard, 15% on Extreme.`,
              t`Let a target’s ring run out and you lose one too — precision still has a clock.`,
              t`Matching every target in its optimal move count builds your streak.`,
              t`Targets arrive faster the longer you last, but each still gets its full ring.`,
            ]}
          />
          <ModeCard
            mode="speed"
            facts={[
              t`A shorter clock — the sooner you hit, the more it scores.`,
              t`The clock keeps tightening as your run goes on, less and less each time.`,
              t`Hit while most of the ring is left to build your combo streak.`,
              t`A slow hit breaks the streak; let a target run out and you lose a life.`,
            ]}
          />

          <Body>
            {t`\nAccuracy leans almost entirely on precision; Speed on the clock. Each keeps its own streak: Accuracy wants the fewest moves, Speed wants you early on the ring.`}
          </Body>

          {/* Arcade. Gone with the pill that leads to it — see the arcade flag in
              constants/features.ts. */}
          {showArcade && (
            <>
              <SectionHeader section="arcade" onMeasure={measure} />
              <Body>
                {t`Pick ARCADE on the start screen. The dial is the same dial — but the targets are not scattered any more. Two to four of them hang at the ends of ways out of the crossroad you are standing on, and the one you dial is the one you walk.`}
              </Body>
              <Card>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Dial any target at the crossroad and you take that way. The ways you
                    refused wither behind you.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Every village holds out for its own length of time, and the ring
                    inside its wall is what is left of it. They are not the same: the one
                    you want may be the one about to go.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    A village whose ring runs out withers off the fan and stops answering
                    the dial. The others stay — you are only dragged back when the last of
                    them gives up, which is what the red creeping along the way behind you
                    is counting down to.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Answer while most of that clock is still full and you strike: the hero
                    does not stop at the next crossroad, it rockets through and lands one
                    deeper.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    When the red reaches you it drags you back one crossroad — and the
                    ways you find there are the ones you left.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Get dragged back off the first crossroad and you fall into the mouth,
                    and the run is over.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Every target is a village with a name, and the country between them is
                    drawn as you climb: farmland, then forest, then hills, then mountains.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    The map turns as you walk, to keep you pointed forward. Tap the
                    compass in the corner if you would rather north stayed at the top of
                    the screen — it remembers whichever you chose.
                  </Trans>
                </Bullet>
              </Card>
              {/* The siege. Three things a player cannot safely find out by playing:
                  that a wall is a fight, that a tower is chipped by arriving at its
                  number rather than sitting on it, and that a walled village is the only
                  food on the map — which is what turns the fight from a risk worth
                  avoiding into the thing a hungry run has to walk toward. */}
              <Body>
                {t`\nSome villages have walls, and you can see which before you choose — a walled village is drawn heavier, with bigger towers and a pennant flying from its wall. Dial that way and you do not walk in. You take it. Three hearts sit on the bar under ARCADE, and a siege is the fastest way to spend them — and the only way to get one back.`}
              </Body>
              <Card>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    The hero halts well short of the gate, with the walls across the top
                    of the screen and open ground between. Every tower on them carries a
                    number, and so does every warrior who comes out of the gate.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    A tower takes several hits — more of them the deeper you are — and a
                    hit means arriving at its number. Every hit it survives it takes a new
                    number, so a tower is several journeys across the dial rather than one
                    answer found and then repeated.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Warriors leave the gate one after another, and faster the longer the
                    fight drags on. Dial a warrior’s number and he is gone. Let one reach
                    you and it costs a heart. There is no way out of a siege but winning
                    it, so look at the walls before you dial that way.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Flatten every tower and the village is yours — the walls come down, a
                    heart comes back, up to three again, and you eat your fill.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Out of hearts and the run is over. That and the mouth are the only two
                    ways one ends.
                  </Trans>
                </Bullet>
              </Card>
              {/* Satiety. The one rule a player cannot read off the screen: that the bar
                  is spent by *walking* rather than by time, and that how well a crossroad
                  was answered is what decides the size of the bite. Everything else about
                  it — that it is low, that it is red, that a heart just went — the bar
                  says for itself. */}
              <Body>
                {t`\nThe hero eats. The bar beside the hearts is how fed they are, and every way you walk takes a bite out of it — a smaller bite the fewer moves you took to dial the target, so the tidy route is the one that keeps you fed. Getting dragged back costs the largest bite there is.`}
              </Body>
              <Card>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    A walled village is the only food on the map. Take one and the bar
                    goes back to full — which is why a hungry run has to go looking for a
                    fight rather than away from one.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    The fight itself costs nothing to stand in. Dialling at towers and
                    warriors leaves the bar exactly where it was when the walls closed.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Empty the bar and it turns red and starts to pulse: you are starving,
                    and a heart goes every five seconds until you eat.
                  </Trans>
                </Bullet>
                <Bullet color={GAME_SCALE[4]}>
                  <Trans>
                    Starving stops nothing else. The clock still runs, the dial still
                    listens and the ways are still there — so an empty bar is a reason to
                    hurry toward walls, not a reason the run is over.
                  </Trans>
                </Bullet>
              </Card>
              <Body>
                {t`\nHow deep you got is the whole score: every way costs about the same number of moves, so what you are choosing is where to go, not what is cheaper. Villages taken is counted beside it on the cards, but it is a tally rather than points. There is no difficulty to pick — the clock tightens the deeper you climb, which is the only one the mode has.`}
              </Body>
            </>
          )}

          {/* Champions — the marks the boards hand out, explained where a player who
              has just seen one on a row will look for them. */}
          <SectionHeader section="champions" onMeasure={measure} />
          <Body>
            {t`Hold the all-time record on a mode’s Extreme board and you carry its mark. It travels with your name everywhere it is drawn — the boards, your own row, a multiplayer room — so the hardest boards say who holds them without anyone having to look them up.`}
          </Body>
          <Card>
            <Bullet color={gradientOf('accuracy')[0]}>
              <Trans>
                🦉 The owl is Accuracy at its hardest. That board rewards the exact route,
                and the owl is the eye that finds it.
              </Trans>
            </Bullet>
            <Bullet color={gradientOf('speed')[0]}>
              <Trans>
                🦅 The eagle is Speed at its hardest, for the dive rather than the search.
              </Trans>
            </Bullet>
            <Bullet color={GAME_SCALE[4]}>
              <Trans>
                👑 The crown is both at once — the rarest thing in the game, and the only
                way to wear one mark instead of two.
              </Trans>
            </Bullet>
          </Card>
          <Body>
            {t`\nA mark is only ever lent. Take somebody’s record and it moves to you; lose yours and it leaves with the board.`}
          </Body>

          {/* Achievements — straight after the marks, because the sentence above ends
              on "only ever lent" and this is the opposite kind of reward. */}
          <SectionHeader section="achievements" onMeasure={measure} />
          <Body>
            {t`Achievements are the other kind. Nothing can take one back: they are achieved once and yours for good, and they are measured against you rather than against anybody else — so they are there to be collected whether or not your score is ever good enough for a board.\n\nThere are dozens, and they ask for all sorts of things.`}
          </Body>
          <Card>
            <Bullet color={ACHIEVEMENT_SCALE[3]}>
              <Trans>
                Scores, one ladder per mode — Accuracy and Speed ask for opposite things,
                so each has its own rungs to climb.
              </Trans>
            </Bullet>
            <Bullet color={ACHIEVEMENT_SCALE[3]}>
              <Trans>
                Skill inside a single run: a long streak, the top multiplier, a stretch
                without losing a life.
              </Trans>
            </Bullet>
            <Bullet color={ACHIEVEMENT_SCALE[3]}>
              <Trans>
                Sticking with it — targets landed across every run you have ever played,
                and days played in a row.
              </Trans>
            </Bullet>
            <Bullet color={ACHIEVEMENT_SCALE[3]}>
              <Trans>A stack of them nobody is told about until they happen.</Trans>
            </Bullet>
          </Card>
          <Body>
            {t`\nAchieve one mid-run and the score bar says so in green — tap that line and the run pauses so you can read what the achievement asked of you. Most are asked once per difficulty — Easy, Hard and Extreme count separately, and the list draws a bar for each. The whole list is behind the achievements line under NINE on the start screen, along with how far along you are on the ones you have not got yet.`}
          </Body>

          {/* Multiplayer. Gone with the tab that leads to it — see the multiplayer
              flag in constants/features.ts. */}
          {showMultiplayer && (
            <>
              <SectionHeader section="multiplayer" onMeasure={measure} />
              <Body>
                {t`Pick “With friends” on the start screen. Create a game and share the four-digit code, or type a friend’s code to join. Two players are enough to start, and the one who created the room starts it.\n\nEveryone dials the same ten targets, one at a time, on their own grid. There are no lives — every target scores, and how it scores is the mode the host picked:`}
              </Body>
              {/* The same cards as the modes section, so a mode reads the same wherever
              it is met — only the badge and the facts change, because multiplayer
              keeps no lives and scores by rank rather than by points. */}
              <ModeCard
                mode="accuracy"
                facts={[
                  t`Ten seconds a target, the same one for everybody.`,
                  t`Everyone who hits is ranked by how few moves it took.`,
                  t`The best takes the most points; the last to land it takes none.`,
                ]}
              />
              <ModeCard
                mode="speed"
                facts={[
                  t`Seven seconds a target — the clock everyone races.`,
                  t`Only the first player to land it scores.`,
                  t`One point, winner takes all — everyone else gets nothing.`,
                ]}
              />
              <Body>
                {t`\nAfter the tenth target everyone’s score goes up on one list. The host can pick a mode and deal another game to the same room, so nobody has to swap codes again.`}
              </Body>
            </>
          )}

          {/* Tips */}
          <SectionHeader section="tips" onMeasure={measure} />
          {/* Shared with the rotating panel in Trainee's menu slot — see
            constants/tips.ts. Editing there updates both. */}
          {TIPS.map((tip, i) => (
            <Bullet key={i} color={SECTIONS.tips.color}>
              {t(tip)}
            </Bullet>
          ))}

          {/* Done. The other way out — the offer to go and play — is at the top of the
              page now rather than under the last tip: a guide can be read, but the dial
              is what teaches it, and an offer nobody scrolls far enough to find is no
              offer at all. See TryItButton. */}
          <View className="mt-10 self-center" style={{ width: 224 }}>
            <TrackedPressable
              id="how_to_play.got_it"
              onPress={onClose}
              className="items-center rounded-2xl bg-strong py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
              >
                <Trans>GOT IT</Trans>
              </Text>
            </TrackedPressable>
          </View>
        </ScrollView>

        {/* Close — the same 5-dot cross + CLOSE label every dialog carries. */}
        <MenuButton
          onToggle={onClose}
          color={MUTED_INK}
          style={{ position: 'absolute', top: 12, right: 18, zIndex: 20 }}
        />
      </ScreenLayer>
    </GestureDetector>
  )
}
