import Phaser from "phaser";
import type {
  EditableElement,
  ElementType,
  SpawnPoint,
} from "@/types/map";
import {
  detectElementType,
} from "@/types/type-guards";
import { EDITOR_CONFIG } from "@/config";
import { EditorElementRenderer } from "./EditorElementRenderer";

type PointElementType = "spawn_point" | "weapon_spawn" | "item_spawn";

/**
 * 포인트 기반 요소(spawn_point, weapon_spawn, item_spawn)의 렌더러입니다.
 * 각 요소 타입에 따라 다른 모양(원, 다이아몬드, 별)과 라벨을 표시합니다.
 */
export class PointElementRenderer extends EditorElementRenderer {
  elementType: ElementType;
  private label: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, data: EditableElement) {
    super(scene, data);
    this.elementType = detectElementType(data) as PointElementType;
    this.drawShape();
  }

  // ─── Position helpers ───

  private getPos(): { x: number; y: number } {
    const data = this.elementData as unknown as SpawnPoint;
    return { x: data.x, y: data.y };
  }

  // ─── Abstract implementations ───

  drawShape(): void {
    this.graphics.clear();
    const pos = this.getPos();
    const r = EDITOR_CONFIG.POINT_RADIUS;
    const type = this.elementType;

    if (type === "spawn_point") {
      this.drawSpawnPoint(pos.x, pos.y, r);
    } else if (type === "weapon_spawn") {
      this.drawWeaponSpawn(pos.x, pos.y, r);
    } else if (type === "item_spawn") {
      this.drawItemSpawn(pos.x, pos.y, r);
    }

    // 라벨 그리기
    this.drawLabel(pos.x, pos.y);
  }

  getElementBounds(): { x: number; y: number; width: number; height: number } {
    const pos = this.getPos();
    const r = EDITOR_CONFIG.POINT_RADIUS;
    return {
      x: pos.x - r,
      y: pos.y - r,
      width: r * 2,
      height: r * 2,
    };
  }

  updateFromData(): void {
    this.drawShape();
    this.drawSelectionOutline();
    // 포인트 요소는 리사이즈 핸들이 없음
  }

  drawSelectionOutline(): void {
    // getBounds를 재계산하기 위해 drawShape이 먼저 호출되어야 함
    const pos = this.getPos();
    const r = EDITOR_CONFIG.POINT_RADIUS;

    this.selectionOutline.clear();
    if (!this.isSelected()) return;

    this.selectionOutline.lineStyle(
      2,
      EDITOR_CONFIG.COLORS.selection,
      1
    );
    this.selectionOutline.strokeCircle(pos.x, pos.y, r + 2);
  }

  drawResizeHandles(): void {
    // 포인트 요소는 리사이즈 불가 → 핸들 없음
    this.resizeHandles.forEach((h) => h.destroy());
    this.resizeHandles = [];
  }

  // ─── Shape drawing ───

  private drawSpawnPoint(cx: number, cy: number, r: number): void {
    this.graphics.fillStyle(EDITOR_CONFIG.COLORS.spawn, 1);
    this.graphics.fillCircle(cx, cy, r);
    this.graphics.lineStyle(1, 0xffffff, 0.5);
    this.graphics.strokeCircle(cx, cy, r);
  }

  private drawWeaponSpawn(cx: number, cy: number, r: number): void {
    this.graphics.fillStyle(EDITOR_CONFIG.COLORS.weapon, 1);
    // 다이아몬드: 45도 회전된 정사각형
    const s = r * 0.85; // 절반 크기
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy - s);
    this.graphics.lineTo(cx + s, cy);
    this.graphics.lineTo(cx, cy + s);
    this.graphics.lineTo(cx - s, cy);
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.lineStyle(1, 0xffffff, 0.5);
    this.graphics.strokePath();
  }

  private drawItemSpawn(cx: number, cy: number, r: number): void {
    this.graphics.fillStyle(EDITOR_CONFIG.COLORS.item, 1);
    // 5개 뾰족 별
    const outerR = r;
    const innerR = r * 0.45;
    const points = 5;

    this.graphics.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / 2) * -1 + (Math.PI / points) * i;
      const radius = i % 2 === 0 ? outerR : innerR;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) {
        this.graphics.moveTo(px, py);
      } else {
        this.graphics.lineTo(px, py);
      }
    }
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.lineStyle(1, 0xffffff, 0.5);
    this.graphics.strokePath();
  }

  // ─── Label ───

  private drawLabel(cx: number, cy: number): void {
    // 기존 라벨 제거
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }

    let text: string;
    if (this.elementType === "spawn_point") {
      text = "S";
    } else if (this.elementType === "weapon_spawn") {
      text = "W";
    } else {
      text = "I";
    }

    this.label = this.scene.add.text(cx, cy, text, {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    this.label.setOrigin(0.5, 0.5);
    this.label.setDepth(1);
    this.add(this.label);
  }

  // ─── Cleanup ───

  destroy(): void {
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }
    super.destroy();
  }
}
