# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Nine** is a mobile number-puzzle game built with Expo (React Native). The player dials a 3×3 grid of digits to match target sums; modes (Trainee / Accuracy / Speed) and difficulties add scoring, lives, and streak mechanics.

## Rules

- **Never deploy to production.** Do not run `eas deploy --prod` (or otherwise promote to prod) unless the user explicitly issues that exact command in the current turn. "Continue", "ship it", or prior approvals do NOT authorize a prod deploy — wait for the explicit instruction every time.

## Commands

```bash
pnpm start          # Start Expo dev server
pnpm ios            # Run on iOS simulator
pnpm android        # Run on Android emulator
pnpm web            # Run in browser
pnpm lint           # ESLint
pnpm format         # Prettier (auto-fix)
pnpm typecheck      # tsc --noEmit
pnpm knip           # Dead-code / unused-export check
pnpm test           # Vitest (run once)
pnpm test:watch     # Vitest (watch mode)
pnpm check          # All of the above in sequence (CI gate)
```

## Architecture

**Expo Router (file-based routing)** — the `app/` directory defines all routes. `app/_layout.tsx` is the root layout wrapping everything in a `ThemeProvider`. `app/(tabs)/` defines the tab group; its `_layout.tsx` configures the bottom tab navigator.

**Theme system** — `constants/theme.ts` defines `Colors` with `light`/`dark` variants. `hooks/use-color-scheme.ts` detects OS preference (with a web-specific hydration-safe variant at `hooks/use-color-scheme.web.ts`). `hooks/use-theme-color.ts` resolves a color key against the active scheme.

**Styling** — NativeWind v5 (Tailwind for React Native). Use `className` for static styles; the `style` prop only for values computed at runtime (dynamic colors, pixel sizes).

**State machines** — XState v5 + `@xstate/react`. Game logic lives in `machines/game.ts`; mode/difficulty config in `machines/modes.ts`; scoring helpers in `machines/scoring.ts`. Components consume the machine via `useMachine` in `app/(tabs)/index.tsx`.

**Persistence** — `@react-native-async-storage/async-storage`. Thin hook wrappers in `hooks/use-persisted-*.ts` hydrate the machine on mount and write back on change.

**Animations** — `react-native-reanimated` v4 with worklets. Use `useSharedValue`, `useAnimatedStyle`, and the `withTiming`/`withSpring`/`withRepeat` drivers. Define animated sub-components at **module level** (not inside render functions) to avoid remounts.

**Platform-specific files** — Expo resolves `.ios.tsx` / `.web.ts` variants automatically. Used for `icon-symbol` (SF Symbols on iOS, Material Icons elsewhere) and `use-color-scheme` (hydration safety on web).

**Path alias** — `@/*` maps to the repo root (e.g. `import { Colors } from '@/constants/theme'`). Never use relative `../` imports.

**New Architecture & React Compiler** — both are enabled in `app.json`.

## Key directories

| Path          | Contents                                                  |
| ------------- | --------------------------------------------------------- |
| `app/`        | Expo Router screens and layouts                           |
| `components/` | UI components (game, overlays, shared)                    |
| `constants/`  | Colors, theme tokens, storage keys, static game config    |
| `hooks/`      | Custom React hooks (persistence, display logic, spawning) |
| `lib/`        | Pure helper functions (no React, no side effects)         |
| `machines/`   | XState machines and pure game logic                       |
| `types/`      | Shared TypeScript types                                   |
