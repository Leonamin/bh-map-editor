import Phaser from "phaser";
import { editorState } from "@/state/EditorState";
import { createRenderer } from "@/objects/RendererFactory";
import type {
  EditableElement,
  ElementType,
} from "@/types/map";
import { EditorElementRenderer } from "@/objects/EditorElementRenderer";

// ─── Element Defaults ───
// 각 ElementType의 기본 필드 정의. id는 생성 시 주입.
// positionFields는 생성 시 worldX/worldY로 덮어쓸 필드를 지정합니다.

type PositionField = "x" | "y" | "leftX" | "rightX" | "topY" | "bottomY" | "width" | "height";

interface ElementDefaults {
  /** 요소에 설정할 type 필드 (SpawnPoint는 type이 없음) */
  type?: ElementType;
  /** 기본 필드 값 */
  defaults: Record<string, unknown>;
  /** worldX로 설정할 필드 */
  xFields: PositionField[];
  /** worldY로 설정할 필드 (또는 worldX+gridSize로 설정) */
  yFields: PositionField[];
  /** xFields 중 gridSize를 더해서 rightX/bottomY로 설정할 필드 */
  xPlusGrid?: PositionField[];
  /** yFields 중 gridSize를 더해서 bottomY로 설정할 필드 */
  yPlusGrid?: PositionField[];
}

const ELEMENT_DEFAULTS: Record<ElementType, ElementDefaults> = {
  floor: {
    type: "floor",
    defaults: {},
    xFields: ["leftX"],
    yFields: ["topY"],
    xPlusGrid: ["rightX"],
  },
  one_way_platform: {
    type: "one_way_platform",
    defaults: {},
    xFields: ["leftX"],
    yFields: ["topY"],
    xPlusGrid: ["rightX"],
  },
  solid_wall: {
    type: "solid_wall",
    defaults: {},
    xFields: ["x"],
    yFields: ["topY"],
    yPlusGrid: ["bottomY"],
  },
  fall_zone: {
    type: "fall_zone",
    defaults: { width: 0, height: 0 },
    xFields: ["x"],
    yFields: ["y"],
    xPlusGrid: ["width"],
    yPlusGrid: ["height"],
  },
  instant_kill_hazard: {
    type: "instant_kill_hazard",
    defaults: { width: 0, height: 0 },
    xFields: ["x"],
    yFields: ["y"],
    xPlusGrid: ["width"],
    yPlusGrid: ["height"],
  },
  spawn_point: {
    type: "spawn_point",
    defaults: {},
    xFields: ["x"],
    yFields: ["y"],
  },
  weapon_spawn: {
    type: "weapon_spawn",
    defaults: {
      weaponId: "",
      respawnMs: 10000,
      despawnAfterMs: 0,
      spawnStyle: "fade_in",
      despawnStyle: "shrink_pop",
      mode: "fixed",
    },
    xFields: ["x"],
    yFields: ["y"],
  },
  item_spawn: {
    type: "item_spawn",
    defaults: {
      itemId: "",
      respawnMs: 15000,
      spawnStyle: "fade_in",
      mode: "fixed",
    },
    xFields: ["x"],
    yFields: ["y"],
  },
};

/**
 * 주어진 타입과 좌표로 EditableElement를 생성합니다.
 * ELEMENT_DEFAULTS 맵을 사용하여 타입별 기본값을 적용합니다.
 */
function createRawElement(
  type: ElementType,
  id: string,
  worldX: number,
  worldY: number,
  gridSize: number,
): EditableElement {
  const def = ELEMENT_DEFAULTS[type];
  const element: Record<string, unknown> = { id, ...def.defaults };

  if (def.type) {
    element.type = def.type;
  }

  // 위치 필드 설정
  for (const f of def.xFields) {
    element[f] = worldX;
  }
  for (const f of def.yFields) {
    element[f] = worldY;
  }
  for (const f of def.xPlusGrid ?? []) {
    element[f] = worldX + gridSize;
  }
  for (const f of def.yPlusGrid ?? []) {
    element[f] = worldY + gridSize;
  }

  return element as unknown as EditableElement;
}

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
   * - rect 타입: 기본 크기(gridSize)로 생성
   * - point 타입: 정확한 위치에 생성
   */
  createElement(
    type: ElementType,
    worldX: number,
    worldY: number,
  ): EditableElement | null {
    const id = editorState.generateId(type);
    const gridSize = editorState.gridSize;
    const element = createRawElement(type, id, worldX, worldY, gridSize);

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
