# 맵 에디터 구현 계획서

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Phaser 3 + TypeScript 기반 웹 맵 에디터. 드래그앤드롭으로 collision/spawn/hazard 요소를 배치하고, JSON I/O로 본게임 맵 포맷과 호환되는 데이터를 주고받는다.

**Architecture:** 단일 Phaser Scene 안에 캔버스(그리드+요소) + HTML DOM 오버레이(Toolbar, Properties Panel)를 결합. HTML DOM 오버레이는 Phaser의 `scene.add.dom()` 또는 index.html에 직접 배치하여 Phaser 캔버스 위에 띄운다. (Phaser GameObjects만으로 복잡한 폼 UI를 구현하는 건 비효율적이므로 속성 편집은 DOM으로, 캔버스 렌더링은 Phaser로 분리)

**Tech Stack:** Phaser 3.80, Vite 5, TypeScript 5.4, Vanilla DOM API (UI 오버레이용)

---

## Task 1: 맵 데이터 타입 정의

**Objective:** 본게임 맵 JSON 포맷과 호환되는 TypeScript 타입을 정의

**Files:**
- Create: `src/types/map.ts`

**구현 내용:**
```typescript
// collision primitives
export interface Floor { id: string; type: "floor"; leftX: number; rightX: number; topY: number; }
export interface OneWayPlatform { id: string; type: "one_way_platform"; leftX: number; rightX: number; topY: number; }
export interface SolidWall { id: string; type: "solid_wall"; x: number; topY: number; bottomY: number; }
export type CollisionElement = Floor | OneWayPlatform | SolidWall;

// hazards
export interface FallZone { id: string; type: "fall_zone"; x: number; y: number; width: number; height: number; }
export interface InstantKillHazard { id: string; type: "instant_kill_hazard"; x: number; y: number; width: number; height: number; }
export type HazardElement = FallZone | InstantKillHazard;

// spawns
export interface SpawnPoint { id: string; x: number; y: number; }

// weapon spawns
export interface WeaponSpawn {
  id: string; weaponId: string; x: number; y: number;
  respawnMs: number; despawnAfterMs: number;
  spawnStyle: "airdrop" | "fade_in" | "triggered";
  despawnStyle: string; mode: "fixed" | "random_candidates";
  spawnGroupId?: string;
}

// item spawns
export interface ItemSpawn {
  id: string; itemId: string; x: number; y: number;
  respawnMs: number; spawnStyle: "airdrop" | "fade_in" | "triggered";
  mode: "fixed" | "random_candidates"; spawnGroupId?: string;
}

// full map
export interface Bounds { left: number; right: number; top: number; bottom: number; }
export interface MapSize { width: number; height: number; }

export interface MapData {
  version: number;
  id: string;
  name: string;
  size: MapSize;
  boundaryPolicy: "closed" | "open";
  cameraPolicy: "static" | "follow" | "dynamic";
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

// editor-specific: union type for any editable element
export type EditableElement = CollisionElement | HazardElement | SpawnPoint | WeaponSpawn | ItemSpawn;
```

**Verification:** `npx tsc --noEmit` 통과

---

## Task 2: 맵 I/O 유틸리티

**Objective:** JSON 내보내기/불러오기 유틸리티 구현

**Files:**
- Create: `src/utils/map-io.ts`

**구현 내용:**
- `exportMapToJson(mapData: MapData): string` — JSON.stringify (indent=2)
- `downloadMapFile(mapData: MapData): void` — Blob 생성 후 브라우저 다운로드
- `loadMapFromFile(): Promise<MapData>` — `<input type="file">` 열어서 읽기
- `loadMapFromJson(json: string): MapData` — 파싱 + 기본 검증

**Verification:** `npx tsc --noEmit` 통과

---

## Task 3: 에디터 상태 관리 (EditorState)

**Objective:** 에디터의 현재 상태를 관리하는 싱글톤 클래스

**Files:**
- Create: `src/state/EditorState.ts`

**구현 내용:**
```typescript
class EditorState {
  mapData: MapData;
  selectedElement: EditableElement | null;
  selectedType: ToolType | null;  // 현재 선택된 도구
  gridSize: number;               // 그리드 크기 (기본 40)
  snapEnabled: boolean;           // 스냅 활성화
  zoom: number;                   // 현재 줌 레벨
  
  // methods
  addElement(element: EditableElement): void;
  removeElement(id: string): void;
  updateElement(id: string, updates: Partial<...>): void;
  getElementsByType(type: string): EditableElement[];
  clearAll(): void;
}
```

