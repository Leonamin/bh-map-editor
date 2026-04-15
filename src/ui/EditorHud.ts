import Phaser from "phaser";
import { editorState } from "@/state/EditorState";
import { downloadMapFile } from "@/utils/map-io";
import { modKeyLabel } from "@/utils/platform";
import type {
  Bounds,
  EditableElement,
  ElementType,
  MapData,
} from "@/types/map";

interface HudHandlers {
  onImportRequested: () => void | Promise<void>;
  onElementEdited: (elementId: string) => void;
  onMapMetadataEdited: () => void;
  onDeleteSelected: () => void;
  onViewportSettingChanged: () => void;
}

interface HudButton {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  setActive: (active: boolean) => void;
  setLabel: (label: string) => void;
}

interface FieldDef {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  options?: string[];
}

const TOOL_DEFS: Array<{ tool: "select" | ElementType; label: string; color: number }> = [
  { tool: "select", label: "Select", color: 0x94a3b8 },
  { tool: "floor", label: "Floor", color: 0x22c55e },
  { tool: "one_way_platform", label: "Platform", color: 0x06b6d4 },
  { tool: "solid_wall", label: "Wall", color: 0x9ca3af },
  { tool: "fall_zone", label: "Fall", color: 0xef4444 },
  { tool: "instant_kill_hazard", label: "Kill", color: 0xf97316 },
  { tool: "spawn_point", label: "Spawn", color: 0x3b82f6 },
  { tool: "weapon_spawn", label: "Weapon", color: 0x8b5cf6 },
  { tool: "item_spawn", label: "Item", color: 0xeab308 },
];

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
    {
      key: "spawnStyle",
      label: "spawnStyle",
      type: "select",
      options: ["airdrop", "fade_in", "triggered"],
    },
    { key: "despawnStyle", label: "despawnStyle", type: "text" },
    {
      key: "mode",
      label: "mode",
      type: "select",
      options: ["fixed", "random_candidates"],
    },
    { key: "spawnGroupId", label: "spawnGroupId", type: "text" },
  ],
  item_spawn: [
    { key: "itemId", label: "itemId", type: "text" },
    { key: "x", label: "x", type: "number" },
    { key: "y", label: "y", type: "number" },
    { key: "respawnMs", label: "respawnMs", type: "number" },
    {
      key: "spawnStyle",
      label: "spawnStyle",
      type: "select",
      options: ["airdrop", "fade_in", "triggered"],
    },
    {
      key: "mode",
      label: "mode",
      type: "select",
      options: ["fixed", "random_candidates"],
    },
    { key: "spawnGroupId", label: "spawnGroupId", type: "text" },
  ],
};

const HUD = {
  toolbarHeight: 44,
  statusHeight: 28,
  panelWidth: 320,
  sidePadding: 10,
  buttonHeight: 28,
  buttonGap: 6,
  rowHeight: 24,
  sectionGap: 14,
  panelPadding: 12,
};

export class EditorHud {
  private scene: Phaser.Scene;
  private handlers: HudHandlers;

  private toolbar!: Phaser.GameObjects.Container;
  private toolbarBg!: Phaser.GameObjects.Rectangle;
  private toolbarButtons = new Map<string, HudButton>();
  private gridButton!: HudButton;
  private snapButton!: HudButton;
  private importButton!: HudButton;
  private exportButton!: HudButton;

  private propertiesShell!: Phaser.GameObjects.Container;
  private propertiesBg!: Phaser.GameObjects.Rectangle;
  private propertiesMaskShape!: Phaser.GameObjects.Graphics;
  private propertiesContent!: Phaser.GameObjects.Container;
  private propertiesScroll = 0;
  private propertiesContentHeight = 0;
  private propertiesTitle!: Phaser.GameObjects.Text;

  private statusBar!: Phaser.GameObjects.Container;
  private statusBg!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;

