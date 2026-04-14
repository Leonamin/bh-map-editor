// ─── Battle Hamsters 맵 데이터 타입 정의 ───
// data-formats.md 및 training-arena.json 포맷과 완전 호환

// ─── 공통 ───

/** 직사각형 경계 */
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 맵 크기 */
export interface MapSize {
  width: number;
  height: number;
}

// ─── Collision primitives ───

export interface Floor {
  id: string;
  type: "floor";
  leftX: number;
  rightX: number;
  topY: number;
}

export interface OneWayPlatform {
  id: string;
  type: "one_way_platform";
  leftX: number;
  rightX: number;
  topY: number;
}

export interface SolidWall {
  id: string;
  type: "solid_wall";
  x: number;
  topY: number;
  bottomY: number;
}

/** 충돌 요소 유니온 */
export type CollisionElement = Floor | OneWayPlatform | SolidWall;

// ─── Hazards ───

export interface FallZone {
  id: string;
  type: "fall_zone";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InstantKillHazard {
  id: string;
  type: "instant_kill_hazard";
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 위험 요소 유니온 */
export type HazardElement = FallZone | InstantKillHazard;

// ─── Spawn / Item / Weapon ───

export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
}

export type SpawnStyle = "airdrop" | "fade_in" | "triggered";

export type SpawnMode = "fixed" | "random_candidates";

export interface WeaponSpawn {
  id: string;
  weaponId: string;
  x: number;
  y: number;
  respawnMs: number;
  despawnAfterMs: number;
  spawnStyle: SpawnStyle;
  despawnStyle: string;
  mode: SpawnMode;
  spawnGroupId?: string;
}

export interface ItemSpawn {
  id: string;
  itemId: string;
  x: number;
  y: number;
  respawnMs: number;
  spawnStyle: SpawnStyle;
  mode: SpawnMode;
  spawnGroupId?: string;
}

// ─── Full map data ───

export type BoundaryPolicy = "closed" | "open";
export type CameraPolicy = "static" | "follow" | "dynamic";

export interface MapData {
  version: number;
  id: string;
  name: string;
  size: MapSize;
  boundaryPolicy: BoundaryPolicy;
  cameraPolicy: CameraPolicy;
  visualBounds: Bounds;
  gameplayBounds: Bounds;
  deathBounds: Bounds;
  spawnPoints: SpawnPoint[];
  collision: CollisionElement[];
  hazards: HazardElement[];
  weaponSpawns: WeaponSpawn[];
  itemSpawns: ItemSpawn[];
  terrain: unknown[];
  decorations: unknown[];
}

// ─── 편집기 헬퍼 타입 ───

/** 에디터에서 편집 가능한 모든 요소 유니온 */
export type EditableElement =
  | CollisionElement
  | HazardElement
  | SpawnPoint
  | WeaponSpawn
  | ItemSpawn;

/** 요소 타입 식별자 문자열 리터럴 유니온 */
export type ElementType =
  | "floor"
  | "one_way_platform"
  | "solid_wall"
  | "fall_zone"
  | "instant_kill_hazard"
  | "spawn_point"
  | "weapon_spawn"
  | "item_spawn";
