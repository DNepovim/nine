---
name: code-guide
description: Coding style and conventions for the Nine Expo/React Native app — TypeScript, components, NativeWind styling, XState machines, Reanimated animations, value maps, conditionals, and testing. Consult when writing or reviewing code.
---

# Code Guide

Style and pattern reference for the Nine codebase. Consult before writing or reviewing any code.

---

## TypeScript

- Write functional, immutable TypeScript code
- Do not use `any`
- Do not use type assertions (`as`) — model the types correctly instead
- Do not use non-null assertions (`!`) — `noUncheckedIndexedAccess` is on; guard or use `??`
- Do not write `// eslint-disable` comments — fix the underlying issue
- Prefer early returns over nested conditionals
- Use `type` for all type definitions (not `interface`)
- Use `type` keyword on import-only lines: `import type { Foo } from '...'`
- Always use the `@/` path alias — never relative `../` imports

---

## Components

- Functional components only
- Destructure props in the function signature
- Pass primitives over objects where possible (`name={item.name}` not `item={item}`)
- Keep components small; extract sub-components when a section has its own state or animation logic
- **Every named component must live in its own file** — no inline sub-components inside another component's file. Even if a component is only used in one place, it gets its own file.
- Define animated sub-components at **module level**, not inside the parent function — nesting them causes remount on every parent render, resetting all shared values

```tsx
// ❌ Nested — remounts on every parent render
export function Screen() {
  function AnimatedDot() { ... }   // new component identity each render
  return <AnimatedDot />
}

// ✅ Module-level — stable identity
function AnimatedDot() { ... }

export function Screen() {
  return <AnimatedDot />
}
```

---

## Styling (NativeWind)

**Strongly prefer `className`** — reach for it first. `style` is the last resort, reserved only for values that cannot be expressed statically: runtime-computed colors (hex with dynamic alpha), sizes derived from layout measurements, and Reanimated animated style objects.

- Use `className` for all static styles (spacing, typography, flex, colors from the palette)
- Use the `style` prop only for values that are computed at runtime: dynamic hex colors, pixel sizes from layout measurements, or Reanimated animated styles
- Never mix NativeWind `className` with React Native `StyleSheet.create` on the same component
- Tailwind color tokens (`text-primary`, `bg-dim`, etc.) are defined in `global.css` — prefer tokens over raw hex in `className`

For **conditional** class names, use the `cn` utility (`lib/cn.ts`) — it wraps `clsx` + `tailwind-merge` so conditional Tailwind classes are safe to compose:

```tsx
import { cn } from '@/lib/cn'

// ❌ Conditional inline style
<View style={{ opacity: disabled ? 0.35 : 1 }} />
<Text style={{ color: isMe ? '#4C7EFF' : '#aaa69e' }} />

// ✅ cn() keeps everything in className
<View className={cn('rounded-2xl', disabled && 'opacity-[0.35]')} />
<Text className={cn('font-mono', isMe ? 'text-[#4C7EFF]' : 'text-dim')} />
```

```tsx
// ❌ Inline style for something Tailwind can express
<View style={{ flexDirection: 'row', gap: 8, padding: 16 }} />

// ✅ NativeWind className
<View className="flex-row gap-2 p-4" />

// ✅ style prop only for runtime values (dynamic hex, layout-measured sizes, Reanimated)
<Text className="font-mono text-[13px] font-black" style={{ color: MODE_COLORS[mode] }}>
  {label}
</Text>
```

---

## Value maps

Do not use `if`/ternary chains or `switch` to select a value from a known set. Use a module-level constant map instead:

```ts
// ❌ Breaks silently when a new mode is added
const label = mode === 'trainee' ? 'TRAINEE' : mode === 'accuracy' ? 'ACCURACY' : 'SPEED'

// ✅ Exhaustiveness enforced by the type
const MODE_LABELS = {
  trainee: 'TRAINEE',
  accuracy: 'ACCURACY',
  speed: 'SPEED',
} as const satisfies Record<Mode, string>

const label = MODE_LABELS[mode]
```

Always use `as const satisfies Record<KnownUnion, Value>` — `as const` preserves literal types, `satisfies` enforces exhaustiveness at compile time. Never use `Partial<Record<string, ...>>` — it silently accepts unknown keys and defeats the exhaustiveness check.

Use `switch` only for executing side effects per variant, never for computing a value.

---

## Conditionals

Use `if` only for guards and genuinely boolean checks (`if (!data)`, `if (isPending)`). For variant selection, use a value map (see above).

```ts
// ❌ Ternary chain — adding a new difficulty requires hunting for every branch
const scale = difficulty === 'easy' ? 1.3 : difficulty === 'medium' ? 1.0 : 0.75

// ✅ Value map — one place to extend
const TIMEOUT_SCALES = {
  easy: 1.3,
  medium: 1.0,
  hard: 0.75,
  extreme: 0.55,
} as const satisfies Record<Difficulty, number>

const scale = TIMEOUT_SCALES[difficulty]
```

