# BH Map Editor — 아키텍처 & 구현 상태

> 마지막 갱신: 2026-04-14

## 개요

웹 기반 2D 맵 에디터. Battle Hamsters 게임의 맵 JSON 포맷을 직접 읽고 쓴다.
게임 클라이언트(Phaser 3)와 동일한 렌더링 환경을 사용하여, 에디터에서 보이는 것과 게임에서 보이는 것의 인지적 차이를 최소화한다.

## 핵심 원칙

1. **게임과 동일한 렌더링** — Phaser 3 + Vite + TypeScript
2. **맵 JSON 완전 호환** — 본게임 포맷 준수, 에디터 전용 필드 금지
3. **순수 Phaser UI** — DOM 프레임워크 없이 Phaser GameObjects로 구현 (파일 선택만 예외)
4. **단일 씬 구조** — EditorScene 하나에 모든 기능
5. **단순함 우선** — undo/redo, 멀티 선택 등은 후순위

### 의사결정 기록

**ADR-1: DOM 오버레이 → Phaser HUD 전환**
- v1(develop)에서 HTML DOM 오버레이로 UI를 구현했으나 포인터 이벤트 충돌, 좌표 변환, resize 동기화 문제 발생
- Phaser GameObjects 기반 HUD(EditorHud)로 전환. `setScrollFactor(0)` + `setDepth(1000)`로 화면 고정
- 트레이드오프: 속성 편집은 `prompt()` 다이얼로그 사용 (인라인 편집보다 UX 저하 but 이벤트 일관성 확보)

**ADR-2: 렌더러 팩토리 패턴**
- 8종 요소를 개별 렌더러 대신 `RectElementRenderer`(사각형 5종) + `PointElementRenderer`(포인트 3종) 두 클래스로 분리
- `RendererFactory`가 type 필드로 분기, `config.ts` 색상 매핑으로 타입별 시각 차이 처리

## 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 렌더링 | Phaser 3.80 | 게임 클라이언트와 동일 |
| 빌드 | Vite 5 | 게임 클라이언트와 동일 |
| 언어 | TypeScript 5.4 | 게임 클라이언트와 동일 |
| UI | Phaser GameObjects (HUD) | DOM 프레임워크 없이 Phaser 내부에서 렌더링 |
| 패키지 매니저 | npm | 본게임과 동일 |

## UI 레이아웃

```
┌───────────────────────────────────────────────────────────────┐
│  Toolbar: [Select][Floor][Platform][Wall][Fall][Kill]        │
│           [Spawn][Weapon][Item] | [Grid][Snap][Import][Export]│
├──────────────────────────────────────┬────────────────────────┤
│                                      │ Properties             │
│                                      │ ─────────────────────  │
│      Canvas (Phaser)                 │ Selected Element       │
│      그리드 + 요소 배치              │   ID: floor_01         │
│                                      │   Type: floor          │
│      줌: 마우스 휠 (0.25x~4x)       │   leftX / rightX / topY│
│      팬: 우클릭 드래그              │                        │
│      리셋: Home 키                   │ Map Metadata           │
│                                      │   name / size          │
│                                      │   bounds / policies    │
│                                      │                        │
│                                      │ [Delete Selected]      │
├──────────────────────────────────────┴────────────────────────┤
│  Status: Elements 15 | Zoom 100% | Grid 40 | Snap ON         │
└───────────────────────────────────────────────────────────────┘
```

모든 UI 요소(Toolbar, Properties Panel, Status Bar)는 Phaser GameObjects로 구현된다.
HTML DOM 오버레이는 사용하지 않는다. 파일 선택(``<input type="file">``)만 브라우저 네이티브 API를 사용한다.

## 시스템 구조

### 레이어 구성

