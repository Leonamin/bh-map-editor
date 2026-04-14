import type { MapData } from "@/types/map";
import { fetchSampleMap } from "@/utils/map-io";

/**
 * Load the training-arena.json from public/maps/ as a sample map.
 * This is for testing — in production the user imports their own maps.
 *
 * training-arena.json is copied from battle-hamsters at build time.
 */
export async function loadTrainingArena(): Promise<MapData> {
  return fetchSampleMap("training-arena.json");
}

/**
 * List of available sample map filenames in public/maps/.
 * Add more filenames here as sample maps are added.
 */
export const SAMPLE_MAP_FILES = [
  "training-arena.json",
] as const;

export type SampleMapFilename = (typeof SAMPLE_MAP_FILES)[number];
