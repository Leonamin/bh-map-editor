import Phaser from "phaser";
import { EDITOR_CONFIG } from "@/config";
import { editorState } from "@/state/EditorState";
import { GridOverlay } from "@/objects/GridOverlay";
import { BoundsOverlay } from "@/objects/BoundsOverlay";
import { ElementManager } from "@/systems/ElementManager";
import { InteractionSystem } from "@/systems/InteractionSystem";
import { ToastManager } from "@/ui/ToastManager";
import { useEditorStore } from "@/store/editorStore";
import { loadMapFromFile, loadMapFromFileObject, downloadMapFile } from "@/utils/map-io";

export class EditorScene extends Phaser.Scene {
  private gridOverlay!: GridOverlay;
  private boundsOverlay!: BoundsOverlay;
  private elementManager!: ElementManager;
  private interactionSystem!: InteractionSystem;
  private toastManager!: ToastManager;
  private removeFileDropListeners: (() => void) | null = null;

  // Track last camera state for dirty checking
  private lastScrollX = 0;
  private lastScrollY = 0;
  private lastZoom = 1;

  constructor() {
    super({ key: "EditorScene" });
  }

  create(): void {
    // 에디터 상태 초기화 (빈 맵)
    editorState.reset();

    // 배경색
    this.cameras.main.setBackgroundColor(
      EDITOR_CONFIG.COLORS.background,
    );

    // 그리드 오버레이 생성
    this.gridOverlay = new GridOverlay(this);

    // Bounds 오버레이 생성
    this.boundsOverlay = new BoundsOverlay(this);

    // 요소 매니저 생성
    this.elementManager = new ElementManager(this);

    // 인터랙션 시스템 생성 및 입력 설정
    this.interactionSystem = new InteractionSystem(this, this.elementManager);
    this.interactionSystem.setupInput();

    // 토스트 매니저 생성
    this.toastManager = new ToastManager(this);

    // 인터랙션 시스템에 토스트 콜백 연결
    this.interactionSystem.onToastMessage = (message: string) => {
      this.toastManager.info(message);
    };

    // 초기 렌더링
    this.updateOverlays();

    // 기존 입력 리스너 설정 (줌, 컨텍스트 메뉴 방지, Home 키)
    this.setupInputListeners();
    this.setupResizeListener();
    this.setupFileDropListeners();

    // 카메라 초기 위치: 맵 중앙
    this.centerCamera();

    // 초기 Zustand 스토어 동기화
    this.syncStore();
  }

  update(): void {
    const camera = this.cameras.main;
    const zoom = camera.zoom;

    // 카메라가 이동했거나 줌이 변경된 경우에만 오버레이 갱신
    if (
      camera.scrollX !== this.lastScrollX ||
      camera.scrollY !== this.lastScrollY ||
      zoom !== this.lastZoom
    ) {
      this.updateOverlays();
      this.lastScrollX = camera.scrollX;
      this.lastScrollY = camera.scrollY;
      this.lastZoom = zoom;
    }
  }

  isPointerOverUI(_screenX: number, _screenY: number): boolean {
    // P1: HUD 없음 — 항상 false. P2에서 React 패널 영역 체크로 개선.
    return false;
  }

  rebuildFromMapData(): void {
    const selectedId = editorState.selectedId;
    this.elementManager.rebuildAll();
    if (selectedId && this.elementManager.getRenderer(selectedId)) {
      this.elementManager.selectElement(selectedId);
    }
    this.boundsOverlay.redraw(editorState.mapData);
    this.updateOverlays();
    this.syncStore();
  }

  // ─── Private ───

  /** editorState → Zustand 스토어 동기화 */
  private syncStore(): void {
    const store = useEditorStore.getState();
    const el = editorState.selectedId
      ? editorState.getSelectedElement() ?? null
      : null;
    store.setSelectedId(editorState.selectedId);
    store.setSelectedElement(el);
    store.setMapData(editorState.mapData);
    store.setGridSize(editorState.gridSize);
    store.setSnapEnabled(editorState.snapEnabled);
    store.setZoom(editorState.zoom);
    store.setUndoRedoState(
      editorState.undoStack.length > 0,
      editorState.redoStack.length > 0,
    );
    // Element counts for status bar
    const counts: Record<string, number> = {};
    for (const arr of [
      editorState.mapData.collision,
      editorState.mapData.hazards,
      editorState.mapData.spawnPoints,
      editorState.mapData.weaponSpawns,
      editorState.mapData.itemSpawns,
    ]) {
      for (const e of arr) {
        const type = "type" in e ? (e as { type: string }).type : "spawn_point";
        counts[type] = (counts[type] || 0) + 1;
      }
    }
    store.setElementCounts(counts);
  }

  /**
   * 그리드와 Bounds 오버레이를 현재 카메라 상태에 맞게 다시 그립니다.
   */
  private updateOverlays(): void {
    const zoom = this.cameras.main.zoom;
    this.gridOverlay.redraw(zoom);
    this.boundsOverlay.redraw(editorState.mapData);
    this.syncStore();
  }

