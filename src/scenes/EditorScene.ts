import Phaser from "phaser";
import { EDITOR_CONFIG } from "@/config";
import { editorState } from "@/state/EditorState";
import { GridOverlay } from "@/objects/GridOverlay";
import { BoundsOverlay } from "@/objects/BoundsOverlay";
import { ElementManager } from "@/systems/ElementManager";
import { InteractionSystem } from "@/systems/InteractionSystem";

export class EditorScene extends Phaser.Scene {
  private gridOverlay!: GridOverlay;
  private boundsOverlay!: BoundsOverlay;
  private elementManager!: ElementManager;
  private interactionSystem!: InteractionSystem;

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

    // 초기 렌더링
    this.updateOverlays();

    // 기존 입력 리스너 설정 (줌, 컨텍스트 메뉴 방지, Home 키)
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

  // ─── Public API (UI에서 호출) ───

  /**
   * ElementManager 인스턴스를 반환합니다.
   */
  getElementManager(): ElementManager {
    return this.elementManager;
  }

  /**
   * InteractionSystem의 선택 변경 콜백을 설정합니다.
   */
  setOnSelectionChange(callback: (elementId: string | null) => void): void {
    this.interactionSystem.onSelectionChange = callback;
  }

  /**
   * InteractionSystem의 요소 업데이트 콜백을 설정합니다.
   */
  setOnElementUpdate(callback: (elementId: string) => void): void {
    this.interactionSystem.onElementUpdate = callback;
  }

  /**
   * 맵 데이터를 다시 로드하여 모든 렌더러를 재구성합니다.
   */
  rebuildFromMapData(): void {
    this.elementManager.rebuildAll();
    this.boundsOverlay.redraw(editorState.mapData);
    this.updateOverlays();
  }

  // ─── Private ───

  /**
   * 그리드와 Bounds 오버레이를 현재 카메라 상태에 맞게 다시 그립니다.
   */
  private updateOverlays(): void {
    const zoom = this.cameras.main.zoom;
    this.gridOverlay.redraw(zoom);
    this.boundsOverlay.redraw(editorState.mapData);
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
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
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
}
