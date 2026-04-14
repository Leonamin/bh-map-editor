import { editorState } from "@/state/EditorState";
import type {
  MapData,
  EditableElement,
  ElementType,
  Bounds,
} from "@/types/map";

// ─── Field descriptor ───

interface FieldDef {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  options?: string[];
}

/** 요소 타입별 편집 가능 필드 정의 */
const ELEMENT_FIELDS: Record<string, FieldDef[]> = {
  floor: [
    { key: "leftX", label: "leftX", type: "number" },
    { key: "rightX", label: "rightX", type: "number" },
    { key: "topY", label: "topY", type: "number" },
  ],
  one_way_platform: [
    { key: "leftX", label: "leftX", type: "number" },
    { key: "rightX", label: "rightX", type: "number" },
    { key: "topY", label: "topY", type: "number" },
  ],
  solid_wall: [
    { key: "x", label: "x", type: "number" },
    { key: "topY", label: "topY", type: "number" },
    { key: "bottomY", label: "bottomY", type: "number" },
  ],
  fall_zone: [
    { key: "x", label: "x", type: "number" },
    { key: "y", label: "y", type: "number" },
    { key: "width", label: "width", type: "number" },
    { key: "height", label: "height", type: "number" },
  ],
  instant_kill_hazard: [
    { key: "x", label: "x", type: "number" },
    { key: "y", label: "y", type: "number" },
    { key: "width", label: "width", type: "number" },
    { key: "height", label: "height", type: "number" },
  ],
  spawn_point: [
    { key: "x", label: "x", type: "number" },
    { key: "y", label: "y", type: "number" },
  ],
  weapon_spawn: [
    { key: "weaponId", label: "weaponId", type: "text" },
    { key: "x", label: "x", type: "number" },
    { key: "y", label: "y", type: "number" },
    { key: "respawnMs", label: "respawnMs", type: "number" },
    { key: "despawnAfterMs", label: "despawnAfterMs", type: "number" },
    { key: "spawnStyle", label: "spawnStyle", type: "select", options: ["airdrop", "fade_in", "triggered"] },
    { key: "despawnStyle", label: "despawnStyle", type: "text" },
    { key: "mode", label: "mode", type: "select", options: ["fixed", "random_candidates"] },
    { key: "spawnGroupId", label: "spawnGroupId", type: "text" },
  ],
  item_spawn: [
    { key: "itemId", label: "itemId", type: "text" },
    { key: "x", label: "x", type: "number" },
    { key: "y", label: "y", type: "number" },
    { key: "respawnMs", label: "respawnMs", type: "number" },
    { key: "spawnStyle", label: "spawnStyle", type: "select", options: ["airdrop", "fade_in", "triggered"] },
    { key: "mode", label: "mode", type: "select", options: ["fixed", "random_candidates"] },
    { key: "spawnGroupId", label: "spawnGroupId", type: "text" },
  ],
};

/** 요소 타입 한국어 이름 */
const TYPE_LABELS: Record<string, string> = {
  floor: "Floor",
  one_way_platform: "OneWayPlatform",
  solid_wall: "SolidWall",
  fall_zone: "FallZone",
  instant_kill_hazard: "InstantKillHazard",
  spawn_point: "SpawnPoint",
  weapon_spawn: "WeaponSpawn",
  item_spawn: "ItemSpawn",
};

// ─── Cache ───
let onElementUpdate: ((id: string) => void) | null = null;

// ─── Init ───

/**
 * PropertiesPanel을 초기화하고 맵 메타데이터 필드를 구성합니다.
 */
export function initPropertiesPanel(
  onUpdate: (id: string) => void,
): void {
  onElementUpdate = onUpdate;
  buildMapMetadataFields();
}

// ─── Selection update ───

/**
 * 선택된 요소가 변경되었을 때 호출합니다.
 * 선택 해제 시 null을 전달합니다.
 */
export function updateElementPanel(): void {
  const container = document.getElementById("element-props");
  if (!container) return;

  const element = editorState.getSelectedElement();

  if (!element) {
    container.innerHTML = '<div class="empty-state">요소를 선택하세요</div>';
    return;
  }
  const elementType = detectElementType(element);
  const fields = ELEMENT_FIELDS[elementType] ?? [];

  // 요소 정보 섹션 구성
  let html = '<div class="panel-section">';
  html += '<div class="panel-section-title">선택된 요소</div>';
  html += `<div class="field-row"><label>ID</label><input type="text" value="${escapeHtml(element.id)}" readonly style="opacity:0.6;cursor:default" /></div>`;
  html += `<div class="field-row"><label>Type</label><input type="text" value="${escapeHtml(TYPE_LABELS[elementType] ?? elementType)}" readonly style="opacity:0.6;cursor:default" /></div>`;

  // 각 필드별 input 생성
  for (const field of fields) {
    const value = (element as unknown as Record<string, unknown>)[field.key];
    html += `<div class="field-row"><label>${escapeHtml(field.label)}</label>`;

    if (field.type === "number") {
      const numVal = typeof value === "number" ? value : 0;
      html += `<input type="number" data-field="${field.key}" value="${numVal}" step="1" />`;
    } else if (field.type === "select" && field.options) {
      html += `<select data-field="${field.key}">`;
      for (const opt of field.options) {
        const selected = value === opt ? " selected" : "";
        html += `<option value="${opt}"${selected}>${opt}</option>`;
      }
      html += `</select>`;
    } else {
      const strVal = typeof value === "string" ? value : "";
      html += `<input type="text" data-field="${field.key}" value="${escapeHtml(strVal)}" />`;
    }

    html += `</div>`;
  }

  html += "</div>";
  container.innerHTML = html;

  // 이벤트 바인딩
  bindFieldEvents(container, element.id);
}

