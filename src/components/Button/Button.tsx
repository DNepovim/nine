import { colorInterpolation } from "../../store/utils";

export interface ButtonProps {
  onClick?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  children: number;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  onTouchStart,
}) => (
  <button
    onClick={onClick}
    onTouchStart={onTouchStart}
    className="aspect-square w-full h-full rounded-full transition-colors text-2xl font-bold"
    style={{
      backgroundColor: `${colorInterpolation(
        children,
        "#bbbbbb",
        "#555555"
      )}aa`,
      // color: colorInterpolation(children, "#000000", "#ffffff"),
      color: children < 5 ? "#000000" : "#ffffff",
    }}
  >
    {children}
  </button>
);
