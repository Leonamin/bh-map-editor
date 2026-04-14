import Phaser from "phaser";
import { EDITOR_CONFIG } from "@/config";
import { editorState } from "@/state/EditorState";

/**
 * 그리드 오버레이 — Phaser.GameObjects.Graphics로 월드 공간에 그리드를 그립니다.
 * 줌 레벨에 따라 자동으로 표시/숨김 처리하며, 뷰포트 내 가시 영역만 렌더링합니다.
 */
export class GridOverlay extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene) {
    super(scene);
    scene.add.existing(this);
    this.setDepth(0);
  }

  /**
   * 현재 카메라 뷰포트와 줌 레벨을 기준으로 그리드를 다시 그립니다.
   * @param zoom 현재 카메라 줌 레벨
   */
  redraw(zoom: number): void {
    this.clear();

    // 줌이 너무 작으면 그리드를 숨김
    if (zoom < 0.5) {
      return;
    }

    const camera = this.scene.cameras.main;
    const gridSize = editorState.gridSize;

    // 월드 좌표계에서 카메라가 보이는 영역 계산
    const worldLeft = camera.worldView.x;
    const worldTop = camera.worldView.y;
    const worldRight = camera.worldView.x + camera.worldView.width;
    const worldBottom = camera.worldView.y + camera.worldView.height;

    // 그리드 선의 시작/끝을 gridSize에 맞춰 정렬
    const startX = Math.floor(worldLeft / gridSize) * gridSize;
    const endX = Math.ceil(worldRight / gridSize) * gridSize;
    const startY = Math.floor(worldTop / gridSize) * gridSize;
    const endY = Math.ceil(worldBottom / gridSize) * gridSize;

    // 줌에 따른 알파 조정 (줌이 작을수록 더 투명하게)
    const alpha = EDITOR_CONFIG.GRID_ALPHA * Math.min(1, (zoom - 0.5) / 0.5);

    this.lineStyle(1, EDITOR_CONFIG.GRID_COLOR, alpha);

    // 수직선
    for (let x = startX; x <= endX; x += gridSize) {
      this.beginPath();
      this.moveTo(x, startY);
      this.lineTo(x, endY);
      this.strokePath();
    }

    // 수평선
    for (let y = startY; y <= endY; y += gridSize) {
      this.beginPath();
      this.moveTo(startX, y);
      this.lineTo(endX, y);
      this.strokePath();
    }
  }
}
