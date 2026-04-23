// ─── Placement Handler ───
// 요소 배치 관련 로직: 프리뷰 생성/갱신/정리, 드래그 영역에서 요소 생성.

import Phaser from "phaser";
import type { ElementType, EditableElement } from "@/types/map";
import { ElementManager } from "../ElementManager";
import { isHorizontalBar, isVerticalBar, isRectArea } from "@/types/type-guards";

// ─── Placement State ───

export interface PlacementState {
  startX: number;
  startY: number;
  preview: Phaser.GameObjects.Graphics | null;
}

export function createPlacementState(): PlacementState {
  return { startX: 0, startY: 0, preview: null };
}

// ─── Placement Actions ───

/** rect 요소 드래그 배치 시작 */
export function startPlacing(
  state: PlacementState,
  scene: Phaser.Scene,
  snappedX: number,
  snappedY: number,
): void {
  state.startX = snappedX;
  state.startY = snappedY;

  cleanupPlacementPreview(state);
  state.preview = scene.add.graphics();
  state.preview.setDepth(1000);
}

/** 배치 프리뷰 갱신 */
export function updatePlacementPreview(
  state: PlacementState,
  snappedX: number,
  snappedY: number,
): void {
  if (!state.preview) return;

  const x = Math.min(state.startX, snappedX);
  const y = Math.min(state.startY, snappedY);
  const w = Math.abs(snappedX - state.startX);
  const h = Math.abs(snappedY - state.startY);

  state.preview.clear();
  state.preview.lineStyle(2, 0xffffff, 0.8);
  state.preview.strokeRect(x, y, w, h);
  state.preview.fillStyle(0xffffff, 0.15);
  state.preview.fillRect(x, y, w, h);
}

/** 배치 프리뷰 정리 */
export function cleanupPlacementPreview(state: PlacementState): void {
  if (state.preview) {
    state.preview.destroy();
    state.preview = null;
  }
}

/**
 * 드래그 영역으로 rect 요소를 생성합니다.
 * floor/platform: leftX=min, rightX=max, topY=min (높이는 기본값)
 * wall: x, topY=min, bottomY=max
 * hazards: x=min, y=min, width=diff, height=diff
 */
export function createRectFromDrag(
  elementManager: ElementManager,
  type: ElementType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): EditableElement | null {
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const maxX = Math.max(startX, endX);
  const maxY = Math.max(startY, endY);

  // 기본 위치에 요소 생성
  const el = elementManager.createElement(type, minX, minY);
  if (!el) return null;

  // 드래그 영역에 맞게 크기 조정 (type-guards로 안전한 접근)
  if (isHorizontalBar(el)) {
    el.leftX = minX;
    el.rightX = maxX;
    el.topY = minY;
  } else if (isVerticalBar(el)) {
    el.x = minX + 8;
    el.topY = minY;
    el.bottomY = maxY;
  } else if (isRectArea(el)) {
    el.x = minX;
    el.y = minY;
    el.width = maxX - minX;
    el.height = maxY - minY;
  }

  // 렌더러 갱신
  const renderer = elementManager.getRenderer(el.id);
  if (renderer) {
    renderer.updateFromData();
  }

  return el;
}
