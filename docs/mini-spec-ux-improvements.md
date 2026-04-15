# BH Map Editor — UX 개선 미니스펙

> 버전: v0.1 (검토용)
> 작성: 2026-04-14
> 대상 브랜치: `feat/ux-improvements` → `develop`

## 개요

ADR-1(Phaser HUD 전환) 이후 기본 에디터 기능이 완성됨. 본 스펙은 사용자 편집 경험을 개선하는 UX 기능들을 정의한다.
핵심 원칙: **순수 Phaser UI 유지**, **prompt() 의존도 최소화**, **단순함 우선**.

---

## UX-1. Undo / Redo

### 배경
현재 편집 실수를 되돌릴 방법이 없음. 요소 삭제, 이동, 속성 변경 모두 복구 불가.

### 설계
**Command History 패턴** (상태 스냅샷보다 가벼움)

```typescript
interface EditorCommand {
  type: "add" | "remove" | "update" | "move" | "metadata";
  elementId?: string;
  before: unknown;  // 실행 전 상태 (Undo용)
  after: unknown;   // 실행 후 상태 (Redo용)
}
```

- `editorState`에 `undoStack: EditorCommand[]`, `redoStack: EditorCommand[]` 추가
- 최대 50개 히스토리 (메모리 절약)
- 모든 편집 액션(addElement, removeElement, updateElement, updateMapMetadata)이 커맨드를 push
- Undo 시 `before` 상태 복원, 해당 커맨드를 redoStack으로 이동
- Redo 시 `after` 상태 적용, undoStack으로 이동

### 단축키
| 키 | 동작 |
|---|---|
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Ctrl/Cmd + Y | Redo (대체) |

### HUD 반영
- Status Bar에 undo 가능 횟수 표시: `Undo 3`
- Toolbar에 Undo/Redo 버튼 추가 (선택)

### 구현 난이도
**중** — EditorState 모든 변경점에 커맨드 기록 추가 필요. 렌더러 재동기화 로직 필수.

---

## UX-2. 요소 복제 (Duplicate)

### 배경
비슷한 요소를 여러 개 배치할 때 매번 새로 그리는 것은 비효율적.

### 설계
- 선택된 요소를 복제하여 grid snap offset(+gridSize, +gridSize) 위치에 배치
- 복제된 요소는 새 ID 자동 생성 (예: `floor_1` → `floor_2`)
- 복제 후 새 요소가 자동 선택됨

### 단축키
| 키 | 동작 |
|---|---|
| Ctrl/Cmd + D | 선택 요소 복제 |

### HUD 반영
- Toolbar "Duplicate" 버튼 (선택 요소가 있을 때만 활성화)

### 구현 난이도
**낮음** — 기존 createElement 로직 재사용.

---

## UX-3. 요소 삭제 확인 개선

### 배경
현재 Delete 키로 즉시 삭제됨. 실수로 지울 위험 존재 (Undo가 구현되면 완화되지만, 즉각적 피드백도 필요).

### 설계
**선택적 확인 + 시각 피드백**

1. 요소 삭제 시 캔버스에 500ms 깜빡임 효과 (빨강 flash → 사라짐)
2. Status Bar에 "Deleted floor_1 — Ctrl+Z to undo" 토스트 메시지 (2초)
3. Undo가 구현되면 별도 확인 다이얼로그 불필요

### 구현 난이도
**낮음**

---

## UX-4. Properties Panel 개선

### 배경
현재 속성 편집이 `prompt()` 기반. UX 품질이 낮음.
Phaser 내에서 인라인 텍스트 편집은 Phaser의 텍스트 입력 한계로 구현 복잡도가 높음.

### 설계: 2단계 접근

**Phase 1 (단기) — prompt() 개선**
- prompt 메시지를 더 명확하게: `"floor_01의 leftX 값 입력"` → 요소 ID + 필드명 표시
- 기본값이 현재 값으로 설정 (이미 구현됨)
- 숫자 필드에 입력 검증 강화 (음수 허용 범위, 최대/최소값 안내)
- select 필드를 prompt 대신 **순환 클릭**으로 변경 (이미 일부 구현됨: `resolveNextValue`의 select 분기)

**Phase 2 (중기) — Phaser 인라인 편집**
- 속성 행을 클릭하면 해당 행이 편집 모드로 전환
- 편집 모드: 배경색 변경 + 커서 깜빡임 텍스트로 값 표시
- 키보드 입력으로 직접 값 수정
- Enter로 확정, Escape로 취소
- Phaser `processKeyDown` 이벤트로 문자 입력 캡처

