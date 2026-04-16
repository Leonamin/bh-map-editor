import { useEditorStore } from "@/store/editorStore";
import type { EditableElement, MapData } from "@/types/map";
import { useEffect, useRef } from "react";

/** 요소의 ElementType 감지 */
function getElementType(el: EditableElement): string {
  if ("type" in el) return (el as { type: string }).type;
  return "spawn_point";
}

/** 타입 표시 이름 */
const TYPE_LABELS: Record<string, string> = {
  floor: "Floor",
  one_way_platform: "One-Way Platform",
  solid_wall: "Solid Wall",
  fall_zone: "Fall Zone",
  instant_kill_hazard: "Instant Kill",
  spawn_point: "Spawn Point",
  weapon_spawn: "Weapon Spawn",
  item_spawn: "Item Spawn",
};

/** 타입별 색상 CSS 변수 */
const TYPE_COLORS: Record<string, string> = {
  floor: "var(--color-floor)",
  one_way_platform: "var(--color-platform)",
  solid_wall: "var(--color-wall)",
  fall_zone: "var(--color-fall-zone)",
  instant_kill_hazard: "var(--color-kill)",
  spawn_point: "var(--color-spawn)",
  weapon_spawn: "var(--color-weapon)",
  item_spawn: "var(--color-item)",
};

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      {children}
    </div>
  );
}

function PropValue({ children }: { children: React.ReactNode }) {
  return <span className="prop-value">{children}</span>;
}

/** 선택된 요소의 속성을 읽기 전용으로 표시 */
function ElementProperties({ element }: { element: EditableElement }) {
  const elType = getElementType(element);
  const label = TYPE_LABELS[elType] ?? elType;
  const color = TYPE_COLORS[elType] ?? "transparent";

  // 공통 속성: id
  const id = (element as { id: string }).id;

  return (
    <div className="prop-section">
      <div className="prop-section-title">
        <span
          className="color-dot"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            marginRight: 6,
            verticalAlign: "middle",
          }}
        />
        {label}
      </div>

      <PropRow label="ID">
        <PropValue>{id}</PropValue>
      </PropRow>

      {/* Rect 타입: Floor, OneWayPlatform → leftX, rightX, topY */}
      {"leftX" in element && (
        <>
          <PropRow label="Left X">
            <PropValue>{(element as { leftX: number }).leftX}</PropValue>
          </PropRow>
          <PropRow label="Right X">
            <PropValue>{(element as { rightX: number }).rightX}</PropValue>
          </PropRow>
          <PropRow label="Top Y">
            <PropValue>{(element as { topY: number }).topY}</PropValue>
          </PropRow>
        </>
      )}

      {/* SolidWall: x, topY, bottomY */}
      {"bottomY" in element && !("leftX" in element) && (
        <>
          <PropRow label="X">
            <PropValue>{(element as { x: number }).x}</PropValue>
          </PropRow>
          <PropRow label="Top Y">
            <PropValue>{(element as { topY: number }).topY}</PropValue>
          </PropRow>
          <PropRow label="Bottom Y">
            <PropValue>{(element as { bottomY: number }).bottomY}</PropValue>
          </PropRow>
        </>
      )}

      {/* RectArea 기반 (fall_zone, instant_kill_hazard): x, y, width, height */}
      {"width" in element && (
        <>
          <PropRow label="X">
            <PropValue>{(element as { x: number }).x}</PropValue>
          </PropRow>
          <PropRow label="Y">
            <PropValue>{(element as { y: number }).y}</PropValue>
          </PropRow>
          <PropRow label="Width">
            <PropValue>{(element as { width: number }).width}</PropValue>
          </PropRow>
          <PropRow label="Height">
            <PropValue>{(element as { height: number }).height}</PropValue>
          </PropRow>
        </>
      )}

      {/* 포인트 타입 (spawn_point): x, y만 — width 없음 */}
      {!("width" in element) && !("leftX" in element) && !("bottomY" in element) && (
        <>
          <PropRow label="X">
            <PropValue>{(element as { x: number }).x}</PropValue>
          </PropRow>
          <PropRow label="Y">
            <PropValue>{(element as { y: number }).y}</PropValue>
          </PropRow>
        </>
      )}

      {/* Weapon-specific fields */}
      {"weaponId" in element && (
        <PropRow label="Weapon">
          <PropValue>{(element as { weaponId: string }).weaponId}</PropValue>
        </PropRow>
      )}
      {"despawnAfterMs" in element && (
        <PropRow label="Despawn">
          <PropValue>{(element as { despawnAfterMs: number }).despawnAfterMs}ms</PropValue>
        </PropRow>
      )}

      {/* Item-specific fields */}
      {"itemId" in element && (
        <PropRow label="Item">
          <PropValue>{(element as { itemId: string }).itemId}</PropValue>
        </PropRow>
      )}

      {/* 공통: respawnMs */}
      {"respawnMs" in element && (
        <PropRow label="Respawn">
          <PropValue>{(element as { respawnMs: number }).respawnMs}ms</PropValue>
        </PropRow>
      )}

      {/* spawnStyle */}
      {"spawnStyle" in element && (
        <PropRow label="Style">
          <PropValue>{String((element as { spawnStyle: unknown }).spawnStyle)}</PropValue>
        </PropRow>
      )}

      {/* mode */}
      {"mode" in element && (
        <PropRow label="Mode">
          <PropValue>{String((element as { mode: unknown }).mode)}</PropValue>
        </PropRow>
      )}
    </div>
  );
}

