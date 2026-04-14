import { editorState } from "@/state/EditorState";
import type { MapData } from "@/types/map";

/**
 * StatusBar UI 요소 참조
 */
const refs: {
  elementCount: HTMLElement | null;
  zoom: HTMLElement | null;
  grid: HTMLElement | null;
  snap: HTMLElement | null;
} = {
  elementCount: null,
  zoom: null,
  grid: null,
  snap: null,
};

/**
 * StatusBar를 초기화합니다. DOM 요소 참조를 캐시합니다.
 */
export function initStatusBar(): void {
  refs.elementCount = document.getElementById("status-element-count");
  refs.zoom = document.getElementById("status-zoom");
  refs.grid = document.getElementById("status-grid");
  refs.snap = document.getElementById("status-snap");
}

/**
 * StatusBar의 모든 값을 현재 editorState 기준으로 갱신합니다.
 */
export function updateStatusBar(): void {
  // 요소 개수
  if (refs.elementCount) {
    const count = countElements(editorState.mapData);
    refs.elementCount.textContent = String(count);
  }

  // 줌 레벨
  if (refs.zoom) {
    refs.zoom.textContent = `${Math.round(editorState.zoom * 100)}%`;
  }

  // 그리드 크기
  if (refs.grid) {
    refs.grid.textContent = String(editorState.gridSize);
  }

  // 스냅 상태
  if (refs.snap) {
    refs.snap.textContent = editorState.snapEnabled ? "ON" : "OFF";
  }
}

/**
 * MapData 내 편집 가능 요소 전체 개수를 계산합니다.
 */
function countElements(mapData: MapData): number {
  return (
    mapData.collision.length +
    mapData.hazards.length +
    mapData.spawnPoints.length +
    mapData.weaponSpawns.length +
    mapData.itemSpawns.length
  );
}
