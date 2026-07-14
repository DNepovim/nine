# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- **Never deploy to production.** Do not run `eas deploy --prod` (or otherwise promote to prod) unless the user explicitly issues that exact command in the current turn. "Continue", "ship it", or prior approvals do NOT authorize a prod deploy — wait for the explicit instruction every time.

## Commands

```bash
pnpm start          # Start Expo dev server
pnpm ios            # Run on iOS simulator
pnpm android        # Run on Android emulator
pnpm web            # Run in browser
pnpm lint           # Run ESLint
pnpm reset-project  # Move current app to app-example, reset to blank starter
```

## Architecture

**Expo Router (file-based routing)** — the `app/` directory defines all routes. `app/_layout.tsx` is the root layout wrapping everything in a `ThemeProvider`. `app/(tabs)/` defines the tab group; its `_layout.tsx` configures the bottom tab navigator.

**Theme system** — `constants/theme.ts` defines `Colors` with `light`/`dark` variants. `hooks/use-color-scheme.ts` detects OS preference (with a web-specific hydration-safe variant at `hooks/use-color-scheme.web.ts`). `hooks/use-theme-color.ts` resolves a color key against the active scheme. `ThemedText` and `ThemedView` consume this to adapt styling automatically.

**Platform-specific files** — Expo resolves `.ios.tsx` / `.web.ts` variants automatically. Used for `icon-symbol` (SF Symbols on iOS, Material Icons elsewhere) and `use-color-scheme` (hydration safety on web).

**Path alias** — `@/*` maps to the repo root (e.g. `import { Colors } from '@/constants/theme'`).

**State machines** — XState v5 and `@xstate/react` are installed but not yet used. Intended for future stateful feature logic.

**New Architecture & React Compiler** — both are enabled in `app.json`. Animations use `react-native-reanimated` v4 with worklets.
