import { editorState } from "@/state/EditorState";
import { downloadMapFile } from "@/utils/map-io";
import type { ElementType } from "@/types/map";

type ToolType = "select" | ElementType;

/**
 * Toolbar UI를 초기화하고 이벤트를 바인딩합니다.
 */
export function initToolbar(
  onImport: () => void,
): void {
  const toolbar = document.getElementById("toolbar");
  if (!toolbar) return;

  // ─── 요소/선택 도구 버튼 ───
  const toolBtns = toolbar.querySelectorAll<HTMLButtonElement>(".tool-btn");

  function updateActiveButtons(): void {
    toolBtns.forEach((btn) => {
      const tool = btn.dataset.tool as ToolType;
      if (tool === editorState.activeTool) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  toolBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool as ToolType;
      editorState.setActiveTool(tool);
      updateActiveButtons();
    });
  });

  // ─── 그리드 토글 ───
  const gridBtn = document.getElementById("btn-grid-toggle");
  if (gridBtn) {
    updateGridButton(gridBtn);
    gridBtn.addEventListener("click", () => {
      editorState.gridSize = editorState.gridSize === 16 ? 40 : 16;
      updateGridButton(gridBtn);
    });
  }

  // ─── 스냅 토글 ───
  const snapBtn = document.getElementById("btn-snap-toggle");
  if (snapBtn) {
    updateSnapButton(snapBtn);
    snapBtn.addEventListener("click", () => {
      editorState.snapEnabled = !editorState.snapEnabled;
      updateSnapButton(snapBtn);
    });
  }

  // ─── Export ───
  const exportBtn = document.getElementById("btn-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      downloadMapFile(editorState.mapData);
    });
  }

  // ─── Import ───
  const importBtn = document.getElementById("btn-import");
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      onImport();
    });
  }

  // 초기 활성 버튼 설정
  updateActiveButtons();
}

function updateGridButton(btn: HTMLElement): void {
  btn.textContent = `Grid: ${editorState.gridSize}`;
  if (editorState.gridSize === 16) {
    btn.classList.add("on");
  } else {
    btn.classList.remove("on");
  }
}

function updateSnapButton(btn: HTMLElement): void {
  btn.textContent = `Snap: ${editorState.snapEnabled ? "ON" : "OFF"}`;
  if (editorState.snapEnabled) {
    btn.classList.add("on");
  } else {
    btn.classList.remove("on");
  }
}