---

## Type narrowing

Use type guards from `narrowland` instead of manual comparisons. Import individual guards:

```ts
import { isNonEmptyArray, isNonEmptyString, isNotNull, isOneOf } from 'narrowland'
```

| Pattern to replace               | narrowland equivalent     |
| -------------------------------- | ------------------------- |
| `a === 'x' \|\| a === 'y'`       | `isOneOf(a, ['x', 'y'])`  |
| `a !== 'x' && a !== 'y'`         | `!isOneOf(a, ['x', 'y'])` |
| `arr.length > 0`                 | `isNonEmptyArray(arr)`    |
| `arr.length === 0`               | `isEmptyArray(arr)`       |
| `value !== null`                 | `isNotNull(value)`        |
| `str !== null && str.length > 0` | `isNonEmptyString(str)`   |

```ts
// ❌ Manual narrowing
if (mode !== 'trainee' && mode !== 'arcade') { ... }
const hasItems = items.length > 0
if (nickname !== null && nickname.length > 0) { ... }

// ✅ narrowland
if (isOneOf(mode, ['accuracy', 'speed'])) { ... }
const hasItems = isNonEmptyArray(items)
if (isNonEmptyString(nickname)) { ... }
```

Single comparisons that aren't about membership (`if (mode === 'trainee')`, a lone `!== null`) are fine as-is — reach for narrowland when it replaces a multi-part check or adds semantic clarity.

---

## State machines (XState v5)

- All non-trivial state logic lives in `machines/` as XState v5 machines, not in component state
- Pure helpers (scoring, config lookups, calculations) live in the same `machines/` file or a sibling — they must have no React dependencies
- Export the machine's `send` type as `export type XxxSend = (event: Event) => void` so hooks can be typed without importing `useMachine`
- Components read from `state.context`; they do not maintain a parallel copy of machine state in `useState`
- Guards and actions reference `context` and `event` by destructuring — do not capture outer scope

```ts
// ❌ Guard captures outer variable
let currentMode = 'trainee'
guard: () => currentMode === 'trainee'

// ✅ Guard reads from context
guard: ({ context }) => MODES[context.mode].lives === Number.POSITIVE_INFINITY
```

---

## Animations (Reanimated v4)

- Use `react-native-reanimated` for all animations — never the built-in `Animated` from React Native
- Shared values (`useSharedValue`) and animated styles (`useAnimatedStyle`) must only be read inside worklets (the `useAnimatedStyle` callback, gesture handlers) — never read `.value` in the render path
- Prefer `withTiming` + `Easing.inOut(Easing.sin)` for smooth oscillations; `withSpring` for bouncy, physics-feel responses
- Compose sequences with `withSequence`; stagger with `withDelay`; loop with `withRepeat(..., -1, true)` (reverse)
- Start repeating animations in a `useEffect(() => { ... }, [])` — effects run after mount so the UI is ready

```tsx
// Idle float pattern
useEffect(() => {
  translateY.value = withRepeat(
    withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
    -1,
    true,
  )
}, [])

// Mode-change bounce pattern
useEffect(() => {
  if (value === prevRef.current) return
  prevRef.current = value
  translateY.value = withSequence(
    withSpring(-14, { damping: 5, stiffness: 350 }),
    withSpring(0, { damping: 12, stiffness: 200 }),
  )
}, [value])
```

---

## Persistence

- AsyncStorage is async — the game machine initialises with default values, then persistence hooks hydrate it on mount
- Thin hook pattern: a `use-persisted-*.ts` hook reads storage once on mount (dispatching a `HYDRATE_*` event) and writes back whenever the relevant context slice changes
- Use a versioned storage key (e.g. `nine.stats.v3`) when the stored shape changes — never silently migrate without bumping the key

---

## Platform variants

- For platform-specific implementations, create sibling files: `foo.ts` (default), `foo.ios.tsx`, `foo.web.ts` — Expo resolves them automatically
- Avoid inline `Platform.OS` checks for anything more than a one-liner; prefer separate files for larger differences

---

## Testing

Every pure function in `lib/` and every machine helper in `machines/` must have a colocated Vitest test file (`<name>.test.ts`). Cover the common case, edge cases, and any non-obvious behavior — one `it` per distinct behavior.

```ts
// machines/scoring.test.ts
import { describe, expect, it } from 'vitest'

import { computeHitPoints } from './scoring'

describe('computeHitPoints', () => {
  it('returns max score when time is full and steps are optimal', () => {
    expect(
      computeHitPoints({
        par: 2,
        userSteps: 2,
        timeLeft: 8000,
        duration: 8000,
        weights: { acc: 0.5, spd: 0.5 },
      }),
    ).toBe(1000)
  })
})
```

Run a single file during development: `pnpm exec vitest run machines/scoring.test.ts`. The full suite runs via `pnpm test` (also gated in `pnpm check`).

UI components and hooks do not require tests unless the behavior is non-trivial. Pure logic is always tested.