- `MapData`의 기본 빈 맵 템플릿을 생성하는 팩토리 함수 포함
- 요소 추가/삭제/수정 시 mapData를 직접 조작
- ID 자동 생성: 타입별 prefix + 카운터 (예: `floor_1`, `spawn_3`)

**Verification:** `npx tsc --noEmit` 통과

---

## Task 4: 그리드 + 카메라 컨트롤

**Objective:** 캔버스에 그리드를 그리고, 줌/팬 기능 구현

**Files:**
- Modify: `src/scenes/EditorScene.ts`
- Create: `src/objects/GridOverlay.ts`
- Create: `src/config.ts` — 에디터 설정 상수

**구현 내용:**
- GridOverlay: Phaser.Graphics로 그리드 선 그리기 (줌 레벨에 맞게)
- 카메라 컨트롤:
  - 마우스 휠 → 줌 (0.25x ~ 4x, `cameras.main.setZoom()`)
  - 우클릭 드래그 또는 Space+드래그 → 팬 (`cameras.main.setScroll()`)
  - Home 키 → 뷰 리셋
- 그리드는 항상 카메라 뷰포트에 맞게 그려짐
- 줌이 너무 작으면 그리드 숨김 (밀도가 너무 높으면 안 보임)

**Verification:** `npm run dev` → 브라우저에서 그리드 보이고 줌/팬 동작

---

## Task 5: 맵 Bounds 시각 표시

**Objective:** visualBounds, gameplayBounds, deathBounds를 점선 사각형으로 표시

**Files:**
- Create: `src/objects/BoundsOverlay.ts`
- Modify: `src/scenes/EditorScene.ts`

**구현 내용:**
- visualBounds: 흰색 점선 사각형
- gameplayBounds: 노란색 점선 사각형
- deathBounds: 빨간색 점선 사각형
- 라벨 텍스트 포함 (어떤 bounds인지)
- EditorState의 mapData 변경 시 재그리기

**Verification:** `npm run dev` → 세 bounds가 점선으로 표시

---

## Task 6: 편집 가능한 요소 렌더링 (EditorElement)

**Objective:** 각 요소 타입별 시각 표현 + 선택/이동/리사이즈 인터랙션

**Files:**
- Create: `src/objects/EditorElement.ts` — 공통 베이스 클래스
- Create: `src/objects/FloorRenderer.ts`
- Create: `src/objects/PlatformRenderer.ts`
- Create: `src/objects/WallRenderer.ts`
- Create: `src/objects/HazardRenderer.ts`
- Create: `src/objects/SpawnRenderer.ts`
- Create: `src/objects/WeaponSpawnRenderer.ts`
- Create: `src/objects/ItemSpawnRenderer.ts`

**구현 내용:**
- 각 렌더러는 Phaser.Container 기반
- 공통 기능:
  - `setData(element)` → 데이터 기반 위치/크기 설정
  - `setSelected(bool)` → 선택 테두리 표시
  - `getResizeHandles()` → 리사이즈 핸들 반환 (사각형 요소만)
  - `containsPoint(x, y)` → 히트 테스트
- floor: 녹색 사각형
- one_way_platform: 청록색 사각형 (점선 테두리)
- solid_wall: 회색 세로 막대
- fall_zone: 빨강 반투명 사각형
- instant_kill_hazard: 주황 반투명 사각형
- spawnPoint: 파란 원 (지름 16px)
- weaponSpawn: 보라 다이아몬드
- itemSpawn: 노랑 별

**Verification:** `npx tsc --noEmit` 통과

---

## Task 7: 드래그앤드롭 배치 시스템

**Objective:** Toolbar에서 선택한 타입의 요소를 캔버스에 드래그앤드롭으로 배치

**Files:**
- Create: `src/systems/PlacementSystem.ts`
- Modify: `src/scenes/EditorScene.ts`

**구현 내용:**
- 도구 타입이 선택된 상태에서 캔버스 클릭:
  - 클릭 위치에 기본 크기 요소 생성 (point 타입은 즉시 배치)
  - 사각형 타입은 mousedown → drag → mouseup으로 크기 결정
