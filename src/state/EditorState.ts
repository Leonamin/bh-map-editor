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

// ─── Undo/Redo ───

export interface EditorCommand {
  type: "add" | "remove" | "update" | "metadata";
  elementId?: string;
  before: unknown;
  after: unknown;
}

const MAX_UNDO_STACK = 50;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

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
  gridSize = 40;
  snapEnabled = true;
  zoom = 1;

  private idCounters: Record<string, number> = {};

  // ─── Undo/Redo ───
  undoStack: EditorCommand[] = [];
  redoStack: EditorCommand[] = [];

  // ─── Element CRUD ───

  addElement(element: EditableElement): void {
    const elementType = detectElementType(element);
    const arr = getArrayForType(this.mapData, elementType);
    arr.push(element);

    // UX-1: Push undo command
    this.pushCommand({
      type: "add",
      elementId: element.id,
      before: null,
      after: deepClone(element),
    });
  }

  removeElement(id: string): void {
    for (const arr of getAllElementArrays(this.mapData)) {
      const idx = arr.findIndex((el) => el.id === id);
      if (idx !== -1) {
        const removed = arr[idx];

        // UX-1: Push undo command
        this.pushCommand({
          type: "remove",
          elementId: id,
          before: deepClone(removed),
          after: null,
        });

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
      const before = deepClone(el);
      Object.assign(el, updates);
      const after = deepClone(el);

      // UX-1: Push undo command
      this.pushCommand({
        type: "update",
        elementId: id,
        before,
        after,
      });
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
    // Collect previous values for the keys being updated
    const previousValues: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      (previousValues as Record<string, unknown>)[key] = deepClone(
        (this.mapData as unknown as Record<string, unknown>)[key],
      );
    }

    Object.assign(this.mapData, updates);

    // UX-1: Push undo command
    this.pushCommand({
      type: "metadata",
      before: previousValues,
      after: deepClone(updates),
    });
  }

  // ─── Reset / Load ───

  loadMap(data: MapData): void {
    this.mapData = data;
    this.selectedId = null;
    this.activeTool = "select";
    this.rebuildIdCounters();
    this.clearHistory();
  }

  reset(): void {
    this.mapData = createEmptyMap();
    this.selectedId = null;
    this.activeTool = "select";
    this.zoom = 1;
    this.idCounters = {};
    this.clearHistory();
  }

  // ─── ID generation ───

  generateId(type: ElementType): string {
    const prefix = TYPE_PREFIX[type];
    const current = this.idCounters[prefix] ?? 1;
    this.idCounters[prefix] = current + 1;
    return `${prefix}_${current}`;
  }

  // ─── Undo/Redo ───

  private pushCommand(cmd: EditorCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  undo(): EditorCommand | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;

    // Restore previous state
    switch (cmd.type) {
      case "add": {
        // Undo add → remove the element
        if (cmd.elementId) {
          for (const arr of getAllElementArrays(this.mapData)) {
            const idx = arr.findIndex((el) => el.id === cmd.elementId);
            if (idx !== -1) {
              arr.splice(idx, 1);
              break;
            }
          }
          if (this.selectedId === cmd.elementId) {
            this.selectedId = null;
          }
        }
        break;
      }
      case "remove": {
        // Undo remove → re-add the element
        if (cmd.before && typeof cmd.before === "object") {
          const element = cmd.before as EditableElement;
          const elementType = detectElementType(element);
          const arr = getArrayForType(this.mapData, elementType);
          arr.push(element);
        }
        break;
      }
      case "update": {
        // Undo update → restore before state
        if (cmd.elementId && cmd.before) {
          const el = this.findElement(cmd.elementId);
          if (el) {
            Object.keys(cmd.before as Record<string, unknown>).forEach((key) => {
              (el as unknown as Record<string, unknown>)[key] = (cmd.before as Record<string, unknown>)[key];
            });
          }
        }
        break;
      }
      case "metadata": {
        // Undo metadata → restore previous values
        if (cmd.before) {
          Object.assign(this.mapData, cmd.before);
        }
        break;
      }
    }

    this.redoStack.push(cmd);
    return cmd;
  }

  redo(): EditorCommand | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;

    // Re-apply the command
    switch (cmd.type) {
      case "add": {
        // Redo add → re-add the element
        if (cmd.after && typeof cmd.after === "object") {
          const element = cmd.after as EditableElement;
          const elementType = detectElementType(element);
          const arr = getArrayForType(this.mapData, elementType);
          arr.push(element);
        }
        break;
      }
      case "remove": {
        // Redo remove → remove the element again
        if (cmd.elementId) {
          for (const arr of getAllElementArrays(this.mapData)) {
            const idx = arr.findIndex((el) => el.id === cmd.elementId);
            if (idx !== -1) {
              arr.splice(idx, 1);
              break;
            }
          }
          if (this.selectedId === cmd.elementId) {
            this.selectedId = null;
          }
        }
        break;
      }
      case "update": {
        // Redo update → apply after state
        if (cmd.elementId && cmd.after) {
          const el = this.findElement(cmd.elementId);
          if (el) {
            Object.keys(cmd.after as Record<string, unknown>).forEach((key) => {
              (el as unknown as Record<string, unknown>)[key] = (cmd.after as Record<string, unknown>)[key];
            });
          }
        }
        break;
      }
      case "metadata": {
        // Redo metadata → apply after values
        if (cmd.after) {
          Object.assign(this.mapData, cmd.after);
        }
        break;
      }
    }

    this.undoStack.push(cmd);
    return cmd;
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
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