### 구현 난이도
- Phase 1: **낮음**
- Phase 2: **높음** — Phaser 내 커서 관리, 텍스트 렌더링, IME(한글) 처리 필요

---

## UX-5. 요소 레이블 표시

### 배경
캔버스에서 각 요소가 무엇인지 ID로만 구분. 시각적 식별이 어려움.

### 설계
- 요소 위/아래에 작은 라벨 표시 (type + ID)
- 라벨은 줌 레벨에 따라 자동 표시/숨김 (줌 100% 이상에서만)
- 선택된 요소는 라벨이 항상 표시
- 라벨 폰트: 9px monospace, 배경 반투명

### 토글
- Toolbar "Labels" 버튼으로 전체 라벨 on/off
- 기본값: ON

### 구현 난이도
**낮음** — 렌더러에 텍스트 GameObject 추가.

---

## UX-6. 미니맵

### 배경
대형 맵(1600x900+)에서 현재 뷰포트 위치 파악이 어려움.

### 설계
- Status Bar 우측에 미니맵 썸네일 (120x68px, 비율 유지)
- 전체 맵 축소 렌더링 + 현재 뷰포트 빨강 사각형
- 미니맵 클릭으로 해당 위치로 카메라 이동

### 구현 난이도
**중** — 별도 RenderTexture 또는 Graphics로 축소 렌더링.

---

## UX-7. 정렬 / 분포 (Align / Distribute)

### 배경
여러 요소를 규칙적으로 배치할 때 수동 정렬이 번거로움.

### 설계
- **정렬**: 선택 요소를 다른 요소/그리드에 맞춤
  - 좌/우/상/하 정렬
  - 수평/수직 중앙 정렬
- **분포**: 균등 간격 배치 (아직 멀티선택 미구현이므로 후순위)

### 전제
멀티 선택 (UX-8) 선행 필요. **단일 선택 환경에서는 그리드 스냅으로 충분.**

### 구현 난이도
**중** (멀티선택 이후)

---

## UX-8. 멀티 선택

### 배경
한 번에 하나의 요소만 선택 가능. 그룹 이동, 일괄 삭제 불가.

### 설계
- **Shift+클릭**: 요소 추가 선택/해제
- **드래그 박스 선택**: 빈 영역에서 좌클릭 드래그 → 영역 내 요소 전체 선택 (Select tool)
- **Ctrl+A**: 전체 선택
- 멀티 선택 상태에서 이동: 모든 선택 요소가 동일 offset으로 이동
- Delete: 선택 요소 전체 삭제

### EditorState 변경
- `selectedId: string | null` → `selectedIds: Set<string>`
- 하위 호환을 위해 `selectedId` getter 유지 (첫 번째 요소 반환)

### HUD 반영
- Properties Panel: 멀티 선택 시 "N개 요소 선택됨" 표시 + 공통 타입이면 공통 필드 편집

### 구현 난이도
**높음** — InteractionSystem 상태 머신 대폭 수정, EditorState API 변경.

---

## 구현 우선순위 (제안)

| 순위 | 항목 | 난이도 | 가치 |
|---|---|---|---|
| 1 | UX-1 Undo/Redo | 중 | **필수** — 편집 안전망 |
| 2 | UX-4 Phase 1 prompt 개선 | 낮음 | 높음 — 편집 편의 |
| 3 | UX-2 요소 복제 | 낮음 | 높음 — 반복 작업 감소 |
| 4 | UX-5 요소 레이블 | 낮음 | 중 — 가독성 |
| 5 | UX-3 삭제 확인 개선 | 낮음 | 중 — Undo 선행 시 효과↑ |
| 6 | UX-6 미니맵 | 중 | 중 — 대형 맵 탐색 |
| 7 | UX-8 멀티 선택 | 높음 | 높음 — 복잡, 후순위 |
| 8 | UX-4 Phase 2 인라인 편집 | 높음 | 높음 — 복잡, 후순위 |
| 9 | UX-7 정렬/분포 | 중 | 낮음 — 멀티선택 후 |

---

## 검토 요청 사항

1. **UX-1 (Undo/Redo)**: Command 패턴 vs 상태 스냅샷 — Command가 가볍지만 구현 범위가 넓음. 승인?
2. **UX-4 (Properties Panel)**: Phase 1(prompt 개선) → Phase 2(인라인) 순차 진행 OK?
3. **UX-8 (멀티 선택)**: 언제 진행할지 (v1.0 이후? 당장?)
4. **UX-6 (미니맵)**: 우선순위 — 필요성 체감되는가?
5. 위 순서대로 진행, 또는 변경 원하는 항목 있음?