// ─── Map metadata ───

function buildMapMetadataFields(): void {
  const container = document.getElementById("map-metadata-fields");
  if (!container) return;

  const md = editorState.mapData;

  let html = "";

  // name
  html += `<div class="field-row"><label>name</label><input type="text" data-meta="name" value="${escapeHtml(md.name)}" /></div>`;

  // size
  html += `<div class="field-row"><label>width</label><input type="number" data-meta="size.width" value="${md.size.width}" step="1" /></div>`;
  html += `<div class="field-row"><label>height</label><input type="number" data-meta="size.height" value="${md.size.height}" step="1" /></div>`;

  // boundaryPolicy
  html += `<div class="field-row"><label>boundary</label><select data-meta="boundaryPolicy"><option value="closed"${md.boundaryPolicy === "closed" ? " selected" : ""}>closed</option><option value="open"${md.boundaryPolicy === "open" ? " selected" : ""}>open</option></select></div>`;

  // cameraPolicy
  html += `<div class="field-row"><label>camera</label><select data-meta="cameraPolicy"><option value="static"${md.cameraPolicy === "static" ? " selected" : ""}>static</option><option value="follow"${md.cameraPolicy === "follow" ? " selected" : ""}>follow</option><option value="dynamic"${md.cameraPolicy === "dynamic" ? " selected" : ""}>dynamic</option></select></div>`;

  // Bounds
  html += buildBoundsFields("visualBounds", "Visual", md.visualBounds);
  html += buildBoundsFields("gameplayBounds", "Gameplay", md.gameplayBounds);
  html += buildBoundsFields("deathBounds", "Death", md.deathBounds);

  container.innerHTML = html;

  // 이벤트 바인딩
  bindMetadataEvents(container);
}

function buildBoundsFields(prefix: string, label: string, bounds: Bounds): string {
  let html = `<div style="margin-top:6px"><span style="font-size:11px;color:#6b7280;font-weight:600">${label} Bounds</span></div>`;
  html += `<div class="field-row"><label>left</label><input type="number" data-meta="${prefix}.left" value="${bounds.left}" step="1" /></div>`;
  html += `<div class="field-row"><label>right</label><input type="number" data-meta="${prefix}.right" value="${bounds.right}" step="1" /></div>`;
  html += `<div class="field-row"><label>top</label><input type="number" data-meta="${prefix}.top" value="${bounds.top}" step="1" /></div>`;
  html += `<div class="field-row"><label>bottom</label><input type="number" data-meta="${prefix}.bottom" value="${bounds.bottom}" step="1" /></div>`;
  return html;
}

// ─── Event binding ───

function bindFieldEvents(container: HTMLElement, elementId: string): void {
  const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]");
  inputs.forEach((input) => {
    const field = input.dataset.field!;
    const eventType = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventType, () => {
      const el = editorState.findElement(elementId);
      if (!el) return;

      const fields = ELEMENT_FIELDS[detectElementType(el)] ?? [];
      const fieldDef = fields.find((f) => f.key === field);
      if (!fieldDef) return;

      let value: string | number = input.value;
      if (fieldDef.type === "number") {
        value = parseFloat(input.value);
        if (isNaN(value)) return;
      }

      const updates: Partial<EditableElement> = {};
      (updates as Record<string, unknown>)[field] = value;
      editorState.updateElement(elementId, updates);

      if (onElementUpdate) {
        onElementUpdate(elementId);
      }
    });
  });
}

function bindMetadataEvents(container: HTMLElement): void {
  const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-meta]");
  inputs.forEach((input) => {
    const metaKey = input.dataset.meta!;
    const eventType = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventType, () => {
      applyMetaChange(metaKey, input.value);
    });
  });
}

function applyMetaChange(metaKey: string, rawValue: string): void {
  const updates: Partial<MapData> = {} as Partial<MapData>;

  if (metaKey.startsWith("size.")) {
    const subKey = metaKey.slice(5) as "width" | "height";
    const num = parseFloat(rawValue);
    if (isNaN(num)) return;
    updates.size = { ...editorState.mapData.size, [subKey]: num };
  } else if (
    metaKey.startsWith("visualBounds.") ||
    metaKey.startsWith("gameplayBounds.") ||
    metaKey.startsWith("deathBounds.")
  ) {
    const [boundsKey, subKey] = metaKey.split(".") as [keyof Pick<MapData, "visualBounds" | "gameplayBounds" | "deathBounds">, keyof Bounds];
    const num = parseFloat(rawValue);
    if (isNaN(num)) return;
    updates[boundsKey] = { ...editorState.mapData[boundsKey], [subKey]: num };
  } else if (metaKey === "boundaryPolicy") {
    updates.boundaryPolicy = rawValue as "closed" | "open";
  } else if (metaKey === "cameraPolicy") {
    updates.cameraPolicy = rawValue as "static" | "follow" | "dynamic";
  } else if (metaKey === "name") {
    updates.name = rawValue;
  }

  editorState.updateMapMetadata(updates);
}

/**
 * 맵 메타데이터 필드를 현재 editorState 기준으로 다시 구성합니다.
 * Import 후 호출됩니다.
 */
export function refreshMapMetadata(): void {
  buildMapMetadataFields();
}

// ─── Helpers ───

function detectElementType(el: EditableElement): ElementType {
  if ("type" in el) {
    return (el as { type: ElementType }).type;
  }
  return "spawn_point";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
