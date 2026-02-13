import { useCallback } from "react";
import { isCellUnlocked as regionIsCellUnlocked } from "../../domain/regions/regionController";

// Cell unlock query based on current region unlocks.
export const useCellAccess = ({ unlockedRegions }) =>
  useCallback((x, y) => regionIsCellUnlocked(x, y, unlockedRegions), [unlockedRegions]);
