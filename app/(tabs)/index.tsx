import { useMachine } from "@xstate/react";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, SafeAreaView, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AntDesign, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle } from "react-native-svg";

import { Fonts } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  computeSum,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  gameMachine,
  type BestScores,
  type Difficulty,
  type Target,
} from "@/machines/game";

const mono = Fonts!.mono;
const APP_BLUE = "#4C7EFF";
const APP_RED = "#E5534B";
const SWIPE_THRESHOLD = 20;

// Dial buttons tint by value (0 → 9), transitioning across an on-brand cool
// gradient. Light: pale lavender → periwinkle blue. Dark: deep navy → app blue.
const DIAL_COLORS = {
  light: { low: "#ECEAF7", high: "#8296FF" },
  dark: { low: "#1E2036", high: "#4C7EFF" },
};

// The score above the dial transitions from the target numbers' background color
// (APP_BLUE, the pie fill) up to the standard text color.
const SCORE_COLORS = {
  light: { low: APP_BLUE, high: "#1C1928" },
  dark: { low: APP_BLUE, high: "#D8D2F4" },
};

// Maps a numeric value to its tint progress (0 → 1) across the 0..MAX_TARGET range.
const valueProgress = (v: number) => Math.min(1, Math.max(0, v / MAX_TARGET));
const MAX_TARGET = 324; // 9 × (sum of row×col weights)
const PIE_SIZE = 80;
const CARD_W = PIE_SIZE;
const CARD_H = PIE_SIZE;
const CARD_GAP = 10;
const BEST_SCORES_KEY = "nine.bestScores.v1";
const DIFFICULTY_KEY = "nine.difficulty.v1";
const OPTIONS_KEY = "nine.options.v1";

// ─── Pie Countdown ──────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Thick-stroke trick: radius = SIZE/4, strokeWidth = SIZE/2
// → stroke spans from center to edge, looks like a filled disc
const PIE_RADIUS = PIE_SIZE / 4;
const PIE_STROKE = PIE_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS;

function PieCountdown({
  value,
  isDark,
  active,
  duration,
  onComplete,
}: {
  value: number;
  isDark: boolean;
  active: boolean;
  duration: number;
  onComplete: () => void;
}) {
  const progress = useSharedValue(1); // 1 = full, 0 = empty
  const trackColor = isDark ? "#2A2B44" : "#D4D0C8";

  useEffect(() => {
    progress.value = withTiming(
      0,
      { duration, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onComplete)();
      },
    );
  }, []);

  useEffect(() => {
    if (active) return;
    cancelAnimation(progress);
  }, [active]);

  // strokeDashoffset 0 = full disc, CIRCUMFERENCE = empty.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  // A red arc layered over the blue one, fading in as time runs out (progress
  // 1 → 0). Uses only numeric animated props (opacity), which animate reliably
  // on SVG across platforms — unlike an animated `stroke` color string.
  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
    opacity: 1 - progress.value,
  }));

  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;

  return (
    <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
      <Svg width={PIE_SIZE} height={PIE_SIZE}>
        {/* Track disc */}
        <Circle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={trackColor}
          strokeWidth={PIE_STROKE}
          fill="none"
        />
        {/* Progress disc (blue) — rotated so it starts at 12 o'clock */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={APP_BLUE}
          strokeWidth={PIE_STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
        {/* Red arc over the blue one, fading in as the timer runs out */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={APP_RED}
          strokeWidth={PIE_STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={redProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      {/* Number centered — high-contrast against the blue/red disc and track */}
      <View
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            // Scale by digit count so the number fills almost the whole circle
            // (targets are 0..324, i.e. 1–3 digits) while staying on one line.
            fontSize: String(value).length >= 3 ? 36 : String(value).length === 2 ? 50 : 58,
            fontWeight: "800",
            fontFamily: mono,
            includeFontPadding: false,
            color: isDark ? "#FFFFFF" : "#171421",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Target Card ────────────────────────────────────────────────────────────

type Position = { x: number; y: number };
type DisplayTarget = Target & { exiting: boolean; position: Position };

function findPosition(
  existing: DisplayTarget[],
  containerW: number,
  containerH: number,
): Position {
  const maxX = containerW - CARD_W - CARD_GAP;
  const maxY = containerH - CARD_H - CARD_GAP;
  if (maxX <= 0 || maxY <= 0) return { x: CARD_GAP, y: CARD_GAP };

  for (let attempt = 0; attempt < 60; attempt++) {
    const x = CARD_GAP + Math.random() * (maxX - CARD_GAP);
    const y = CARD_GAP + Math.random() * (maxY - CARD_GAP);
    const overlaps = existing.some(
      (t) =>
        !t.exiting &&
        x < t.position.x + CARD_W &&
        x + CARD_W > t.position.x &&
        y < t.position.y + CARD_H &&
        y + CARD_H > t.position.y,
    );
    if (!overlaps) return { x, y };
  }
  return {
    x: CARD_GAP + Math.random() * maxX,
    y: CARD_GAP + Math.random() * maxY,
  };
}

function TargetCard({
  target,
  isDark,
  duration,
  onExpire,
  onExitComplete,
}: {
  target: DisplayTarget;
  isDark: boolean;
  duration: number;
  onExpire: () => void;
  onExitComplete: () => void;
}) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 180 });
  }, []);

  useEffect(() => {
    if (!target.exiting) return;
    scale.value = withSpring(1.15, { damping: 10, stiffness: 300 });
    opacity.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) runOnJS(onExitComplete)();
    });
  }, [target.exiting]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: target.position.x,
          top: target.position.y,
        },
        animStyle,
      ]}
    >
      <PieCountdown
        value={target.value}
        isDark={isDark}
        active={!target.exiting}
        duration={duration}
        onComplete={onExpire}
      />
    </Animated.View>
  );
}

