// ─── Resize Handler ───
// 요소 리사이즈 관련 로직: 핸들 히트 테스트, 리사이즈 위치 갱신.

import type { EditableElement } from "@/types/map";
import { editorState } from "@/state/EditorState";
import { isHorizontalBar, isVerticalBar, isRectArea } from "@/types/type-guards";
import { EDITOR_CONFIG } from "@/config";
import type { EditorElementRenderer } from "@/objects/EditorElementRenderer";

// ─── Resize State ───

export interface ResizeState {
  oppositeX: number;
  oppositeY: number;
}

// ─── Resize Actions ───

/**
 * 리사이즈 핸들의 히트 테스트를 수행합니다.
 * 핸들 인덱스: 0=TL, 1=TR, 2=BL, 3=BR
 * 포인트 요소는 항상 -1을 반환합니다.
 */
export function hitTestResizeHandles(
  renderer: EditorElementRenderer,
  worldX: number,
  worldY: number,
): number {
  const bounds = renderer.getElementBounds();
  const hs = EDITOR_CONFIG.RESIZE_HANDLE_SIZE;
  const halfHs = hs / 2;

  const corners = [
    { cx: bounds.x, cy: bounds.y }, // 0: TL
    { cx: bounds.x + bounds.width, cy: bounds.y }, // 1: TR
    { cx: bounds.x, cy: bounds.y + bounds.height }, // 2: BL
    { cx: bounds.x + bounds.width, cy: bounds.y + bounds.height }, // 3: BR
  ];

  for (let i = 0; i < corners.length; i++) {
    const { cx, cy } = corners[i];
    if (
      worldX >= cx - halfHs &&
      worldX <= cx + halfHs &&
      worldY >= cy - halfHs &&
      worldY <= cy + halfHs
    ) {
      return i;
    }
  }

  return -1;
}

/** 핸들 인덱스로 대각선 반대편 고정 좌표를 계산합니다. */
export function getOppositeCorner(
  handleIndex: number,
  bounds: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  switch (handleIndex) {
    case 0: return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }; // TL → BR
    case 1: return { x: bounds.x, y: bounds.y + bounds.height }; // TR → BL
    case 2: return { x: bounds.x + bounds.width, y: bounds.y }; // BL → TR
    case 3: return { x: bounds.x, y: bounds.y }; // BR → TL
    default: return { x: bounds.x, y: bounds.y };
  }
}

/**
 * 리사이즈 중 요소 크기를 갱신합니다.
 * type-guards를 사용하여 안전하게 타입별 크기를 업데이트합니다.
 */
export function updateResizePosition(
  el: EditableElement,
  snappedX: number,
  snappedY: number,
  oppositeX: number,
  oppositeY: number,
): boolean {
  const gridSize = editorState.gridSize;
  const newX = Math.min(snappedX, oppositeX);
  const newY = Math.min(snappedY, oppositeY);
  const finalW = Math.max(Math.abs(snappedX - oppositeX), gridSize);
  const finalH = Math.max(Math.abs(snappedY - oppositeY), gridSize);

  if (isHorizontalBar(el)) {
    el.leftX = newX;
    el.rightX = newX + finalW;
    el.topY = newY;
    return true;
  } else if (isVerticalBar(el)) {
    el.x = newX + 8;
    el.topY = newY;
    el.bottomY = newY + finalH;
    return true;
  } else if (isRectArea(el)) {
    el.x = newX;
    el.y = newY;
    el.width = finalW;
    el.height = finalH;
    return true;
  }

  // 포인트 요소는 리사이즈 불가
  return false;
}
