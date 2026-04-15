# BH Map Editor

Battle Hamsters 게임의 2D 맵을 시각적으로 편집하는 웹 기반 에디터입니다.
Phaser 3 + TypeScript로 구현되어, 에디터에서 보이는 렌더링 결과가 게임 클라이언트와 동일합니다.

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## 화면 구성

```
┌─────────────── Toolbar ───────────────────┐
│ [Select][Floor][Platform][Wall][Fall]…    │
│ [Grid 16][Snap ON][Import][Export]        │
├─────────────────────────────┬─────────────┤
│                             │ Properties  │
│       Canvas (맵 영역)       │ ─ 요소 정보  │
│       그리드 + 요소 시각화   │ ─ 속성 편집  │
│                             │ ─ 맵 메타    │
├─────────────────────────────┴─────────────┤
│ Elements 5  Zoom 100%  Grid 16  Snap ON   │
└───────────────────────────────────────────┘
```

## 사용법

### 요소 배치

| 요소 타입 | 배치 방법 |
|---|---|
| 포인트 (Spawn, Weapon, Item) | **클릭** 즉시 배치 |
| 사각형 (Floor, Platform, Wall, Fall, Kill) | **클릭 + 드래그**로 영역 지정. 또는 단일 클릭으로 기본 크기 배치 |

### 요소 편집

- **선택**: Select 도구로 클릭. 빈 공간 클릭 시 해제
- **이동**: 선택된 요소를 드래그 (Snap이 켜져 있으면 그리드 단위)
- **리사이즈**: 사각형 요소 선택 시 코너에 4개 핸들(흰색 원) 표시 → 핸들 드래그 (포인트 요소는 불가)
- **속성 편집**: Properties 패널에서 속성 행 클릭 → `prompt()` 다이얼로그로 값 입력
- **삭제**: Delete 키 또는 Properties의 "Delete Selected" 버튼

### 맵 메타데이터

Properties 패널 하단에서 name, size, boundaryPolicy, cameraPolicy, visualBounds, gameplayBounds, deathBounds 편집.

### Import / Export

| 동작 | 방법 |
|---|---|
| Export | Export 버튼 또는 **Ctrl/Cmd+S** → `{mapId}.json` 다운로드 |
| Import (버튼) | Import 버튼 또는 **Ctrl/Cmd+O** → 파일 선택 |
| Import (드래그) | `.json` 파일을 브라우저 창에 드롭 |

## 단축키

| 키 | 동작 | 비고 |
|---|---|---|
| Ctrl/Cmd + S | Export (JSON 저장) | Mac: Cmd+S, Win: Ctrl+S |
| Ctrl/Cmd + O | Import (파일 열기) | Mac: Cmd+O, Win: Ctrl+O |
| 마우스 휠 | 줌 (포인터 위치 기준) | 0.25x ~ 4x |
| 우클릭 드래그 | 카메라 팬 | 중클릭도 가능 |
| Home | 카메라 리셋 | 맵 중앙, 줌 100% |
| Delete | 선택 요소 삭제 | |
| Escape | 선택 해제 + Select 복귀 | 배치 중이면 취소 |

## 기술 스택

Phaser 3.80 | Vite 5 | TypeScript 5.4 | Phaser GameObjects UI (DOM 없음)

## 문서

- [아키텍처 & 구현 상태](docs/architecture.md) — 시스템 구조, 컴포넌트 상세, 진행 상황

## 라이선스

Battle Hamsters 프로젝트의 일부입니다.
