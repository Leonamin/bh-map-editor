import type { MapData } from "@/types/map";

/**
 * MapData를 JSON 문자열로 변환합니다.
 */
export function exportMapToJson(mapData: MapData): string {
  return JSON.stringify(mapData, null, 2);
}

/**
 * MapData를 JSON 파일로 다운로드합니다.
 */
export function downloadMapFile(mapData: MapData): void {
  const json = exportMapToJson(mapData);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${mapData.id}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}

/**
 * 파일 선택 대화상자를 열어 JSON 맵 파일을 로드합니다.
 */
export function loadMapFromFile(): Promise<MapData> {
  return new Promise<MapData>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("선택된 파일이 없습니다."));
        input.remove();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const mapData = loadMapFromJson(reader.result as string);
          resolve(mapData);
        } catch (err) {
          reject(err);
        } finally {
          input.remove();
        }
      };
      reader.onerror = () => {
        reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
        input.remove();
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
  });
}

/** MapData에 필수로 있어야 하는 최상위 키 목록 */
const REQUIRED_KEYS: (keyof MapData)[] = [
  "version",
  "id",
  "name",
  "size",
  "boundaryPolicy",
  "cameraPolicy",
  "visualBounds",
  "gameplayBounds",
  "deathBounds",
  "spawnPoints",
  "collision",
  "hazards",
  "weaponSpawns",
  "itemSpawns",
  "terrain",
  "decorations",
];

/**
 * JSON 문자열을 파싱하고 유효성 검사 후 MapData로 반환합니다.
 */
export function loadMapFromJson(json: string): MapData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("유효하지 않은 JSON 형식입니다.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("맵 데이터는 객체여야 합니다.");
  }

  const obj = parsed as Record<string, unknown>;

  // version 필드 존재 확인
  if (!("version" in obj) || typeof obj.version !== "number") {
    throw new Error("version 필드가 없거나 숫자가 아닙니다.");
  }

  // 필수 키 존재 확인
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      throw new Error(`필수 필드 '${key}'이(가) 없습니다.`);
    }
  }

  return obj as unknown as MapData;
}

/**
 * 기본값으로 채워진 빈 MapData를 생성합니다.
 */
export function createEmptyMap(): MapData {
  return {
    version: 1,
    id: "new_map",
    name: "New Map",
    size: { width: 1600, height: 900 },
    boundaryPolicy: "closed",
    cameraPolicy: "follow",
    visualBounds: { left: 0, right: 1600, top: 0, bottom: 780 },
    gameplayBounds: { left: 0, right: 1600, top: 0, bottom: 980 },
    deathBounds: { left: -80, right: 1680, top: -9999, bottom: 980 },
    spawnPoints: [],
    collision: [],
    hazards: [],
    weaponSpawns: [],
    itemSpawns: [],
    terrain: [],
    decorations: [],
  };
}