```
┌─────────────────────────────────────────────────────────┐
│                    EditorHud (UI)                       │
│  Toolbar | Properties Panel | Status Bar | Drop Overlay │
├─────────────────────────────────────────────────────────┤
│                  InteractionSystem                      │
│  배치 / 선택 / 이동 / 리사이즈 / 카메라 팬 상태 머신     │
├─────────────────────────────────────────────────────────┤
│                  ElementManager                          │
│  요소 CRUD / 렌더러 관리 / 히트 테스트 / 선택 상태       │
├─────────────────────────────────────────────────────────┤
│              EditorElementRenderer                      │
│  RectElementRenderer | PointElementRenderer             │
├─────────────────────────────────────────────────────────┤
│                EditorState (상태)                       │
│  MapData / activeTool / selectedId / zoom / grid        │
├─────────────────────────────────────────────────────────┤
│              GridOverlay / BoundsOverlay                │
├─────────────────────────────────────────────────────────┤
│                 map-io (파일 I/O)                       │
└─────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
사용자 입력 (마우스/키보드)
    │
    ▼
InteractionSystem (상태 머신)
    │ 포인터가 HUD 영역이면 → EditorHud가 처리
    │ 포인터가 캔버스 영역이면 → 아래 흐름
    ▼
ElementManager (요소 CRUD)
    │ createElement / selectElement / removeElement
    ▼
EditorState (상태 갱신)
    │ mapData 갱신, selectedId 변경
    ▼
EditorElementRenderer (시각 갱신)
    │ updateFromData() → drawShape() 재실행
    ▼
EditorHud.refreshProperties() / refreshStatus()
    │ 속성 패널, 상태바 갱신
    ▼
화면 업데이트
```

### 디렉토리 구조

```
src/
├── main.ts                     # Phaser Game 생성, 엔트리포인트
├── config.ts                   # 에디터 설정 상수 (색상, 그리드, 줌)
├── types/
│   └── map.ts                  # 맵 데이터 타입 정의 (MapData, EditableElement 등)
├── state/
│   └── EditorState.ts          # 에디터 싱글톤 상태 관리
├── scenes/
│   └── EditorScene.ts          # 메인 Phaser Scene (오케스트레이터)
├── systems/
│   ├── ElementManager.ts       # 요소 렌더러 CRUD + 히트 테스트
│   └── InteractionSystem.ts    # 마우스/키보드 인터랙션 상태 머신
├── objects/
│   ├── EditorElementRenderer.ts # 추상 베이스 렌더러 클래스
│   ├── RectElementRenderer.ts   # 사각형 요소 렌더러 (floor, platform, wall, hazards)
│   ├── PointElementRenderer.ts  # 포인트 요소 렌더러 (spawn, weapon, item)
│   ├── RendererFactory.ts       # 타입 기반 렌더러 생성 팩토리
│   ├── GridOverlay.ts           # 그리드 오버레이
│   └── BoundsOverlay.ts         # 맵 bounds 시각 오버레이
├── ui/
│   └── EditorHud.ts             # Phaser 기반 HUD (Toolbar, Properties, Status)
└── utils/
    ├── map-io.ts                # JSON import/export, 유효성 검사
    ├── platform.ts              # 크로스 플랫폼 입력 헬퍼 (Ctrl/Cmd, Alt/Option)
    ├── default-map.ts           # 빈 맵 템플릿 (createEmptyMap 위임)
    └── sample-loader.ts         # 샘플 맵 fetch 로더
```

## 핵심 컴포넌트

### EditorScene (`src/scenes/EditorScene.ts`)

단일 Phaser Scene. 모든 컴포넌트의 오케스트레이터 역할.

- `create()`: EditorState 초기화 → GridOverlay, BoundsOverlay, ElementManager, InteractionSystem, EditorHud 생성 → 입력 리스너 설정 → 파일 드롭 리스너 설정
- `update()`: 카메라 상태 변경 감지 → 오버레이 갱신 (dirty checking)
- `isPointerOverUI()`: HUD 영역 판정 (포인터 이벤트를 HUD와 캔버스로 분기)
- `rebuildFromMapData()`: Import 후 전체 재렌더링

### EditorState (`src/state/EditorState.ts`)

에디터의 전역 상태를 관리하는 싱글톤 (`editorState` export).

