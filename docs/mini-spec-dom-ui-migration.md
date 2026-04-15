# BH Map Editor — DOM UI 마이그레이션 미니스펙

> 버전: v0.1 (검토용)
> 작성: 2026-04-15
> 대상 브랜치: `feat/dom-ui` → `develop`

## 개요

ADR-1(Phaser HUD 전환)로 100% Phaser GameObjects 기반 UI를 구현했으나, 다음 한계가 확인됨:

1. **select 모드 외 요소 선택 불가** — 도구 선택 상태에서는 클릭=배치만 동작
2. **Properties 패널 클릭 위치 불일치** — Container 수동 스크롤 시 Phaser hit area 오프셋 어긋남
3. **패널 고정으로 맵 가시성 저하** — Properties 320px + Toolbar 44px + Status 28px이 항상 고정
4. **속성 편집 = `window.prompt()`** — 인라인 편집 불가, UX 극도로 나쁨
5. **텍스트 입력 불가** — Phaser에는 `<input>`에 해당하는 게임오브젝트가 없음
6. **레이아웃 수동 관리** — 버튼 위치 x 좌표 수동 누적, flex/grid 불가
7. **스크롤 구현 버그** — Graphics 마스크 + 수동 offset에서 hit area 불일치 발생

**결정**: Phaser 캔버스는 맵 렌더링 + 입력 처리만 담당, UI 패널은 **React**로 전환.

### ADR-3: Phaser-only HUD → React + Phaser 하이브리드

- **전략**: Island Architecture — React가 전체 레이아웃 담당, Phaser 캔버스를 특정 `<div>`에 마운트
- **이유**: Tiled, LDtk 등 성공적인 에디터들이 모두 "캔버스=렌더링/입력, UI=별도 계층" 패턴 사용
- **선택**: **Vite + React** (Next.js 불필요 — 에디터는 100% CSR, SSR은 Phaser 호환성 문제만 발생)
- **상태 공유**: **Zustand** — Phaser 씬 내에서도 `store.getState()`로 직접 접근 가능, 1KB

---

## 신규 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│  React App (Vite)                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ App.tsx                                            │  │
│  │ ┌──────┐ ┌──────────────────┐ ┌─────────────────┐  │  │
│  │ │ Left │ │                  │ │ Right Panel     │  │  │
│  │ │Panel │ │  Phaser Canvas   │ │ ┌─────────────┐ │  │  │
│  │ │      │ │  (parent: div)   │ │ │ Properties  │ │  │  │
│  │ │Tools │ │                  │ │ │ 인라인 편집  │ │  │  │
│  │ │List  │ │  그리드 + 요소   │ │ │             │ │  │  │
│  │ │      │ │  카메라 줌/팬   │ │ │ Map Metadata│ │  │  │
│  │ │      │ │                  │ │ │ 인라인 편집  │ │  │  │
│  │ └──────┘ └──────────────────┘ │ └─────────────┘ │  │  │
│  │                             └─────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Status Bar (React)                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Shared State: Zustand Store (React ↔ Phaser 양방향)     │
└──────────────────────────────────────────────────────────┘
```

---

## 작업 그룹

| 그룹 | 항목 | PR 브랜치 | 난이도 | 의존성 |
|------|------|-----------|--------|--------|
| **P0** | React 인프라 + Zustand 도입 | `feat/dom-ui/phase0-infra` | 중 | 없음 |
| **P1** | Phaser 캔버스 분리 + 기존 HUD 제거 | `feat/dom-ui/phase1-canvas` | 중 | P0 |
| **P2** | 도구 패널 + 속성 패널 (React) | `feat/dom-ui/phase2-panels` | 높음 | P1 |
| **P3** | 상호작용 개선 (요소 선택/이동/리사이즈) | `feat/dom-ui/phase3-interaction` | 중 | P1 |
| **P4** | 속성 인라인 편집 | `feat/dom-ui/phase4-editing` | 중 | P2 |

---

## P0: React 인프라 + Zustand 도입

### 목표
Vite + React + Zustand를 도입하고, 기존 Phaser 앱을 React가 감싸는 구조로 만듦. 기능 변화 없음.

### 파일 변경
- **수정**: `package.json` — react, react-dom, zustand, @vitejs/plugin-react, @types/react, @types/react-dom 추가
- **수정**: `vite.config.ts` — `@vitejs/plugin-react` 플러그인 추가
- **수정**: `tsconfig.json` — `jsx: "react-jsx"` 추가
- **신규**: `src/main.tsx` — React 엔트리포인트
- **신규**: `src/App.tsx` — React 루트 (Phaser 캔버스 + 임시 div)
- **신규**: `src/App.css` — 전체 레이아웃 (flex)
- **수정**: `index.html` — `<div id="root">` + `<script type="module" src="/src/main.tsx">`
- **수정**: `src/main.ts` → `src/phaser/main.ts` (Phaser 초기화 함수 export)

### Zustand Store 설계

```typescript
// src/store/editorStore.ts
import { create } from "zustand";
import type { EditableElement, ElementType, MapData } from "@/types/map";

