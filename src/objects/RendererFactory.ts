import type { EditableElement } from "@/types/map";
import { RectElementRenderer } from "./RectElementRenderer";
import { PointElementRenderer } from "./PointElementRenderer";
import type { EditorElementRenderer } from "./EditorElementRenderer";

type RectType =
  | "floor"
  | "one_way_platform"
  | "solid_wall"
  | "fall_zone"
  | "instant_kill_hazard";

const RECT_TYPES: Set<string> = new Set<RectType>([
  "floor",
  "one_way_platform",
  "solid_wall",
  "fall_zone",
  "instant_kill_hazard",
]);

/**
 * EditableElement의 타입에 따라 적절한 EditorElementRenderer 인스턴스를 생성합니다.
 *
 * - 사각형 타입(floor, one_way_platform, solid_wall, fall_zone, instant_kill_hazard)
 *   → RectElementRenderer
 * - 포인트 타입(spawn_point, weapon_spawn, item_spawn)
 *   → PointElementRenderer
 */
export function createRenderer(
  scene: Phaser.Scene,
  element: EditableElement
): EditorElementRenderer {
  const type = (element as { type?: string }).type;

  if (type !== undefined && RECT_TYPES.has(type)) {
    return new RectElementRenderer(scene, element);
  }

  return new PointElementRenderer(scene, element);
}