| 속성 | 타입 | 설명 |
|---|---|---|
| `mapData` | `MapData` | 현재 편집 중인 맵 데이터 |
| `activeTool` | `ToolType` | 현재 도구 (`"select"` or `ElementType`) |
| `selectedId` | `string \| null` | 선택된 요소 ID |
| `gridSize` | `number` | 그리드 크기 (16 or 40, 기본 40) |
| `snapEnabled` | `boolean` | 그리드 스냅 여부 (기본 true) |
| `zoom` | `number` | 현재 줌 레벨 |

주요 메서드:
- `addElement(element)` / `removeElement(id)` / `updateElement(id, updates)` / `findElement(id)`
- `generateId(type)` — 타입별 prefix(`floor_`, `platform_`, `wall_`, ...) + 자동 증가 카운터
- `loadMap(data)` — 맵 로드 시 카운터 재구축(`rebuildIdCounters`)으로 기존 ID와 충돌 방지
- `detectElementType(el)` — `type` 필드 유무로 Collision/Hazard/SpawnPoint 구분 (SpawnPoint는 `type` 필드가 없음)

### InteractionSystem (`src/systems/InteractionSystem.ts`)

상태 머신 기반 마우스/키보드 인터랙션.

| 상태 | 트리거 | 동작 |
|---|---|---|
| `idle` | 기본 | 대기 |
| `placing` | 좌클릭 + 배치 도구 | 드래그로 사각형 영역 지정, mouseup 시 요소 생성 |
| `dragging` | 좌클릭 + 요소 위 | 요소를 마우스 따라 이동 (그리드 스냅) |
| `resizing` | 좌클릭 + 핸들 위 | 코너 핸들 드래그로 크기 변경 (반대편 고정) |
| `panning` | 우/중클릭 | 카메라 스크롤 이동 |

콜백:
- `onSelectionChange?(elementId)` — 선택 변경 시 (EditorScene → HUD 갱신)
- `onElementUpdate?(elementId)` — 이동/리사이즈 완료 시 (EditorScene → 렌더러 갱신)
- `onExportRequested?()` — Ctrl/Cmd+S
- `onImportRequested?()` — Ctrl/Cmd+O

크로스 플랫폼: `src/utils/platform.ts`의 `isModKey()`로 Mac(Meta) / Windows(Ctrl) 자동 감지.

### EditorHud (`src/ui/EditorHud.ts`)

Phaser GameObjects로 구현된 HUD. `setScrollFactor(0)` + `setDepth(1000)`로 항상 화면 위에 고정.

| 구성요소 | 위치 | 내용 |
|---|---|---|
| Toolbar | 상단 (height: 44px) | 도구 버튼 9개 + Grid/Snap 토글 + Import/Export |
| Properties Panel | 우측 (width: 320px) | 선택 요소 속성 + 맵 메타데이터 편집 |
| Status Bar | 하단 (height: 28px) | 요소 수, 줌, 그리드, 스냅, 단축키 힌트 |
| Drop Overlay | 전체 화면 | 드래그앤드롭 시 반투명 오버레이 |

속성 편집: 클릭 시 브라우저 `prompt()`로 값 입력 → `editorState.updateElement()` + 렌더러 갱신.

### map-io (`src/utils/map-io.ts`)

| 함수 | 설명 |
|---|---|
| `exportMapToJson(mapData)` | MapData → JSON 문자열 (indent=2) |
| `downloadMapFile(mapData)` | Blob + `<a>` 클릭으로 브라우저 다운로드 (파일명: `{mapId}.json`) |
| `loadMapFromFile()` | `<input type="file">` 열어서 파일 선택 → 파싱 |
| `loadMapFromFileObject(file)` | `File` 객체 → 파싱 (드래그앤드롭용) |
| `fetchSampleMap(filename)` | `public/maps/`에서 fetch로 샘플 로드 |
| `loadMapFromJson(json)` | JSON 파싱 + 필수 키 존재 확인 + version 타입 검증 |
| `createEmptyMap()` | 기본값으로 채워진 빈 MapData (1600x900) |

## 편집 가능한 요소

