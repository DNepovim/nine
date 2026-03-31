import React, { createContext, useContext, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

type ColorScheme = 'light' | 'dark';

const BG_DARK = '#0B0C14';
const BG_LIGHT = '#F3EFE9';

const ThemeContext = createContext<{
  colorScheme: ColorScheme;
  toggleTheme: () => void;
  transitionOpacity: SharedValue<number>;
  transitionColor: string;
} | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme() ?? 'light';
  const [override, setOverride] = useState<ColorScheme | null>(null);
  const [transitionColor, setTransitionColor] = useState(BG_DARK);

  const colorScheme = override ?? system;
  const transitionOpacity = useSharedValue(0);

  const applyToggle = () => {
    setOverride(prev => (prev ?? system) === 'dark' ? 'light' : 'dark');
  };

  const toggleTheme = () => {
    const targetDark = colorScheme === 'light';
    setTransitionColor(targetDark ? BG_DARK : BG_LIGHT);
    transitionOpacity.value = withTiming(1, { duration: 350 }, finished => {
      if (!finished) return;
      runOnJS(applyToggle)();
      transitionOpacity.value = withTiming(0, { duration: 500 });
    });
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, toggleTheme, transitionOpacity, transitionColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside AppThemeProvider');
  return ctx;
}
