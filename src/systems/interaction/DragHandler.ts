// ─── Drag Handler ───
// 요소 드래그 이동 관련 로직.

import type { EditableElement } from "@/types/map";
import { isHorizontalBar, isVerticalBar, isRectArea } from "@/types/type-guards";
import { EDITOR_CONFIG } from "@/config";

// ─── Drag State ───

export interface DragState {
  offsetX: number;
  offsetY: number;
}

export function createDragState(
  worldX: number,
  worldY: number,
  bounds: { x: number; y: number },
): DragState {
  return {
    offsetX: worldX - bounds.x,
    offsetY: worldY - bounds.y,
  };
}

// ─── Drag Actions ───

/**
 * 드래그 중 요소 위치를 갱신합니다.
 * type-guards를 사용하여 안전하게 타입별 좌표를 업데이트합니다.
 */
export function updateDragPosition(
  el: EditableElement,
  snappedX: number,
  snappedY: number,
): void {
  if (isHorizontalBar(el)) {
    const w = el.rightX - el.leftX;
    el.leftX = snappedX;
    el.rightX = snappedX + w;
    el.topY = snappedY;
  } else if (isVerticalBar(el)) {
    const h = el.bottomY - el.topY;
    el.x = snappedX + 8; // x는 중심선, bounds x = x - 8
    el.topY = snappedY;
    el.bottomY = snappedY + h;
  } else if (isRectArea(el)) {
    el.x = snappedX;
    el.y = snappedY;
  } else {
    // 포인트 요소 (spawn_point, weapon_spawn, item_spawn)
    const d = el as { x: number; y: number };
    d.x = snappedX + EDITOR_CONFIG.POINT_RADIUS;
    d.y = snappedY + EDITOR_CONFIG.POINT_RADIUS;
  }
}

/**
 * 요소 복제 시 위치 오프셋을 적용합니다.
 */
export function offsetElementPosition(
  el: EditableElement,
  offset: number,
): void {
  if (isHorizontalBar(el)) {
    el.leftX += offset;
    el.rightX += offset;
    el.topY += offset;
  } else if (isVerticalBar(el)) {
    el.x += offset;
    el.topY += offset;
    el.bottomY += offset;
  } else if (isRectArea(el)) {
    el.x += offset;
    el.y += offset;
  } else {
    // 포인트 요소
    const d = el as { x: number; y: number };
    d.x += offset;
    d.y += offset;
  }
}