// ─── Score Digit ────────────────────────────────────────────────────────────

function ScoreDigit({
  digit,
  direction,
  isDark,
  progress,
}: {
  digit: string;
  direction: 1 | -1;
  isDark: boolean;
  progress: number;
}) {
  const prevDigit = useRef(digit);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const colorProgress = useSharedValue(progress);

  // Animate the tint as the sum changes.
  useEffect(() => {
    colorProgress.value = withTiming(progress, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    });
  }, [progress]);

  useEffect(() => {
    if (digit === prevDigit.current) return;
    prevDigit.current = digit;

    const exitDir = direction === 1 ? -1 : 1;

    opacity.value = withSequence(
      withTiming(0, { duration: 80 }),
      withTiming(1, { duration: 110 }),
    );
    translateY.value = withSequence(
      withTiming(exitDir * 10, { duration: 80 }),
      withTiming(exitDir * -10, { duration: 0 }),
      withSpring(0, { damping: 18, stiffness: 180 }),
    );
  }, [digit]);

  const palette = isDark ? SCORE_COLORS.dark : SCORE_COLORS.light;
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    color: interpolateColor(
      colorProgress.value,
      [0, 1],
      [palette.high, palette.low],
    ),
  }));

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          fontSize: 42,
          fontWeight: "700",
          fontFamily: mono,
          letterSpacing: 2,
        },
        animStyle,
      ]}
    >
      {digit}
    </Animated.Text>
  );
}

// ─── Dial Button ────────────────────────────────────────────────────────────