type ToolType = "select" | ElementType;

interface EditorStore {
  // ─── Tool ───
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // ─── Selection ───
  selectedId: string | null;
  selectedElement: EditableElement | null;
  selectElement: (id: string | null, element?: EditableElement | null) => void;

  // ─── Map Data ───
  mapData: MapData | null;
  setMapData: (data: MapData) => void;
  updateMapMetadata: (updates: Partial<MapData>) => void;

  // ─── Element CRUD ───
  addElement: (element: EditableElement) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<EditableElement>) => void;

  // ─── Undo/Redo ───
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // ─── Grid/Camera ───
  gridSize: number;
  snapEnabled: boolean;
  zoom: number;

  // ─── Phaser Ref ───
  phaserScene: Phaser.Scene | null;
  setPhaserScene: (scene: Phaser.Scene | null) => void;
}
```

### 커밋 계획
1. `chore: React + Zustand 의존성 추가` — package.json, package-lock.json
2. `chore: Vite React 플러그인 + TSConfig JSX 설정` — vite.config.ts, tsconfig.json
3. `refactor: Phaser 진입점을 모듈로 분리` — src/main.ts → src/phaser/main.ts
4. `feat: React 루트 + Zustand 스토어 초기화` — main.tsx, App.tsx, App.css, editorStore.ts, index.html

### 검증
- `npm run dev` 실행 시 React 앱이 렌더링되고, 그 안에 기존 Phaser 캔버스가 정상 동작
- 기존 기능 (요소 배치, 이동, 삭제, undo/redo) 전부 정상
- `npm run build` 성공

---

## P1: Phaser 캔버스 분리 + 기존 HUD 제거

### 목표
Phaser 캔버스가 전체 화면이 아닌 지정된 `<div>` 영역에만 렌더링되도록 변경. 기존 EditorHud.ts를 제거하고 Phaser가 맵 렌더링 + 마우스 입력만 담당.

### 파일 변경
- **삭제**: `src/ui/EditorHud.ts` (808줄, 전체 제거)
- **수정**: `src/scenes/EditorScene.ts` — HUD 생성/참조 제거, Phaser ↔ Zustand 브릿지 추가
- **수정**: `src/phaser/main.ts` — `parent` 옵션으로 `#phaser-container` div 지정
- **수정**: `src/App.tsx` — PhaserCanvas 컴포넌트 (resize observer 포함)
- **수정**: `src/store/editorStore.ts` — Phaser 씬에서 호출하는 스토어 메서드 완성
- **신규**: `src/components/PhaserCanvas.tsx` — Phaser 마운트 + resize 관리

### Phaser ↔ Zustand 브릿지

```typescript
// EditorScene에서 Zustand 사용 예시
import { useEditorStore } from "@/store/editorStore";

// Phaser 씬 내에서 (React 컴포넌트 바깥)
const store = useEditorStore.getState();
store.selectElement(id, element);
store.addElement(newElement);
```

### 커밋 계획
1. `refactor: EditorHud.ts 제거 — Phaser 씬에서 HUD 참조 제거`
2. `feat: Phaser ↔ Zustand 브릿지 — EditorScene이 스토어와 소통`
3. `feat: PhaserCanvas React 컴포넌트 — resize observer + parent 지정`

### 검증
- Phaser 캔버스가 지정된 영역에만 렌더링
- 캔버스 영역 외부 클릭 시 Phaser가 반응하지 않음
- 기존 맵 편집 기능 (배치, 선택, 이동, 삭제) 정상 동작

---

## P2: 도구 패널 + 속성 패널 (React)

### 목표
기존 EditorHud의 도구바 + Properties를 React 컴포넌트로 재구현. DOM 기반이므로:
- CSS flex/grid로 레이아웃 자동 배치
- 클릭 위치 정확 (Phaser hit area 버그 해결)
- `window.prompt()` 없이 인라인 편집 가능
- 패널 리사이즈/토글 가능