/** 맵 메타데이터 읽기 전용 표시 */
function MapMetadata({ mapData }: { mapData: MapData }) {
  return (
    <div className="prop-section">
      <div className="prop-section-title">Map Metadata</div>

      <PropRow label="Name">
        <PropValue>{mapData.name}</PropValue>
      </PropRow>
      <PropRow label="Version">
        <PropValue>{mapData.version}</PropValue>
      </PropRow>
      <PropRow label="Size">
        <PropValue>{mapData.size.width} × {mapData.size.height}</PropValue>
      </PropRow>

      <div style={{ marginTop: 8 }}>
        <div className="prop-section-title">Visual Bounds</div>
        <PropRow label="">
          <PropValue>
            L:{mapData.visualBounds.left} R:{mapData.visualBounds.right}{" "}
            T:{mapData.visualBounds.top} B:{mapData.visualBounds.bottom}
          </PropValue>
        </PropRow>
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="prop-section-title">Gameplay Bounds</div>
        <PropRow label="">
          <PropValue>
            L:{mapData.gameplayBounds.left} R:{mapData.gameplayBounds.right}{" "}
            T:{mapData.gameplayBounds.top} B:{mapData.gameplayBounds.bottom}
          </PropValue>
        </PropRow>
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="prop-section-title">Death Bounds</div>
        <PropRow label="">
          <PropValue>
            L:{mapData.deathBounds.left} R:{mapData.deathBounds.right}{" "}
            T:{mapData.deathBounds.top} B:{mapData.deathBounds.bottom}
          </PropValue>
        </PropRow>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const { selectedElement, mapData, focusPropertiesRequest } = useEditorStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // P3-2: 더블클릭으로 패널 포커스
  useEffect(() => {
    if (focusPropertiesRequest > 0 && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      // 첫 번째 prop-row에 focus 효과
      const firstRow = panelRef.current.querySelector(".prop-row");
      if (firstRow) {
        (firstRow as HTMLElement).focus();
        firstRow.classList.add("prop-row-highlight");
        setTimeout(() => firstRow.classList.remove("prop-row-highlight"), 1000);
      }
    }
  }, [focusPropertiesRequest]);

  return (
    <div className="right-panel" ref={panelRef}>
      <div className="panel-title">Properties</div>
      <div className="panel-content">
        {selectedElement ? (
          <ElementProperties element={selectedElement} />
        ) : (
          <div className="empty-state">요소를 선택하면 속성이 여기에 표시됩니다.</div>
        )}

        {mapData && <MapMetadata mapData={mapData} />}
      </div>
    </div>
  );
}
