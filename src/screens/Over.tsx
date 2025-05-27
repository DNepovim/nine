import { useGameStore } from "../store/Game";

export const Over = () => {
  const { score } = useGameStore();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-6xl font-bold mb-8">Game Over</h1>
      <p className="text-3xl text-gray-600 mb-8">Score: {score}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-8 py-4 bg-gray-800 text-white text-2xl font-bold rounded-lg hover:bg-gray-700 transition-colors"
      >
        New Game
      </button>
    </div>
  );
};
