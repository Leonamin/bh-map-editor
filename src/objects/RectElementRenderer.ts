import type {
  EditableElement,
  ElementType,
  Floor,
  OneWayPlatform,
  SolidWall,
  FallZone,
  InstantKillHazard,
} from "@/types/map";
import { EDITOR_CONFIG } from "@/config";
import { EditorElementRenderer } from "./EditorElementRenderer";

type RectElementType =
  | "floor"
  | "one_way_platform"
  | "solid_wall"
  | "fall_zone"
  | "instant_kill_hazard";

/**
 * 사각형 기반 요소(floor, one_way_platform, solid_wall, fall_zone, instant_kill_hazard)의
 * 렌더러입니다. 각 요소 타입에 따라 다른 색상과 크기 계산 로직을 사용합니다.
 */
export class RectElementRenderer extends EditorElementRenderer {
  elementType: ElementType;

  /** 계산된 사각형 (월드 좌표계) */
  private rect: { x: number; y: number; width: number; height: number } = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  constructor(scene: Phaser.Scene, data: EditableElement) {
    super(scene, data);
    const detected = this.detectType(data);
    this.elementType = detected;
    this.computeRect();
    this.drawShape();
  }

  // ─── Type detection ───

  private detectType(data: EditableElement): RectElementType {
    if ("type" in data) {
      const t = (data as { type: string }).type;
      if (
        t === "floor" ||
        t === "one_way_platform" ||
        t === "solid_wall" ||
        t === "fall_zone" ||
        t === "instant_kill_hazard"
      ) {
        return t;
      }
    }
    // 기본값 (발생하지 않아야 함)
    return "floor";
  }

  // ─── Rect computation ───

  private computeRect(): void {
    const data = this.elementData;
    const type = this.elementType;

    if (type === "floor") {
      const d = data as unknown as Floor;
      this.rect = {
        x: d.leftX,
        y: d.topY,
        width: d.rightX - d.leftX,
        height: 16,
      };
    } else if (type === "one_way_platform") {
      const d = data as unknown as OneWayPlatform;
      this.rect = {
        x: d.leftX,
        y: d.topY,
        width: d.rightX - d.leftX,
        height: 8,
      };
    } else if (type === "solid_wall") {
      const d = data as unknown as SolidWall;
      this.rect = {
        x: d.x - 8,
        y: d.topY,
        width: 16,
        height: d.bottomY - d.topY,
      };
    } else {
      // fall_zone / instant_kill_hazard — both have x, y, width, height
      const d = data as unknown as FallZone | InstantKillHazard;
      this.rect = {
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
      };
    }
  }

  // ─── Abstract implementations ───

  drawShape(): void {
    this.graphics.clear();
    const { x, y, width, height } = this.rect;
    const type = this.elementType;

    if (type === "floor") {
      this.graphics.fillStyle(EDITOR_CONFIG.COLORS.floor, 1);
      this.graphics.fillRect(x, y, width, height);
    } else if (type === "one_way_platform") {
      this.graphics.fillStyle(EDITOR_CONFIG.COLORS.platform, 1);
      this.graphics.fillRect(x, y, width, height);
      // Dashed border
      this.graphics.lineStyle(1, EDITOR_CONFIG.COLORS.platform, 1);
      this.drawDashedRect(this.graphics, x, y, width, height, 6, 4);
    } else if (type === "solid_wall") {
      this.graphics.fillStyle(EDITOR_CONFIG.COLORS.wall, 1);
      this.graphics.fillRect(x, y, width, height);
    } else if (type === "fall_zone") {
      this.graphics.fillStyle(EDITOR_CONFIG.COLORS.fall_zone, 0.3);
      this.graphics.fillRect(x, y, width, height);
      // Thin border for visibility
      this.graphics.lineStyle(1, EDITOR_CONFIG.COLORS.fall_zone, 0.6);
      this.graphics.strokeRect(x, y, width, height);
    } else if (type === "instant_kill_hazard") {
      this.graphics.fillStyle(EDITOR_CONFIG.COLORS.instant_kill, 0.3);
      this.graphics.fillRect(x, y, width, height);
      // Thin border for visibility
      this.graphics.lineStyle(1, EDITOR_CONFIG.COLORS.instant_kill, 0.6);
      this.graphics.strokeRect(x, y, width, height);
    }
  }

  getElementBounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.rect };
  }

  updateFromData(): void {
    this.computeRect();
    this.drawShape();
    this.drawSelectionOutline();
    this.drawResizeHandles();
  }

  drawSelectionOutline(): void {
    this.selectionOutline.clear();
    if (!this.isSelected()) return;

    const { x, y, width, height } = this.rect;
    this.selectionOutline.lineStyle(
      2,
      EDITOR_CONFIG.COLORS.selection,
      1
    );
    this.selectionOutline.strokeRect(x, y, width, height);
  }

  drawResizeHandles(): void {
    // 기존 핸들 제거
    this.resizeHandles.forEach((h) => h.destroy());
    this.resizeHandles = [];

    if (!this.isSelected()) return;

    const { x, y, width, height } = this.rect;
    const hs = EDITOR_CONFIG.RESIZE_HANDLE_SIZE;
    const color = EDITOR_CONFIG.COLORS.selection;

    const corners = [
      { cx: x, cy: y }, // top-left
      { cx: x + width, cy: y }, // top-right
      { cx: x, cy: y + height }, // bottom-left
      { cx: x + width, cy: y + height }, // bottom-right
    ];

    for (const corner of corners) {
      const handle = this.scene.add.rectangle(
        corner.cx,
        corner.cy,
        hs,
        hs,
        color,
        1
      );
      handle.setStrokeStyle(1, 0x000000);
      handle.setOrigin(0.5);
      // 핸들을 컨테이너보다 위에 렌더링하도록 설정
      this.add(handle);
      this.resizeHandles.push(handle);
    }
  }

  // ─── Helpers ───

  /**
   * 점선 사각형을 그립니다.
   */
  private drawDashedRect(
    g: Phaser.GameObjects.Graphics,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    dashLength: number,
    gapLength: number
  ): void {
    // Top edge
    this.drawDashedLine(g, rx, ry, rx + rw, ry, dashLength, gapLength);
    // Bottom edge
    this.drawDashedLine(
      g,
      rx,
      ry + rh,
      rx + rw,
      ry + rh,
      dashLength,
      gapLength
    );
    // Left edge
    this.drawDashedLine(g, rx, ry, rx, ry + rh, dashLength, gapLength);
    // Right edge
    this.drawDashedLine(
      g,
      rx + rw,
      ry,
      rx + rw,
      ry + rh,
      dashLength,
      gapLength
    );
  }

  private drawDashedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len;
    const uy = dy / len;
    let drawn = 0;

    g.beginPath();
    while (drawn < len) {
      const segEnd = Math.min(drawn + dashLength, len);
      g.moveTo(x1 + ux * drawn, y1 + uy * drawn);
      g.lineTo(x1 + ux * segEnd, y1 + uy * segEnd);
      drawn = segEnd + gapLength;
    }
    g.strokePath();
  }
}
