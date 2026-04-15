import Phaser from "phaser";
import { editorState } from "@/state/EditorState";
import { ElementManager } from "./ElementManager";
import { EditorElementRenderer } from "@/objects/EditorElementRenderer";
import { EDITOR_CONFIG } from "@/config";
import { isModKey } from "@/utils/platform";
import type {
  ElementType,
  Floor,
  OneWayPlatform,
  SolidWall,
  FallZone,
  InstantKillHazard,
  EditableElement,
} from "@/types/map";

type InteractionState = "idle" | "placing" | "dragging" | "resizing" | "panning";

/**
 * InteractionSystem — 요소 배치, 선택, 이동, 리사이즈, 카메라 팬 등
 * 모든 마우스/키보드 인터랙션을 관리합니다.
 *
 * 상태 머신:
 * - idle: 기본 대기
 * - placing: rect 요소 드래그 배치 중
 * - dragging: 요소 이동 중
 * - resizing: 리사이즈 핸들 드래그 중
 * - panning: 우/중클릭 카메라 팬 중
 */
export class InteractionSystem {
  private scene: Phaser.Scene;
  private elementManager: ElementManager;
  private state: InteractionState = "idle";

  // ─── Placing state ───
  private placingStartX: number = 0;
  private placingStartY: number = 0;
  private placingPreview: Phaser.GameObjects.Graphics | null = null;

  // ─── Dragging state ───
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private dragRenderer: EditorElementRenderer | null = null;

