import { NumPad } from "./components/NumPad/NumPad";
import { Targets } from "./components/Targets/Targets";
import { useGameStore } from "./store/Game";
import { gameSum } from "./utils/gameSum";

function App() {
  const { score, lives } = useGameStore();
  const state = useGameStore();
  const sum = gameSum(state);

  return (
    <div className="h-screen flex flex-col bg-gray-100 touch-none overflow-hidden">
      <div className="h-12 text-2xl font-bold p-4 flex justify-between items-center">
        <span className="text-gray-600">Score: {score}</span>
        <span className="text-4xl">{sum}</span>
        <span className="text-gray-600">Lives: {lives}</span>
      </div>
      <div className="h-[calc(50vh-3rem)] p-4">
        <Targets intervalSeconds={5} />
      </div>
      <div className="h-[calc(50vh-3rem)] flex items-center justify-center">
        <NumPad />
      </div>
    </div>
  );
}

export default App;
