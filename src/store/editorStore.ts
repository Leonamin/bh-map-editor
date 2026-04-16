import { create } from "zustand";
import type {
  EditableElement,
  ElementType,
  MapData,
} from "@/types/map";
import { editorState } from "@/state/EditorState";

export type ToolType = "select" | ElementType;

/**
 * Phaser ↔ React 양방향 상태 공유 스토어.
 *
 * P0에서는 React 컴포넌트가 Phaser의 editorState를 읽기 위한 브릿지 역할.
 * P2에서는 React → Phaser 방향 액션(undo, redo, setActiveTool) 추가.
 *
 * Phaser 씬 내에서 사용: useEditorStore.getState().setSelectedId(id)
 * React 컴포넌트에서 사용: const selectedId = useEditorStore(s => s.selectedId)
 */
interface EditorStore {
  // ─── Tool ───
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // ─── Selection ───
  selectedId: string | null;
  selectedElement: EditableElement | null;
  setSelectedId: (id: string | null) => void;
  setSelectedElement: (el: EditableElement | null) => void;

  // ─── Map Data (읽기 전용 브릿지) ───
  mapData: MapData | null;
  setMapData: (data: MapData) => void;

  // ─── Grid / Camera ───
  gridSize: number;
  setGridSize: (size: number) => void;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;

  // ─── Undo/Redo ───
  canUndo: boolean;
  canRedo: boolean;
  setUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;

  // ─── Element counts (상태바용) ───
  elementCounts: Record<string, number>;
  setElementCounts: (counts: Record<string, number>) => void;

  // ─── Toast (Phaser → React) ───
  toastMessage: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;

  // ─── React → Phaser 액션 (P2) ───
  undo: () => void;
  redo: () => void;
  triggerImport: () => void;
  triggerExport: () => void;
  triggerDeleteSelected: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;

  // ─── P3: 상호작용 개선 ───
  /** 더블클릭으로 Properties 패널 포커스 요청. React가 이 값을 읽고 처리. */
  focusPropertiesRequest: number; // 타임스탬프로 매번 새 이벤트
  requestFocusProperties: () => void;

  // ─── P4: 속성 인라인 편집 ───
  /** 요소 속성 업데이트 (editorState + 렌더러 갱신) */
  updateElement: (id: string, updates: Partial<EditableElement>) => void;
  /** 맵 메타데이터 업데이트 */
  updateMapMetadata: (updates: Partial<MapData>) => void;
}

function getEditorScene() {
  return (window as any).__editorScene;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // ─── Tool ───
  activeTool: "select",
  setActiveTool: (tool) => {
    editorState.setActiveTool(tool); // Phaser에 알림
    set({ activeTool: tool });       // React에 알림
  },

  // ─── Selection ───
  selectedId: null,
  selectedElement: null,
  setSelectedId: (id) => set({ selectedId: id }),
  setSelectedElement: (el) => set({ selectedElement: el }),

  // ─── Map Data ───
  mapData: null,
  setMapData: (data) => set({ mapData: data }),

  // ─── Grid / Camera ───
  gridSize: 40,
  setGridSize: (size) => {
    editorState.gridSize = size;
    set({ gridSize: size });
  },
  snapEnabled: true,
  setSnapEnabled: (enabled) => {
    editorState.snapEnabled = enabled;
    set({ snapEnabled: enabled });
  },
  zoom: 1,
  setZoom: (zoom) => set({ zoom }),

  // ─── Undo/Redo ───
  canUndo: false,
  canRedo: false,
  setUndoRedoState: (canUndo, canRedo) => set({ canUndo, canRedo }),

  // ─── Element counts ───
  elementCounts: {},
  setElementCounts: (counts) => set({ elementCounts: counts }),

  // ─── Toast ───
  toastMessage: null,
  showToast: (message) => set({ toastMessage: message }),
  clearToast: () => set({ toastMessage: null }),

  // ─── React → Phaser 액션 ───
  undo: () => {
    const cmd = editorState.undo();
    if (cmd) {
      const scene = getEditorScene();
      if (scene) scene.rebuildFromMapData();
    }
  },
  redo: () => {
    const cmd = editorState.redo();
    if (cmd) {
      const scene = getEditorScene();
      if (scene) scene.rebuildFromMapData();
    }
  },
  triggerImport: () => {
    const scene = getEditorScene();
    if (scene) scene.triggerImport();
  },
  triggerExport: () => {
    const scene = getEditorScene();
    if (scene) scene.triggerExport();
  },
  triggerDeleteSelected: () => {
    const scene = getEditorScene();
    if (scene) scene.triggerDeleteSelected();
  },
  toggleGrid: () => {
    const current = get().gridSize;
    const next = current === 40 ? 16 : 40;
    editorState.gridSize = next;
    set({ gridSize: next });
    const scene = getEditorScene();
    if (scene) scene.rebuildGridOverlay();
  },
  toggleSnap: () => {
    const current = get().snapEnabled;
    editorState.snapEnabled = !current;
    set({ snapEnabled: !current });
  },

  // ─── P3: 상호작용 개선 ───
  focusPropertiesRequest: 0,
  requestFocusProperties: () => {
    set({ focusPropertiesRequest: Date.now() });
  },

  // ─── P4: 속성 인라인 편집 ───
  updateElement: (id, updates) => {
    editorState.updateElement(id, updates);
    // 렌더러 갱신
    const scene = getEditorScene();
    if (scene) {
      const renderer = scene.elementManager?.getRenderer(id);
      if (renderer) renderer.updateFromData();
      scene.syncStore();
    }
  },
  updateMapMetadata: (updates) => {
    editorState.updateMapMetadata(updates);
    const scene = getEditorScene();
    if (scene) {
      scene.syncStore();
      // Bounds 오버레이도 갱신
      if (updates.visualBounds || updates.gameplayBounds || updates.deathBounds) {
        scene.rebuildFromMapData();
      }
    }
  },
}));
