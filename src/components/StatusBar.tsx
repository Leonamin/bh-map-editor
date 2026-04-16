import { useEditorStore } from "@/store/editorStore";

const ELEMENT_LABELS: Record<string, string> = {
  floor: "Floor",
  one_way_platform: "Platform",
  solid_wall: "Wall",
  fall_zone: "Fall",
  instant_kill_hazard: "Kill",
  spawn_point: "Spawn",
  weapon_spawn: "Weapon",
  item_spawn: "Item",
};

export function StatusBar() {
  const { zoom, elementCounts } = useEditorStore();

  const totalElements = Object.values(elementCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  const countParts = Object.entries(elementCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${ELEMENT_LABELS[type] ?? type}: ${count}`)
    .join(" | ");

  return (
    <div className="status-bar">
      <div className="status-item">
        Zoom: {Math.round(zoom * 100)}%
      </div>
      <div className="status-item">
        Elements: {totalElements}
        {countParts && ` (${countParts})`}
      </div>
      <div style={{ flex: 1 }} />
      <div className="status-item">
        <kbd>1-9</kbd> Tools
      </div>
      <div className="status-item">
        <kbd>Del</kbd> Delete
      </div>
      <div className="status-item">
        <kbd>Ctrl+S</kbd> Export
      </div>
      <div className="status-item">
        <kbd>Ctrl+O</kbd> Import
      </div>
    </div>
  );
}