| 카테고리 | 타입 | 시각 | 조작 | 렌더러 |
|---|---|---|---|---|
| Collision | `floor` | 녹색 사각형 | 배치 + 이동 + 리사이즈 | Rect |
| Collision | `one_way_platform` | 청록색 사각형 (점선) | 배치 + 이동 + 리사이즈 | Rect |
| Collision | `solid_wall` | 회색 세로 막대 | 배치 + 이동 + 리사이즈 | Rect |
| Hazards | `fall_zone` | 빨강 반투명 | 배치 + 이동 + 리사이즈 | Rect |
| Hazards | `instant_kill_hazard` | 주황 반투명 | 배치 + 이동 + 리사이즈 | Rect |
| Spawn | `spawn_point` | 파란 원 (반지름 8px) | 배치 + 이동 | Point |
| Weapons | `weapon_spawn` | 보라 다이아몬드 | 배치 + 이동 | Point |
| Items | `item_spawn` | 노랑 별 | 배치 + 이동 | Point |

## 단축키

| 키 | 동작 | 비고 |
|---|---|---|
| Ctrl/Cmd + S | Export (JSON 저장) | Mac: Cmd+S, Win: Ctrl+S |
| Ctrl/Cmd + O | Import (파일 열기) | Mac: Cmd+O, Win: Ctrl+O |
| 마우스 휠 | 줌 인/아웃 (0.25x ~ 4x, 포인터 위치 기준) | |
| 우클릭 드래그 | 카메라 팬 | 중클릭도 가능 |
| Home | 카메라를 visualBounds 중앙으로 리셋 | 줌 100% |
| Delete | 선택 요소 삭제 | |
| Escape | 선택 해제 + 도구 → Select + 배치 취소 | |

## 진행 상황

### 완료

| Task | 내용 | 커밋 |
|---|---|---|
| Task 1 | 맵 데이터 타입 정의 (`src/types/map.ts`) | `4973644` |
| Task 2 | 맵 I/O 유틸리티 (`src/utils/map-io.ts`) | `6b6e68c` |
| Task 3 | 에디터 상태 관리 — EditorState 싱글톤 (`src/state/EditorState.ts`) | `2fc8c81` |
| Task 4 | 그리드 오버레이 + 카메라 컨트롤 (줌/팬/Home) | `c55b537` |
| Task 5 | 맵 Bounds 시각 표시 (visual/gameplay/death) | `c55b537` |
| Task 6 | 편집 가능한 요소 렌더링 — RendererFactory + Rect/Point 렌더러 | `9829f6b` |
| Task 7 | 드래그앤드롭 배치 시스템 — rect 드래그 영역 지정 + point 즉시 배치 | `6f7b13f` |
| Task 8 | 선택 + 이동 + 리사이즈 인터랙션 — InteractionSystem 상태 머신 | `6f7b13f` |
| Task 9 | DOM 오버레이 제거 → Phaser HUD 전환 (EditorHud) | `c9c169f` |
| Task 10 | Import/Export 통합 — 파일 선택 + 드래그앤드롭 + 샘플 맵 | `c9c169f` |
| Task 11 (일부) | 크로스 플랫폼 단축키 — platform.ts 헬퍼, Ctrl/Cmd+S/O, Status Bar 힌트 | 미커밋 |

### 미완료

| Task | 내용 | 상태 |
|---|---|---|
| Task 11 (나머지) | undo/redo | 미시작 |

### 브랜치

| 브랜치 | 기준 | 설명 |
|---|---|---|
| `develop` | Task 1~8 | Phaser 캔버스 + DOM 오버레이 UI |
| `feat/html-dom-overlay-ui` | develop + Task 9~11 | DOM 제거 → Phaser HUD, Import/Export, 단축키. **현재 작업 브랜치** |
| `feat/editor-state` | — | Task 3 초기 실험 (develop에 merge 완료) |

## 알려진 제한

- **undo/redo 없음**: 구현 예정
- **멀티 선택 없음**: 한 번에 하나의 요소만 선택 가능
- **terrain/decoration 편집 불가**: 본게임에서 에셋 형식 결정 필요
- **단일 씬**: 여러 맵을 동시에 열 수 없음
- **속성 편집이 prompt 기반**: 인라인 편집 미구현
