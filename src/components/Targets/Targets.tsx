import { useEffect, useState, useRef } from "react";
import { useGameStore } from "../../store/Game";
import { gameSum } from "../../utils/gameSum";

export interface TargetsProps {
  intervalSeconds: number;
}

export const Targets: React.FC<TargetsProps> = ({ intervalSeconds }) => {
  const [target, setTarget] = useState<number>(
    Math.floor(Math.random() * 101) + 200
  );
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const state = useGameStore();
  const { increaseScore, decreaseLives } = useGameStore();

  const generateNewTarget = () => {
    const maxSum = gameSum([
      [9, 9, 9],
      [9, 9, 9],
      [9, 9, 9],
    ]);
    let newTarget;
    do {
      newTarget = Math.floor(Math.random() * (maxSum + 1));
    } while (newTarget === target);

    setTarget(newTarget);
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setPosition({
        x: Math.random() * (width - 100),
        y: Math.random() * (height - 100),
      });
    }
    setScale(1);
    setIsVisible(true);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isVisible) {
        decreaseLives();
      }
      generateNewTarget();
    }, intervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [intervalSeconds, state, isVisible, decreaseLives]);

  useEffect(() => {
    const timer = setInterval(() => {
      setScale((prev) => prev + 0.01);
    }, 100);

    return () => clearInterval(timer);
  }, [target]);

  useEffect(() => {
    const checkSum = setInterval(() => {
      const currentSum = gameSum(state.numbers);
      if (currentSum === target && isVisible) {
        setIsVisible(false);
        increaseScore(1);
        generateNewTarget();
      }
    }, 100);

    return () => clearInterval(checkSum);
  }, [target, state, isVisible, increaseScore]);

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div
        className="absolute text-center transition-all duration-100"
        style={{
          left: position.x,
          top: position.y,
          fontSize: "2rem",
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {target}
      </div>
    </div>
  );
};