### 파일 변경
- **신규**: `src/components/Toolbar.tsx` — 도구 선택 버튼 (상단 고정)
- **신규**: `src/components/ToolPanel.tsx` — 좌측 도구 목록 (아이콘 + 라벨)
- **신규**: `src/components/PropertiesPanel.tsx` — 우측 속성 패널
- **신규**: `src/components/StatusBar.tsx` — 하단 상태바
- **신규**: `src/components/ui/` — 버튼, 토글, 입력 필드 등 공용 UI
- **수정**: `src/App.tsx` — 전체 레이아웃 구성
- **수정**: `src/App.css` — 레이아웃 + 패널 스타일

### UI 디자인 원칙
- **다크 테마 기본** — 기존 `#111827` 배경 유지
- **CSS 변수 기반 색상** — Phaser EDITOR_CONFIG.COLORS와 동일한 팔레트
- **패널 리사이즈 가능** — 드래그으로 폭 조절 (최소/최대)
- **패널 토글** — 단축키 또는 버튼으로 숨김/표시

### Toolbar (상단)

```
┌─────────────────────────────────────────────────────────────────┐
│ [↩️][↪️] │ [🖱️Select] [■Floor] [═Platform] [█Wall]            │
│          │ [▼Fall] [⚠Kill] [●Spawn] [◆Weapon] [★Item]         │
│          │ │ [Grid 40/16] [Snap ✓] │ [Import] [Export]         │
└─────────────────────────────────────────────────────────────────┘
```

### Properties Panel (우측)

```
┌──────────────────────┐
│ Selected Element     │
│ ──────────────────── │
│ Type: floor          │
│ ID: floor_01        │
│ ──────────────────── │
│ leftX:  [  120  ]   │  ← 인라인 number input
│ rightX: [  520  ]   │
│ topY:   [  680  ]   │
│ ──────────────────── │
│ Map Metadata         │
│ ──────────────────── │
│ Name: [Training ]   │  ← 인라인 text input
│ Size: 1600 × 900    │
│ Boundary: [closed▼] │  ← select dropdown
│ ──────────────────── │
│ Visual Bounds        │
│ Left: [0] Right: [1600] │
│ Top: [0]  Bottom: [780] │
└──────────────────────┘
```

### 커밋 계획
1. `feat: 공용 UI 컴포넌트 — Button, Toggle, InputField`
2. `feat: Toolbar 컴포넌트 — 도구 선택 + 유틸리티`
3. `feat: PropertiesPanel 컴포넌트 — 선택 요소 + 맵 메타데이터`
4. `feat: StatusBar 컴포넌트 — 줌/위치/카운트`
5. `feat: 전체 레이아웃 — App.tsx + App.css`

### 검증
- 모든 도구 버튼이 Zustand store와 연동
- 선택된 요소의 속성이 Properties에 표시
- 패널 숨김/표시 토글 동작
- 패널 리사이즈 시 캔버스 영역 자동 조절

---

## P3: 상호작용 개선

### 목표
P1-P2 기반으로 사용자 경험을 근본적으로 개선.

### P3-1: 임시 선택 (Temp Select)

**문제**: 도구 선택 상태에서 기존 요소를 클릭하면 배치만 되고 선택이 안 됨.

**해결**: **Alt+클릭**으로 임시 선택. 선택 후 도구는 유지.

```
floor 도구 활성 → Alt+클릭 기존 요소 → 선택됨 (도구는 floor 유지)
Alt 해제 → 다음 클릭부터 다시 floor 배치
```

### P3-2: 더블클릭으로 속성 편집 진입

**문제**: `window.prompt()` UX가 최악.

**해결**: 요소 더블클릭 → Properties 패널이 해당 요소로 포커스 + 첫 번째 필드에 커서.

### P3-3: 드래그/리사이즈 모드 개선

**현재**: select 모드에서만 동작.
**개선**:
- 모든 모드에서 요소 위 클릭 → 우선 선택 (도구 배치보다 선택이 우선)
- 빈 공간 클릭 → 해당 도구로 배치
- 이건 select 모드 전환이 필요 없는 **자동 분기** 방식

```
floor 도구 활성:
  기존 floor 위 클릭 → 선택 (드래그/리사이즈 가능)
  빈 공간 클릭 → 새 floor 배치
```

### 파일 변경
- **수정**: `src/systems/InteractionSystem.ts` — hit test 후 분기 로직 개선
- **수정**: `src/store/editorStore.ts` — 임시 선택 상태 추가
- **수정**: `src/components/PropertiesPanel.tsx` — 더블클릭 포커스 처리

### 커밋 계획
1. `feat: 자동 선택 분기 — 요소 위 클릭=선택, 빈 공간=배치`
2. `feat: 더블클릭으로 속성 패널 포커스`
3. `feat: Alt+클릭 임시 선택`