function DialButton({
  value,
  isDark,
  size,
  weight,
  showSum,
  showFactor,
  onDelta,
  onSet,
}: {
  value: number;
  isDark: boolean;
  size: number;
  weight: number;
  showSum: boolean;
  showFactor: boolean;
  onDelta: (delta: 1 | -1) => void;
  onSet: (value: number) => void;
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const numTranslateY = useSharedValue(0);
  const numOpacity = useSharedValue(1);
  const numScale = useSharedValue(1);
  const colorProgress = useSharedValue(value / 9);

  // Animate the button tint whenever its value changes.
  useEffect(() => {
    colorProgress.value = withTiming(value / 9, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    });
  }, [value]);

  const animateSwipe = (delta: 1 | -1) => {
    "worklet";
    const exitDir = delta === 1 ? -1 : 1;

    translateY.value = withSequence(
      withTiming(exitDir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    );

    numOpacity.value = withTiming(0, { duration: 110 });
    numTranslateY.value = withTiming(
      exitDir * 18,
      { duration: 110 },
      (finished) => {
        if (!finished) return;
        runOnJS(onDelta)(delta);
        numTranslateY.value = exitDir * -18;
        numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 });
        numOpacity.value = withTiming(1, { duration: 130 });
      },
    );
  };

  // Left/right swipe sets an absolute value (left → 0, right → 9), animated the
  // same way as an up/down swipe. exitDir: -1 = up (increase), 1 = down (decrease).
  const animateSet = (newValue: number, exitDir: 1 | -1) => {
    "worklet";
    translateY.value = withSequence(
      withTiming(exitDir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    );

    numOpacity.value = withTiming(0, { duration: 110 });
    numTranslateY.value = withTiming(
      exitDir * 18,
      { duration: 110 },
      (finished) => {
        if (!finished) return;
        runOnJS(onSet)(newValue);
        numTranslateY.value = exitDir * -18;
        numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 });
        numOpacity.value = withTiming(1, { duration: 130 });
      },
    );
  };

  const animateTap = () => {
    "worklet";
    numScale.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withSpring(1, { damping: 18, stiffness: 160 }),
    );
    runOnJS(onDelta)(1);
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      "worklet";
      scale.value = withSpring(0.94, { damping: 20, stiffness: 260 });
    })
    .onEnd((e) => {
      "worklet";
      // Dominant axis decides the gesture: horizontal sets 0/9, vertical ±1.
      // Skip the number animation when the value wouldn't change (already 0/9).
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX < -SWIPE_THRESHOLD) {
          if (value !== 0) animateSet(0, 1);
        } else if (e.translationX > SWIPE_THRESHOLD) {
          if (value !== 9) animateSet(9, -1);
        } else animateTap();
      } else {
        if (e.translationY < -SWIPE_THRESHOLD) animateSwipe(1);
        else if (e.translationY > SWIPE_THRESHOLD) animateSwipe(-1);
        else animateTap();
      }
    })
    .onFinalize(() => {
      "worklet";
      scale.value = withSpring(1, { damping: 16, stiffness: 140 });
    });

  const palette = isDark ? DIAL_COLORS.dark : DIAL_COLORS.light;
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [palette.low, palette.high],
    ),
  }));

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numTranslateY.value }, { scale: numScale.value }],
    opacity: numOpacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      {/* Explicit pixel size (not w-1/3 + aspect-square): iOS WebKit fails to
          derive height from aspect-ratio on wrapping flex children. */}
      <View style={{ width: size, height: size, padding: 10 }}>
        <Animated.View
          style={[
            {
              flex: 1,
              borderRadius: 999,
              justifyContent: "center" as const,
              alignItems: "center" as const,
              shadowColor: isDark ? "#04040C" : "#1C1928",
              shadowOpacity: isDark ? 0.9 : 0.13,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 10,
            },
            btnStyle,
          ]}
        >
          {/* Factor (row×col multiplier) — small, pinned near the top */}
          {showFactor && (
            <View
              style={{ position: "absolute", top: Math.round(size * 0.1), left: 0, right: 0, alignItems: "center" }}
              pointerEvents="none"
            >
              <Text
                selectable={false}
                style={{
                  fontSize: Math.max(10, Math.round(size * 0.14)),
                  fontFamily: mono,
                  fontWeight: "700",
                  includeFontPadding: false,
                  color: isDark ? "#6E6A92" : "#9A96A8",
                }}
              >
                {weight}
              </Text>
            </View>
          )}
          <Animated.Text
            selectable={false}
            style={[
              {
                fontSize: 30,
                fontFamily: mono,
                fontWeight: "500" as const,
                includeFontPadding: false,
                color: isDark ? "#C8C2E8" : "#1C1928",
              },
              numStyle,
            ]}
          >
            {showSum ? value * weight : value}
          </Animated.Text>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// ─── Theme Toggle ────────────────────────────────────────────────────────────

