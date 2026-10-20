import { MobileRuntime } from "./mobile";
import Prototype from "./Prototype";

export default function App() {
  return (
    <MobileRuntime mode="fullscreen">
      <Prototype />
    </MobileRuntime>
  );
}
