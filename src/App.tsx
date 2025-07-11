import { Game } from "./screens/Game";
import { Over } from "./screens/Over";
import { Start } from "./screens/Start";
import { useGameStore } from "./store/Game";

function App() {
  const screen = useGameStore((state) => state.screen);

  switch (screen) {
    case "game":
      return <Game />;
    case "over":
      return <Over />;
    default:
      return <Start />;
  }
}

export default App;
