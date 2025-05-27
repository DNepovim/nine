import { useGameStore } from "../store/Game";

export const Start = () => {
  const resetGame = useGameStore((state) => state.resetGame);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-9xl font-bold mb-16">9</h1>
      <button
        onClick={resetGame}
        className="px-8 py-4 bg-gray-800 text-white text-2xl font-bold rounded-lg hover:bg-gray-700 transition-colors"
      >
        New Game
      </button>
    </div>
  );
};
