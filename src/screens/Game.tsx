import { NumPad } from "../components/NumPad/NumPad";
import { Targets } from "../components/Targets/Targets";
import { useGameStore } from "../store/Game";
import { useEffect, useRef } from "react";

export const Game = () => {
  const {
    score,
    lives,
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
    const updateTime = (timestamp: number) => {
      if (!isGameRunning) {
        if (!containerRef.current) {
          return;
        }

        startGame(
          timestamp,
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
        return;
      }

      updateGame(timestamp);
      animationFrameId.current = requestAnimationFrame(updateTime);
    };

    animationFrameId.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [updateGame, startGame, isGameRunning]);

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-200 touch-none overflow-hidden p-4">
      <div className="h-12 text-2xl font-bold px-4 flex justify-between items-center">
        <div className="flex flex-col flex-1">
          <div className="text-gray-600">
            {score}&nbsp;
            <span className="text-sm text-gray-400">/&nbsp;{bestScore}</span>
          </div>
        </div>
        <span className="text-4xl flex-1 flex justify-center">{sum}</span>
        <span className="text-gray-600 flex-1 flex justify-end">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="mx-0.5">
              {i < 3 - lives ? "♡" : "♥"}
            </span>
          ))}
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-[calc(50vh-3rem)] flex items-center justify-center"
      >
        <Targets targets={targets} />
      </div>
      <div className="h-[calc(50vh-3rem)]">
        <NumPad />
      </div>
    </div>
  );
};
