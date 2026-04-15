import { create } from "zustand";
import type {
  EditableElement,
  ElementType,
  MapData,
} from "@/types/map";

export type ToolType = "select" | ElementType;

/**
 * Phaser ↔ React 양방향 상태 공유 스토어.
 *
 * P0에서는 React 컴포넌트가 Phaser의 editorState를 읽기 위한 브릿지 역할.
 * P1 이후에는 editorState의 역할을 점진적으로 이관.
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
}

export const useEditorStore = create<EditorStore>((set) => ({
  // ─── Tool ───
  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),

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
  setGridSize: (size) => set({ gridSize: size }),
  snapEnabled: true,
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
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
}));
