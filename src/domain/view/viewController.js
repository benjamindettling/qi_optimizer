import { REGION_SIZE, REGION_COLS, REGION_ROWS, REGION_MASK } from "../../config/boardConfig";

export const computeViewBounds = (unlockedRegions) => {
  // Calculate bounds based on ALL playable regions (not void), not just unlocked
  // This ensures the full game board is always visible
  const playableCoords = [];
  for (let row = 0; row < REGION_ROWS; row++) {
    for (let col = 0; col < REGION_COLS; col++) {
      const mask = REGION_MASK[row]?.[col];
      // Include all non-void regions (S = start/base, U = unlockable)
      if (mask !== "N") {
        playableCoords.push({ row, col });
      }
    }
  }
  
  const minCol =
    playableCoords.length > 0
      ? Math.min(...playableCoords.map((c) => c.col))
      : 0;
  const maxCol =
    playableCoords.length > 0
      ? Math.max(...playableCoords.map((c) => c.col))
      : 0;
  const minRow =
    playableCoords.length > 0
      ? Math.min(...playableCoords.map((c) => c.row))
      : 0;
  const maxRow =
    playableCoords.length > 0
      ? Math.max(...playableCoords.map((c) => c.row))
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
  boardScale = 1,
  containerHeightPx = null, // If provided, calculate cell size to fit height
  containerWidthPx = null   // If provided, calculate cell size to fit width
) => {
  // Calculate cell size to fit viewport, or use base size
  const BASE_CELL_PX = 36;
  const s = boardScale ?? 1;
  
  let cellSizePx;
  
  // theta is the rotation angle
  const theta = viewMode === "right" ? -90 : viewMode === "diagonal" ? -45 : 0;
  const rad = (theta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  
  // The rotated bounding box dimensions are:
  // rotatedWidth = width * |cos(theta)| + height * |sin(theta)|
  // rotatedHeight = height * |cos(theta)| + width * |sin(theta)|
  const effectiveWidth = viewWidth * absCos + viewHeight * absSin;
  const effectiveHeight = viewHeight * absCos + viewWidth * absSin;
  
  if ((containerHeightPx || containerWidthPx) && viewHeight > 0 && viewWidth > 0) {
    let widthFit = Infinity;
    let heightFit = Infinity;
    
    if (containerWidthPx && effectiveWidth > 0) {
      widthFit = containerWidthPx / effectiveWidth;
    }
    
    if (containerHeightPx && effectiveHeight > 0) {
      heightFit = containerHeightPx / effectiveHeight;
    }
    
    // Use the smaller of the two to fit both dimensions
    cellSizePx = Math.floor(Math.min(widthFit, heightFit));
    
    // Apply manual scale factor - allow very small sizes for zooming out
    cellSizePx = Math.max(4, cellSizePx * s);
  } else {
    cellSizePx = Math.max(4, BASE_CELL_PX * s);
  }
  
  const layoutWidthPx = viewWidth * cellSizePx;
  const layoutHeightPx = viewHeight * cellSizePx;
  const scaledWidthPx = layoutWidthPx;
  const scaledHeightPx = layoutHeightPx;

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
    // Offsets were used historically to "fake" layout accounting for transforms.
    // Prefer using rotatedWidthPx/rotatedHeightPx to size an untransformed wrapper
    // so flex/grid can layout correctly.
    toolbarOffsetPx,
    statusOffsetPx,
    boardTransform,
    regionTransform,
    cellSizePx,
    rotatedWidthPx,
    rotatedHeightPx,
    layoutWidthPx,
    layoutHeightPx,
  };
};
