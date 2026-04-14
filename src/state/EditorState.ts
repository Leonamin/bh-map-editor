import type {
  MapData,
  EditableElement,
  ElementType,
} from "@/types/map";
import { createEmptyMap } from "@/utils/map-io";

// ─── ToolType ───

type ToolType = "select" | ElementType;

// ─── ID prefix mapping ───

const TYPE_PREFIX: Record<ElementType, string> = {
  floor: "floor",
  one_way_platform: "platform",
  solid_wall: "wall",
  fall_zone: "fallzone",
  instant_kill_hazard: "hazard",
  spawn_point: "spawn",
  weapon_spawn: "weapon",
  item_spawn: "item",
};

type ElementArrayHolder = Pick<
  MapData,
  "collision" | "hazards" | "spawnPoints" | "weaponSpawns" | "itemSpawns"
>;

/**
 * EditableElement에서 ElementType을 감지합니다.
 * SpawnPoint는 type 필드가 없으므로 별도 검사가 필요합니다.
 */
function detectElementType(el: EditableElement): ElementType {
  if ("type" in el) {
    return (el as { type: ElementType }).type;
  }
  // SpawnPoint: id, x, y만 있고 type 필드 없음
  return "spawn_point";
}

/**
 * ElementType에 해당하는 MapData 내 배열을 반환합니다.
 */
function getArrayForType(
  data: ElementArrayHolder,
  type: ElementType,
): EditableElement[] {
  switch (type) {
    case "floor":
    case "one_way_platform":
    case "solid_wall":
      return data.collision as EditableElement[];
    case "fall_zone":
    case "instant_kill_hazard":
      return data.hazards as EditableElement[];
    case "spawn_point":
      return data.spawnPoints as EditableElement[];
    case "weapon_spawn":
      return data.weaponSpawns as EditableElement[];
    case "item_spawn":
      return data.itemSpawns as EditableElement[];
  }
}

/**
 * MapData 내 모든 편집 가능 요소 배열을 순회할 수 있도록 반환합니다.
 */
function getAllElementArrays(data: MapData): EditableElement[][] {
  return [
    data.collision as EditableElement[],
    data.hazards as EditableElement[],
    data.spawnPoints as EditableElement[],
    data.weaponSpawns as EditableElement[],
    data.itemSpawns as EditableElement[],
  ];
}

// ─── EditorStateImpl ───

class EditorStateImpl {
  mapData: MapData = createEmptyMap();
  selectedId: string | null = null;
  activeTool: ToolType = "select";
  gridSize = 16;
  snapEnabled = true;
  zoom = 1;

  private idCounters: Record<string, number> = {};

  // ─── Element CRUD ───

  addElement(element: EditableElement): void {
    const elementType = detectElementType(element);
    const arr = getArrayForType(this.mapData, elementType);
    arr.push(element);
  }

  removeElement(id: string): void {
    for (const arr of getAllElementArrays(this.mapData)) {
      const idx = arr.findIndex((el) => el.id === id);
      if (idx !== -1) {
        arr.splice(idx, 1);
        // 선택된 요소가 삭제된 경우 선택 해제
        if (this.selectedId === id) {
          this.selectedId = null;
        }
        return;
      }
    }
  }

  updateElement(id: string, updates: Partial<EditableElement>): void {
    const el = this.findElement(id);
    if (el) {
      Object.assign(el, updates);
    }
  }

  findElement(id: string): EditableElement | undefined {
    for (const arr of getAllElementArrays(this.mapData)) {
      const el = arr.find((e) => e.id === id);
      if (el) return el;
    }
    return undefined;
  }

  getElementsArray(type: ElementType): EditableElement[] {
    return getArrayForType(this.mapData, type);
  }

  // ─── Tool ───

  setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
  }

  // ─── Selection ───

  selectElement(id: string | null): void {
    this.selectedId = id;
  }

  getSelectedElement(): EditableElement | undefined {
    if (this.selectedId === null) return undefined;
    return this.findElement(this.selectedId);
  }

  // ─── Map metadata ───

  updateMapMetadata(updates: Partial<MapData>): void {
    Object.assign(this.mapData, updates);
  }

  // ─── Reset / Load ───

  loadMap(data: MapData): void {
    this.mapData = data;
    this.selectedId = null;
    this.activeTool = "select";
    this.rebuildIdCounters();
  }

  reset(): void {
    this.mapData = createEmptyMap();
    this.selectedId = null;
    this.activeTool = "select";
    this.zoom = 1;
    this.idCounters = {};
  }

  // ─── ID generation ───

  generateId(type: ElementType): string {
    const prefix = TYPE_PREFIX[type];
    const current = this.idCounters[prefix] ?? 1;
    this.idCounters[prefix] = current + 1;
    return `${prefix}_${current}`;
  }

  // ─── Internal helpers ───

  /**
   * 현재 mapData 내 기존 ID들을 분석하여 카운터를 초기화합니다.
   * 각 prefix별로 가장 큰 숫자 suffix + 1 로 설정합니다.
   */
  private rebuildIdCounters(): void {
    this.idCounters = {};

    // collision 배열은 type 필드로 prefix 결정
    for (const el of this.mapData.collision) {
      const prefix = TYPE_PREFIX[el.type as ElementType];
      this.parseIdAndUpdateCounter(el.id, prefix);
    }

    // hazards 배열도 type 필드로 prefix 결정
    for (const el of this.mapData.hazards) {
      const prefix = TYPE_PREFIX[el.type as ElementType];
      this.parseIdAndUpdateCounter(el.id, prefix);
    }

    // spawnPoints, weaponSpawns, itemSpawns은 고정 prefix
    for (const el of this.mapData.spawnPoints) {
      this.parseIdAndUpdateCounter(el.id, "spawn");
    }
    for (const el of this.mapData.weaponSpawns) {
      this.parseIdAndUpdateCounter(el.id, "weapon");
    }
    for (const el of this.mapData.itemSpawns) {
      this.parseIdAndUpdateCounter(el.id, "item");
    }
  }

  private parseIdAndUpdateCounter(id: string, prefix: string): void {
    if (!prefix) return;
    const match = id.match(/^([a-z]+)_(\d+)$/);
    if (match && match[1] === prefix) {
      const num = parseInt(match[2], 10);
      const prev = this.idCounters[prefix] ?? 0;
      if (num >= prev) {
        this.idCounters[prefix] = num + 1;
      }
    }
  }
}

export const editorState = new EditorStateImpl();
