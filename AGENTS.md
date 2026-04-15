# Battle Hamsters 에이전트 공통 작업 규칙

이 문서는 `bh-map-editor` 프로젝트에서 작업하는 모든 AI 에이전트의 기본 규칙이다.

## 1. 언어 규칙

- 내부 추론 언어는 도구가 자유롭게 선택할 수 있다.
- **사용자에게 보이는 결과물은 기본적으로 한국어**로 작성한다.
- 예외: 코드 문법, API/라이브러리 식별자, 타입 이름, 파일 경로, 외부 서비스 고유 명칭

## 2. 작업 시작 전 점검

1. 아키텍처 문서 확인: `docs/architecture.md`
2. 맵 데이터 포맷: `battle-hamsters/docs/technical/data-formats.md` 참조
3. 맵 설계 원칙: `battle-hamsters/docs/game-design/map-design.md` 참조

## 3. 핵심 원칙

1. **게임과 동일한 렌더링** — Phaser 3 + Vite + TypeScript
2. **맵 JSON 완전 호환** — 본게임 포맷 준수, 에디터 전용 필드 금지
3. **순수 Phaser UI** — DOM 프레임워크 없이 Phaser GameObjects로 구현 (파일 선택만 예외)
4. **단일 씬 구조** — EditorScene 하나에 모든 기능
5. **단순함 우선** — undo/redo, 멀티 선택 등은 후순위

### 의사결정 기록

- **ADR-1**: DOM 오버레이 → Phaser HUD 전환. `prompt()` 다이얼로그로 속성 편집.
- **ADR-2**: 렌더러 팩토리 — RectElementRenderer(사각형 5종) + PointElementRenderer(포인트 3종).

## 4. 맵 JSON 호환성

- 입출력 포맷은 `battle-hamsters/docs/technical/data-formats.md`의 맵 포맷을 준수
- `version: 1`
- `battle-hamsters/packages/shared/maps/*.json` 과 완전 호환

## 5. 브랜치 / PR 규칙

- `main` (또는 `master`)은 보호 브랜치
- `feat/*`, `fix/*`, `chore/*`, `docs/*` 브랜치는 `develop` 대상으로 PR
- `hotfix/*` 만 `main`/`master` 대상 PR 허용
- PR 생성 전 브랜치 전략 위반 여부 확인
