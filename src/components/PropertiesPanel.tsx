import { useEditorStore } from "@/store/editorStore";
import { detectElementType } from "@/types/type-guards";
import type {
  EditableElement,
  MapData,
  BoundaryPolicy,
  CameraPolicy,
} from "@/types/map";
import { useEffect, useRef } from "react";

// ─── Helpers ───

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

// ─── UI primitives ───

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      {children}
    </div>
  );
}

/** 읽기 전용 값 표시 */
function PropValue({ children }: { children: React.ReactNode }) {
  return <span className="prop-value">{children}</span>;
}

/** 숫자 인라인 편집 input */
function NumberInput({
  value,
  onChange,
  step = 1,
  autoFocus,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="prop-input number"
      type="number"
      value={value}
      step={step}
      autoFocus={autoFocus}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/** 텍스트 인라인 편집 input */
function TextInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="prop-input"
      type="text"
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 셀렉트 드롭다운 */
function SelectInput<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      className="prop-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Element Properties ───

/** 선택된 요소의 속성을 인라인 편집 가능하게 표시 */
function ElementProperties({ element }: { element: EditableElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const elType = detectElementType(element);
  const label = TYPE_LABELS[elType] ?? elType;
  const color = TYPE_COLORS[elType] ?? "transparent";
  const id = (element as { id: string }).id;

  const handleUpdate = (updates: Partial<EditableElement>) => {
    updateElement(id, updates);
  };

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

      {/* ID — 읽기 전용 */}
      <PropRow label="ID">
        <PropValue>{id}</PropValue>
      </PropRow>

      {/* ── Rect 타입: Floor, OneWayPlatform → leftX, rightX, topY ── */}
      {"leftX" in element && (
        <>
          <PropRow label="Left X">
            <NumberInput
              value={(element as { leftX: number }).leftX}
              onChange={(v) => handleUpdate({ leftX: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Right X">
            <NumberInput
              value={(element as { rightX: number }).rightX}
              onChange={(v) => handleUpdate({ rightX: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Top Y">
            <NumberInput
              value={(element as { topY: number }).topY}
              onChange={(v) => handleUpdate({ topY: v } as Partial<EditableElement>)}
            />
          </PropRow>
        </>
      )}

      {/* ── SolidWall: x, topY, bottomY ── */}
      {"bottomY" in element && !("leftX" in element) && (
        <>
          <PropRow label="X">
            <NumberInput
              value={(element as { x: number }).x}
              onChange={(v) => handleUpdate({ x: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Top Y">
            <NumberInput
              value={(element as { topY: number }).topY}
              onChange={(v) => handleUpdate({ topY: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Bottom Y">
            <NumberInput
              value={(element as { bottomY: number }).bottomY}
              onChange={(v) => handleUpdate({ bottomY: v } as Partial<EditableElement>)}
            />
          </PropRow>
        </>
      )}

      {/* ── RectArea 기반 (fall_zone, instant_kill_hazard): x, y, width, height ── */}
      {"width" in element && (
        <>
          <PropRow label="X">
            <NumberInput
              value={(element as { x: number }).x}
              onChange={(v) => handleUpdate({ x: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Y">
            <NumberInput
              value={(element as { y: number }).y}
              onChange={(v) => handleUpdate({ y: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Width">
            <NumberInput
              value={(element as { width: number }).width}
              onChange={(v) => handleUpdate({ width: v } as Partial<EditableElement>)}
              step={10}
            />
          </PropRow>
          <PropRow label="Height">
            <NumberInput
              value={(element as { height: number }).height}
              onChange={(v) => handleUpdate({ height: v } as Partial<EditableElement>)}
              step={10}
            />
          </PropRow>
        </>
      )}

      {/* ── 포인트 타입 (spawn_point): x, y만 — width 없음 ── */}
      {!("width" in element) && !("leftX" in element) && !("bottomY" in element) && (
        <>
          <PropRow label="X">
            <NumberInput
              value={(element as { x: number }).x}
              onChange={(v) => handleUpdate({ x: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Y">
            <NumberInput
              value={(element as { y: number }).y}
              onChange={(v) => handleUpdate({ y: v } as Partial<EditableElement>)}
            />
          </PropRow>
        </>
      )}

      {/* ── Weapon-specific ── */}
      {"weaponId" in element && (
        <>
          <PropRow label="Weapon">
            <TextInput
              value={(element as { weaponId: string }).weaponId}
              onChange={(v) => handleUpdate({ weaponId: v } as Partial<EditableElement>)}
            />
          </PropRow>
          <PropRow label="Respawn">
            <NumberInput
              value={(element as { respawnMs: number }).respawnMs}
              onChange={(v) => handleUpdate({ respawnMs: v } as Partial<EditableElement>)}
              step={500}
            />
            <span className="prop-unit">ms</span>
          </PropRow>
          {"despawnAfterMs" in element && (
            <PropRow label="Despawn">
              <NumberInput
                value={(element as { despawnAfterMs: number }).despawnAfterMs}
                onChange={(v) => handleUpdate({ despawnAfterMs: v } as Partial<EditableElement>)}
                step={500}
              />
              <span className="prop-unit">ms</span>
            </PropRow>
          )}
          {"spawnStyle" in element && (
            <PropRow label="Spawn Style">
              <SelectInput<"airdrop" | "fade_in" | "triggered">
                value={(element as { spawnStyle: "airdrop" | "fade_in" | "triggered" }).spawnStyle}
                options={[
                  { value: "airdrop", label: "Airdrop" },
                  { value: "fade_in", label: "Fade In" },
                  { value: "triggered", label: "Triggered" },
                ]}
                onChange={(v) => handleUpdate({ spawnStyle: v } as Partial<EditableElement>)}
              />
            </PropRow>
          )}
          {"despawnStyle" in element && (
            <PropRow label="Despawn Style">
              <SelectInput<"shrink_pop">
                value={(element as { despawnStyle: "shrink_pop" }).despawnStyle}
                options={[
                  { value: "shrink_pop", label: "Shrink Pop" },
                ]}
                onChange={(v) => handleUpdate({ despawnStyle: v } as Partial<EditableElement>)}
              />
            </PropRow>
          )}
          {"mode" in element && (
            <PropRow label="Mode">
              <SelectInput<"fixed" | "random_candidates">
                value={(element as { mode: "fixed" | "random_candidates" }).mode}
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "random_candidates", label: "Random" },
                ]}
                onChange={(v) => handleUpdate({ mode: v } as Partial<EditableElement>)}
              />
            </PropRow>
          )}
        </>
      )}

      {/* ── Item-specific ── */}
      {"itemId" in element && !("weaponId" in element) && (
        <>
          <PropRow label="Item">
            <TextInput
              value={(element as { itemId: string }).itemId}
              onChange={(v) => handleUpdate({ itemId: v } as Partial<EditableElement>)}
            />
          </PropRow>
          {"respawnMs" in element && (
            <PropRow label="Respawn">
              <NumberInput
                value={(element as { respawnMs: number }).respawnMs}
                onChange={(v) => handleUpdate({ respawnMs: v } as Partial<EditableElement>)}
                step={500}
              />
              <span className="prop-unit">ms</span>
            </PropRow>
          )}
          {"spawnStyle" in element && (
            <PropRow label="Spawn Style">
              <SelectInput<"airdrop" | "fade_in" | "triggered">
                value={(element as { spawnStyle: "airdrop" | "fade_in" | "triggered" }).spawnStyle}
                options={[
                  { value: "airdrop", label: "Airdrop" },
                  { value: "fade_in", label: "Fade In" },
                  { value: "triggered", label: "Triggered" },
                ]}
                onChange={(v) => handleUpdate({ spawnStyle: v } as Partial<EditableElement>)}
              />
            </PropRow>
          )}
          {"mode" in element && (
            <PropRow label="Mode">
              <SelectInput<"fixed" | "random_candidates">
                value={(element as { mode: "fixed" | "random_candidates" }).mode}
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "random_candidates", label: "Random" },
                ]}
                onChange={(v) => handleUpdate({ mode: v } as Partial<EditableElement>)}
              />
            </PropRow>
          )}
        </>
      )}
    </div>
  );
}

// ─── Map Metadata ───

const BOUNDARY_OPTIONS: { value: BoundaryPolicy; label: string }[] = [
  { value: "closed", label: "Closed" },
  { value: "open", label: "Open" },
];

const CAMERA_OPTIONS: { value: CameraPolicy; label: string }[] = [
  { value: "static", label: "Static" },
  { value: "follow", label: "Follow" },
  { value: "dynamic", label: "Dynamic" },
];

/** 맵 메타데이터 인라인 편집 */
function MapMetadata({ mapData }: { mapData: MapData }) {
  const updateMapMetadata = useEditorStore((s) => s.updateMapMetadata);

  return (
    <div className="prop-section">
      <div className="prop-section-title">Map Metadata</div>

      <PropRow label="Name">
        <TextInput
          value={mapData.name}
          onChange={(v) => updateMapMetadata({ name: v })}
        />
      </PropRow>
      <PropRow label="Version">
        <PropValue>{mapData.version}</PropValue>
      </PropRow>
      <PropRow label="Width">
        <NumberInput
          value={mapData.size.width}
          onChange={(v) =>
            updateMapMetadata({ size: { ...mapData.size, width: v } })
          }
          step={100}
        />
      </PropRow>
      <PropRow label="Height">
        <NumberInput
          value={mapData.size.height}
          onChange={(v) =>
            updateMapMetadata({ size: { ...mapData.size, height: v } })
          }
          step={100}
        />
      </PropRow>
      <PropRow label="Boundary">
        <SelectInput<BoundaryPolicy>
          value={mapData.boundaryPolicy}
          options={BOUNDARY_OPTIONS}
          onChange={(v) => updateMapMetadata({ boundaryPolicy: v })}
        />
      </PropRow>
      <PropRow label="Camera">
        <SelectInput<CameraPolicy>
          value={mapData.cameraPolicy}
          options={CAMERA_OPTIONS}
          onChange={(v) => updateMapMetadata({ cameraPolicy: v })}
        />
      </PropRow>

      {/* Visual Bounds */}
      <div style={{ marginTop: 8 }}>
        <div className="prop-section-title">Visual Bounds</div>
        <PropRow label="Left">
          <NumberInput
            value={mapData.visualBounds.left}
            onChange={(v) =>
              updateMapMetadata({
                visualBounds: { ...mapData.visualBounds, left: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Right">
          <NumberInput
            value={mapData.visualBounds.right}
            onChange={(v) =>
              updateMapMetadata({
                visualBounds: { ...mapData.visualBounds, right: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Top">
          <NumberInput
            value={mapData.visualBounds.top}
            onChange={(v) =>
              updateMapMetadata({
                visualBounds: { ...mapData.visualBounds, top: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Bottom">
          <NumberInput
            value={mapData.visualBounds.bottom}
            onChange={(v) =>
              updateMapMetadata({
                visualBounds: { ...mapData.visualBounds, bottom: v },
              })
            }
          />
        </PropRow>
      </div>

      {/* Gameplay Bounds */}
      <div style={{ marginTop: 8 }}>
        <div className="prop-section-title">Gameplay Bounds</div>
        <PropRow label="Left">
          <NumberInput
            value={mapData.gameplayBounds.left}
            onChange={(v) =>
              updateMapMetadata({
                gameplayBounds: { ...mapData.gameplayBounds, left: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Right">
          <NumberInput
            value={mapData.gameplayBounds.right}
            onChange={(v) =>
              updateMapMetadata({
                gameplayBounds: { ...mapData.gameplayBounds, right: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Top">
          <NumberInput
            value={mapData.gameplayBounds.top}
            onChange={(v) =>
              updateMapMetadata({
                gameplayBounds: { ...mapData.gameplayBounds, top: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Bottom">
          <NumberInput
            value={mapData.gameplayBounds.bottom}
            onChange={(v) =>
              updateMapMetadata({
                gameplayBounds: { ...mapData.gameplayBounds, bottom: v },
              })
            }
          />
        </PropRow>
      </div>

      {/* Death Bounds */}
      <div style={{ marginTop: 8 }}>
        <div className="prop-section-title">Death Bounds</div>
        <PropRow label="Left">
          <NumberInput
            value={mapData.deathBounds.left}
            onChange={(v) =>
              updateMapMetadata({
                deathBounds: { ...mapData.deathBounds, left: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Right">
          <NumberInput
            value={mapData.deathBounds.right}
            onChange={(v) =>
              updateMapMetadata({
                deathBounds: { ...mapData.deathBounds, right: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Top">
          <NumberInput
            value={mapData.deathBounds.top}
            onChange={(v) =>
              updateMapMetadata({
                deathBounds: { ...mapData.deathBounds, top: v },
              })
            }
          />
        </PropRow>
        <PropRow label="Bottom">
          <NumberInput
            value={mapData.deathBounds.bottom}
            onChange={(v) =>
              updateMapMetadata({
                deathBounds: { ...mapData.deathBounds, bottom: v },
              })
            }
          />
        </PropRow>
      </div>
    </div>
  );
}

// ─── Main Panel ───

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
