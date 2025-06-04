import { type Target } from "../../store/Game";
import { useGameStore } from "../../store/Game";

interface TargetsProps {
  targets: Target[];
}

export const Targets: React.FC<TargetsProps> = ({ targets }) => {
  const gameTime = useGameStore((state) => state.gameTime);

  return (
    <div className="relative w-full h-full rounded-md border-gray-300 border-2 bg-white">
      {targets.map((target, index) => {
        const timeLeft = target.createdTime + 2 - gameTime;
        const progress = Math.max(0, (timeLeft / 2) * 100);

        return (
          <div
            key={index}
            className="absolute text-center"
            style={{
              left: target.position.x,
              top: target.position.y,
              fontSize: "2rem",
              // transform: `scale(${1 + target.countdown * 0.1})`,
              transformOrigin: "center",
            }}
          >
            {target.value}
            <div className="w-16 h-1 bg-gray-200 mt-1">
              <div
                className="h-full bg-gray-400 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
