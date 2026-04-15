import Phaser from "phaser";
import { EditorScene } from "../scenes/EditorScene";

/**
 * Phaser 게임을 지정된 컨테이너에 마운트합니다.
 * React 컴포넌트에서 호출하여 사용합니다.
 *
 * @param containerId - Phaser 캔버스를 마운트할 div의 id
 * @returns Phaser.Game 인스턴스 (필요시 제거 가능)
 */
export function initPhaser(containerId: string): Phaser.Game {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Phaser mount container #${containerId} not found`);
  }

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: containerId,
    width,
    height,
    backgroundColor: "#111827",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [EditorScene],
  });

  // ─── Resize ───
  // ResizeObserver를 사용하여 컨테이너 크기 변화를 감지합니다.
  // React 패널 토글/리사이즈 시 캔버스가 자동 조절됩니다.
  const resizeObserver = new ResizeObserver(() => {
    const el = document.getElementById(containerId);
    if (el) {
      game.scale.resize(el.clientWidth, el.clientHeight);
    }
  });
  resizeObserver.observe(container);

  return game;
}
