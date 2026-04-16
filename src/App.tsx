import { PhaserCanvas } from "./components/PhaserCanvas";
import { Toolbar } from "./components/Toolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { StatusBar } from "./components/StatusBar";
import "./App.css";

/**
 * App — BH Map Editor 루트 컴포넌트.
 *
 * P2: Toolbar + PhaserCanvas + PropertiesPanel + StatusBar 전체 레이아웃.
 */
export default function App() {
  return (
    <div className="editor-root">
      <Toolbar />
      <div className="editor-main">
        <PhaserCanvas />
        <PropertiesPanel />
      </div>
      <StatusBar />
    </div>
  );
}
