import Phaser from "phaser";
import { EDITOR_CONFIG } from "@/config";
import { editorState } from "@/state/EditorState";
import { GridOverlay } from "@/objects/GridOverlay";
import { BoundsOverlay } from "@/objects/BoundsOverlay";

export class EditorScene extends Phaser.Scene {
  private gridOverlay!: GridOverlay;
  private boundsOverlay!: BoundsOverlay;

  // Camera pan state
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartScrollX = 0;
  private camStartScrollY = 0;

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

    // 초기 렌더링
    this.updateOverlays();

    // 입력 리스너 설정
    this.setupInputListeners();

    // 카메라 초기 위치: 맵 중앙
    this.centerCamera();
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

  /**
   * 그리드와 Bounds 오버레이를 현재 카메라 상태에 맞게 다시 그립니다.
   */
  private updateOverlays(): void {
    const zoom = this.cameras.main.zoom;
    this.gridOverlay.redraw(zoom);
    this.boundsOverlay.redraw(editorState.mapData);
  }

  /**
   * 마우스, 키보드 입력 리스너를 설정합니다.
   */
  private setupInputListeners(): void {
    // 마우스 휠 — 줌 (마우스 위치 기준)
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        this.handleZoom(deltaY);
      },
    );

    // 우클릭 / 중클릭 드래그 — 카메라 팬
    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
          this.startPan(pointer);
        }
      },
    );

    this.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        if (this.isPanning) {
          this.doPan(pointer);
        }
      },
    );

    this.input.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer) => {
        if (
          this.isPanning &&
          (pointer.rightButtonReleased() || pointer.middleButtonReleased())
        ) {
          this.isPanning = false;
        }
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
   * 카메라 팬을 시작합니다.
   */
  private startPan(pointer: Phaser.Input.Pointer): void {
    this.isPanning = true;
    this.panStartX = pointer.x;
    this.panStartY = pointer.y;
    const camera = this.cameras.main;
    this.camStartScrollX = camera.scrollX;
    this.camStartScrollY = camera.scrollY;
  }

  /**
   * 카메라 팬을 수행합니다.
   */
  private doPan(pointer: Phaser.Input.Pointer): void {
    const camera = this.cameras.main;
    const dx = pointer.x - this.panStartX;
    const dy = pointer.y - this.panStartY;

    camera.scrollX = this.camStartScrollX - dx / camera.zoom;
    camera.scrollY = this.camStartScrollY - dy / camera.zoom;
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
}
