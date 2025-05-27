import type { PropsWithChildren } from "react";
import { Button } from "../Button/Button";
import { useGameStore } from "../../store/Game";

export interface NumPadProps extends PropsWithChildren {}

export const NumPad: React.FC<NumPadProps> = ({ children }) => {
  const { numbers, increaseNumber, decreaseNumber } = useGameStore();

  const handleTouchStart = (
    e: React.TouchEvent,
    rowIndex: number,
    colIndex: number
  ) => {
    e.preventDefault();
    const startY = e.touches[0].clientY;

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const endY = e.changedTouches[0].clientY;
      const diff = endY - startY;

      if (Math.abs(diff) < 10) {
        increaseNumber(rowIndex, colIndex);
      } else if (diff > 50) {
        decreaseNumber(rowIndex, colIndex);
      } else if (diff < -50) {
        increaseNumber(rowIndex, colIndex);
      }

      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div className="grid grid-cols-3 gap-2 p-2 touch-none">
      {numbers.map((row, rowIndex) =>
        row.map((number, colIndex) => (
          <Button
            key={`${rowIndex}-${colIndex}`}
            onClick={() => increaseNumber(rowIndex, colIndex)}
            onTouchStart={(e) => handleTouchStart(e, rowIndex, colIndex)}
          >
            {number}
          </Button>
        ))
      )}
      {children}
    </div>
  );
};
