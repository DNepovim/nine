import Svg, { Ellipse, Path } from 'react-native-svg'

// A real thumb pad is taller than it is wide; the print sits low on it.
export const THUMB_ASPECT = 1.28

// Thumb outline plus four fingerprint ridges, drawn in a 40 × 51 box.
export function ThumbPrint({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={width * THUMB_ASPECT} viewBox="0 0 40 51">
      <Ellipse
        cx="20"
        cy="25.5"
        rx="18"
        ry="24"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M7 28a13 15 0 0 1 26 0"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M10.5 30a9.5 11 0 0 1 19 0"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M14 32a6 7 0 0 1 12 0"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M17.5 34a2.5 3 0 0 1 5 0"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  )
}
