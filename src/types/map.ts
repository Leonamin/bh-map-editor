// ─── Battle Hamsters 맵 에디터 타입 ───
// 핵심 맵 타입은 @battle-hamsters/shared에서 가져오고,
// 에디터 전용 헬퍼 타입만 여기에 정의한다.

// shared에서 원본 타입 re-export (에디터 친화적 별칭)
export type {
  MapDefinition as MapData,
  CollisionPrimitive as CollisionElement,
  FloorCollisionPrimitive as Floor,
  OneWayPlatformCollisionPrimitive as OneWayPlatform,
  SolidWallCollisionPrimitive as SolidWall,
  HazardZone as HazardElement,
  FallZoneHazard as FallZone,
  InstantKillHazard,
  SpawnPoint,
  WeaponSpawnPoint as WeaponSpawn,
  ItemSpawnPoint as ItemSpawn,
  BoundsRect as Bounds,
  BoundaryPolicy,
  CameraPolicy,
  SpawnStyle,
} from "@battle-hamsters/shared";

// 에디터에서 사용하는 shared 타입 직접 import
import type { CollisionPrimitive } from "@battle-hamsters/shared";
import type { HazardZone } from "@battle-hamsters/shared";
import type { SpawnPoint } from "@battle-hamsters/shared";
import type { WeaponSpawnPoint } from "@battle-hamsters/shared";
import type { ItemSpawnPoint } from "@battle-hamsters/shared";

/** 맵 크기 — shared에는 {width, height}가 inline이어서 별도 정의 */
export interface MapSize {
  width: number;
  height: number;
}

/** spawnStyle + mode 조합 타입 */
export type SpawnMode = "fixed" | "random_candidates";

// ─── 편집기 헬퍼 타입 ───

/** 에디터에서 편집 가능한 모든 요소 유니온 */
export type EditableElement =
  | CollisionPrimitive
  | HazardZone
  | SpawnPoint
  | WeaponSpawnPoint
  | ItemSpawnPoint;

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