---

## P4: 속성 인라인 편집

### 목표
Properties 패널에서 요소 속성을 직접 편집 (React `<input>` 사용).

### 설계

```typescript
// PropertiesPanel.tsx
function ElementProperties({ element }: { element: EditableElement }) {
  const updateElement = useEditorStore(s => s.updateElement);

  return (
    <div className="prop-group">
      <label>leftX</label>
      <input
        type="number"
        value={element.leftX}
        onChange={(e) => updateElement(element.id, { leftX: Number(e.target.value) })}
      />
    </div>
  );
}
```

### 타입별 편집 필드

| 요소 타입 | 편집 가능 필드 |
|-----------|--------------|
| floor | leftX, rightX, topY, id |
| one_way_platform | leftX, rightX, topY, id |
| solid_wall | x, topY, bottomY, id |
| fall_zone | x, y, width, height, id |
| instant_kill_hazard | x, y, width, height, id |
| spawn_point | x, y, id |
| weapon_spawn | x, y, weaponId, respawnMs, despawnAfterMs, spawnStyle, despawnStyle, mode, id |
| item_spawn | x, y, itemId, respawnMs, spawnStyle, mode, id |

### 맵 메타데이터 편집
- name, size (width, height), boundaryPolicy, cameraPolicy
- visualBounds, gameplayBounds, deathBounds

### 커밋 계획
1. `feat: 요소 속성 인라인 편집 — rect 타입`
2. `feat: 요소 속성 인라인 편집 — point 타입 + weapon/item 속성`
3. `feat: 맵 메타데이터 인라인 편집`

---

## PR/브랜치 전략

```
develop (base)
  │
  ├── feat/dom-ui/phase0-infra  ← PR #2
  │     chore: React + Zustand 의존성
  │     chore: Vite + TSConfig 설정
  │     refactor: Phaser 진입점 모듈화
  │     feat: React 루트 + Zustand 초기화
  │
  ├── feat/dom-ui/phase1-canvas  ← PR #3 (P0 머지 후)
  │     refactor: EditorHud 제거
  │     feat: Phaser ↔ Zustand 브릿지
  │     feat: PhaserCanvas 컴포넌트
  │
  ├── feat/dom-ui/phase2-panels  ← PR #4 (P1 머지 후)
  │     feat: 공용 UI 컴포넌트
  │     feat: Toolbar
  │     feat: PropertiesPanel
  │     feat: StatusBar
  │     feat: 전체 레이아웃
  │
  ├── feat/dom-ui/phase3-interaction  ← PR #5 (P1 머지 후, P2와 병렬 가능)
  │     feat: 자동 선택 분기
  │     feat: 더블클릭 포커스
  │     feat: Alt+클릭 임시 선택
  │
  └── feat/dom-ui/phase4-editing  ← PR #6 (P2 머지 후)
        feat: rect 속성 편집
        feat: point 속성 편집
        feat: 맵 메타데이터 편집
```

### 의존성 관계
```
P0 ──→ P1 ──→ P2 ──→ P4
            └──→ P3 (P2와 병렬 가능, P1까지만 필요)
```

---

## 제외 항목 (본 스펙 범위 밖)

- 미니맵 (UX-6) — P2 완료 후 별도 스펙
- 정렬/분포 (UX-7) — P3 완료 후 별도 스펙
- 멀티 선택 (UX-8) — P3 완료 후 별도 스펙
- 레이어 패널 — B그룹 (shared 타입 확정 후)
- 배경색/그라디언트 — A그룹 (terrain 타입 정의 후)
- 패럴랙스, BGM — B그룹
- 테마/스킨 시스템 — 나중에

---

## 기술 참고사항

### Next.js를 선택하지 않은 이유
- 에디터는 100% CSR 애플리케이션 — SSR 불필요
- Phaser와 SSR은 호환성 문제 (`dynamic(() => ..., { ssr: false })` 번거로움)
- 정적 배포가 간단해야 함 (GitHub Pages, S3)
- 빌드 속도 / HMR 성능이 더 좋음

### Zustand를 선택한 이유
- Phaser 씬에서 `store.getState()`로 직접 접근 가능 (React 훅 불필요)
- 1KB, 보일러플레이트 최소
- Context Provider 없이 동작 (Phaser ↔ React 의존성 없음)

### React만으로 충분한 이유
- UI 컴포넌트는 약 5~8개 — Redux/Saga 같은 무거운 상태관리 불필요
- Zustand 1개로 충분
- 라우팅 불필요 (단일 페이지 에디터)
