// ─── Keyboard Handler ───
// 키보드 단축키 관련 로직: Undo/Redo, Delete, Export/Import, Duplicate.

import type { EditableElement } from "@/types/map";
import { editorState } from "@/state/EditorState";
import { ElementManager } from "../ElementManager";
import { detectElementType } from "@/types/type-guards";
import { offsetElementPosition } from "./DragHandler";
import { isModKey } from "@/utils/platform";

// ─── Callbacks ───

export interface KeyboardCallbacks {
  onSelectionChange: (id: string | null) => void;
  onElementUpdate: (id: string) => void;
  onToastMessage: (message: string) => void;
}

// ─── Keyboard Actions ───

export function handleUndo(
  elementManager: ElementManager,
  callbacks: KeyboardCallbacks,
): void {
  const cmd = editorState.undo();
  if (!cmd) {
    callbacks.onToastMessage("실행 취소할 작업이 없습니다");
    return;
  }

  elementManager.rebuildAll();

  if (cmd.elementId) {
    const el = editorState.findElement(cmd.elementId);
    if (el) {
      elementManager.selectElement(cmd.elementId);
      callbacks.onSelectionChange(cmd.elementId);
      callbacks.onElementUpdate(cmd.elementId);
    } else {
      editorState.selectElement(null);
      callbacks.onSelectionChange(null);
    }
  }

  callbacks.onSelectionChange(editorState.selectedId);
  callbacks.onToastMessage(`실행 취소: ${cmd.type}`);
}

export function handleRedo(
  elementManager: ElementManager,
  callbacks: KeyboardCallbacks,
): void {
  const cmd = editorState.redo();
  if (!cmd) {
    callbacks.onToastMessage("다시 실행할 작업이 없습니다");
    return;
  }

  elementManager.rebuildAll();

  if (cmd.elementId) {
    const el = editorState.findElement(cmd.elementId);
    if (el) {
      elementManager.selectElement(cmd.elementId);
      callbacks.onSelectionChange(cmd.elementId);
      callbacks.onElementUpdate(cmd.elementId);
    } else {
      editorState.selectElement(null);
      callbacks.onSelectionChange(null);
    }
  }

  callbacks.onSelectionChange(editorState.selectedId);
  callbacks.onToastMessage(`다시 실행: ${cmd.type}`);
}

export function handleDuplicate(
  elementManager: ElementManager,
  callbacks: KeyboardCallbacks,
): void {
  const selected = editorState.getSelectedElement();
  if (!selected) {
    callbacks.onToastMessage("복제할 요소를 먼저 선택하세요");
    return;
  }

  // Deep clone the element data
  const cloned = JSON.parse(JSON.stringify(selected)) as EditableElement;

  // Detect element type and generate new ID
  const elementType = detectElementType(cloned);
  const newId = editorState.generateId(elementType);
  (cloned as unknown as Record<string, unknown>).id = newId;

  // Offset position by gridSize
  const gridSize = editorState.gridSize;
  offsetElementPosition(cloned, gridSize);

  // Add to state (this pushes to undo stack)
  editorState.addElement(cloned);

  // Create renderer for the new element
  elementManager.addRenderer(cloned);

  // Select the new element
  elementManager.selectElement(newId);
  callbacks.onSelectionChange(newId);
  callbacks.onElementUpdate(newId);
  callbacks.onToastMessage(`요소 복제됨: ${newId}`);
}

/**
 * DOM 키보드 이벤트 핸들러를 생성합니다.
 * Phaser는 Ctrl/Cmd 조합키를 처리하지 못하므로 DOM 이벤트 사용.
 */
export function createDomKeydownHandler(callbacks: {
  onExportRequested: () => void;
  onImportRequested: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
}): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    // Ctrl/Cmd + S → Export
    if (isModKey(e) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      callbacks.onExportRequested();
      return;
    }
    // Ctrl/Cmd + O → Import
    if (isModKey(e) && e.key.toLowerCase() === "o") {
      e.preventDefault();
      callbacks.onImportRequested();
      return;
    }

    // Ctrl+Z → Undo
    if (isModKey(e) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      callbacks.onUndo();
      return;
    }

    // Ctrl+Shift+Z or Ctrl+Y → Redo
    if (
      (isModKey(e) && e.shiftKey && e.key.toLowerCase() === "z") ||
      (isModKey(e) && e.key.toLowerCase() === "y")
    ) {
      e.preventDefault();
      callbacks.onRedo();
      return;
    }

    // Ctrl+D → Duplicate selected element
    if (isModKey(e) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      callbacks.onDuplicate();
      return;
    }
  };
}
