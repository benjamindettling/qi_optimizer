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
  return {
    viewColStart,
    viewColEnd,
    viewRowStart,
    viewRowEnd,
    viewWidth,
    viewHeight,
  };
};

export const computeViewTransforms = (
  viewMode,
  viewWidth,
  viewHeight,
  boardScale = 1
) => {
  const BASE_CELL_PX = 36;
  const s = boardScale ?? 1;
  // Scale the logical cell size directly to avoid sub-pixel border loss on rotation.
  const cellSizePx = BASE_CELL_PX * s;
  const layoutWidthPx = viewWidth * cellSizePx;
  const layoutHeightPx = viewHeight * cellSizePx;
  const scaledWidthPx = layoutWidthPx;
  const scaledHeightPx = layoutHeightPx;

  const theta = viewMode === "right" ? -90 : viewMode === "diagonal" ? -45 : 0;
  const rad = (theta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: 0, y: 0 },
    { x: scaledWidthPx, y: 0 },
    { x: 0, y: scaledHeightPx },
    { x: scaledWidthPx, y: scaledHeightPx },
  ].map(({ x, y }) => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }));

  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));

  const translateX = -minX;
  const translateY = -minY;
  const rotatedWidthPx = maxX - minX;
  const rotatedHeightPx = maxY - minY;

  const toolbarOffsetPx = rotatedWidthPx - layoutWidthPx;
  const statusOffsetPx = rotatedHeightPx - layoutHeightPx;

  const boardTransform = `translate(${translateX}px, ${translateY}px) rotate(${theta}deg)`;

  const regionTransform =
    viewMode === "right"
      ? "rotate(-90deg)"
      : viewMode === "diagonal"
      ? "rotate(-45deg) scale(0.78)"
      : "none";

  const viewRotation =
    viewMode === "right"
      ? "-90deg"
      : viewMode === "diagonal"
      ? "-45deg"
      : "0deg";

  const boardTransformClass = `view-${viewMode}`;

  return {
    viewRotation,
    boardTransformClass,
    toolbarOffsetPx,
    statusOffsetPx,
    boardTransform,
    regionTransform,
    cellSizePx,
  };
};
