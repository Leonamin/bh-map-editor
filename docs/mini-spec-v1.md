# 맵 에디터 미니 스펙

## 작업명

Battle Hamsters 웹 기반 맵 에디터 (1차)

## 목표

게임 클라이언트와 동일한 기술 스택(Phaser 3 + Vite + TypeScript)으로,
맵 JSON 포맷을 직접 읽고 쓰는 드래그앤드롭 방식의 2D 맵 에디터를 구축한다.

## 이번 범위

1. **에디터 캔버스**: 그리드 표시, 줌/팬, 요소 렌더링
2. **요소 배치**: 7종 요소(floor, one_way_platform, solid_wall, fall_zone, instant_kill_hazard, spawnPoint, weaponSpawn, itemSpawn)를 도구바에서 선택 후 드래그앤드롭으로 배치
3. **요소 편집**: 이동(드래그), 리사이즈(핸들), 삭제(Delete 키)
4. **속성 패널**: 선택된 요소의 모든 필드 실시간 편집 (Phaser GameObjects로 구현)
5. **맵 메타데이터 편집**: name, size, bounds, policies
6. **JSON I/O**: Export (JSON 다운로드), Import (파일 로드)
7. **맵 bounds 표시**: visualBounds, gameplayBounds, deathBounds 점선 표시

## 비목표

- 배경/terrain/decoration 에셋 (본게임에서 먼저 결정)
- undo/redo
- 실시간 협업
- 맵 밸런스 시뮬레이션
- 커스텀 에셋 업로드

## 건드리는 스펙/문서

- 신규 프로젝트이므로 기존 스펙 변경 없음
- 입출력 포맷은 `battle-hamsters/docs/technical/data-formats.md`의 맵 포맷을 준수

## 검증 방법

1. `pnpm dev` 실행 → 브라우저에서 에디터 로드
2. 각 요소 타입을 배치하고 드래그/리사이즈 동작 확인
3. Export JSON → 본게임 `training-arena.json` 포맷과 구조 비교
4. Import JSON → `training-arena.json` 로드 후 모든 요소 정상 표시
5. `npx tsc --noEmit` 타입체크 통과