  private dropOverlay!: Phaser.GameObjects.Container;
  private dropBg!: Phaser.GameObjects.Rectangle;
  private dropText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, handlers: HudHandlers) {
    this.scene = scene;
    this.handlers = handlers;

    this.createToolbar();
    this.createPropertiesPanel();
    this.createStatusBar();
    this.createDropOverlay();
    this.layout(scene.scale.width, scene.scale.height);
    this.refreshAll();
  }

  layout(width: number, height: number): void {
    this.toolbarBg.setSize(width, HUD.toolbarHeight);
    this.layoutToolbarButtons();

    const panelX = width - HUD.panelWidth;
    const panelY = HUD.toolbarHeight;
    const panelHeight = height - HUD.toolbarHeight - HUD.statusHeight;

    this.propertiesShell.setPosition(panelX, panelY);
    this.propertiesBg.setSize(HUD.panelWidth, panelHeight);
    this.propertiesTitle.setPosition(HUD.panelPadding, HUD.panelPadding);
    this.propertiesMaskShape.clear();
    this.propertiesMaskShape.fillStyle(0xffffff, 1);
    this.propertiesMaskShape.fillRect(
      panelX,
      panelY + 38,
      HUD.panelWidth,
      Math.max(0, panelHeight - 38),
    );
    this.clampPropertiesScroll();
    this.positionPropertiesContent();

    this.statusBar.setPosition(0, height - HUD.statusHeight);
    this.statusBg.setSize(width, HUD.statusHeight);

    this.dropBg.setSize(width, height);
    this.dropText.setPosition(width / 2, height / 2);
  }

  refreshAll(): void {
    this.refreshToolbar();
    this.refreshProperties();
    this.refreshStatus();
  }

  refreshToolbar(): void {
    for (const def of TOOL_DEFS) {
      const button = this.toolbarButtons.get(def.tool);
      button?.setActive(editorState.activeTool === def.tool);
    }
    this.gridButton.setLabel(`Grid ${editorState.gridSize}`);
    this.snapButton.setLabel(`Snap ${editorState.snapEnabled ? "ON" : "OFF"}`);
    this.snapButton.setActive(editorState.snapEnabled);
  }

  refreshProperties(): void {
    this.propertiesContent.removeAll(true);

    let y = 0;
    y = this.addSectionTitle("Selected Element", y);

    const selected = editorState.getSelectedElement();
    if (!selected) {
      y = this.addInfoRow("선택된 요소가 없습니다.", y);
    } else {
      const elementType = detectElementType(selected);
      y = this.addInfoRow(`ID  ${selected.id}`, y);
      y = this.addInfoRow(`Type  ${elementType}`, y);

      for (const field of ELEMENT_FIELDS[elementType] ?? []) {
        const rawValue = (selected as unknown as Record<string, unknown>)[field.key];
        const value = rawValue === undefined || rawValue === "" ? "-" : String(rawValue);
        y = this.addActionRow(
          `${field.label}  ${value}`,
          y,
          () => {
            this.editElementField(selected.id, field, rawValue);
          },
          0x1f2937,
        );
      }

      y = this.addButtonRow("Delete Selected", y, 0x7f1d1d, () => {
        this.handlers.onDeleteSelected();
      });
    }

    y += HUD.sectionGap;
    y = this.addSectionTitle("Map Metadata", y);

    const map = editorState.mapData;
    y = this.addMetadataRow("name", map.name, y, "text", (value) => {
      editorState.updateMapMetadata({ name: value as string });
      this.handlers.onMapMetadataEdited();
    });
    y = this.addMetadataRow("width", map.size.width, y, "number", (value) => {
      editorState.updateMapMetadata({
        size: { ...editorState.mapData.size, width: value as number },
      });
      this.handlers.onMapMetadataEdited();
    });
    y = this.addMetadataRow("height", map.size.height, y, "number", (value) => {
      editorState.updateMapMetadata({
        size: { ...editorState.mapData.size, height: value as number },
      });
      this.handlers.onMapMetadataEdited();
    });
    y = this.addMetadataRow(
      "boundaryPolicy",
      map.boundaryPolicy,
      y,
      "select",
      (value) => {
        editorState.updateMapMetadata({
          boundaryPolicy: value as MapData["boundaryPolicy"],
        });
        this.handlers.onMapMetadataEdited();
      },
      ["closed", "open"],
    );
    y = this.addMetadataRow(
      "cameraPolicy",
      map.cameraPolicy,
      y,
      "select",
      (value) => {
        editorState.updateMapMetadata({
          cameraPolicy: value as MapData["cameraPolicy"],
        });
        this.handlers.onMapMetadataEdited();
      },
      ["static", "follow", "dynamic"],
    );

    y = this.addSectionLabel("Visual Bounds", y + 4);
    y = this.addBoundsRows("visualBounds", map.visualBounds, y);
    y = this.addSectionLabel("Gameplay Bounds", y + 4);
    y = this.addBoundsRows("gameplayBounds", map.gameplayBounds, y);
    y = this.addSectionLabel("Death Bounds", y + 4);
    y = this.addBoundsRows("deathBounds", map.deathBounds, y);

    this.propertiesContentHeight = y + HUD.panelPadding;
    this.clampPropertiesScroll();
    this.positionPropertiesContent();
  }

  refreshStatus(): void {
    const mod = modKeyLabel();

    // UX-5d: Per-type element counts
    const f = editorState.mapData.collision.filter((e) => e.type === "floor").length;
    const pl = editorState.mapData.collision.filter((e) => e.type === "one_way_platform").length;
    const w = editorState.mapData.collision.filter((e) => e.type === "solid_wall").length;
    const fz = editorState.mapData.hazards.filter((e) => e.type === "fall_zone").length;
    const k = editorState.mapData.hazards.filter((e) => e.type === "instant_kill_hazard").length;
    const sp = editorState.mapData.spawnPoints.length;
    const wp = editorState.mapData.weaponSpawns.length;
    const it = editorState.mapData.itemSpawns.length;
    const total = f + pl + w + fz + k + sp + wp + it;

    const countParts: string[] = [];
    if (f) countParts.push(`Floor:${f}`);
    if (pl) countParts.push(`Plat:${pl}`);
    if (w) countParts.push(`Wall:${w}`);
    if (fz) countParts.push(`Fall:${fz}`);
    if (k) countParts.push(`Kill:${k}`);
    if (sp) countParts.push(`Spawn:${sp}`);
    if (wp) countParts.push(`Weapon:${wp}`);
    if (it) countParts.push(`Item:${it}`);
    const countStr = countParts.length > 0 ? countParts.join(" ") : "none";

    // UX-5a: Updated shortcut hints with undo/redo/duplicate
    this.statusText.setText(
      `${total} (${countStr})  Zoom ${Math.round(editorState.zoom * 100)}%  Grid ${editorState.gridSize}  Snap ${editorState.snapEnabled ? "ON" : "OFF"}  |  ${mod}+Z Undo  ${mod}+⇧+Z Redo  ${mod}+D Dup  Del Delete  Esc  Home`,
    );
  }

  setDropActive(active: boolean): void {
    this.dropOverlay.setVisible(active);
  }

  containsScreenPoint(screenX: number, screenY: number): boolean {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const inToolbar =
      screenY >= 0 && screenY <= HUD.toolbarHeight && screenX >= 0 && screenX <= width;
    const inStatus =
      screenY >= height - HUD.statusHeight &&
      screenY <= height &&
      screenX >= 0 &&
      screenX <= width;
    const inPanel =
      screenX >= width - HUD.panelWidth &&
      screenX <= width &&
      screenY >= HUD.toolbarHeight &&
      screenY <= height - HUD.statusHeight;

    return inToolbar || inStatus || inPanel;
  }

  handleWheel(screenX: number, screenY: number, deltaY: number): boolean {
    if (!this.containsScreenPoint(screenX, screenY)) {
      return false;
    }

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const inPanel =
      screenX >= width - HUD.panelWidth &&
      screenX <= width &&
      screenY >= HUD.toolbarHeight &&
      screenY <= height - HUD.statusHeight;

    if (!inPanel) {
      return true;
    }

    const viewportHeight = height - HUD.toolbarHeight - HUD.statusHeight - 38;
    const maxScroll = Math.max(0, this.propertiesContentHeight - viewportHeight);
    if (maxScroll <= 0) {
      return true;
    }

    this.propertiesScroll = Phaser.Math.Clamp(
      this.propertiesScroll + deltaY * 0.35,
      0,
      maxScroll,
    );
    this.positionPropertiesContent();
    return true;
  }

  destroy(): void {
    this.toolbar.destroy(true);
    this.propertiesShell.destroy(true);
    this.propertiesMaskShape.destroy();
    this.statusBar.destroy(true);
    this.dropOverlay.destroy(true);
  }

  private createToolbar(): void {
    this.toolbar = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.toolbarBg = this.scene.add
      .rectangle(0, 0, 0, HUD.toolbarHeight, 0x111827, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x374151, 1)
      .setScrollFactor(0);
    this.toolbar.add(this.toolbarBg);

    for (const def of TOOL_DEFS) {
      const button = this.createButton(def.label, 64, HUD.buttonHeight, def.color, () => {
        editorState.setActiveTool(def.tool);
        this.refreshToolbar();
      });
      this.toolbarButtons.set(def.tool, button);
      this.toolbar.add([button.bg, button.text]);
    }

    this.gridButton = this.createButton("Grid 16", 68, HUD.buttonHeight, 0x475569, () => {
      editorState.gridSize = editorState.gridSize === 16 ? 40 : 16;
      this.refreshToolbar();
      this.handlers.onViewportSettingChanged();
    });
    this.snapButton = this.createButton("Snap ON", 82, HUD.buttonHeight, 0x2563eb, () => {
      editorState.snapEnabled = !editorState.snapEnabled;
      this.refreshToolbar();
      this.handlers.onViewportSettingChanged();
    });
    this.importButton = this.createButton("Import", 70, HUD.buttonHeight, 0x065f46, () => {
      void this.handlers.onImportRequested();
    });
    this.exportButton = this.createButton("Export", 70, HUD.buttonHeight, 0x7c3aed, () => {
      downloadMapFile(editorState.mapData);
    });

    this.toolbar.add([
      this.gridButton.bg,
      this.gridButton.text,
      this.snapButton.bg,
      this.snapButton.text,
      this.importButton.bg,
      this.importButton.text,
      this.exportButton.bg,
      this.exportButton.text,
    ]);
  }

  private layoutToolbarButtons(): void {
    let x = HUD.sidePadding;
    const y = (HUD.toolbarHeight - HUD.buttonHeight) / 2;

    for (const def of TOOL_DEFS) {
      const button = this.toolbarButtons.get(def.tool);
      if (!button) continue;
      button.bg.setPosition(x, y);
      button.text.setPosition(x + button.bg.width / 2, y + button.bg.height / 2);
      x += button.bg.width + HUD.buttonGap;
    }

    x += HUD.buttonGap;
    for (const button of [
      this.gridButton,
      this.snapButton,
      this.importButton,
      this.exportButton,
    ]) {
      button.bg.setPosition(x, y);
      button.text.setPosition(x + button.bg.width / 2, y + button.bg.height / 2);
      x += button.bg.width + HUD.buttonGap;
    }
  }

  private createPropertiesPanel(): void {
    this.propertiesShell = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.propertiesContent = this.scene.add.container(0, 0).setScrollFactor(0);
    this.propertiesBg = this.scene.add
      .rectangle(0, 0, HUD.panelWidth, 100, 0x0f172a, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x334155, 1)
      .setScrollFactor(0);
    this.propertiesTitle = this.scene.add
      .text(0, 0, "Properties", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#e5e7eb",
      })
      .setScrollFactor(0);

    this.propertiesMaskShape = this.scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.propertiesMaskShape.setVisible(false);
    this.propertiesContent.setMask(this.propertiesMaskShape.createGeometryMask());

    this.propertiesShell.add([
      this.propertiesBg,
      this.propertiesTitle,
      this.propertiesContent,
    ]);
  }

  private createStatusBar(): void {
    this.statusBar = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.statusBg = this.scene.add
      .rectangle(0, 0, 100, HUD.statusHeight, 0x111827, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x374151, 1)
      .setScrollFactor(0);
    this.statusText = this.scene.add
      .text(HUD.sidePadding, 6, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cbd5e1",
      })
      .setScrollFactor(0);

    this.statusBar.add([this.statusBg, this.statusText]);
  }

  private createDropOverlay(): void {
    this.dropOverlay = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1200);
    this.dropBg = this.scene.add
      .rectangle(0, 0, 100, 100, 0x020617, 0.82)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.dropText = this.scene.add
      .text(0, 0, "JSON 파일을 놓으면 맵을 가져옵니다", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f8fafc",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.dropOverlay.add([this.dropBg, this.dropText]);
    this.dropOverlay.setVisible(false);
  }

  private createButton(
    label: string,
    width: number,
    height: number,
    activeColor: number,
    onClick: () => void,
  ): HudButton {
    const bg = this.scene.add
      .rectangle(0, 0, width, height, 0x1f2937, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x475569, 1)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    const text = this.scene.add
      .text(width / 2, height / 2, label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    let isActive = false;

    bg.on("pointerover", () => {
      if (isActive) {
        bg.setFillStyle(activeColor, 0.28);
        return;
      }
      bg.setFillStyle(0x334155, 1);
    });
    bg.on("pointerout", () => {
      if (isActive) {
        bg.setFillStyle(activeColor, 0.28);
        bg.setStrokeStyle(1, activeColor, 1);
        text.setColor("#ffffff");
        return;
      }
      bg.setFillStyle(0x1f2937, 1);
      bg.setStrokeStyle(1, 0x475569, 1);
      text.setColor("#cbd5e1");
    });
    bg.on("pointerdown", () => {
      onClick();
    });

    return {
      bg,
      text,
      setActive: (active: boolean) => {
        isActive = active;
        if (active) {
          bg.setFillStyle(activeColor, 0.28);
          bg.setStrokeStyle(1, activeColor, 1);
          text.setColor("#ffffff");
          return;
        }
        bg.setFillStyle(0x1f2937, 1);
        bg.setStrokeStyle(1, 0x475569, 1);
        text.setColor("#cbd5e1");
      },
      setLabel: (nextLabel: string) => {
        text.setText(nextLabel);
      },
    };
  }

  private addSectionTitle(title: string, y: number): number {
    const text = this.scene.add.text(0, y, title, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f8fafc",
    });
    this.propertiesContent.add(text);
    return y + 22;
  }

  private addSectionLabel(title: string, y: number): number {
    const text = this.scene.add.text(0, y, title, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#94a3b8",
    });
    this.propertiesContent.add(text);
    return y + 18;
  }

  private addInfoRow(text: string, y: number): number {
    const label = this.scene.add.text(0, y, text, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#cbd5e1",
      wordWrap: { width: HUD.panelWidth - HUD.panelPadding * 2 },
    });
    this.propertiesContent.add(label);
    return y + HUD.rowHeight;
  }

  private addActionRow(
    text: string,
    y: number,
    onClick: () => void,
    fillColor: number,
  ): number {
    const width = HUD.panelWidth - HUD.panelPadding * 2;
    const bg = this.scene.add
      .rectangle(0, y, width, HUD.rowHeight, fillColor, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x334155, 1)
      .setInteractive({ useHandCursor: true });
    const label = this.scene.add.text(8, y + 6, text, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#e2e8f0",
      wordWrap: { width: width - 16 },
    });

    bg.on("pointerover", () => {
      bg.setFillStyle(0x334155, 1);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(fillColor, 1);
    });
    bg.on("pointerdown", () => {
      onClick();
    });

    this.propertiesContent.add([bg, label]);
    return y + HUD.rowHeight + 4;
  }

  private addButtonRow(
    label: string,
    y: number,
    fillColor: number,
    onClick: () => void,
  ): number {
    return this.addActionRow(label, y, onClick, fillColor);
  }

  private addMetadataRow(
    label: string,
    currentValue: string | number,
    y: number,
    type: "number" | "text" | "select",
    apply: (value: string | number) => void,
    options?: string[],
  ): number {
    return this.addActionRow(`${label}  ${currentValue}`, y, () => {
      const nextValue = this.resolveNextValue(label, type, currentValue, options);
      if (nextValue === null) {
        return;
      }
      apply(nextValue);
      this.refreshProperties();
    }, 0x1f2937);
  }

  private addBoundsRows(
    boundsKey: "visualBounds" | "gameplayBounds" | "deathBounds",
    bounds: Bounds,
    y: number,
  ): number {
    y = this.addMetadataRow("left", bounds.left, y, "number", (value) => {
      this.updateBounds(boundsKey, "left", value as number);
    });
    y = this.addMetadataRow("right", bounds.right, y, "number", (value) => {
      this.updateBounds(boundsKey, "right", value as number);
    });
    y = this.addMetadataRow("top", bounds.top, y, "number", (value) => {
      this.updateBounds(boundsKey, "top", value as number);
    });
    y = this.addMetadataRow("bottom", bounds.bottom, y, "number", (value) => {
      this.updateBounds(boundsKey, "bottom", value as number);
    });
    return y;
  }

  private updateBounds(
    boundsKey: "visualBounds" | "gameplayBounds" | "deathBounds",
    side: keyof Bounds,
    value: number,
  ): void {
    editorState.updateMapMetadata({
      [boundsKey]: {
        ...editorState.mapData[boundsKey],
        [side]: value,
      },
    } as Partial<MapData>);
    this.handlers.onMapMetadataEdited();
    this.refreshProperties();
  }

  private editElementField(
    elementId: string,
    field: FieldDef,
    currentValue: unknown,
  ): void {
    const nextValue = this.resolveNextValue(
      field.label,
      field.type,
      currentValue,
      field.options,
    );
    if (nextValue === null) {
      return;
    }

    const updates: Partial<EditableElement> = {};
    (updates as Record<string, unknown>)[field.key] = nextValue;
    editorState.updateElement(elementId, updates);
    this.handlers.onElementEdited(elementId);
    this.refreshProperties();
  }

  private resolveNextValue(
    label: string,
    type: "number" | "text" | "select",
    currentValue: unknown,
    options?: string[],
  ): string | number | null {
    if (type === "select" && options && options.length > 0) {
      const currentIndex = options.indexOf(String(currentValue));
      return options[(currentIndex + 1 + options.length) % options.length];
    }

    const nextRaw = window.prompt(`${label} 값을 입력하세요`, currentValue === undefined ? "" : String(currentValue));
    if (nextRaw === null) {
      return null;
    }

    if (type === "number") {
      const parsed = Number(nextRaw);
      if (Number.isNaN(parsed)) {
        window.alert("숫자 값을 입력해야 합니다.");
        return null;
      }
      return parsed;
    }

    return nextRaw;
  }

  private clampPropertiesScroll(): void {
    const viewportHeight =
      this.scene.scale.height - HUD.toolbarHeight - HUD.statusHeight - 38;
    const maxScroll = Math.max(0, this.propertiesContentHeight - viewportHeight);
    this.propertiesScroll = Phaser.Math.Clamp(this.propertiesScroll, 0, maxScroll);
  }

  private positionPropertiesContent(): void {
    this.propertiesContent.setPosition(
      HUD.panelPadding,
      38 + HUD.panelPadding - this.propertiesScroll,
    );
  }
}

function detectElementType(element: EditableElement): ElementType {
  if ("type" in element) {
    return (element as { type: ElementType }).type;
  }
  if ("weaponId" in element) {
    return "weapon_spawn";
  }
  if ("itemId" in element) {
    return "item_spawn";
  }
  return "spawn_point";
}
