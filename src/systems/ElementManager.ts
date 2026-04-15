import Phaser from "phaser";
import { editorState } from "@/state/EditorState";
import { createRenderer } from "@/objects/RendererFactory";
import type {
  EditableElement,
  ElementType,
  Floor,
  OneWayPlatform,
  SolidWall,
  FallZone,
  InstantKillHazard,
  SpawnPoint,
  WeaponSpawn,
  ItemSpawn,
} from "@/types/map";
import { EditorElementRenderer } from "@/objects/EditorElementRenderer";

/**
 * ElementManager — 씬 내 모든 EditorElementRenderer 인스턴스를 관리합니다.
 * 요소 생성/삭제, 렌더러 조회, 히트 테스트, 선택 상태 관리를 담당합니다.
 */
export class ElementManager {
  private scene: Phaser.Scene;
  private renderers: Map<string, EditorElementRenderer> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 지정된 타입의 새 요소를 월드 좌표에 생성합니다.
   * - rect 타입: 기본 크기로 생성
   * - point 타입: 정확한 위치에 생성
   */
  createElement(
    type: ElementType,
    worldX: number,
    worldY: number,
  ): EditableElement | null {
    const id = editorState.generateId(type);
    let element: EditableElement;

    switch (type) {
      case "floor": {
        const gridSize = editorState.gridSize;
        element = {
          id,
          type: "floor",
          leftX: worldX,
          rightX: worldX + gridSize,
          topY: worldY,
        } as Floor;
        break;
      }
      case "one_way_platform": {
        const gridSize = editorState.gridSize;
        element = {
          id,
          type: "one_way_platform",
          leftX: worldX,
          rightX: worldX + gridSize,
          topY: worldY,
        } as OneWayPlatform;
        break;
      }
      case "solid_wall": {
        const gridSize = editorState.gridSize;
        element = {
          id,
          type: "solid_wall",
          x: worldX,
          topY: worldY,
          bottomY: worldY + gridSize,
        } as SolidWall;
        break;
      }
      case "fall_zone": {
        const gridSize = editorState.gridSize;
        element = {
          id,
          type: "fall_zone",
          x: worldX,
          y: worldY,
          width: gridSize,
          height: gridSize,
        } as FallZone;
        break;
      }
      case "instant_kill_hazard": {
        const gridSize = editorState.gridSize;
        element = {
          id,
          type: "instant_kill_hazard",
          x: worldX,
          y: worldY,
          width: gridSize,
          height: gridSize,
        } as InstantKillHazard;
        break;
      }
      case "spawn_point": {
        element = {
          id,
          x: worldX,
          y: worldY,
        } as SpawnPoint;
        break;
      }
      case "weapon_spawn": {
        element = {
          id,
          weaponId: "",
          x: worldX,
          y: worldY,
          respawnMs: 10000,
          despawnAfterMs: 0,
          spawnStyle: "fade_in",
          despawnStyle: "shrink_pop",
          mode: "fixed",
        } as WeaponSpawn;
        break;
      }
      case "item_spawn": {
        element = {
          id,
          itemId: "",
          x: worldX,
          y: worldY,
          respawnMs: 15000,
          spawnStyle: "fade_in",
          mode: "fixed",
        } as ItemSpawn;
        break;
      }
      default:
        return null;
    }

    // editorState에 추가
    editorState.addElement(element);

    // 렌더러 생성 및 씬에 추가
    const renderer = createRenderer(this.scene, element);
    this.renderers.set(element.id, renderer);
    this.scene.add.existing(renderer);

    return element;
  }

  /**
   * 기존 요소 데이터로부터 렌더러를 생성합니다 (맵 로드 시 사용).
   */
  addRenderer(element: EditableElement): void {
    const renderer = createRenderer(this.scene, element);
    this.renderers.set(element.id, renderer);
    this.scene.add.existing(renderer);
  }

  /**
   * ID로 요소를 제거합니다. 렌더러와 editorState 모두에서 삭제합니다.
   * UX-3: 빨간 플래시 피드백 후 200ms 뒤 삭제합니다.
   */
  removeElement(id: string): void {
    const renderer = this.renderers.get(id);
    if (renderer) {
      // UX-3: Flash red before destroying
      const bounds = renderer.getElementBounds();
      const flash = this.scene.add.graphics();
      flash.setDepth(1001);
      flash.fillStyle(0xff0000, 0.5);
      flash.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

      // Destroy renderer immediately (hide it)
      renderer.setVisible(false);

      // Remove from map
      this.renderers.delete(id);

      // Destroy flash and renderer after 200ms
      this.scene.time.delayedCall(200, () => {
        flash.destroy();
        renderer.destroy();
      });
    }
    editorState.removeElement(id);
  }

  /**
   * ID로 렌더러를 조회합니다.
   */
  getRenderer(id: string): EditorElementRenderer | undefined {
    return this.renderers.get(id);
  }

  /**
   * 모든 렌더러를 반환합니다.
   */
  getAllRenderers(): EditorElementRenderer[] {
    return Array.from(this.renderers.values());
  }

  /**
   * 월드 좌표에서 가장 위에 있는 요소를 찾습니다 (마지막에 추가된 요소 우선).
   */
  hitTest(worldX: number, worldY: number): EditorElementRenderer | null {
    const all = Array.from(this.renderers.values());
    // 역순으로 순회 (마지막에 추가된 요소가 최상단)
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].hitTest(worldX, worldY)) {
        return all[i];
      }
    }
    return null;
  }

  /**
   * 요소를 선택/해제합니다. 이전 선택을 해제하고 새 요소를 선택합니다.
   */
  selectElement(id: string | null): void {
    // 이전 선택 해제
    if (editorState.selectedId) {
      const prev = this.renderers.get(editorState.selectedId);
      if (prev) {
        prev.setSelected(false);
      }
    }

    // 새 요소 선택
    if (id) {
      const next = this.renderers.get(id);
      if (next) {
        next.setSelected(true);
      }
    }

    editorState.selectElement(id);
  }

  /**
   * 모든 렌더러를 제거하고 editorState.mapData에서 다시 생성합니다.
   */
  rebuildAll(): void {
    this.renderers.forEach((r) => r.destroy());
    this.renderers.clear();

    for (const el of editorState.mapData.collision) this.addRenderer(el);
    for (const el of editorState.mapData.hazards) this.addRenderer(el);
    for (const el of editorState.mapData.spawnPoints) this.addRenderer(el);
    for (const el of editorState.mapData.weaponSpawns) this.addRenderer(el);
    for (const el of editorState.mapData.itemSpawns) this.addRenderer(el);
  }

  /**
   * 모든 렌더러를 정리합니다.
   */
  destroy(): void {
    this.renderers.forEach((r) => r.destroy());
    this.renderers.clear();
  }
}