const TOGGLE_W = 96;
const TOGGLE_H = 40;
const KNOB = TOGGLE_H - 8;

function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  const knobX = useSharedValue(isDark ? TOGGLE_W - KNOB - 4 : 4);

  useEffect(() => {
    knobX.value = withSpring(isDark ? TOGGLE_W - KNOB - 4 : 4, {
      damping: 18,
      stiffness: 200,
    });
  }, [isDark]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }));

  const trackDim = isDark ? "#16172A" : "#E8E4DC";
  const iconDim = isDark ? "#504E6E" : "#AAA69E";
  const iconActive = isDark ? "#D8D2F4" : "#1C1928";

  return (
    <Pressable onPress={onToggle}>
      <View
        style={{
          width: TOGGLE_W,
          height: TOGGLE_H,
          borderRadius: TOGGLE_H / 2,
          backgroundColor: trackDim,
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "center",
        }}
      >
        {/* Moon — left */}
        <View
          style={{
            position: "absolute",
            left: 10,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name="moon"
            size={15}
            color={isDark ? iconDim : iconActive}
          />
        </View>
        {/* Sun — right */}
        <View
          style={{
            position: "absolute",
            right: 10,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name="sunny"
            size={15}
            color={isDark ? iconActive : iconDim}
          />
        </View>
        {/* Knob */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: isDark ? "#1C1D30" : "#FDFCFA",
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
            },
            knobStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}

// ─── Menu / Pause overlay ────────────────────────────────────────────────────

function MenuOverlay({
  isDark,
  bestScores,
  difficulty,
  canContinue,
  onPlay,
  onContinue,
  onSetDifficulty,
  onToggleTheme,
  onOpenAdvanced,
}: {
  isDark: boolean;
  bestScores: BestScores;
  difficulty: Difficulty;
  canContinue: boolean;
  onPlay: () => void;
  onContinue: () => void;
  onSetDifficulty: (difficulty: Difficulty) => void;
  onToggleTheme: () => void;
  onOpenAdvanced: () => void;
}) {
  const dimText = isDark ? "text-[#504E6E]" : "text-[#AAA69E]";
  const primaryText = isDark ? "text-[#D8D2F4]" : "text-[#1C1928]";
  const btnBg = isDark ? "bg-[#1C1D30]" : "bg-[#1C1928]";
  const bestScore = bestScores[difficulty];
  const cardBg = isDark ? "bg-[#16172A]" : "bg-[#E8E4DC]";

  return (
    <View
      style={{ position: "absolute", inset: 0 }}
      className={`items-center justify-center ${isDark ? "bg-[#0B0C14]" : "bg-[#F3EFE9]"}`}
    >
      {canContinue && (
        <Pressable
          onPress={onContinue}
          hitSlop={12}
          style={{ position: "absolute", top: 16, right: 16 }}
        >
          <AntDesign
            name="close"
            size={26}
            color={isDark ? "#2A2B44" : "#D4D0C8"}
          />
        </Pressable>
      )}
      <Text
        selectable={false}
        className={`text-[48px] font-black tracking-[10px] mb-2 ${primaryText}`}
        style={{ fontFamily: mono }}
      >
        NINE
      </Text>

      {/* Difficulty selector — only on the intro/home menu */}
      {!canContinue && (
        <View className="items-center mb-6">
          <Text
            selectable={false}
            className={`text-[9px] font-bold tracking-[1.8px] mb-2 ${dimText}`}
            style={{ fontFamily: mono }}
          >
            DIFFICULTY
          </Text>
          <View
            className="flex-row flex-wrap justify-center gap-2 px-6"
            style={{ maxWidth: 320 }}
          >
            {DIFFICULTY_ORDER.map((d) => {
              const selected = d === difficulty;
              return (
                <Pressable
                  key={d}
                  onPress={() => onSetDifficulty(d)}
                  className={`px-3.5 py-2 rounded-xl ${selected ? btnBg : cardBg}`}
                >
                  <Text
                    selectable={false}
                    className={`text-[11px] font-black tracking-[1.5px] ${selected ? "text-[#D8D2F4]" : dimText}`}
                    style={{ fontFamily: mono }}
                  >
                    {DIFFICULTIES[d].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View className={`px-8 py-3 rounded-2xl items-center mb-10 ${cardBg}`}>
        <Text
          selectable={false}
          className={`text-[9px] font-bold tracking-[1.8px] ${dimText}`}
          style={{ fontFamily: mono }}
        >
          {`BEST · ${DIFFICULTIES[difficulty].label}`}
        </Text>
        <Text
          selectable={false}
          className={`text-[32px] font-black leading-tight ${primaryText}`}
          style={{ fontFamily: mono }}
        >
          {bestScore}
        </Text>
      </View>

      <View className="gap-3 w-56">
        {canContinue && (
          <Pressable
            onPress={onContinue}
            className={`py-4 rounded-2xl items-center ${cardBg}`}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 10,
            }}
          >
            <Text
              selectable={false}
              className={`text-[13px] font-black tracking-[2px] ${primaryText}`}
              style={{ fontFamily: mono }}
            >
              CONTINUE
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onPlay}
          className={`py-4 rounded-2xl items-center ${btnBg}`}
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 12,
          }}
        >
          <Text
            selectable={false}
            className="text-[13px] font-black tracking-[2px] text-[#D8D2F4]"
            style={{ fontFamily: mono }}
          >
            {canContinue ? "NEW GAME" : "PLAY GAME"}
          </Text>
        </Pressable>

        {/* Theme toggle */}
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </View>

      {/* Advanced options link — available on both the intro and pause menus */}
      <Pressable onPress={onOpenAdvanced} hitSlop={10} className="mt-8">
        <Text
          selectable={false}
          className={`text-[10px] font-bold tracking-[1.8px] underline ${dimText}`}
          style={{ fontFamily: mono }}
        >
          ADVANCED OPTIONS
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Advanced options overlay ────────────────────────────────────────────────

function AdvancedOptionsOverlay({
  isDark,
  showSum,
  showFactor,
  onToggleSum,
  onToggleFactor,
  onClose,
}: {
  isDark: boolean;
  showSum: boolean;
  showFactor: boolean;
  onToggleSum: () => void;
  onToggleFactor: () => void;
  onClose: () => void;
}) {
  const dimText = isDark ? "text-[#504E6E]" : "text-[#AAA69E]";
  const primaryText = isDark ? "text-[#D8D2F4]" : "text-[#1C1928]";
  const cardBg = isDark ? "bg-[#16172A]" : "bg-[#E8E4DC]";
  const boxOn = isDark ? "bg-[#1C1D30]" : "bg-[#1C1928]";

  const Option = ({
    checked,
    label,
    description,
    onToggle,
  }: {
    checked: boolean;
    label: string;
    description: string;
    onToggle: () => void;
  }) => (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center gap-3 py-3"
      style={{ width: 300 }}
    >
      <View
        className={`w-7 h-7 rounded-lg items-center justify-center ${checked ? boxOn : cardBg}`}
      >
        {checked && <AntDesign name="check" size={17} color="#D8D2F4" />}
      </View>
      <View className="flex-1">
        <Text
          selectable={false}
          className={`text-[13px] font-black tracking-[1px] ${primaryText}`}
          style={{ fontFamily: mono }}
        >
          {label}
        </Text>
        <Text
          selectable={false}
          className={`text-[10px] font-bold tracking-[0.5px] mt-0.5 ${dimText}`}
          style={{ fontFamily: mono }}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View
      style={{ position: "absolute", inset: 0 }}
      className={`items-center justify-center ${isDark ? "bg-[#0B0C14]" : "bg-[#F3EFE9]"}`}
    >
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={{ position: "absolute", top: 16, right: 16 }}
      >
        <AntDesign name="close" size={26} color={isDark ? "#2A2B44" : "#D4D0C8"} />
      </Pressable>

      <Text
        selectable={false}
        className={`text-[20px] font-black tracking-[3px] mb-8 ${primaryText}`}
        style={{ fontFamily: mono }}
      >
        ADVANCED
      </Text>

      <Option
        checked={showSum}
        label="SHOW SUM IN BUTTONS"
        description="Display value × row × column"
        onToggle={onToggleSum}
      />
      <Option
        checked={showFactor}
        label="SHOW FACTOR"
        description="Small multiplier at the top of each button"
        onToggle={onToggleFactor}
      />

      <Pressable
        onPress={onClose}
        className={`mt-8 py-4 rounded-2xl items-center ${boxOn}`}
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="text-[13px] font-black tracking-[2px] text-[#D8D2F4]"
          style={{ fontFamily: mono }}
        >
          DONE
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function GameScreen() {
  const { colorScheme, toggleTheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [state, send] = useMachine(gameMachine);

  // Load persisted per-difficulty best scores once on mount.
  useEffect(() => {
    AsyncStorage.getItem(BEST_SCORES_KEY)
      .then((raw) => {
        if (raw)
          send({
            type: "HYDRATE_BEST",
            bestScores: JSON.parse(raw) as BestScores,
          });
      })
      .catch(() => {});
  }, []);

  // Persist best scores whenever they change.
  const bestScores = state.context.bestScores;
  useEffect(() => {
    AsyncStorage.setItem(BEST_SCORES_KEY, JSON.stringify(bestScores)).catch(
      () => {},
    );
  }, [bestScores]);

  // Restore the last chosen difficulty on mount (machine starts in `menu`,
  // where SET_DIFFICULTY is handled).
  const difficultyHydrated = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(DIFFICULTY_KEY)
      .then((raw) => {
        if (raw && (DIFFICULTY_ORDER as string[]).includes(raw)) {
          send({ type: "SET_DIFFICULTY", difficulty: raw as Difficulty });
        }
      })
      .catch(() => {})
      .finally(() => {
        difficultyHydrated.current = true;
      });
  }, []);

  // Persist the difficulty when it changes (but not the default before restore).
  const difficulty = state.context.difficulty;
  useEffect(() => {
    if (!difficultyHydrated.current) return;
    AsyncStorage.setItem(DIFFICULTY_KEY, difficulty).catch(() => {});
  }, [difficulty]);

  // Advanced display options (persisted).
  const [showSum, setShowSum] = useState(false);
  const [showFactor, setShowFactor] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const optionsHydrated = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(OPTIONS_KEY)
      .then((raw) => {
        if (!raw) return;
        const o = JSON.parse(raw);
        if (typeof o?.showSum === "boolean") setShowSum(o.showSum);
        if (typeof o?.showFactor === "boolean") setShowFactor(o.showFactor);
      })
      .catch(() => {})
      .finally(() => {
        optionsHydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (!optionsHydrated.current) return;
    AsyncStorage.setItem(
      OPTIONS_KEY,
      JSON.stringify({ showSum, showFactor }),
    ).catch(() => {});
  }, [showSum, showFactor]);

  const score = computeSum(state.context.grid);
  const prevScoreRef = useRef(score);
  const direction: 1 | -1 = score >= prevScoreRef.current ? 1 : -1;
  useEffect(() => {
    prevScoreRef.current = score;
  }, [score]);

  const isPlaying = state.matches("playing");

  // Spawn targets every 5 seconds (first one immediately), only while playing
  useEffect(() => {
    if (!isPlaying) return;
    const spawn = () =>
      send({
        type: "ADD_TARGET",
        value: Math.floor(Math.random() * (MAX_TARGET + 1)),
      });
    spawn();
    const interval = setInterval(spawn, 5000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Sync displayed targets with machine (to allow exit animations)
  const [displayedTargets, setDisplayedTargets] = useState<DisplayTarget[]>([]);
  const containerSize = useRef({ width: 0, height: 0 });

  // Dial pad is a square sized to fit its container (min of width/height),
  // so it never overflows over the score above it.
  const [dialSize, setDialSize] = useState(0);

  useEffect(() => {
    const machineIds = new Set(state.context.targets.map((t) => t.id));
    setDisplayedTargets((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        exiting: t.exiting || !machineIds.has(t.id),
      }));
      const displayedIds = new Set(prev.map((t) => t.id));
      const placed = [...updated];
      const incoming = state.context.targets
        .filter((t) => !displayedIds.has(t.id))
        .map((t) => {
          const position = findPosition(
            placed,
            containerSize.current.width,
            containerSize.current.height,
          );
          const entry = { ...t, exiting: false, position };
          placed.push(entry);
          return entry;
        });
      return [...updated, ...incoming];
    });
  }, [state.context.targets]);

  const removeDisplayed = (id: number) =>
    setDisplayedTargets((prev) => prev.filter((t) => t.id !== id));

  // Clear displayed targets when starting a fresh game
  const prevStateRef = useRef(state.value);
  useEffect(() => {
    const prev = prevStateRef.current;
    const wasMenuOrGameOver = prev === "menu" || prev === "gameOver";
    if (wasMenuOrGameOver && state.matches("playing")) {
      setDisplayedTargets([]);
    }
    prevStateRef.current = state.value;
  }, [state.value]);

  const isMenu = state.matches("menu");
  const isPaused = state.matches("paused");
  const isGameOver = state.matches("gameOver");

  return (
    <>
      {/* ── Game board — top third ── */}
      <View className="flex-1 px-4 pt-1 pb-2.5">
        <View className="flex-row justify-between items-center mb-3">
          <Text
            selectable={false}
            className={`text-[30px] font-black tracking-[8px] ${isDark ? "text-[#D8D2F4]" : "text-[#1C1928]"}`}
            style={{ fontFamily: mono }}
          >
            NINE
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-row gap-1">
              {[0, 1, 2].map((i) => (
                <AntDesign
                  key={i}
                  name="heart"
                  size={22}
                  color={
                    i >= 3 - state.context.lives
                      ? "#E5534B"
                      : isDark
                        ? "#1C1D30"
                        : "#FDFCFA"
                  }
                />
              ))}
            </View>
            <View
              className={`px-3.5 py-1.5 rounded-[10px] items-center min-w-[64px] ${isDark ? "bg-[#16172A]" : "bg-[#E8E4DC]"}`}
            >
              <Text
                selectable={false}
                className={`text-[9px] font-bold tracking-[1.8px] ${isDark ? "text-[#504E6E]" : "text-[#AAA69E]"}`}
                style={{ fontFamily: mono }}
              >
                SCORE
              </Text>
              <Text
                selectable={false}
                className={`text-xl font-extrabold mt-px ${isDark ? "text-[#D8D2F4]" : "text-[#1C1928]"}`}
                style={{ fontFamily: mono }}
              >
                {state.context.gameScore}
              </Text>
            </View>
            <Pressable onPress={() => send({ type: "PAUSE" })} hitSlop={10}>
              <AntDesign
                name="bars"
                size={26}
                color={isDark ? "#2A2B44" : "#D4D0C8"}
              />
            </Pressable>
          </View>
        </View>

        {/* Target numbers */}
        <View
          className="flex-1"
          onLayout={(e) => {
            containerSize.current = {
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            };
          }}
        >
          {displayedTargets.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              isDark={isDark}
              duration={DIFFICULTIES[state.context.difficulty].duration}
              onExpire={() => send({ type: "TARGET_EXPIRED", id: target.id })}
              onExitComplete={() => removeDisplayed(target.id)}
            />
          ))}
        </View>
      </View>

      {/* ── Score above dial ── */}
      <View className="items-center py-1.5">
        <View className="flex-row">
          {String(score)
            .split("")
            .map((digit, i, arr) => (
              <ScoreDigit
                key={arr.length - 1 - i}
                digit={digit}
                direction={direction}
                isDark={isDark}
                progress={valueProgress(score)}
              />
            ))}
        </View>
      </View>

      {/* ── Dial pad — bottom two thirds ── */}
      <View
        className="flex-1 items-center justify-center"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setDialSize(Math.min(width, height));
        }}
      >
        <View
          style={{ width: dialSize, height: dialSize }}
          className="flex-row flex-wrap"
        >
          {state.context.grid.flat().map((value, index) => (
            <DialButton
              key={index}
              value={value}
              isDark={isDark}
              size={Math.floor(dialSize / 3)}
              weight={(Math.floor(index / 3) + 1) * ((index % 3) + 1)}
              showSum={showSum}
              showFactor={showFactor}
              onDelta={(delta) => send({ type: "PRESS", index, delta })}
              onSet={(cellValue) =>
                send({ type: "SET_CELL", index, value: cellValue })
              }
            />
          ))}
        </View>
      </View>

      {/* ── Menu / Pause overlay ── */}
      {(isMenu || isPaused) &&
        (advancedOpen ? (
          <AdvancedOptionsOverlay
            isDark={isDark}
            showSum={showSum}
            showFactor={showFactor}
            onToggleSum={() => setShowSum((v) => !v)}
            onToggleFactor={() => setShowFactor((v) => !v)}
            onClose={() => setAdvancedOpen(false)}
          />
        ) : (
          <MenuOverlay
            isDark={isDark}
            bestScores={state.context.bestScores}
            difficulty={state.context.difficulty}
            canContinue={isPaused}
            onPlay={() => send({ type: isPaused ? "MENU" : "START" })}
            onContinue={() => send({ type: "RESUME" })}
            onSetDifficulty={(difficulty) =>
              send({ type: "SET_DIFFICULTY", difficulty })
            }
            onToggleTheme={toggleTheme}
            onOpenAdvanced={() => setAdvancedOpen(true)}
          />
        ))}

      {/* ── Game Over overlay ── */}
      {isGameOver && (
        <View
          style={{ position: "absolute", inset: 0 }}
          className={`items-center justify-center ${isDark ? "bg-[#0B0C14]" : "bg-[#F3EFE9]"}`}
        >
          <Text
            selectable={false}
            className={`text-[40px] font-black tracking-[6px] mb-8 ${isDark ? "text-[#D8D2F4]" : "text-[#1C1928]"}`}
            style={{ fontFamily: mono }}
          >
            GAME OVER
          </Text>

          <View
            className={`px-8 py-5 rounded-2xl items-center mb-3 ${isDark ? "bg-[#16172A]" : "bg-[#E8E4DC]"}`}
          >
            <Text
              selectable={false}
              className={`text-[9px] font-bold tracking-[1.8px] ${isDark ? "text-[#504E6E]" : "text-[#AAA69E]"}`}
              style={{ fontFamily: mono }}
            >
              YOUR SCORE
            </Text>
            <Text
              selectable={false}
              className={`text-[48px] font-black leading-tight ${isDark ? "text-[#D8D2F4]" : "text-[#1C1928]"}`}
              style={{ fontFamily: mono }}
            >
              {state.context.gameScore}
            </Text>
          </View>

          <View className="items-center mb-10">
            <Text
              selectable={false}
              className={`text-[9px] font-bold tracking-[1.8px] ${isDark ? "text-[#504E6E]" : "text-[#AAA69E]"}`}
              style={{ fontFamily: mono }}
            >
              BEST
            </Text>
            <Text
              selectable={false}
              className={`text-[28px] font-black ${isDark ? "text-[#504E6E]" : "text-[#AAA69E]"}`}
              style={{ fontFamily: mono }}
            >
              {state.context.bestScores[state.context.difficulty]}
            </Text>
          </View>

          <Pressable
            onPress={() => send({ type: "MENU" })}
            className={`px-10 py-4 rounded-2xl ${isDark ? "bg-[#1C1D30]" : "bg-[#1C1928]"}`}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 12,
            }}
          >
            <Text
              selectable={false}
              className="text-[15px] font-black tracking-[3px] text-[#D8D2F4]"
              style={{ fontFamily: mono }}
            >
              NEW GAME
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
