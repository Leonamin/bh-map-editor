/**
 * 플랫폼 감지 및 크로스 플랫폼 입력 헬퍼.
 * Mac에서는 Cmd(Meta) 키를, Windows/Linux에서는 Ctrl 키를 보조키로 사용합니다.
 */

/** Mac 플랫폼 여부 (1회만 감지) */
const IS_MAC: boolean =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

/** 현재 플랫폼에서 "보조키(Ctrl/Cmd)"가 눌려 있는지 확인합니다. */
export function isModKey(event: KeyboardEvent): boolean {
  return IS_MAC ? event.metaKey : event.ctrlKey;
}

/** 현재 플랫폼에서 "대체키(Alt/Option)"가 눌려 있는지 확인합니다. */
export function isAltKey(event: KeyboardEvent): boolean {
  return event.altKey;
}

/** 현재 플랫폼 이름을 반환합니다. UI 표시용. */
export function getPlatform(): "mac" | "windows" | "linux" {
  if (IS_MAC) return "mac";
  if (typeof navigator !== "undefined" && /Win/.test(navigator.userAgent)) return "windows";
  return "linux";
}

/** 보조키 라벨 (UI 표시용) */
export function modKeyLabel(): string {
  return IS_MAC ? "Cmd" : "Ctrl";
}

/** 대체키 라벨 (UI 표시용) */
export function altKeyLabel(): string {
  return IS_MAC ? "Option" : "Alt";
}
