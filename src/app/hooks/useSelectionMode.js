// Manages the temporary selection mode used for multi-select.
import { useCallback, useState } from "react";
import { findTargetInstance } from "../../domain/placement/placementController";

export function useSelectionMode({
  layout,
  toggleSelectId,
  resetModes,
  setSelectedBuildingId,
  handleCellClick,
}) {
  const [selectMode, setSelectMode] = useState(false);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev;
      if (next) {
        resetModes();
        setSelectedBuildingId(null);
      }
      return next;
    });
  }, [resetModes, setSelectedBuildingId]);

  const handleBoardClick = useCallback(
    (x, y) => {
      if (selectMode) {
        const target = findTargetInstance(layout, x, y);
        if (target) {
          toggleSelectId(target.id);
        }
        return;
      }
      handleCellClick(x, y);
    },
    [selectMode, layout, toggleSelectId, handleCellClick],
  );

  return {
    selectMode,
    setSelectMode,
    toggleSelectMode,
    handleBoardClick,
  };
}
