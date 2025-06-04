import { NumPad } from "../components/NumPad/NumPad";
import { Targets } from "../components/Targets/Targets";
import { useGameStore } from "../store/Game";
import { useEffect, useRef } from "react";

export const Game = () => {
  const {
    score,
    lives,
    startTime,
    targets,
    sum,
    bestScore,
    isGameRunning,
    startGame,
    updateGame,
  } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    startGame(
      Date.now(),
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
  }, []);

  useEffect(() => {
    if (!isGameRunning) {
      return;
    }

    const updateTime = (timestamp: number) => {
      const elapsedTime = (timestamp - startTime) / 1000;
      updateGame(elapsedTime);
      animationFrameId.current = requestAnimationFrame(updateTime);
    };

    animationFrameId.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [startTime, updateGame]);

  return (
    <div className="h-screen flex flex-col bg-gray-200 touch-none overflow-hidden">
      <div className="h-12 text-2xl font-bold px-4 flex justify-between items-center">
        <div className="flex flex-col flex-1">
          <span className="text-gray-600">{score}</span>
          <span className="text-sm text-gray-400">{bestScore}</span>
        </div>
        <span className="text-4xl flex-1 flex justify-center text-red-950">
          {sum}
        </span>
        <span className="text-gray-600 flex-1 flex justify-end">
          {Array.from({ length: lives }, (_, i) => (
            <span key={i} className="text-purple-500 mx-0.5">
              ♥
            </span>
          ))}
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-[calc(50vh-3rem)] p-4 flex items-center justify-center"
      >
        <Targets targets={targets} />
      </div>
      <div className="h-[calc(50vh-3rem)]">
        <NumPad />
      </div>
    </div>
  );
};