  /**
   * 줌, 컨텍스트 메뉴 방지, Home 키 리스너를 설정합니다.
   * 카메라 팬은 InteractionSystem이 처리합니다.
   */
  private setupInputListeners(): void {
    // 마우스 휠 — 줌 (마우스 위치 기준)
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (this.isPointerOverUI(pointer.x, pointer.y)) {
          return;
        }
        this.handleZoom(deltaY);
      },
    );

    // 우클릭 컨텍스트 메뉴 방지
    this.game.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    // 키보드 — Home 키로 카메라 리셋
    this.input.keyboard?.on("keydown-HOME", () => {
      this.centerCamera();
      this.updateOverlays();
    });

    this.interactionSystem.onSelectionChange = () => {
      this.syncStore();
    };
    this.interactionSystem.onElementUpdate = (elementId) => {
      this.handleElementEdited(elementId);
    };
    this.interactionSystem.onExportRequested = () => {
      downloadMapFile(editorState.mapData);
    };
    this.interactionSystem.onImportRequested = () => {
      void this.handleImportRequested();
    };
  }

  private setupResizeListener(): void {
    this.scale.on("resize", () => {
      this.toastManager.relayout();
      this.updateOverlays();
    });
  }

  /**
   * 마우스 휠로 줌 인/아웃합니다. 마우스 포인터 위치를 중심으로 줌합니다.
   */
  private handleZoom(deltaY: number): void {
    const camera = this.cameras.main;
    const pointer = this.input.activePointer;

    const oldZoom = camera.zoom;
    let newZoom = oldZoom;

    if (deltaY < 0) {
      // 줌 인
      newZoom = Math.min(EDITOR_CONFIG.MAX_ZOOM, oldZoom + EDITOR_CONFIG.ZOOM_STEP);
    } else {
      // 줌 아웃
      newZoom = Math.max(EDITOR_CONFIG.MIN_ZOOM, oldZoom - EDITOR_CONFIG.ZOOM_STEP);
    }

    if (newZoom === oldZoom) return;

    // 마우스가 가리키는 월드 좌표 (줌 전)
    const worldX = camera.scrollX + pointer.x / oldZoom;
    const worldY = camera.scrollY + pointer.y / oldZoom;

    // 줌 적용
    camera.setZoom(newZoom);

    // 마우스가 동일한 월드 좌표를 가리키도록 스크롤 보정
    camera.scrollX = worldX - pointer.x / newZoom;
    camera.scrollY = worldY - pointer.y / newZoom;

    editorState.zoom = newZoom;
    this.updateOverlays();
  }

  /**
   * 카메라를 맵 중앙으로 이동시킵니다.
   */
  private centerCamera(): void {
    const mapData = editorState.mapData;
    const camera = this.cameras.main;

    // visualBounds 중앙 계산
    const vb = mapData.visualBounds;
    const centerX = (vb.left + vb.right) / 2;
    const centerY = (vb.top + vb.bottom) / 2;

    camera.centerOn(centerX, centerY);
    camera.setZoom(1);
    editorState.zoom = 1;

    this.lastScrollX = camera.scrollX;
    this.lastScrollY = camera.scrollY;
    this.lastZoom = 1;
  }

  private handleElementEdited(elementId: string): void {
    const renderer = this.elementManager.getRenderer(elementId);
    renderer?.updateFromData();
    if (editorState.selectedId === elementId) {
      this.elementManager.selectElement(elementId);
    }
    this.syncStore();
  }

  private async handleImportRequested(): Promise<void> {
    try {
      const data = await loadMapFromFile();
      this.loadMapData(data);
      this.toastManager.success(`맵 가져오기 성공: ${data.name}`);
    } catch (error) {
      console.error("맵 가져오기 실패:", error);
      this.toastManager.error("맵 가져오기 실패");
    }
  }

  private loadMapData(data: typeof editorState.mapData): void {
    editorState.loadMap(data);
    this.rebuildFromMapData();
    this.centerCamera();
    this.updateOverlays();
    this.syncStore();
  }

  private setupFileDropListeners(): void {
    let dragDepth = 0;

    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      dragDepth += 1;
    };

    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
    };

    const onDrop = async (event: DragEvent): Promise<void> => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      dragDepth = 0;

      const file = event.dataTransfer?.files?.[0];
      if (!file) {
        return;
      }

      try {
        const data = await loadMapFromFileObject(file);
        this.loadMapData(data);
        this.toastManager.success(`맵 가져오기 성공: ${data.name}`);
      } catch (error) {
        console.error("드래그앤드롭 가져오기 실패:", error);
        this.toastManager.error("드래그앤드롭 가져오기 실패");
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    this.removeFileDropListeners = () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeFileDropListeners?.();
      this.removeFileDropListeners = null;
      this.interactionSystem.destroy();
      this.toastManager.destroy();
    });
  }
}
