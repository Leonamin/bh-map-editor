import { PhaserCanvas } from "./components/PhaserCanvas";

/**
 * App — BH Map Editor 루트 컴포넌트.
 *
 * P0: Phaser 캔버스를 전체 화면에 마운트. 기능 변화 없음.
 * P1 이후: Toolbar, Properties, Status 패널 추가.
 */
export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#111827",
      }}
    >
      {/* P1+: Toolbar 영역 */}

      {/* P0: Phaser 캔버스가 전체 화면을 차지 */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* P2+: Left Panel (Tool List) */}
        <PhaserCanvas />
        {/* P2+: Right Panel (Properties) */}
      </div>

      {/* P2+: StatusBar 영역 */}
    </div>
  );
}
