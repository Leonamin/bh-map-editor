import Phaser from "phaser";
import type { EditableElement, ElementType } from "@/types/map";

/**
 * EditorElementRenderer — 편집 가능한 맵 요소의 시각적 표현을 담당하는 추상 기본 클래스.
 * Phaser.GameObjects.Container를 상속하여 graphics, selectionOutline, resizeHandles를 관리합니다.
 */
export abstract class EditorElementRenderer extends Phaser.GameObjects.Container {
  abstract elementType: ElementType;
  elementData: EditableElement;
  protected graphics: Phaser.GameObjects.Graphics;
  protected selectionOutline: Phaser.GameObjects.Graphics;
  protected resizeHandles: Phaser.GameObjects.Rectangle[];
  private _selected: boolean = false;

  constructor(scene: Phaser.Scene, data: EditableElement) {
    super(scene, 0, 0);
    this.elementData = data;
    this.graphics = scene.add.graphics();
    this.selectionOutline = scene.add.graphics();
    this.resizeHandles = [];
    this.add([this.graphics, this.selectionOutline]);
    this.drawShape();
  }

  /** 요소의 시각적 형태를 그립니다. */
  abstract drawShape(): void;

  /** elementData로부터 위치/크기를 다시 읽어 갱신합니다. */
  abstract updateFromData(): void;

  /** 월드 공간 바운딩 박스를 반환합니다. */
  abstract getElementBounds(): { x: number; y: number; width: number; height: number };

  /** 선택 상태를 설정하고 UI를 업데이트합니다. */
  setSelected(selected: boolean): void {
    this._selected = selected;
    this.drawSelectionOutline();
    this.drawResizeHandles();
  }

  isSelected(): boolean {
    return this._selected;
  }

  /** 선택 시 외곽선을 그립니다. */
  abstract drawSelectionOutline(): void;

  /** 선택 시 리사이즈 핸들을 그립니다. */
  abstract drawResizeHandles(): void;

  /** 주어진 월드 좌표가 요소의 바운딩 박스 내부인지 검사합니다. */
  hitTest(worldX: number, worldY: number): boolean {
    const b = this.getElementBounds();
    return (
      worldX >= b.x &&
      worldX <= b.x + b.width &&
      worldY >= b.y &&
      worldY <= b.y + b.height
    );
  }

  /** 요소 데이터를 부분 업데이트하고 시각을 갱신합니다. */
  syncData(updates: Partial<EditableElement>): void {
    Object.assign(this.elementData, updates);
    this.updateFromData();
  }

  destroy(): void {
    this.graphics.destroy();
    this.selectionOutline.destroy();
    this.resizeHandles.forEach((h) => h.destroy());
    super.destroy();
  }
}
