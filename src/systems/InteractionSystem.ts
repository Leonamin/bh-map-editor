import Phaser from "phaser";
import { editorState } from "@/state/EditorState";
import { ElementManager } from "./ElementManager";
import { EditorElementRenderer } from "@/objects/EditorElementRenderer";
import { useEditorStore } from "@/store/editorStore";
import type { ElementType } from "@/types/map";

// 핸들러 모듈
import {
  createPlacementState,
  startPlacing,
  updatePlacementPreview,
  cleanupPlacementPreview,
  createRectFromDrag,
} from "./interaction/PlacementHandler";
import {
  DragState,
  createDragState,
  updateDragPosition,
} from "./interaction/DragHandler";
import {
  ResizeState,
  hitTestResizeHandles,
  getOppositeCorner,
  updateResizePosition,
} from "./interaction/ResizeHandler";
import {
  handleUndo,
  handleRedo,
  handleDuplicate,
  createDomKeydownHandler,
} from "./interaction/KeyboardHandler";

type InteractionState = "idle" | "placing" | "dragging" | "resizing" | "panning";

/**
 * InteractionSystem — 요소 배치, 선택, 이동, 리사이즈, 카메라 팬 등
 * 모든 마우스/키보드 인터랙션을 관리합니다.
 *
 * 핸들러 모듈과 협력하는 코디네이터 역할.
 * 상태 머신 라우팅과 공유 상태만 관리합니다.
 */
export class InteractionSystem {
  private scene: Phaser.Scene;
  private elementManager: ElementManager;
  private state: InteractionState = "idle";

  // ─── Placing state (delegated to PlacementHandler) ───
  private placingState = createPlacementState();

  // ─── Dragging state (delegated to DragHandler) ───
  private dragState: DragState | null = null;
  private dragRenderer: EditorElementRenderer | null = null;

  // ─── Resizing state (delegated to ResizeHandler) ───
  private resizeState: ResizeState | null = null;
  private resizingRenderer: EditorElementRenderer | null = null;

  // ─── Panning state ───
  private panStartScrollX: number = 0;
  private panStartScrollY: number = 0;
  private panStartPointerX: number = 0;
  private panStartPointerY: number = 0;

  // ─── Callbacks ───
  onSelectionChange?: (elementId: string | null) => void;
  onElementUpdate?: (elementId: string) => void;
  onExportRequested?: () => void;
  onImportRequested?: () => void;
  onToastMessage?: (message: string) => void;

  // ─── P3: 더블클릭 감지 ───
  private lastClickTime = 0;
  private lastClickId: string | null = null;
  private static readonly DOUBLE_CLICK_THRESHOLD = 350; // ms

  constructor(scene: Phaser.Scene, elementManager: ElementManager) {
    this.scene = scene;
    this.elementManager = elementManager;
  }

  /**
   * 입력 리스너를 설정합니다. EditorScene.create()에서 한 번만 호출합니다.
   */
  setupInput(): void {
    // ─── Pointer down ───
    this.scene.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        const uiAwareScene = this.scene as Phaser.Scene & {
          isPointerOverUI?: (x: number, y: number) => boolean;
        };
        if (uiAwareScene.isPointerOverUI?.(pointer.x, pointer.y)) {
          return;
        }

        const worldX = pointer.worldX;
        const worldY = pointer.worldY;

        // 우클릭 / 중클릭 → 카메라 팬
        if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
          this.state = "panning";
          this.panStartPointerX = pointer.x;
          this.panStartPointerY = pointer.y;
          const camera = this.scene.cameras.main;
          this.panStartScrollX = camera.scrollX;
          this.panStartScrollY = camera.scrollY;
          return;
        }

