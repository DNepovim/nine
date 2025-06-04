import { type Target } from "../../store/Game";

interface TargetsProps {
  targets: Target[];
}

export const Targets: React.FC<TargetsProps> = ({ targets }) => (
  <div className="relative w-full h-full rounded-sm border border-gray-300">
    {targets.map((target, index) => (
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
      </div>
    ))}
  </div>
);
