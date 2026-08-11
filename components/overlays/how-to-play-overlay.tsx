import { AntDesign, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { MenuButton } from '@/components/game/menu-button'
import { useTheme } from '@/hooks/use-theme'
import { MODE_DESCRIPTIONS, MODE_GRADIENT, MODES, type Mode } from '@/machines/game'

// The cell weights, row-major: value × (row+1) × (col+1). Mirrors computeSum.
const WEIGHTS = [
  [1, 2, 3],
  [2, 4, 6],
  [3, 6, 9],
]

const ACCENT = {
  goal: '#4C7EFF',
  controls: '#7273D2',
  modes: '#c36282',
  scoring: '#E5534B',
  lives: '#E5534B',
  tips: '#FF8C00',
} as const

type IoniconName = keyof typeof Ionicons.glyphMap

// ── Reusable building blocks ────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  color,
}: {
  icon: IoniconName
  title: string
  color: string
}) {
  return (
    <View className="mb-3 mt-8 flex-row items-center gap-2.5">
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

function Body({ children }: { children: string }) {
  return (
    <Text
      selectable={false}
      className="font-mono text-[12px] font-medium leading-[19px] text-dim"
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
      {hint('SWIPE UP  +1')}
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
      <Text
        selectable={false}
        className="mt-3 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        TAP = +1 (WRAPS 9 → 0)
      </Text>
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
        <View className="flex-row items-center gap-1">
          {MODES[mode].lives === Number.POSITIVE_INFINITY ? (
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1px] text-on-strong"
            >
              ∞ LIVES
            </Text>
          ) : (
            Array.from({ length: MODES[mode].lives }).map((_, i) => (
              <AntDesign key={i} name="heart" size={11} color="#FFFFFF" />
            ))
          )}
        </View>
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

export function HowToPlayOverlay({ onClose }: { onClose: () => void }) {
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'
  return (
    <View className="absolute inset-0 bg-surface">
      <ScrollView
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

        {/* Goal */}
        <SectionHeader icon="flag" title="THE GOAL" color={ACCENT.goal} />
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
        <SectionHeader icon="hand-left" title="CONTROLS" color={ACCENT.controls} />
        <Card>
          <ControlsDiagram />
        </Card>
        <Body>
          {
            '\nTap to count up, swipe up/down to step ±1, and swipe left or right to jump straight to 0 or 9. Tip: turn on “Show sum in buttons” under Options to see each button’s live contribution.'
          }
        </Body>

        {/* Targets & clock */}
        <SectionHeader icon="timer" title="TARGETS & THE CLOCK" color={ACCENT.controls} />
        <Body>
          {
            'Each target carries a shrinking ring — its countdown. Land the sum before the ring empties. Several targets can share the board at once (up to 3, or 4 on Extreme), and new ones keep arriving, so pick your order wisely. In Speed, each new target arrives with a slightly shorter ring than the last — the squeeze eases off as it goes, so a long run gets tighter without ever running away from you.'
          }
        </Body>

        {/* Modes */}
        <SectionHeader icon="grid" title="MODES" color={ACCENT.modes} />
        <Body>
          {
            'Same grid, different pressure. Difficulty (Easy / Hard / Extreme) tightens the clock and adds targets.'
          }
        </Body>
        <ModeCard
          mode="trainee"
          facts={[
            'Pure practice — no lives, no score, and a relaxed clock.',
            'Buttons show their weight and max, so you can learn the math.',
          ]}
        />
        <ModeCard
          mode="accuracy"
          facts={[
            'Score rewards precision: solve each target in the fewest moves.',
            'Waste too many moves on a hit (under 20% accuracy) and you lose a life.',
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

        {/* Scoring */}
        <SectionHeader icon="trophy" title="SCORING" color={ACCENT.scoring} />
        <Body>
          {
            'A hit is worth up to 100 points, blended from two factors and weighted by the mode:'
          }
        </Body>
        <Card>
          <Bullet color={ACCENT.goal}>
            Accuracy — how close to the fewest possible moves you were.
          </Bullet>
          <Bullet color={ACCENT.scoring}>
            Speed — how much time was left on the ring. Land it with most of the ring
            intact and it pays a bonus on top.
          </Bullet>
          <Bullet color="#FF8C00">
            Streak — consecutive perfect plays multiply your points ×2 → ×4 → ×8. One
            imperfect hit and you start again.
          </Bullet>
        </Card>
        <Body>
          {
            '\nAccuracy mode leans almost entirely on precision; Speed mode on the clock. Each keeps its own streak: Accuracy wants the fewest moves, Speed wants you early on the ring. Trainee is unscored practice.'
          }
        </Body>

        {/* Lives */}
        <SectionHeader icon="heart" title="LIVES" color={ACCENT.lives} />
        <Body>
          {
            'Accuracy and Speed give you three hearts. You lose one when a target’s ring runs out — and in Accuracy, also for a badly wasteful hit. Lose all three and it’s game over. Trainee has unlimited lives, so take your time.'
          }
        </Body>

        {/* Tips */}
        <SectionHeader icon="bulb" title="TIPS & TRICKS" color={ACCENT.tips} />
        <Bullet color={ACCENT.tips}>
          Set the coarse ×9 / ×6 buttons first to get near the target, then fine-tune with
          the ×1 / ×2 buttons.
        </Bullet>
        <Bullet color={ACCENT.tips}>
          Swipe to 0 or 9 to reset a button in a single gesture instead of tapping
          through.
        </Bullet>
        <Bullet color={ACCENT.tips}>
          In Accuracy, plan your route before you touch anything — every extra move costs
          you.
        </Bullet>
        <Bullet color={ACCENT.tips}>
          In Speed, go for whichever target sits closest to the current sum — fewer moves
          means more of the ring left, and the ring is what feeds your combo.
        </Bullet>
        <Bullet color={ACCENT.tips}>
          Start in Trainee to build intuition for the weights, then chase high scores.
        </Bullet>

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
  )
}
