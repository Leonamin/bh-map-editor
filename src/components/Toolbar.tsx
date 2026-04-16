import { useEditorStore, type ToolType } from "@/store/editorStore";

const TOOLS: { id: ToolType; label: string; color: string }[] = [
  { id: "select", label: "Select", color: "transparent" },
  { id: "floor", label: "Floor", color: "var(--color-floor)" },
  { id: "one_way_platform", label: "Platform", color: "var(--color-platform)" },
  { id: "solid_wall", label: "Wall", color: "var(--color-wall)" },
  { id: "fall_zone", label: "Fall", color: "var(--color-fall-zone)" },
  { id: "instant_kill_hazard", label: "Kill", color: "var(--color-kill)" },
  { id: "spawn_point", label: "Spawn", color: "var(--color-spawn)" },
  { id: "weapon_spawn", label: "Weapon", color: "var(--color-weapon)" },
  { id: "item_spawn", label: "Item", color: "var(--color-item)" },
];

export function Toolbar() {
  const {
    activeTool,
    gridSize,
    snapEnabled,
    canUndo,
    canRedo,
    setActiveTool,
    undo,
    redo,
    toggleGrid,
    toggleSnap,
    triggerImport,
    triggerExport,
  } = useEditorStore();

  return (
    <div className="toolbar">
      {/* Undo/Redo */}
      <div className="toolbar-group">
        <button
          className="tool-btn"
          disabled={!canUndo}
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          className="tool-btn"
          disabled={!canRedo}
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
      </div>
      <div className="toolbar-separator" />

      {/* Tools */}
      <div className="toolbar-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? "active" : ""}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
          >
            {tool.id !== "select" && (
              <span
                className="color-dot"
                style={{ background: tool.color }}
              />
            )}
            {tool.label}
          </button>
        ))}
      </div>
      <div className="toolbar-separator" />

      {/* Utilities */}
      <div className="toolbar-group">
        <button
          className={`util-btn ${gridSize === 16 ? "toggled" : ""}`}
          onClick={toggleGrid}
          title="Toggle grid size"
        >
          Grid {gridSize}
        </button>
        <button
          className={`util-btn ${snapEnabled ? "toggled" : ""}`}
          onClick={toggleSnap}
          title="Toggle snap to grid"
        >
          Snap {snapEnabled ? "ON" : "OFF"}
        </button>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <button className="util-btn" onClick={triggerImport} title="Import map (Ctrl+O)">
          Import
        </button>
        <button className="util-btn" onClick={triggerExport} title="Export map (Ctrl+S)">
          Export
        </button>
      </div>
    </div>
  );
}
