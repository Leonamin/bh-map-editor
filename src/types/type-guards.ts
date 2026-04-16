// ─── Type Guards for EditableElement ───
// EditableElement 유니온 타입을 안전하게 좁히기 위한 타입 가드 함수들.
// "type" in el 체크와 as unknown as 캐스팅을 대체합니다.

import type {
  EditableElement,
  ElementType,
  MapData,
  Floor,
  OneWayPlatform,
  SolidWall,
  FallZone,
  InstantKillHazard,
  SpawnPoint,
  WeaponSpawn,
  ItemSpawn,
} from "./map";

// ─── ElementType 감지 ───

/**
 * EditableElement에서 ElementType을 감지합니다.
 * SpawnPoint는 type 필드가 없으므로 별도 검사.
 *
 * 단일 소스 오브 트루스 — 이 함수를 모든 곳에서 사용하세요.
 */
export function detectElementType(el: EditableElement): ElementType {
  if ("type" in el) {
    return (el as { type: ElementType }).type;
  }
  return "spawn_point";
}

// ─── 개별 타입 가드 ───

export function isFloor(el: EditableElement): el is Floor {
  return "type" in el && (el as { type: string }).type === "floor";
}

export function isOneWayPlatform(el: EditableElement): el is OneWayPlatform {
  return "type" in el && (el as { type: string }).type === "one_way_platform";
}

export function isSolidWall(el: EditableElement): el is SolidWall {
  return "type" in el && (el as { type: string }).type === "solid_wall";
}

export function isFallZone(el: EditableElement): el is FallZone {
  return "type" in el && (el as { type: string }).type === "fall_zone";
}

export function isInstantKillHazard(el: EditableElement): el is InstantKillHazard {
  return "type" in el && (el as { type: string }).type === "instant_kill_hazard";
}

export function isSpawnPoint(el: EditableElement): el is SpawnPoint {
  return !("type" in el);
}

export function isWeaponSpawn(el: EditableElement): el is WeaponSpawn {
  return "weaponId" in el;
}

export function isItemSpawn(el: EditableElement): el is ItemSpawn {
  return "itemId" in el && !("weaponId" in el);
}

// ─── 그룹 타입 가드 ───

/** 사각형 기반 요소 여부 (floor, one_way_platform, solid_wall, fall_zone, instant_kill_hazard) */
export function isRectElement(el: EditableElement): boolean {
  if (!("type" in el)) return false;
  const t = (el as { type: string }).type;
  return (
    t === "floor" ||
    t === "one_way_platform" ||
    t === "solid_wall" ||
    t === "fall_zone" ||
    t === "instant_kill_hazard"
  );
}

/** 포인트 기반 요소 여부 (spawn_point, weapon_spawn, item_spawn) */
export function isPointElement(el: EditableElement): boolean {
  return !isRectElement(el);
}

/** leftX/rightX/topY를 가진 가로바 타입 (floor, one_way_platform) */
export function isHorizontalBar(el: EditableElement): el is Floor | OneWayPlatform {
  return "leftX" in el && "rightX" in el;
}

/** x/topY/bottomY를 가진 수직 타입 (solid_wall) */
export function isVerticalBar(el: EditableElement): el is SolidWall {
  return "bottomY" in el && !("leftX" in el);
}

/** x/y/width/height를 가진 영역 타입 (fall_zone, instant_kill_hazard) */
export function isRectArea(el: EditableElement): el is FallZone | InstantKillHazard {
  return "width" in el && "height" in el && !("leftX" in el) && !("bottomY" in el);
}

// ─── MapData 배열 접근 ───

type ElementArrayHolder = Pick<
  MapData,
  "collision" | "hazards" | "spawnPoints" | "weaponSpawns" | "itemSpawns"
>;

/**
 * ElementType에 해당하는 MapData 내 배열을 반환합니다.
 * as 캐스팅이 필요하지만, 타입 매핑이 정확하므로 안전합니다.
 */
export function getArrayForType(
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
export function getAllElementArrays(data: MapData): EditableElement[][] {
  return [
    data.collision as EditableElement[],
    data.hazards as EditableElement[],
    data.spawnPoints as EditableElement[],
    data.weaponSpawns as EditableElement[],
    data.itemSpawns as EditableElement[],
  ];
}