- 배치 완료 후:
  - EditorState에 요소 추가
  - 해당 요소 자동 선택
  - 속성 패널 업데이트 이벤트 발생
- 그리드 스냅: snapEnabled이면 가장 가까운 그리드 점으로 보정

**Verification:** `npm run dev` → 요소 배치 동작

---

## Task 8: 선택 + 이동 + 리사이즈 인터랙션

**Objective:** 배치된 요소를 클릭으로 선택, 드래그로 이동, 핸들로 리사이즈

**Files:**
- Create: `src/systems/SelectionSystem.ts`
- Modify: `src/scenes/EditorScene.ts`

**구현 내용:**
- 클릭 → hitTest → 요소 선택 (기존 선택 해제)
- 빈 공간 클릭 → 선택 해제
- 선택된 요소 드래그 → 이동 (그리드 스냅 적용)
- 선택된 요소의 리사이즈 핸들 드래그 → 크기 변경
- Delete 키 → 선택 요소 삭제
- 이동/리사이즈 중 EditorState의 mapData 실시간 업데이트
- 변경 시 속성 패널 업데이트 이벤트 발생

**Verification:** `npm run dev` → 선택/이동/리사이즈/삭제 동작

---

## Task 9: HTML DOM 오버레이 — Toolbar + Properties Panel

**Objective:** 에디터 UI 오버레이를 HTML DOM으로 구현

**Files:**
- Modify: `index.html` — 오버레이 UI HTML 추가
- Create: `src/ui/styles.css` — 오버레이 스타일
- Create: `src/ui/Toolbar.ts` — 도구바 로직
- Create: `src/ui/PropertiesPanel.ts` — 속성 패널 로직
- Create: `src/ui/StatusBar.ts` — 상태 표시줄

**구현 내용:**

**Toolbar** (상단):
- 요소 타입 버튼: Floor, Platform, Wall, Hazard (fall_zone/kill), Spawn, Weapon, Item
- 선택 도구 버튼 (포인터)
- 그리드 토글, 스냅 토글
- Import/Export 버튼

**Properties Panel** (우측):
- 선택된 요소의 모든 필드를 input 필드로 표시
- 값 변경 시 즉시 EditorState + 캔버스 렌더러 업데이트
- 맵 메타데이터 섹션: name, size, bounds, policies

**StatusBar** (하단):
- 요소 개수, 줌 레벨, 그리드 크기

**주의:** Phaser 캔버스 위에 CSS `position: fixed` 오버레이로 배치. 캔버스 이벤트와 UI 이벤트가 충돌하지 않게 `pointer-events` 관리.

**Verification:** `npm run dev` → 전체 UI 레이아웃 표시

---

## Task 10: Import/Export 통합 + 기본 맵 로드

**Objective:** JSON Import/Export가 전체 흐름에서 동작

**Files:**
- Modify: `src/ui/Toolbar.ts` — Import/Export 버튼 핸들러
- Modify: `src/scenes/EditorScene.ts` — 로드 후 전체 재렌더링
- Create: `src/utils/default-map.ts` — 빈 맵 템플릿

**구현 내용:**
- Export: EditorState.mapData → JSON → 파일 다운로드
- Import: 파일 선택 → JSON 파싱 → EditorState.mapData 교체 → 캔버스 전체 재렌더링
- 초기 로드: 빈 맵 템플릿으로 시작
- Import 후 모든 bounds, collision, spawn 등 시각 요소 재생성

**Verification:** 
1. 빈 맵에서 요소 배치 → Export → 파일 확인
2. `training-arena.json` Import → 모든 요소 정상 표시
3. `npx tsc --noEmit` 통과

---

## Task 11: 통합 + 폴리싱

**Objective:** 전체 기능 통합 테스트 + UI 폴리싱

**Files:**
- 전반적 수정

**구현 내용:**
- 단축키 추가: Ctrl+S (Export), Delete (삭제), Escape (선택 해제), G (그리드 토글)
- 요소 ID 자동 생성 개선
- 빈 영역 우클릭 컨텍스트 메뉴 방지
- 줌 레벨 표시
- 전체 타입체크 통과

**Verification:**
1. `npx tsc --noEmit` 통과
2. `npm run build` 성공
3. 전체 워크플로우: 빈 맵 → 요소 배치 → 편집 → Export → Import → 동일 결과
