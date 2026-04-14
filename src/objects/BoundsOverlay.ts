import Phaser from "phaser";
import { EDITOR_CONFIG } from "@/config";
import type { MapData, Bounds } from "@/types/map";

/** 대시선 길이 상수 */
const DASH_LENGTH = 10;
const GAP_LENGTH = 6;

interface BoundsLabel {
  bounds: Bounds;
  color: number;
  label: string;
}

/**
 * Bounds 오버레이 — visualBounds, gameplayBounds, deathBounds를
 * 대시선 사각형으로 월드 공간에 표시합니다.
 */
export class BoundsOverlay extends Phaser.GameObjects.Graphics {
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene);
    scene.add.existing(this);
    this.setDepth(1);
  }

  /**
   * MapData의 bounds 정보를 바탕으로 대시선 사각형과 라벨을 다시 그립니다.
   */
  redraw(mapData: MapData): void {
    this.clear();

    // 기존 라벨 제거
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];

    const boundsList: BoundsLabel[] = [
      {
        bounds: mapData.visualBounds,
        color: EDITOR_CONFIG.COLORS.visualBounds,
        label: "Visual Bounds",
      },
      {
        bounds: mapData.gameplayBounds,
        color: EDITOR_CONFIG.COLORS.gameplayBounds,
        label: "Gameplay Bounds",
      },
      {
        bounds: mapData.deathBounds,
        color: EDITOR_CONFIG.COLORS.deathBounds,
        label: "Death Bounds",
      },
    ];

    for (const { bounds, color, label } of boundsList) {
      this.drawDashedRect(
        bounds.left,
        bounds.top,
        bounds.right,
        bounds.bottom,
        color,
      );
      this.createLabel(bounds.left, bounds.top, label, color);
    }
  }

  /**
   * 대시선 사각형을 그립니다.
   */
  private drawDashedRect(
    left: number,
    top: number,
    right: number,
    bottom: number,
    color: number,
  ): void {
    this.lineStyle(2, color, 0.8);

    // 상단
    this.drawDashedLine(left, top, right, top);
    // 하단
    this.drawDashedLine(left, bottom, right, bottom);
    // 좌측
    this.drawDashedLine(left, top, left, bottom);
    // 우측
    this.drawDashedLine(right, top, right, bottom);
  }

  /**
   * 두 점 사이에 대시선을 그립니다.
   */
  private drawDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    const unitX = dx / distance;
    const unitY = dy / distance;

    let drawn = 0;
    let drawing = true;

    while (drawn < distance) {
      const segmentLength = drawing ? DASH_LENGTH : GAP_LENGTH;
      const remaining = distance - drawn;
      const currentLength = Math.min(segmentLength, remaining);

      if (drawing) {
        const startX = x1 + unitX * drawn;
        const startY = y1 + unitY * drawn;
        const endX = x1 + unitX * (drawn + currentLength);
        const endY = y1 + unitY * (drawn + currentLength);

        this.beginPath();
        this.moveTo(startX, startY);
        this.lineTo(endX, endY);
        this.strokePath();
      }

      drawn += currentLength;
      drawing = !drawing;
    }
  }

  /**
   * bounds 사각형의 좌상단에 텍스트 라벨을 배치합니다.
   */
  private createLabel(
    x: number,
    y: number,
    text: string,
    color: number,
  ): void {
    const hexColor = "#" + color.toString(16).padStart(6, "0");
    const label = this.scene.add.text(x + 4, y + 2, text, {
      fontSize: "11px",
      color: hexColor,
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: { x: 3, y: 1 },
    });
    label.setDepth(this.depth);
    this.labels.push(label);
  }

  /**
   * 씬 전환 시 라벨을 포함하여 정리합니다.
   */
  destroy(fromScene?: boolean): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];
    super.destroy(fromScene);
  }
}
