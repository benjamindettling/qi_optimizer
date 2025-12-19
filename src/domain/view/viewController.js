import { REGION_SIZE, REGION_COLS } from "../../config/boardConfig";

export const computeViewBounds = (unlockedRegions) => {
  const unlockedCoords = unlockedRegions
    .map((flag, idx) =>
      flag
        ? { row: Math.floor(idx / REGION_COLS), col: idx % REGION_COLS }
        : null
    )
    .filter(Boolean);
  const minCol =
    unlockedCoords.length > 0
      ? Math.min(...unlockedCoords.map((c) => c.col))
      : 0;
  const maxCol =
    unlockedCoords.length > 0
      ? Math.max(...unlockedCoords.map((c) => c.col))
      : 0;
  const minRow =
    unlockedCoords.length > 0
      ? Math.min(...unlockedCoords.map((c) => c.row))
      : 0;
  const maxRow =
    unlockedCoords.length > 0
      ? Math.max(...unlockedCoords.map((c) => c.row))
      : 0;
  const viewColStart = minCol * REGION_SIZE;
  const viewColEnd = (maxCol + 1) * REGION_SIZE;
  const viewRowStart = minRow * REGION_SIZE;
  const viewRowEnd = (maxRow + 1) * REGION_SIZE;
  const viewWidth = viewColEnd - viewColStart;
  const viewHeight = viewRowEnd - viewRowStart;
  return { viewColStart, viewColEnd, viewRowStart, viewRowEnd, viewWidth, viewHeight };
};

export const computeViewTransforms = (viewMode, viewWidth, viewHeight) => {
  const viewRotation =
    viewMode === "right"
      ? "-90deg"
      : viewMode === "diagonal"
      ? "-45deg"
      : "0deg";

  const boardTransformClass = `view-${viewMode}`;
  const CELL_SIZE_PX = 36;
  const baseWidthPx = viewWidth * CELL_SIZE_PX;
  const baseHeightPx = viewHeight * CELL_SIZE_PX;

  let rotatedWidthPx = baseWidthPx;
  if (viewMode === "right") {
    rotatedWidthPx = baseHeightPx;
  } else if (viewMode === "diagonal") {
    rotatedWidthPx = (baseWidthPx + baseHeightPx) / Math.SQRT2;
  }

  const toolbarOffsetPx = rotatedWidthPx - baseWidthPx;

  const boardTransform =
    viewMode === "right"
      ? "rotate(-90deg) translateX(-100%)"
      : viewMode === "diagonal"
      ? "rotate(-45deg) translate(-300px, 300px)"
      : "none";

  const regionTransform =
    viewMode === "right"
      ? "rotate(-90deg) translate(0px, 0px)"
      : viewMode === "diagonal"
      ? "rotate(-45deg) scale(0.8) translate(10px, -30px)"
      : "none";

  return {
    viewRotation,
    boardTransformClass,
    toolbarOffsetPx,
    boardTransform,
    regionTransform,
  };
};
