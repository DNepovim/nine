import type { PropsWithChildren } from "react";

export interface ButtonProps extends PropsWithChildren {
  onClick?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  onTouchStart,
}) => (
  <button
    onClick={onClick}
    onTouchStart={onTouchStart}
    className="aspect-square w-full h-full rounded-full bg-gray-200 hover:bg-gray-300 active:bg-gray-400 transition-colors text-2xl font-bold"
  >
    {children}
  </button>
);
