import { useMemo, useRef } from "react";
import { buildPreviewOrigin } from "../../domain/placement/placementController";
import { computeViewBounds, computeViewTransforms } from "../../domain/view/viewController";

// View transforms and preview positioning.
export const useViewHandlers = ({
  hoverCell,
  carried,
  selectedBuildingId,
  libraryMap,
  categoryColors,
  unlockedRegions,
  viewMode,
  boardScale,
  containerHeight = null, // viewport height for dynamic sizing
  containerWidth = null,  // viewport width for dynamic sizing
  isCellUnlocked = null, // Optional: function to check if cell is unlocked
}) => {
  const selectedDef = selectedBuildingId ? libraryMap[selectedBuildingId] : null;
  const previewDef = carried?.def ?? selectedDef;
  
  // Store last valid preview position
  const lastValidPreviewRef = useRef(null);
  
  const previewOrigin = useMemo(() => {
    // If no preview def, clear the last valid position and return null
    if (!previewDef) {
      lastValidPreviewRef.current = null;
      return null;
    }
    
    const newOrigin = buildPreviewOrigin(hoverCell, previewDef, categoryColors, isCellUnlocked);
    
    // If new position is valid, update and use it
    if (newOrigin) {
      lastValidPreviewRef.current = newOrigin;
      return newOrigin;
    }
    
    // If new position is invalid but we have a last valid position, use that
    // But only if the previewDef dimensions still match
    if (lastValidPreviewRef.current && 
        lastValidPreviewRef.current.width === previewDef.width &&
        lastValidPreviewRef.current.height === previewDef.height) {
      return lastValidPreviewRef.current;
    }
    
    return null;
  }, [hoverCell, previewDef, categoryColors, isCellUnlocked]);

  const viewBounds = useMemo(
    () => computeViewBounds(unlockedRegions),
    [unlockedRegions]
  );
  const { viewColStart, viewRowStart, viewWidth, viewHeight } = viewBounds;

  const viewTransforms = useMemo(
    () => computeViewTransforms(viewMode, viewWidth, viewHeight, boardScale, containerHeight, containerWidth),
    [viewMode, viewWidth, viewHeight, boardScale, containerHeight, containerWidth]
  );
  const {
    viewRotation,
    boardTransform,
    regionTransform,
    toolbarOffsetPx,
    statusOffsetPx,
    boardTransformClass,
    cellSizePx,
    rotatedWidthPx,
    rotatedHeightPx,
  } = viewTransforms;

  return {
    previewOrigin,
    viewRotation,
    boardTransform,
    regionTransform,
    toolbarOffsetPx,
    statusOffsetPx,
    boardTransformClass,
    cellSizePx,
    rotatedWidthPx,
    rotatedHeightPx,
    viewWidth,
    viewHeight,
    viewColStart,
    viewRowStart,
  };
};