        // 좌클릭
        if (pointer.leftButtonDown()) {
          const tool = editorState.activeTool;

          if (tool === "select") {
            this.handleSelectDown(worldX, worldY);
          } else if (pointer.event?.altKey) {
            // P3-3: Alt+클릭 임시 선택 — 도구 유지, 요소만 선택
            const hit = this.elementManager.hitTest(worldX, worldY);
            if (hit) {
              this.elementManager.selectElement(hit.elementData.id);
              this.onSelectionChange?.(hit.elementData.id);
            }
          } else {
            // P3-1: 자동 선택 분기 — 요소 위 클릭=선택, 빈 공간=배치
            const hit = this.elementManager.hitTest(worldX, worldY);
            if (hit) {
              this.handleSelectDown(worldX, worldY);
            } else {
              this.handlePlacementDown(worldX, worldY, tool as ElementType);
            }
          }
        }
      },
    );

    // ─── Pointer move ───
    this.scene.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;

        switch (this.state) {
          case "panning":
            this.handlePanning(pointer);
            break;
          case "placing":
            updatePlacementPreview(this.placingState, this.snap(worldX), this.snap(worldY));
            break;
          case "dragging":
            this.handleDraggingMove(worldX, worldY);
            break;
          case "resizing":
            this.handleResizingMove(worldX, worldY);
            break;
        }
      },
    );

    // ─── Pointer up ───
    this.scene.input.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer) => {
        this.handlePointerUp(pointer);
      },
    );

    // ─── Phaser Keyboard (single keys) ───
    this.scene.input.keyboard?.on("keydown-DELETE", () => {
      if (editorState.selectedId) {
        const deletedId = editorState.selectedId;
        this.elementManager.removeElement(deletedId);
        this.onSelectionChange?.(null);
        this.onToastMessage?.(`요소 삭제됨: ${deletedId}`);
      }
    });

    this.scene.input.keyboard?.on("keydown-ESC", () => {
      this.elementManager.selectElement(null);
      this.onSelectionChange?.(null);
      editorState.setActiveTool("select");

      // 배치 취소 시 프리뷰 제거
      cleanupPlacementPreview(this.placingState);
      this.state = "idle";
    });

    // ─── DOM Keyboard (modifier combos — cross-platform) ───
    const kbCallbacks = {
      onExportRequested: () => this.onExportRequested?.(),
      onImportRequested: () => this.onImportRequested?.(),
      onUndo: () => this.dispatchUndo(),
      onRedo: () => this.dispatchRedo(),
      onDuplicate: () => this.dispatchDuplicate(),
    };
    this._domKeydownHandler = createDomKeydownHandler(kbCallbacks);
    this.scene.game.canvas.addEventListener("keydown", this._domKeydownHandler);
  }

  // ─── Keyboard dispatch (wraps handler module with callbacks) ───

  private dispatchUndo(): void {
    handleUndo(this.elementManager, {
      onSelectionChange: (id) => this.onSelectionChange?.(id),
      onElementUpdate: (id) => this.onElementUpdate?.(id),
      onToastMessage: (msg) => this.onToastMessage?.(msg),
    });
  }

  private dispatchRedo(): void {
    handleRedo(this.elementManager, {
      onSelectionChange: (id) => this.onSelectionChange?.(id),
      onElementUpdate: (id) => this.onElementUpdate?.(id),
      onToastMessage: (msg) => this.onToastMessage?.(msg),
    });
  }

  private dispatchDuplicate(): void {
    handleDuplicate(this.elementManager, {
      onSelectionChange: (id) => this.onSelectionChange?.(id),
      onElementUpdate: (id) => this.onElementUpdate?.(id),
      onToastMessage: (msg) => this.onToastMessage?.(msg),
    });
  }

  /**
   * Scene shutdown 시 DOM 리스너를 정리합니다.
   */
  destroy(): void {
    if (this._domKeydownHandler) {
      this.scene.game.canvas.removeEventListener("keydown", this._domKeydownHandler);
      this._domKeydownHandler = null;
    }
    cleanupPlacementPreview(this.placingState);
  }

  /** DOM keydown 리스너 참조 (cleanup용) */
  private _domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // ─── Select tool: pointer down ───

  private handleSelectDown(worldX: number, worldY: number): void {
    // 선택된 요소가 있으면 리사이즈 핸들 우선 확인
    const selectedRenderer = this.elementManager.getRenderer(
      editorState.selectedId || "",
    );
    if (selectedRenderer?.isSelected()) {
      const handleIndex = hitTestResizeHandles(
        selectedRenderer,
        worldX,
        worldY,
      );
      if (handleIndex >= 0) {
        this.state = "resizing";
        this.resizingRenderer = selectedRenderer;

        const bounds = selectedRenderer.getElementBounds();
        const opposite = getOppositeCorner(handleIndex, bounds);
        this.resizeState = { oppositeX: opposite.x, oppositeY: opposite.y };
        return;
      }
    }

    // 요소 히트 테스트
    const hit = this.elementManager.hitTest(worldX, worldY);
    if (hit) {
      // P3-2: 더블클릭 감지 → Properties 패널 포커스 요청
      const now = Date.now();
      const hitId = hit.elementData.id;
      if (
        hitId === this.lastClickId &&
        now - this.lastClickTime < InteractionSystem.DOUBLE_CLICK_THRESHOLD
      ) {
        useEditorStore.getState().requestFocusProperties();
        this.lastClickTime = 0;
        this.lastClickId = null;
      } else {
        this.lastClickTime = now;
        this.lastClickId = hitId;
      }

      this.state = "dragging";
      this.dragRenderer = hit;

      const b = hit.getElementBounds();
      this.dragState = createDragState(worldX, worldY, b);

      this.elementManager.selectElement(hit.elementData.id);
      this.onSelectionChange?.(hit.elementData.id);
    } else {
      this.elementManager.selectElement(null);
      this.onSelectionChange?.(null);
    }
  }

  // ─── Placement tool: pointer down ───

  private handlePlacementDown(
    worldX: number,
    worldY: number,
    type: ElementType,
  ): void {
    const snappedX = this.snap(worldX);
    const snappedY = this.snap(worldY);

    // 포인트 타입: 즉시 배치
    if (
      type === "spawn_point" ||
      type === "weapon_spawn" ||
      type === "item_spawn"
    ) {
      const el = this.elementManager.createElement(type, snappedX, snappedY);
      if (el) {
        this.elementManager.selectElement(el.id);
        this.onSelectionChange?.(el.id);
      }
    } else {
      // rect 타입: 드래그 배치 시작
      this.state = "placing";
      startPlacing(this.placingState, this.scene, snappedX, snappedY);
    }
  }

  // ─── Pointer move handlers ───

  private handlePanning(pointer: Phaser.Input.Pointer): void {
    const camera = this.scene.cameras.main;
    const dx = pointer.x - this.panStartPointerX;
    const dy = pointer.y - this.panStartPointerY;

    camera.scrollX = this.panStartScrollX - dx / camera.zoom;
    camera.scrollY = this.panStartScrollY - dy / camera.zoom;
  }

  private handleDraggingMove(worldX: number, worldY: number): void {
    if (!this.dragRenderer || !this.dragState) return;

    const snappedX = this.snap(worldX - this.dragState.offsetX);
    const snappedY = this.snap(worldY - this.dragState.offsetY);

    const el = this.dragRenderer.elementData;

    updateDragPosition(el, snappedX, snappedY);
    this.dragRenderer.updateFromData();
  }

  private handleResizingMove(worldX: number, worldY: number): void {
    if (!this.resizingRenderer || !this.resizeState) return;

    const snappedX = this.snap(worldX);
    const snappedY = this.snap(worldY);

    const el = this.resizingRenderer.elementData;

    const updated = updateResizePosition(
      el, snappedX, snappedY,
      this.resizeState.oppositeX, this.resizeState.oppositeY,
    );
    if (updated) {
      this.resizingRenderer.updateFromData();
    }
  }

  // ─── Pointer up handler ───

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.state === "placing") {
      const snappedX = this.snap(pointer.worldX);
      const snappedY = this.snap(pointer.worldY);

      const type = editorState.activeTool as ElementType;

      // 드래그 거리가 충분하면 드래그 영역으로 배치
      const dx = Math.abs(snappedX - this.placingState.startX);
      const dy = Math.abs(snappedY - this.placingState.startY);
      const gridSize = editorState.gridSize;

      if (dx >= gridSize / 2 || dy >= gridSize / 2) {
        const el = createRectFromDrag(
          this.elementManager, type,
          this.placingState.startX, this.placingState.startY,
          snappedX, snappedY,
        );
        if (el) {
          this.elementManager.selectElement(el.id);
          this.onSelectionChange?.(el.id);
        }
      } else {
        // 단일 클릭: 기본 크기로 요소 생성
        const el = this.elementManager.createElement(
          type,
          this.placingState.startX,
          this.placingState.startY,
        );
        if (el) {
          this.elementManager.selectElement(el.id);
          this.onSelectionChange?.(el.id);
        }
      }

      cleanupPlacementPreview(this.placingState);
    }

    if (this.state === "dragging" || this.state === "resizing") {
      if (editorState.selectedId) {
        this.onElementUpdate?.(editorState.selectedId);
      }
    }

    // 팬 종료
    if (
      this.state === "panning" &&
      (pointer.rightButtonReleased() || pointer.middleButtonReleased())
    ) {
      // panning은 여기서 idle로 복귀
    }

    // dragging/placing/resizing 중이 아니면 유지 (panning은 pointerup에서 처리)
    if (this.state !== "idle") {
      this.state = "idle";
    }
  }

  // ─── Utility ───

  private snap(value: number): number {
    if (!editorState.snapEnabled) return value;
    const gridSize = editorState.gridSize;
    return Math.round(value / gridSize) * gridSize;
  }
}
