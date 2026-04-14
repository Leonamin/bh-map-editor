import Phaser from "phaser";
import { EditorScene } from "./scenes/EditorScene";
import { initToolbar } from "./ui/Toolbar";
import { initPropertiesPanel, updateElementPanel, refreshMapMetadata } from "./ui/PropertiesPanel";
import { initStatusBar, updateStatusBar } from "./ui/StatusBar";
import { editorState } from "./state/EditorState";
import { loadMapFromFile } from "./utils/map-io";

// CSS import
import "./ui/styles.css";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#111827",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [EditorScene],
});

// 글로벌 저장
(window as unknown as { game: Phaser.Game }).game = game;

// ─── UI 초기화 ───

/**
 * EditorScene이 준비된 후 UI를 초기화합니다.
 */
function initializeUI(): void {
  const scene = game.scene.getScene("EditorScene") as EditorScene | null;
  if (!scene) {
    // 씬이 아직 준비되지 않은 경우 재시도
    setTimeout(initializeUI, 100);
    return;
  }

  // StatusBar 초기화
  initStatusBar();

  // PropertiesPanel 초기화
  initPropertiesPanel((_elementId: string) => {
    // 요소 속성 변경 시 씬에 알림
    scene.rebuildFromMapData();
    updateStatusBar();
  });

  // Toolbar 초기화 (Import 콜백 포함)
  initToolbar(async () => {
    try {
      const data = await loadMapFromFile();
      editorState.loadMap(data);
      scene.rebuildFromMapData();
      refreshMapMetadata();
      updateElementPanel();
      updateStatusBar();
    } catch (err) {
      console.error("맵 가져오기 실패:", err);
    }
  });

  // 선택 변경 콜백
  scene.setOnSelectionChange(() => {
    updateElementPanel();
    updateStatusBar();
  });

  // 요소 업데이트 콜백 (드래그 등으로 요소가 변경될 때)
  scene.setOnElementUpdate(() => {
    updateElementPanel();
    updateStatusBar();
  });

  // 줌 변경 감지를 위한 주기적 StatusBar 업데이트
  setInterval(() => {
    updateStatusBar();
  }, 500);

  // 초기 상태 표시
  updateStatusBar();
}

// ─── Resize ───

window.addEventListener("resize", () => {
  const container = document.getElementById("game-container");
  if (container) {
    game.scale.resize(container.clientWidth, container.clientHeight);
  }
});

// ─── Game ready ───

game.events.once("ready", () => {
  initializeUI();
});