  // ─── Resizing state ───
  private resizingRenderer: EditorElementRenderer | null = null;
  private resizingOppositeX: number = 0;
  private resizingOppositeY: number = 0;

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
          } else {
            this.handlePlacementDown(worldX, worldY, tool as ElementType);
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
            this.handlePlacingMove(worldX, worldY);
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

    // ─── Keyboard ───
    this.scene.input.keyboard?.on("keydown-DELETE", () => {
      if (editorState.selectedId) {
        this.elementManager.removeElement(editorState.selectedId);
        this.onSelectionChange?.(null);
      }
    });

    this.scene.input.keyboard?.on("keydown-ESC", () => {
      this.elementManager.selectElement(null);
      this.onSelectionChange?.(null);
      editorState.setActiveTool("select");

      // 배치 취소 시 프리뷰 제거
      this.cleanupPlacingPreview();
      this.state = "idle";
    });

    // ─── DOM Keyboard (modifier combos — cross-platform) ───
    // Phaser는 Ctrl/Cmd 조합키를 처리하지 못하므로 DOM 이벤트 사용.
    // Mac: Cmd+S/Cmd+O, Windows/Linux: Ctrl+S/Ctrl+O
    const domHandler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S → Export
      if (isModKey(e) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        this.onExportRequested?.();
        return;
      }
      // Ctrl/Cmd + O → Import
      if (isModKey(e) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        this.onImportRequested?.();
        return;
      }

      // UX-1: Ctrl+Z → Undo
      if (isModKey(e) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.handleUndo();
        return;
      }

      // UX-1: Ctrl+Shift+Z or Ctrl+Y → Redo
      if (
        (isModKey(e) && e.shiftKey && e.key.toLowerCase() === "z") ||
        (isModKey(e) && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        this.handleRedo();
        return;
      }

      // UX-2: Ctrl+D → Duplicate selected element
      if (isModKey(e) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        this.handleDuplicate();
        return;
      }
    };
    this.scene.game.canvas.addEventListener("keydown", domHandler);
    // cleanup용 저장 (scene shutdown에서 제거 가능하도록)
    this._domKeydownHandler = domHandler;
  }

  // ─── UX-1: Undo ───

  private handleUndo(): void {
    const cmd = editorState.undo();
    if (!cmd) return;

    // Rebuild renderers to match state
    this.elementManager.rebuildAll();

    // If the command involved an element, refresh selection and update
    if (cmd.elementId) {
      const el = editorState.findElement(cmd.elementId);
      if (el) {
        this.elementManager.selectElement(cmd.elementId);
        this.onSelectionChange?.(cmd.elementId);
        this.onElementUpdate?.(cmd.elementId);
      } else {
        // Element was removed by undo
        editorState.selectElement(null);
        this.onSelectionChange?.(null);
      }
    }

    // Always refresh UI
    this.onSelectionChange?.(editorState.selectedId);
  }

  // ─── UX-1: Redo ───

  private handleRedo(): void {
    const cmd = editorState.redo();
    if (!cmd) return;

    // Rebuild renderers to match state
    this.elementManager.rebuildAll();

    if (cmd.elementId) {
      const el = editorState.findElement(cmd.elementId);
      if (el) {
        this.elementManager.selectElement(cmd.elementId);
        this.onSelectionChange?.(cmd.elementId);
        this.onElementUpdate?.(cmd.elementId);
      } else {
        editorState.selectElement(null);
        this.onSelectionChange?.(null);
      }
    }

    this.onSelectionChange?.(editorState.selectedId);
  }

  // ─── UX-2: Duplicate ───

  private handleDuplicate(): void {
    const selected = editorState.getSelectedElement();
    if (!selected) return;

    // Deep clone the element data
    const cloned = JSON.parse(JSON.stringify(selected)) as EditableElement;

    // Detect element type and generate new ID
    const elementType = this.detectElementType(cloned);
    const newId = editorState.generateId(elementType);
    (cloned as unknown as Record<string, unknown>).id = newId;

    // Offset position by gridSize
    const gridSize = editorState.gridSize;
    this.offsetElementPosition(cloned, elementType, gridSize);

    // Add to state (this pushes to undo stack)
    editorState.addElement(cloned);

    // Create renderer for the new element
    this.elementManager.addRenderer(cloned);

    // Select the new element
    this.elementManager.selectElement(newId);
    this.onSelectionChange?.(newId);
    this.onElementUpdate?.(newId);
  }

  private detectElementType(el: EditableElement): ElementType {
    if ("type" in el) {
      return (el as { type: ElementType }).type;
    }
    return "spawn_point";
  }

  private offsetElementPosition(
    el: EditableElement,
    type: ElementType,
    offset: number,
  ): void {
    switch (type) {
      case "floor":
      case "one_way_platform": {
        const d = el as unknown as { leftX: number; rightX: number; topY: number };
        d.leftX += offset;
        d.rightX += offset;
        d.topY += offset;
        break;
      }
      case "solid_wall": {
        const d = el as unknown as { x: number; topY: number; bottomY: number };
        d.x += offset;
        d.topY += offset;
        d.bottomY += offset;
        break;
      }
      case "fall_zone":
      case "instant_kill_hazard": {
        const d = el as unknown as { x: number; y: number };
        d.x += offset;
        d.y += offset;
        break;
      }
      case "spawn_point":
      case "weapon_spawn":
      case "item_spawn": {
        const d = el as unknown as { x: number; y: number };
        d.x += offset;
        d.y += offset;
        break;
      }
    }
  }

  /**
   * Scene shutdown 시 DOM 리스너를 정리합니다.
   * EditorScene.events(SHUTDOWN)에서 호출합니다.
   */
  destroy(): void {
    if (this._domKeydownHandler) {
      this.scene.game.canvas.removeEventListener("keydown", this._domKeydownHandler);
      this._domKeydownHandler = null;
    }
    this.cleanupPlacingPreview();
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
      const handleIndex = this.hitTestResizeHandles(
        selectedRenderer,
        worldX,
        worldY,
      );
      if (handleIndex >= 0) {
        this.state = "resizing";
        this.resizingRenderer = selectedRenderer;

        // 대각선 방향 반대편 고정 좌표 계산
        const bounds = selectedRenderer.getElementBounds();
        switch (handleIndex) {
          case 0: // TL → 고정: BR
            this.resizingOppositeX = bounds.x + bounds.width;
            this.resizingOppositeY = bounds.y + bounds.height;
            break;
          case 1: // TR → 고정: BL
            this.resizingOppositeX = bounds.x;
            this.resizingOppositeY = bounds.y + bounds.height;
            break;
          case 2: // BL → 고정: TR
            this.resizingOppositeX = bounds.x + bounds.width;
            this.resizingOppositeY = bounds.y;
            break;
          case 3: // BR → 고정: TL
            this.resizingOppositeX = bounds.x;
            this.resizingOppositeY = bounds.y;
            break;
        }
        return;
      }
    }

    // 요소 히트 테스트
    const hit = this.elementManager.hitTest(worldX, worldY);
    if (hit) {
      this.state = "dragging";
      this.dragRenderer = hit;

      // 드래그 오프셋: 클릭 지점과 요소 바운딩 박스 좌상단 간의 차이
      const b = hit.getElementBounds();
      this.dragOffsetX = worldX - b.x;
      this.dragOffsetY = worldY - b.y;

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
      this.placingStartX = snappedX;
      this.placingStartY = snappedY;

      // 프리뷰 Graphics 생성
      this.cleanupPlacingPreview();
      this.placingPreview = this.scene.add.graphics();
      this.placingPreview.setDepth(1000);
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

  private handlePlacingMove(worldX: number, worldY: number): void {
    if (!this.placingPreview) return;

    const snappedX = this.snap(worldX);
    const snappedY = this.snap(worldY);

    const x = Math.min(this.placingStartX, snappedX);
    const y = Math.min(this.placingStartY, snappedY);
    const w = Math.abs(snappedX - this.placingStartX);
    const h = Math.abs(snappedY - this.placingStartY);

    this.placingPreview.clear();
    this.placingPreview.lineStyle(2, 0xffffff, 0.8);
    this.placingPreview.strokeRect(x, y, w, h);
    this.placingPreview.fillStyle(0xffffff, 0.15);
    this.placingPreview.fillRect(x, y, w, h);
  }

  private handleDraggingMove(worldX: number, worldY: number): void {
    if (!this.dragRenderer) return;

    const snappedX = this.snap(worldX - this.dragOffsetX);
    const snappedY = this.snap(worldY - this.dragOffsetY);

    const el = this.dragRenderer.elementData;
    const type = this.dragRenderer.elementType;

    switch (type) {
      case "floor": {
        const d = el as unknown as Floor;
        const w = d.rightX - d.leftX;
        d.leftX = snappedX;
        d.rightX = snappedX + w;
        d.topY = snappedY;
        break;
      }
      case "one_way_platform": {
        const d = el as unknown as OneWayPlatform;
        const w = d.rightX - d.leftX;
        d.leftX = snappedX;
        d.rightX = snappedX + w;
        d.topY = snappedY;
        break;
      }
      case "solid_wall": {
        const d = el as unknown as SolidWall;
        const h = d.bottomY - d.topY;
        d.x = snappedX + 8; // x는 중심선, bounds x = x - 8
        d.topY = snappedY;
        d.bottomY = snappedY + h;
        break;
      }
      case "fall_zone":
      case "instant_kill_hazard": {
        const d = el as unknown as FallZone | InstantKillHazard;
        d.x = snappedX;
        d.y = snappedY;
        break;
      }
      case "spawn_point": {
        const d = el as unknown as { x: number; y: number };
        d.x = snappedX + EDITOR_CONFIG.POINT_RADIUS;
        d.y = snappedY + EDITOR_CONFIG.POINT_RADIUS;
        break;
      }
      case "weapon_spawn":
      case "item_spawn": {
        const d = el as unknown as { x: number; y: number };
        d.x = snappedX + EDITOR_CONFIG.POINT_RADIUS;
        d.y = snappedY + EDITOR_CONFIG.POINT_RADIUS;
        break;
      }
    }

    this.dragRenderer.updateFromData();
  }

  private handleResizingMove(worldX: number, worldY: number): void {
    if (!this.resizingRenderer) return;

    const snappedX = this.snap(worldX);
    const snappedY = this.snap(worldY);

    // 새로운 rect 계산: 핸들 위치와 반대편 고정점 기준
    const newX = Math.min(snappedX, this.resizingOppositeX);
    const newY = Math.min(snappedY, this.resizingOppositeY);
    const newW = Math.abs(snappedX - this.resizingOppositeX);
    const newH = Math.abs(snappedY - this.resizingOppositeY);

    // 최소 크기 보장
    const gridSize = editorState.gridSize;
    const minSize = gridSize;
    const finalW = Math.max(newW, minSize);
    const finalH = Math.max(newH, minSize);

    const el = this.resizingRenderer.elementData;
    const type = this.resizingRenderer.elementType;

    switch (type) {
      case "floor": {
        const d = el as unknown as Floor;
        d.leftX = newX;
        d.rightX = newX + finalW;
        d.topY = newY;
        break;
      }
      case "one_way_platform": {
        const d = el as unknown as OneWayPlatform;
        d.leftX = newX;
        d.rightX = newX + finalW;
        d.topY = newY;
        break;
      }
      case "solid_wall": {
        const d = el as unknown as SolidWall;
        d.x = newX + 8;
        d.topY = newY;
        d.bottomY = newY + finalH;
        break;
      }
      case "fall_zone":
      case "instant_kill_hazard": {
        const d = el as unknown as FallZone | InstantKillHazard;
        d.x = newX;
        d.y = newY;
        d.width = finalW;
        d.height = finalH;
        break;
      }
      default:
        // 포인트 요소는 리사이즈 불가
        return;
    }

    this.resizingRenderer.updateFromData();
  }

  // ─── Pointer up handler ───

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.state === "placing") {
      const snappedX = this.snap(pointer.worldX);
      const snappedY = this.snap(pointer.worldY);

      const type = editorState.activeTool as ElementType;

      // 드래그 거리가 충분하면 드래그 영역으로 배치
      const dx = Math.abs(snappedX - this.placingStartX);
      const dy = Math.abs(snappedY - this.placingStartY);
      const gridSize = editorState.gridSize;

      if (dx >= gridSize / 2 || dy >= gridSize / 2) {
        // 드래그 배치: 영역을 기반으로 요소 생성
        this.createRectFromDrag(type, this.placingStartX, this.placingStartY, snappedX, snappedY);
      } else {
        // 단일 클릭: 기본 크기로 요소 생성
        const el = this.elementManager.createElement(
          type,
          this.placingStartX,
          this.placingStartY,
        );
        if (el) {
          this.elementManager.selectElement(el.id);
          this.onSelectionChange?.(el.id);
        }
      }

      this.cleanupPlacingPreview();
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

  /**
   * 드래그 영역으로 rect 요소를 생성합니다.
   * floor/platform: leftX=min, rightX=max, topY=min (높이는 기본값)
   * wall: x, topY=min, bottomY=max
   * hazards: x=min, y=min, width=diff, height=diff
   */
  private createRectFromDrag(
    type: ElementType,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void {
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const maxX = Math.max(startX, endX);
    const maxY = Math.max(startY, endY);

    // 기본 위치에 요소 생성
    const el = this.elementManager.createElement(type, minX, minY);
    if (!el) return;

    // 드래그 영역에 맞게 크기 조정
    switch (type) {
      case "floor": {
        const d = el as unknown as Floor;
        d.leftX = minX;
        d.rightX = maxX;
        d.topY = minY;
        break;
      }
      case "one_way_platform": {
        const d = el as unknown as OneWayPlatform;
        d.leftX = minX;
        d.rightX = maxX;
        d.topY = minY;
        break;
      }
      case "solid_wall": {
        const d = el as unknown as SolidWall;
        d.x = minX + 8;
        d.topY = minY;
        d.bottomY = maxY;
        break;
      }
      case "fall_zone":
      case "instant_kill_hazard": {
        const d = el as unknown as FallZone | InstantKillHazard;
        d.x = minX;
        d.y = minY;
        d.width = maxX - minX;
        d.height = maxY - minY;
        break;
      }
    }

    // 렌더러 갱신
    const renderer = this.elementManager.getRenderer(el.id);
    if (renderer) {
      renderer.updateFromData();
    }

    this.elementManager.selectElement(el.id);
    this.onSelectionChange?.(el.id);
  }

  // ─── Utility ───

  private snap(value: number): number {
    if (!editorState.snapEnabled) return value;
    const gridSize = editorState.gridSize;
    return Math.round(value / gridSize) * gridSize;
  }

  /**
   * 리사이즈 핸들의 히트 테스트를 수행합니다.
   * 핸들 인덱스: 0=TL, 1=TR, 2=BL, 3=BR
   * 포인트 요소는 항상 -1을 반환합니다.
   */
  private hitTestResizeHandles(
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

  /**
   * 배치 프리뷰 Graphics를 정리합니다.
   */
  private cleanupPlacingPreview(): void {
    if (this.placingPreview) {
      this.placingPreview.destroy();
      this.placingPreview = null;
    }
  }
}
