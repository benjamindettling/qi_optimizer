// Board grid and building rendering (SVG-only).
import {
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
  useId,
} from "react";
import { Check, X } from "lucide-react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  REGION_SIZE,
  REGION_COLS,
  REGION_ROWS,
  REGION_MASK,
} from "../../config/boardConfig";
import { findTargetInstance } from "../../domain/placement/placementController";
import { useLang } from "../../context/LanguageContext";
import { getBuildingName } from "../../utils/buildingName";
import { isAreaFree } from "../../utils/layoutUtils";
import { PRIMARY_COLORS } from "../../config/colors";
import { getBoostInteractionState } from "../../utils/shards";
import "./Board.css";

const TIER_HUE_SHIFT = {
  1: 0,
  2: 0,
  3: 0,
};

const HUE_SHIFT_PRODUCTION = {
  1: 0,
  2: 0,
  3: 0,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const parseHexToHsl = (hex) => {
  if (!hex || typeof hex !== "string") return null;
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  const r = Number.parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h, s, l };
};

const hslToRgba = (h, s, l, alpha = 1) => {
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255,
  )}, ${alpha})`;
};

const tintColor = (
  baseHex,
  alphaBg = 0.22,
  alphaBorder = 1,
  hueShiftDeg = 0,
) => {
  const hsl = parseHexToHsl(baseHex);
  if (!hsl) {
    return {
      background: "rgba(255, 255, 255, 0.2)",
      border: baseHex || "#ffffff",
    };
  }

  const satDelta = 0;
  const lightDelta = 0;

  let h = (hsl.h * 360 + hueShiftDeg) % 360;
  if (h < 0) h += 360;
  const s = clamp01(hsl.s + satDelta);
  const l = clamp01(hsl.l + lightDelta);

  return {
    background: hslToRgba(h / 360, s, l, alphaBg),
    border: hslToRgba(h / 360, s, l, alphaBorder),
  };
};

const resolveCssVar = (styles, key, fallback) => {
  const value = styles?.getPropertyValue(key)?.trim();
  return value || fallback;
};

const toSvgTransform = (cssTransform) =>
  (cssTransform || "translate(0px, 0px) rotate(0deg)")
    .replace(/px/g, "")
    .replace(/deg/g, "")
    .replace(/,\s*/g, " ")
    .replace(
      /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi,
      (match) => `${round2(match)}`,
    );

const parseRotation = (rotation) => {
  const numeric = Number.parseFloat(String(rotation || "0"));
  return Number.isFinite(numeric) ? numeric : 0;
};

const round2 = (value) => Number((Number(value) || 0).toFixed(2));
const round4 = (value) => Number((Number(value) || 0).toFixed(4));
const SVG_TEXT_STACK = "Helvetica, Arial, sans-serif";
// Single source of truth for all rounded corners (relative to one board cell).
const CORNER_RADIUS = 0.75;
const sanitizeSvgId = (rawId) => String(rawId).replace(/[^a-zA-Z0-9_-]/g, "");
const rectanglesOverlap = (a, b) => {
  if (!a || !b) return false;
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
};
const createDrawPlacementState = () => ({
  active: false,
  pointerId: null,
  anchorX: 0,
  anchorY: 0,
  stepWidth: 1,
  stepHeight: 1,
  targetGridX: 0,
  targetGridY: 0,
  lastGridX: 0,
  lastGridY: 0,
  placementInFlight: false,
  lastPlacedRect: null,
  attemptedKeys: new Set(),
});
const createToolDragState = () => ({
  active: false,
  pointerId: null,
  mode: null,
  defId: null,
  inFlight: false,
  pendingIds: [],
  processedIds: new Set(),
});

export function Board({
  viewRotation,
  boardTransform,
  rotatedWidthPx,
  rotatedHeightPx,
  viewWidth,
  viewHeight,
  viewColStart,
  viewRowStart,
  previewOrigin,
  isCellUnlocked,
  handleCellClick,
  setHoverCell,
  onDropComplete,
  onCancelAction,
  onIllegalDrawPlacement,
  layout,
  libraryMap,
  categoryColors,
  boardTransformClass,
  cellSizePx,
  readyMap = {},
  buildLocks = {},
  boostMode = false,
  resources,
  config,
  highlightedIds = new Set(),
  boardRef,
  onWrapperResize,
  unlockedRegions = [],
  neighborUnlocked,
  canAnyUnlock = false,
  onRegionClick,
  isShopOpen = false,
  adminMode = false,
  onDebugUnlockRegion,
  onDebugLockRegion,
  infiniteResources = false,
  moveMode = false,
  sellMode = false,
  refundMode = false,
  selectedBuildingId = null,
  carried = null,
  helpMode = false,
}) {
  const { lang } = useLang();
  const svgIdSeed = useId();
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const boardSpaceRef = useRef(null);
  const layoutRef = useRef(layout);
  const readyMapRef = useRef(readyMap);
  const pointerDownCellRef = useRef(null);
  const pointerStateRef = useRef({
    pointerType: "mouse",
    startX: 0,
    startY: 0,
    hasDragged: false,
    ghostAtStart: null,
    startScrollX: 0,
    startScrollY: 0,
    handledMouseBuildOnDown: false,
  });
  const drawPlacementRef = useRef(createDrawPlacementState());
  const toolDragRef = useRef(createToolDragState());
  const [isTouchSelection, setIsTouchSelection] = useState(false);
  const [hoveredRegionIdx, setHoveredRegionIdx] = useState(null);
  const selectedBuildDef = useMemo(
    () =>
      selectedBuildingId ? (libraryMap?.[selectedBuildingId] ?? null) : null,
    [libraryMap, selectedBuildingId],
  );
  const isPreviewDragActive = !!selectedBuildingId || !!carried;
  const hideAdminLockButtons =
    moveMode ||
    sellMode ||
    refundMode ||
    boostMode ||
    isShopOpen ||
    !!selectedBuildingId ||
    !!carried ||
    isTouchSelection;
  const regionInteractionsDisabled =
    isShopOpen || !!selectedBuildingId || isTouchSelection;

  useEffect(() => {
    if (!wrapperRef.current || !onWrapperResize) return undefined;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const height = entry.contentRect.height;
        if (height > 0) onWrapperResize(height);
      });
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [onWrapperResize]);

  useEffect(() => {
    if (!previewOrigin && !carried && !selectedBuildingId) {
      setIsTouchSelection(false);
    }
  }, [carried, previewOrigin, selectedBuildingId]);

  const resetDrawPlacement = useCallback(() => {
    drawPlacementRef.current = createDrawPlacementState();
  }, []);

  const resetToolDrag = useCallback(() => {
    toolDragRef.current = createToolDragState();
  }, []);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    readyMapRef.current = readyMap;
  }, [readyMap]);

  useEffect(() => {
    if (selectedBuildingId) return;
    pointerStateRef.current.handledMouseBuildOnDown = false;
    resetDrawPlacement();
  }, [resetDrawPlacement, selectedBuildingId]);

  useEffect(() => {
    if (
      sellMode ||
      refundMode ||
      (!moveMode && !boostMode && !selectedBuildingId && !carried)
    ) {
      return;
    }
    resetToolDrag();
  }, [
    boostMode,
    carried,
    moveMode,
    refundMode,
    resetToolDrag,
    sellMode,
    selectedBuildingId,
  ]);

  const isDrawPlacementUnlocked = useCallback(
    (x, y, width, height) => {
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          if (!isCellUnlocked(x + dx, y + dy)) return false;
        }
      }
      return true;
    },
    [isCellUnlocked],
  );

  const canDrawPlaceAt = useCallback(
    (x, y) => {
      if (!selectedBuildDef) return false;
      if (
        x < 0 ||
        y < 0 ||
        x > BOARD_WIDTH - selectedBuildDef.width ||
        y > BOARD_HEIGHT - selectedBuildDef.height
      ) {
        return false;
      }
      return isAreaFree(
        layout,
        x,
        y,
        selectedBuildDef.width,
        selectedBuildDef.height,
        undefined,
        isCellUnlocked,
      );
    },
    [isCellUnlocked, layout, selectedBuildDef],
  );

  const processToolDragQueue = useCallback(() => {
    const toolState = toolDragRef.current;
    if (!toolState.active || toolState.inFlight) return;

    while (toolState.pendingIds.length > 0) {
      const targetId = toolState.pendingIds.shift();
      if (toolState.processedIds.has(targetId)) {
        continue;
      }

      const target = (layoutRef.current || []).find(
        (item) => item.id === targetId,
      );
      if (!target) {
        toolState.processedIds.add(targetId);
        continue;
      }

      if (toolState.mode === "delete" && target.defId !== toolState.defId) {
        toolState.processedIds.add(targetId);
        continue;
      }

      if (toolState.mode === "harvest" && !readyMapRef.current?.[target.id]) {
        toolState.processedIds.add(targetId);
        continue;
      }

      const result = handleCellClick(target.x, target.y);
      toolState.processedIds.add(targetId);
      if (result?.ok) {
        toolState.inFlight = true;
        return;
      }
    }
  }, [handleCellClick]);

  useEffect(() => {
    const toolState = toolDragRef.current;
    if (!toolState.active) return;
    toolState.inFlight = false;
    processToolDragQueue();
  }, [layout, readyMap, processToolDragQueue]);

  const enqueueToolDragTarget = useCallback(
    (target) => {
      const toolState = toolDragRef.current;
      if (!toolState.active || !target) return;
      if (toolState.processedIds.has(target.id)) return;
      if (toolState.pendingIds.includes(target.id)) return;

      if (toolState.mode === "delete" && target.defId !== toolState.defId) {
        return;
      }

      if (toolState.mode === "harvest" && !readyMapRef.current?.[target.id]) {
        return;
      }

      toolState.pendingIds.push(target.id);
      processToolDragQueue();
    },
    [processToolDragQueue],
  );

  useEffect(() => {
    if (regionInteractionsDisabled) {
      setHoveredRegionIdx(null);
    }
  }, [regionInteractionsDisabled]);

  const safeCols = Math.max(1, Math.floor(Number(viewWidth) || 0));
  const safeRows = Math.max(1, Math.floor(Number(viewHeight) || 0));
  const safeCellSize = Math.max(0.1, Number(cellSizePx) || 1);

  const boardWidthPx = safeCols * safeCellSize;
  const boardHeightPx = safeRows * safeCellSize;
  const finalSvgWidth =
    Number.isFinite(rotatedWidthPx) && rotatedWidthPx > 0
      ? rotatedWidthPx
      : boardWidthPx;
  const finalSvgHeight =
    Number.isFinite(rotatedHeightPx) && rotatedHeightPx > 0
      ? rotatedHeightPx
      : boardHeightPx;

  const cornerRadiusPx = safeCellSize * CORNER_RADIUS;
  // Keep these deterministic and stable under zoom/rotation.
  const gridStrokeWidth = 1.5;
  const buildingStrokeWidth = 2;
  const buildingInnerStrokeWidth = 1.2;
  const regionStrokeWidth = 2;
  const buildingLabelFontSize = Math.max(15, safeCellSize * 0.62);
  const buildingLabelFontWeight = 800;
  // Small symmetric buffer so border strokes/arcs near edges are never clipped.
  const edgeBufferPx = Math.max(
    2,
    Math.ceil(
      Math.max(regionStrokeWidth, buildingStrokeWidth, gridStrokeWidth),
    ),
  );
  const svgWidthPx = finalSvgWidth + edgeBufferPx * 2;
  const svgHeightPx = finalSvgHeight + edgeBufferPx * 2;

  const themeColors = (() => {
    if (typeof window === "undefined") {
      return {
        boardBg: "#0d1b2a",
        boardBorder: "#1f3e63",
        pageBg: "#0d1b2a",
        accent: "#4C8BF5",
        selectionBlue: "#74b0ff",
        selectionBlueBorder: "#4d8fd9",
        white: "#ffffff",
      };
    }

    const styles = getComputedStyle(document.documentElement);
    return {
      boardBg: resolveCssVar(styles, "--color-board-bg", "#0d1b2a"),
      boardBorder: resolveCssVar(styles, "--color-board-border", "#1f3e63"),
      pageBg: resolveCssVar(styles, "--color-bg", "#0d1b2a"),
      accent: resolveCssVar(styles, "--color-accent", "#4C8BF5"),
      selectionBlue: resolveCssVar(styles, "--ui-selection-blue", "#74b0ff"),
      selectionBlueBorder: resolveCssVar(
        styles,
        "--ui-selection-blue-border",
        "#4d8fd9",
      ),
      white: resolveCssVar(styles, "--ui-white", "#ffffff"),
    };
  })();

  const visibleRegions = useMemo(() => {
    const regions = [];
    const cols = Math.max(1, Math.floor(viewWidth || 0));
    const rows = Math.max(1, Math.floor(viewHeight || 0));
    const startRegionCol = Math.floor(viewColStart / REGION_SIZE);
    const startRegionRow = Math.floor(viewRowStart / REGION_SIZE);
    const endRegionCol = Math.ceil((viewColStart + cols) / REGION_SIZE);
    const endRegionRow = Math.ceil((viewRowStart + rows) / REGION_SIZE);

    for (let regRow = startRegionRow; regRow < endRegionRow; regRow += 1) {
      for (let regCol = startRegionCol; regCol < endRegionCol; regCol += 1) {
        if (
          regRow < 0 ||
          regRow >= REGION_ROWS ||
          regCol < 0 ||
          regCol >= REGION_COLS
        ) {
          continue;
        }

        const mask = REGION_MASK[regRow]?.[regCol];
        const isVoid = mask === "N";
        const isBase = mask === "S";
        const idx = regRow * REGION_COLS + regCol;
        const unlocked = !!unlockedRegions[idx];
        const isNeighbor =
          typeof neighborUnlocked === "function"
            ? neighborUnlocked(idx)
            : !!neighborUnlocked?.[idx];

        const localXCells = regCol * REGION_SIZE - viewColStart;
        const localYCells = regRow * REGION_SIZE - viewRowStart;

        const canUnlock = infiniteResources || canAnyUnlock;
        const normalClickable = !isVoid && !unlocked && isNeighbor && canUnlock;
        const isDebugUnlockable =
          adminMode && !isVoid && !unlocked && isNeighbor;
        const isDebugLockable =
          adminMode && !hideAdminLockButtons && !isVoid && unlocked && !isBase;
        const clickable =
          normalClickable || isDebugUnlockable || isDebugLockable;

        regions.push({
          idx,
          regRow,
          regCol,
          x: localXCells * safeCellSize,
          y: localYCells * safeCellSize,
          width: REGION_SIZE * safeCellSize,
          height: REGION_SIZE * safeCellSize,
          unlocked,
          isNeighbor,
          isBase,
          isVoid,
          clickable,
          isDebugUnlockable,
          isDebugLockable,
        });
      }
    }

    return regions;
  }, [
    adminMode,
    canAnyUnlock,
    hideAdminLockButtons,
    infiniteResources,
    neighborUnlocked,
    safeCellSize,
    unlockedRegions,
    viewColStart,
    viewHeight,
    viewRowStart,
    viewWidth,
  ]);

  const voidRegions = useMemo(
    () => visibleRegions.filter((region) => region.isVoid),
    [visibleRegions],
  );
  const helpUnlockableRegions = useMemo(
    () =>
      visibleRegions.filter(
        (region) => !region.isVoid && !region.unlocked && region.isNeighbor,
      ),
    [visibleRegions],
  );
  const helpLockedRegions = useMemo(
    () =>
      visibleRegions.filter(
        (region) => !region.isVoid && !region.unlocked && !region.isNeighbor,
      ),
    [visibleRegions],
  );
  const helpTownhallRects = useMemo(
    () =>
      (layout || [])
        .filter((building) => {
          const def = libraryMap?.[building.defId];
          return def?.category === "townhall";
        })
        .map((building) => ({
          id: building.id,
          x: (building.x - viewColStart) * safeCellSize,
          y: (building.y - viewRowStart) * safeCellSize,
          width: building.width * safeCellSize,
          height: building.height * safeCellSize,
        })),
    [layout, libraryMap, safeCellSize, viewColStart, viewRowStart],
  );
  const clipIdBase = `board-${sanitizeSvgId(svgIdSeed)}`;
  const unlockedClipId = `${clipIdBase}-unlocked`;

  const unlockedCellSet = useMemo(() => {
    const set = new Set();
    for (let row = 0; row < safeRows; row += 1) {
      for (let col = 0; col < safeCols; col += 1) {
        const globalCol = viewColStart + col;
        const globalRow = viewRowStart + row;
        if (isCellUnlocked(globalCol, globalRow)) {
          set.add(`${col},${row}`);
        }
      }
    }
    return set;
  }, [isCellUnlocked, safeCols, safeRows, viewColStart, viewRowStart]);

  const previewRect = useMemo(() => {
    if (!previewOrigin) return null;
    return {
      x: (previewOrigin.x - viewColStart) * safeCellSize,
      y: (previewOrigin.y - viewRowStart) * safeCellSize,
      width: previewOrigin.width * safeCellSize,
      height: previewOrigin.height * safeCellSize,
    };
  }, [previewOrigin, safeCellSize, viewColStart, viewRowStart]);

  const touchActionButtons = useMemo(() => {
    if (!previewRect || !isTouchSelection) return null;

    const buttonRadius = Math.max(15, safeCellSize * 0.42);
    const buttonGap = Math.max(8, safeCellSize * 0.22);
    const buttonMargin = Math.max(10, safeCellSize * 0.3);
    const buttonOffset = buttonRadius + buttonGap / 2;
    const minCenterX = buttonRadius + buttonOffset;
    const maxCenterX = boardWidthPx - buttonRadius - buttonOffset;
    const unclampedCenterX = previewRect.x + previewRect.width / 2;
    const centerX = Math.min(
      maxCenterX,
      Math.max(minCenterX, unclampedCenterX),
    );

    let centerY = previewRect.y - buttonRadius - buttonMargin;
    if (centerY - buttonRadius < 0) {
      centerY =
        previewRect.y + previewRect.height + buttonRadius + buttonMargin;
    }
    centerY = Math.min(
      boardHeightPx - buttonRadius,
      Math.max(buttonRadius, centerY),
    );

    return {
      iconSize: Math.max(18, buttonRadius * 1.15),
      radius: buttonRadius,
      strokeWidth: Math.max(2, safeCellSize * 0.08),
      confirm: {
        x: centerX - buttonOffset,
        y: centerY,
      },
      cancel: {
        x: centerX + buttonOffset,
        y: centerY,
      },
    };
  }, [
    boardHeightPx,
    boardWidthPx,
    isTouchSelection,
    previewRect,
    safeCellSize,
  ]);

  const touchActionAnchor = useMemo(() => {
    if (!previewRect || !touchActionButtons) return null;
    return {
      x: previewRect.x + previewRect.width / 2,
      y: previewRect.y + previewRect.height / 2,
    };
  }, [previewRect, touchActionButtons]);

  const unlockedGridPath = useMemo(() => {
    const segments = [];
    const hasCell = (col, row) => unlockedCellSet.has(`${col},${row}`);

    // Horizontal lines between two unlocked neighbor rows.
    for (let row = 1; row < safeRows; row += 1) {
      let runStart = null;
      for (let col = 0; col < safeCols; col += 1) {
        const draw = hasCell(col, row - 1) && hasCell(col, row);
        if (draw && runStart === null) runStart = col;
        if ((!draw || col === safeCols - 1) && runStart !== null) {
          const endCol = draw && col === safeCols - 1 ? col + 1 : col;
          const y = row * safeCellSize;
          segments.push(
            `M ${round2(runStart * safeCellSize)} ${round2(y)} L ${round2(
              endCol * safeCellSize,
            )} ${round2(y)}`,
          );
          runStart = null;
        }
      }
    }

    // Vertical lines between two unlocked neighbor columns.
    for (let col = 1; col < safeCols; col += 1) {
      let runStart = null;
      for (let row = 0; row < safeRows; row += 1) {
        const draw = hasCell(col - 1, row) && hasCell(col, row);
        if (draw && runStart === null) runStart = row;
        if ((!draw || row === safeRows - 1) && runStart !== null) {
          const endRow = draw && row === safeRows - 1 ? row + 1 : row;
          const x = col * safeCellSize;
          segments.push(
            `M ${round2(x)} ${round2(runStart * safeCellSize)} L ${round2(
              x,
            )} ${round2(endRow * safeCellSize)}`,
          );
          runStart = null;
        }
      }
    }

    return segments.join(" ");
  }, [safeCellSize, safeCols, safeRows, unlockedCellSet]);

  const unlockedRegionBoundaryPath = useMemo(() => {
    const unlockedRegionSet = new Set();
    for (let row = 0; row < REGION_ROWS; row += 1) {
      for (let col = 0; col < REGION_COLS; col += 1) {
        const idx = row * REGION_COLS + col;
        if (REGION_MASK[row]?.[col] === "N") continue;
        if (unlockedRegions[idx]) unlockedRegionSet.add(`${col},${row}`);
      }
    }
    if (!unlockedRegionSet.size) return "";

    const segmentMap = new Map();
    const pointMap = new Map();
    const adjacency = new Map();
    const canonicalEdge = (aKey, bKey) =>
      aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    const pointKey = (x, y) => `${round4(x)},${round4(y)}`;

    const addEdge = (x1, y1, x2, y2) => {
      const a = { x: round4(x1), y: round4(y1) };
      const b = { x: round4(x2), y: round4(y2) };
      const aKey = pointKey(a.x, a.y);
      const bKey = pointKey(b.x, b.y);
      if (aKey === bKey) return;
      const edgeKey = canonicalEdge(aKey, bKey);
      if (segmentMap.has(edgeKey)) return;
      segmentMap.set(edgeKey, { aKey, bKey });
      pointMap.set(aKey, a);
      pointMap.set(bKey, b);
      if (!adjacency.has(aKey)) adjacency.set(aKey, new Set());
      if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
      adjacency.get(aKey).add(bKey);
      adjacency.get(bKey).add(aKey);
    };

    for (let row = 0; row < REGION_ROWS; row += 1) {
      for (let col = 0; col < REGION_COLS; col += 1) {
        const key = `${col},${row}`;
        if (!unlockedRegionSet.has(key)) continue;

        const x0 = (col * REGION_SIZE - viewColStart) * safeCellSize;
        const y0 = (row * REGION_SIZE - viewRowStart) * safeCellSize;
        const size = REGION_SIZE * safeCellSize;

        if (!unlockedRegionSet.has(`${col},${row - 1}`))
          addEdge(x0, y0, x0 + size, y0);
        if (!unlockedRegionSet.has(`${col + 1},${row}`))
          addEdge(x0 + size, y0, x0 + size, y0 + size);
        if (!unlockedRegionSet.has(`${col},${row + 1}`))
          addEdge(x0 + size, y0 + size, x0, y0 + size);
        if (!unlockedRegionSet.has(`${col - 1},${row}`))
          addEdge(x0, y0 + size, x0, y0);
      }
    }

    if (!segmentMap.size) return "";

    const visited = new Set();
    const loops = [];

    segmentMap.forEach((segment, seedEdgeKey) => {
      if (visited.has(seedEdgeKey)) return;

      const startKey = segment.aKey;
      let prevKey = null;
      let currentKey = startKey;
      let nextKey = segment.bKey;
      const loop = [pointMap.get(startKey)];
      let guard = 0;

      while (nextKey && guard < 10000) {
        guard += 1;
        const edgeKey = canonicalEdge(currentKey, nextKey);
        if (!segmentMap.has(edgeKey)) break;
        visited.add(edgeKey);

        prevKey = currentKey;
        currentKey = nextKey;
        loop.push(pointMap.get(currentKey));

        if (currentKey === startKey) break;

        const neighbors = [...(adjacency.get(currentKey) ?? [])];
        const unvisitedNext = neighbors.find(
          (neighbor) =>
            neighbor !== prevKey &&
            !visited.has(canonicalEdge(currentKey, neighbor)),
        );
        nextKey =
          unvisitedNext ??
          neighbors.find((neighbor) => neighbor !== prevKey) ??
          null;
      }

      if (loop.length > 3) {
        const first = loop[0];
        const last = loop[loop.length - 1];
        if (first && last && first.x === last.x && first.y === last.y) {
          loop.pop();
        }
        if (loop.length > 2) loops.push(loop);
      }
    });

    if (!loops.length) return "";

    const buildRoundedLoopPath = (points, radius) => {
      const n = points.length;
      if (n < 3) return "";
      const signedArea = points.reduce((sum, point, idx) => {
        const next = points[(idx + 1) % n];
        return sum + (point.x * next.y - next.x * point.y);
      }, 0);
      const orientationSign = signedArea >= 0 ? 1 : -1;

      const corners = [];
      for (let i = 0; i < n; i += 1) {
        const prev = points[(i - 1 + n) % n];
        const curr = points[i];
        const next = points[(i + 1) % n];

        const inVec = { x: curr.x - prev.x, y: curr.y - prev.y };
        const outVec = { x: next.x - curr.x, y: next.y - curr.y };
        const inLen = Math.hypot(inVec.x, inVec.y);
        const outLen = Math.hypot(outVec.x, outVec.y);

        if (inLen < 1e-6 || outLen < 1e-6) {
          corners.push({
            start: curr,
            end: curr,
            corner: false,
            radius: 0,
            sweep: 0,
          });
          continue;
        }

        const inDir = { x: inVec.x / inLen, y: inVec.y / inLen };
        const outDir = { x: outVec.x / outLen, y: outVec.y / outLen };
        const cross = inDir.x * outDir.y - inDir.y * outDir.x;
        const isConvexTurn = cross * orientationSign > 1e-6;
        if (!isConvexTurn) {
          corners.push({
            start: curr,
            end: curr,
            corner: false,
            radius: 0,
            sweep: 0,
          });
          continue;
        }

        const localRadius = Math.min(radius, inLen / 2, outLen / 2);
        const start = {
          x: curr.x - inDir.x * localRadius,
          y: curr.y - inDir.y * localRadius,
        };
        const end = {
          x: curr.x + outDir.x * localRadius,
          y: curr.y + outDir.y * localRadius,
        };

        corners.push({
          start,
          end,
          corner: true,
          radius: localRadius,
          sweep: cross > 0 ? 1 : 0,
        });
      }

      const first = corners[0];
      let d = `M ${round2(first.end.x)} ${round2(first.end.y)}`;
      for (let i = 1; i < n; i += 1) {
        const c = corners[i];
        d += ` L ${round2(c.start.x)} ${round2(c.start.y)}`;
        if (c.corner && c.radius > 0.01) {
          d += ` A ${round2(c.radius)} ${round2(c.radius)} 0 0 ${c.sweep} ${round2(
            c.end.x,
          )} ${round2(c.end.y)}`;
        } else {
          d += ` L ${round2(c.end.x)} ${round2(c.end.y)}`;
        }
      }
      d += ` L ${round2(first.start.x)} ${round2(first.start.y)}`;
      if (first.corner && first.radius > 0.01) {
        d += ` A ${round2(first.radius)} ${round2(first.radius)} 0 0 ${first.sweep} ${round2(
          first.end.x,
        )} ${round2(first.end.y)}`;
      }
      d += " Z";
      return d;
    };

    return loops
      .map((loop) => buildRoundedLoopPath(loop, cornerRadiusPx))
      .filter(Boolean)
      .join(" ");
  }, [
    cornerRadiusPx,
    safeCellSize,
    unlockedRegions,
    viewColStart,
    viewRowStart,
  ]);

  const handleRegionClick = useCallback(
    (region) => {
      if (adminMode) {
        if (region.isDebugUnlockable) {
          onDebugUnlockRegion?.(region.idx);
        } else if (region.isDebugLockable) {
          onDebugLockRegion?.(region.idx, region.isBase);
        }
        return;
      }

      if (!region.unlocked && region.isNeighbor) {
        onRegionClick?.(region.idx);
      }
    },
    [adminMode, onDebugLockRegion, onDebugUnlockRegion, onRegionClick],
  );

  const svgBoardTransform = useMemo(
    () => toSvgTransform(boardTransform),
    [boardTransform],
  );

  const labelCounterRotation = -parseRotation(viewRotation);

  const resolveCellFromClient = useCallback(
    (clientX, clientY, options = {}) => {
      const { clampToBoard = false } = options;
      const svgNode = svgRef.current;
      const boardSpaceNode = boardSpaceRef.current;
      if (!svgNode || !boardSpaceNode) return null;

      const ctm = boardSpaceNode.getScreenCTM();
      if (!ctm) return null;

      const point = svgNode.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const localPoint = point.matrixTransform(ctm.inverse());
      const maxLocalX = Math.max(0, boardWidthPx - 1e-6);
      const maxLocalY = Math.max(0, boardHeightPx - 1e-6);
      const resolvedX = clampToBoard
        ? Math.min(Math.max(localPoint.x, 0), maxLocalX)
        : localPoint.x;
      const resolvedY = clampToBoard
        ? Math.min(Math.max(localPoint.y, 0), maxLocalY)
        : localPoint.y;

      if (
        resolvedX < 0 ||
        resolvedY < 0 ||
        resolvedX >= boardWidthPx ||
        resolvedY >= boardHeightPx
      ) {
        return null;
      }

      const localCol = Math.floor(resolvedX / safeCellSize);
      const localRow = Math.floor(resolvedY / safeCellSize);

      if (
        localCol < 0 ||
        localCol >= safeCols ||
        localRow < 0 ||
        localRow >= safeRows
      ) {
        return null;
      }

      return {
        localCol,
        localRow,
        globalCol: viewColStart + localCol,
        globalRow: viewRowStart + localRow,
      };
    },
    [
      boardHeightPx,
      boardWidthPx,
      safeCellSize,
      safeCols,
      safeRows,
      viewColStart,
      viewRowStart,
    ],
  );

  const processDrawPlacement = useCallback(() => {
    const drawState = drawPlacementRef.current;
    if (!drawState.active || drawState.placementInFlight) return;

    const deltaGridX = drawState.targetGridX - drawState.lastGridX;
    const deltaGridY = drawState.targetGridY - drawState.lastGridY;
    const steps = Math.max(Math.abs(deltaGridX), Math.abs(deltaGridY));

    if (steps <= 0) {
      const hoverX =
        drawState.anchorX + drawState.targetGridX * drawState.stepWidth;
      const hoverY =
        drawState.anchorY + drawState.targetGridY * drawState.stepHeight;
      setHoverCell({ x: hoverX, y: hoverY });
      return;
    }

    let finalHoverX =
      drawState.anchorX + drawState.targetGridX * drawState.stepWidth;
    let finalHoverY =
      drawState.anchorY + drawState.targetGridY * drawState.stepHeight;
    let prevGridX = drawState.lastGridX;
    let prevGridY = drawState.lastGridY;

    for (let step = 1; step <= steps; step += 1) {
      const gridX = prevGridX + Math.round((deltaGridX * step) / steps);
      const gridY = prevGridY + Math.round((deltaGridY * step) / steps);
      if (gridX === drawState.lastGridX && gridY === drawState.lastGridY) {
        continue;
      }
      const candidateX = drawState.anchorX + gridX * drawState.stepWidth;
      const candidateY = drawState.anchorY + gridY * drawState.stepHeight;
      finalHoverX = candidateX;
      finalHoverY = candidateY;
      drawState.lastGridX = gridX;
      drawState.lastGridY = gridY;

      const key = `${candidateX},${candidateY}`;
      if (drawState.attemptedKeys.has(key)) {
        continue;
      }

      drawState.attemptedKeys.add(key);
      if (!canDrawPlaceAt(candidateX, candidateY)) {
        continue;
      }

      const result = handleCellClick(candidateX, candidateY);
      if (result?.ok) {
        drawState.placementInFlight = true;
        drawState.lastPlacedRect = {
          x: candidateX,
          y: candidateY,
          width: drawState.stepWidth,
          height: drawState.stepHeight,
        };
        setHoverCell({ x: candidateX, y: candidateY });
        return;
      }
    }

    setHoverCell({ x: finalHoverX, y: finalHoverY });
  }, [canDrawPlaceAt, handleCellClick, setHoverCell]);

  useEffect(() => {
    const drawState = drawPlacementRef.current;
    if (!drawState.active && !drawState.lastPlacedRect) return;

    const placedRect = drawState.lastPlacedRect;
    if (placedRect) {
      const overlappingCount = (layout || []).filter((item) =>
        rectanglesOverlap(placedRect, item),
      ).length;
      const unlocked = isDrawPlacementUnlocked(
        placedRect.x,
        placedRect.y,
        placedRect.width,
        placedRect.height,
      );

      if (!unlocked || overlappingCount > 1) {
        pointerStateRef.current.handledMouseBuildOnDown = false;
        resetDrawPlacement();
        onIllegalDrawPlacement?.();
        return;
      }

      drawState.lastPlacedRect = null;
    }

    if (drawState.active) {
      drawState.placementInFlight = false;
      processDrawPlacement();
    }
  }, [
    isDrawPlacementUnlocked,
    layout,
    onIllegalDrawPlacement,
    processDrawPlacement,
    resetDrawPlacement,
  ]);

  const handlePointerMove = useCallback(
    (event) => {
      if (isShopOpen) return;
      const cell = resolveCellFromClient(event.clientX, event.clientY, {
        clampToBoard: true,
      });
      if (!cell) return;

      const drawState = drawPlacementRef.current;
      if (
        event.pointerType === "mouse" &&
        drawState.active &&
        drawState.pointerId === event.pointerId
      ) {
        drawState.targetGridX = Math.floor(
          (cell.globalCol - drawState.anchorX) / drawState.stepWidth,
        );
        drawState.targetGridY = Math.floor(
          (cell.globalRow - drawState.anchorY) / drawState.stepHeight,
        );
        processDrawPlacement();
        return;
      }

      const toolState = toolDragRef.current;
      if (
        event.pointerType === "mouse" &&
        toolState.active &&
        toolState.pointerId === event.pointerId
      ) {
        const target = findTargetInstance(
          layoutRef.current,
          cell.globalCol,
          cell.globalRow,
        );
        setHoverCell({ x: cell.globalCol, y: cell.globalRow });
        enqueueToolDragTarget(target);
        return;
      }

      if (
        event.pointerType === "touch" ||
        pointerStateRef.current.pointerType === "touch"
      ) {
        const dx = event.clientX - pointerStateRef.current.startX;
        const dy = event.clientY - pointerStateRef.current.startY;
        if (Math.hypot(dx, dy) > 10) {
          pointerStateRef.current.hasDragged = true;
        }
      }

      setHoverCell({ x: cell.globalCol, y: cell.globalRow });
    },
    [
      enqueueToolDragTarget,
      isShopOpen,
      processDrawPlacement,
      resolveCellFromClient,
      setHoverCell,
    ],
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (isShopOpen) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      const cell = resolveCellFromClient(event.clientX, event.clientY);
      if (!cell) return;
      const target = findTargetInstance(layout, cell.globalCol, cell.globalRow);

      pointerStateRef.current = {
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        hasDragged: false,
        ghostAtStart: previewOrigin ? { ...previewOrigin } : null,
        startScrollX: typeof window !== "undefined" ? window.scrollX : 0,
        startScrollY: typeof window !== "undefined" ? window.scrollY : 0,
        handledMouseBuildOnDown: false,
      };

      if (
        event.pointerType === "touch" &&
        (isTouchSelection || selectedBuildingId || (moveMode && target))
      ) {
        setIsTouchSelection(true);
      }

      if (
        event.pointerType === "mouse" &&
        selectedBuildingId &&
        selectedBuildDef
      ) {
        const anchorX = previewOrigin?.x ?? cell.globalCol;
        const anchorY = previewOrigin?.y ?? cell.globalRow;
        pointerStateRef.current.handledMouseBuildOnDown = true;
        pointerDownCellRef.current = null;
        setHoverCell({ x: anchorX, y: anchorY });

        const result = handleCellClick(anchorX, anchorY);
        if (
          result?.ok &&
          result?.kind === "build" &&
          canDrawPlaceAt(anchorX, anchorY)
        ) {
          drawPlacementRef.current = {
            active: true,
            pointerId: event.pointerId,
            anchorX,
            anchorY,
            stepWidth: selectedBuildDef.width,
            stepHeight: selectedBuildDef.height,
            targetGridX: 0,
            targetGridY: 0,
            lastGridX: 0,
            lastGridY: 0,
            placementInFlight: true,
            lastPlacedRect: {
              x: anchorX,
              y: anchorY,
              width: selectedBuildDef.width,
              height: selectedBuildDef.height,
            },
            attemptedKeys: new Set([`${anchorX},${anchorY}`]),
          };
        } else {
          resetDrawPlacement();
        }
      } else if (
        event.pointerType === "mouse" &&
        (sellMode || refundMode) &&
        target
      ) {
        pointerStateRef.current.handledMouseBuildOnDown = true;
        pointerDownCellRef.current = null;
        setHoverCell({ x: cell.globalCol, y: cell.globalRow });

        const result = handleCellClick(target.x, target.y);
        if (result?.ok) {
          toolDragRef.current = {
            active: true,
            pointerId: event.pointerId,
            mode: "delete",
            defId: target.defId,
            inFlight: true,
            pendingIds: [],
            processedIds: new Set([target.id]),
          };
        } else {
          pointerStateRef.current.handledMouseBuildOnDown = false;
          resetToolDrag();
        }
      } else if (
        event.pointerType === "mouse" &&
        !moveMode &&
        !sellMode &&
        !refundMode &&
        !boostMode &&
        !selectedBuildingId &&
        !carried &&
        target &&
        readyMapRef.current?.[target.id] === true
      ) {
        pointerStateRef.current.handledMouseBuildOnDown = true;
        pointerDownCellRef.current = null;
        setHoverCell({ x: cell.globalCol, y: cell.globalRow });

        const result = handleCellClick(target.x, target.y);
        if (result?.ok) {
          toolDragRef.current = {
            active: true,
            pointerId: event.pointerId,
            mode: "harvest",
            defId: null,
            inFlight: true,
            pendingIds: [],
            processedIds: new Set([target.id]),
          };
        } else {
          pointerStateRef.current.handledMouseBuildOnDown = false;
          resetToolDrag();
        }
      } else {
        pointerDownCellRef.current = cell;
        setHoverCell({ x: cell.globalCol, y: cell.globalRow });
      }

      const shouldCapturePointer =
        event.pointerType !== "touch" || isPreviewDragActive;
      if (shouldCapturePointer) {
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // ignore capture failures
        }
      }
    },
    [
      isTouchSelection,
      isShopOpen,
      isPreviewDragActive,
      boostMode,
      carried,
      layout,
      moveMode,
      previewOrigin,
      readyMapRef,
      resetDrawPlacement,
      resetToolDrag,
      resolveCellFromClient,
      refundMode,
      selectedBuildingId,
      selectedBuildDef,
      sellMode,
      canDrawPlaceAt,
      handleCellClick,
      setHoverCell,
    ],
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (isShopOpen) return;
      const down = pointerDownCellRef.current;
      pointerDownCellRef.current = null;
      const drawState = drawPlacementRef.current;
      const toolState = toolDragRef.current;
      if (
        event.pointerType === "mouse" &&
        pointerStateRef.current.handledMouseBuildOnDown
      ) {
        pointerStateRef.current.handledMouseBuildOnDown = false;
        if (drawState.active && drawState.pointerId === event.pointerId) {
          resetDrawPlacement();
        }
        if (toolState.active && toolState.pointerId === event.pointerId) {
          resetToolDrag();
        }
        return;
      }
      const cell = resolveCellFromClient(event.clientX, event.clientY);
      if (!cell || !down) return;

      const pState = pointerStateRef.current;
      const isTouch =
        event.pointerType === "touch" || pState.pointerType === "touch";
      const scrollDeltaX =
        typeof window !== "undefined"
          ? Math.abs(window.scrollX - (pState.startScrollX || 0))
          : 0;
      const scrollDeltaY =
        typeof window !== "undefined"
          ? Math.abs(window.scrollY - (pState.startScrollY || 0))
          : 0;

      if (isTouch && pState.hasDragged) {
        return;
      }
      if (isTouch && (scrollDeltaX > 2 || scrollDeltaY > 2)) {
        return;
      }

      if (
        down.globalCol !== cell.globalCol ||
        down.globalRow !== cell.globalRow
      ) {
        return;
      }

      if (
        isTouch &&
        isTouchSelection &&
        (selectedBuildingId || carried || previewOrigin)
      ) {
        return;
      }

      handleCellClick(cell.globalCol, cell.globalRow);
    },
    [
      resetDrawPlacement,
      carried,
      handleCellClick,
      isShopOpen,
      isTouchSelection,
      previewOrigin,
      resolveCellFromClient,
      selectedBuildingId,
    ],
  );

  const handlePointerCancel = useCallback(() => {
    pointerDownCellRef.current = null;
    pointerStateRef.current.hasDragged = true;
    pointerStateRef.current.handledMouseBuildOnDown = false;
    resetDrawPlacement();
    resetToolDrag();
  }, [resetDrawPlacement, resetToolDrag]);

  useEffect(() => {
    const handleWindowPointerUp = (event) => {
      if (isShopOpen) return;
      if (event.pointerType !== "mouse" || event.button !== 0) return;

      if (pointerStateRef.current.handledMouseBuildOnDown) {
        pointerStateRef.current.handledMouseBuildOnDown = false;
        resetDrawPlacement();
        resetToolDrag();
        return;
      }

      const wrapperNode = wrapperRef.current;
      const svgNode = svgRef.current;
      if (!wrapperNode || !svgNode) return;

      const target = event.target;
      if (target instanceof Node && svgNode.contains(target)) {
        return;
      }

      const wrapperRect = wrapperNode.getBoundingClientRect();
      if (
        event.clientX < wrapperRect.left ||
        event.clientX > wrapperRect.right ||
        event.clientY < wrapperRect.top ||
        event.clientY > wrapperRect.bottom
      ) {
        return;
      }

      const cell = resolveCellFromClient(event.clientX, event.clientY, {
        clampToBoard: true,
      });
      if (!cell) return;

      pointerDownCellRef.current = null;
      handleCellClick(cell.globalCol, cell.globalRow);
    };

    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [
    handleCellClick,
    isShopOpen,
    resetDrawPlacement,
    resetToolDrag,
    resolveCellFromClient,
  ]);

  const handleDragOver = useCallback(
    (event) => {
      if (isShopOpen) return;
      event.preventDefault();
      const cell = resolveCellFromClient(event.clientX, event.clientY, {
        clampToBoard: true,
      });
      if (!cell) return;
      setHoverCell({ x: cell.globalCol, y: cell.globalRow });
    },
    [isShopOpen, resolveCellFromClient, setHoverCell],
  );

  const handleDrop = useCallback(
    (event) => {
      if (isShopOpen) return;
      event.preventDefault();
      const cell = resolveCellFromClient(event.clientX, event.clientY);
      if (!cell) return;
      handleCellClick(cell.globalCol, cell.globalRow);
      onDropComplete?.();
    },
    [handleCellClick, isShopOpen, onDropComplete, resolveCellFromClient],
  );

  const assignBoardRef = useCallback(
    (node) => {
      svgRef.current = node;
      if (!boardRef) return;
      if (typeof boardRef === "function") {
        boardRef(node);
        return;
      }
      boardRef.current = node;
    },
    [boardRef],
  );

  const stopTouchActionEvent = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleTouchConfirm = useCallback(
    (event) => {
      stopTouchActionEvent(event);
      if (isShopOpen) return;
      if (!previewOrigin) return;

      const result = handleCellClick(previewOrigin.x, previewOrigin.y);

      if (selectedBuildingId) {
        if (result?.ok) {
          setIsTouchSelection(false);
        }
        return;
      }

      if (carried && result?.ok && result?.done) {
        setIsTouchSelection(false);
      }
    },
    [
      carried,
      handleCellClick,
      isShopOpen,
      onDropComplete,
      previewOrigin,
      selectedBuildingId,
      stopTouchActionEvent,
    ],
  );

  const handleTouchCancel = useCallback(
    (event) => {
      stopTouchActionEvent(event);
      setIsTouchSelection(false);
      onCancelAction?.();
    },
    [onCancelAction, stopTouchActionEvent],
  );

  if (!Number.isFinite(viewColStart) || !Number.isFinite(viewRowStart)) {
    return null;
  }

  return (
    <div className="board-wrapper" ref={wrapperRef}>
      <div
        className={`board-transform-box ${boardTransformClass || ""}`.trim()}
        style={{
          width: `${svgWidthPx}px`,
          height: `${svgHeightPx}px`,
        }}
      >
        <div className="board-frame">
          <svg
            ref={assignBoardRef}
            className="board-svg"
            width={svgWidthPx}
            height={svgHeightPx}
            style={{ touchAction: isPreviewDragActive ? "none" : "auto" }}
            data-view-cols={safeCols}
            data-view-rows={safeRows}
            data-view-col-start={viewColStart}
            data-view-row-start={viewRowStart}
            data-cell-size={safeCellSize}
            data-edge-buffer={edgeBufferPx}
            viewBox={`0 0 ${svgWidthPx} ${svgHeightPx}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Board"
          >
            <g transform={`translate(${edgeBufferPx} ${edgeBufferPx})`}>
              <g transform={svgBoardTransform}>
                <g ref={boardSpaceRef}>
                  <defs>
                    {unlockedRegionBoundaryPath ? (
                      <clipPath
                        id={unlockedClipId}
                        clipPathUnits="userSpaceOnUse"
                      >
                        <path
                          d={unlockedRegionBoundaryPath}
                          fillRule="evenodd"
                          clipRule="evenodd"
                        />
                      </clipPath>
                    ) : null}
                  </defs>

                  <g data-layer="background-grid" pointerEvents="none">
                    <rect
                      x="0"
                      y="0"
                      width={boardWidthPx}
                      height={boardHeightPx}
                      fill={themeColors.boardBg}
                    />

                    {unlockedGridPath ? (
                      <path
                        d={unlockedGridPath}
                        fill="none"
                        stroke={themeColors.boardBorder}
                        strokeWidth={gridStrokeWidth}
                        opacity="0.96"
                        clipPath={
                          unlockedRegionBoundaryPath
                            ? `url(#${unlockedClipId})`
                            : undefined
                        }
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}

                    {voidRegions.map((region) => (
                      <rect
                        key={`void-${region.idx}`}
                        x={region.x}
                        y={region.y}
                        width={region.width}
                        height={region.height}
                        fill={themeColors.pageBg}
                      />
                    ))}
                  </g>

                  <rect
                    x="0"
                    y="0"
                    width={boardWidthPx}
                    height={boardHeightPx}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onPointerLeave={() => {
                      pointerDownCellRef.current = null;
                    }}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <title>Board</title>
                  </rect>

                  <g data-layer="regions" pointerEvents="none">
                    {unlockedRegionBoundaryPath ? (
                      <path
                        d={unlockedRegionBoundaryPath}
                        fill="rgba(33, 74, 118, 0.16)"
                        stroke="rgba(33, 74, 118, 0.85)"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        strokeWidth={regionStrokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}

                    {visibleRegions
                      .filter(
                        (region) =>
                          !region.isVoid &&
                          (!region.unlocked || region.isDebugLockable),
                      )
                      .map((region) => {
                        let fill = "transparent";
                        let stroke = "transparent";
                        const regionRadius = cornerRadiusPx;
                        const isHoveredUnlockable =
                          hoveredRegionIdx === region.idx &&
                          !region.unlocked &&
                          (region.clickable || region.isDebugUnlockable);

                        if (region.isDebugUnlockable) {
                          fill =
                            hoveredRegionIdx === region.idx
                              ? "rgba(0, 255, 0, 0.35)"
                              : "rgba(0, 255, 0, 0.18)";
                          stroke = "rgba(0, 255, 0, 0.5)";
                        } else if (region.isDebugLockable) {
                          fill =
                            hoveredRegionIdx === region.idx
                              ? "rgba(255, 0, 0, 0.35)"
                              : "rgba(255, 0, 0, 0.18)";
                          stroke = "rgba(255, 0, 0, 0.5)";
                        } else if (region.isNeighbor) {
                          fill =
                            hoveredRegionIdx === region.idx
                              ? "rgba(37, 83, 147, 0.5)"
                              : "rgba(37, 83, 147, 0.35)";
                          stroke =
                            hoveredRegionIdx === region.idx
                              ? themeColors.selectionBlueBorder
                              : themeColors.accent;
                        } else {
                          fill = "rgba(27, 48, 74, 0.75)";
                          stroke = "rgba(100, 120, 150, 0.45)";
                        }

                        return (
                          <rect
                            key={`region-${region.idx}`}
                            x={region.x}
                            y={region.y}
                            width={region.width}
                            height={region.height}
                            rx={regionRadius}
                            ry={regionRadius}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={
                              isHoveredUnlockable
                                ? regionStrokeWidth * 1.8
                                : regionStrokeWidth
                            }
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}
                  </g>

                  <g data-layer="buildings" pointerEvents="none">
                    {(layout || []).map((b) => {
                      const def = libraryMap?.[b.defId] || {};
                      const label = getBuildingName(def, lang, "short");

                      const baseColor =
                        categoryColors?.[def.category] || "#ffffff";
                      const hueShift =
                        (def.category === "production"
                          ? HUE_SHIFT_PRODUCTION[def.tier]
                          : TIER_HUE_SHIFT[def.tier]) ??
                        TIER_HUE_SHIFT[1] ??
                        0;

                      const tinted = tintColor(baseColor, 0.28, 1, hueShift);
                      const x = (b.x - viewColStart) * safeCellSize;
                      const y = (b.y - viewRowStart) * safeCellSize;
                      const width = b.width * safeCellSize;
                      const height = b.height * safeCellSize;
                      const cx = x + width / 2;
                      const cy = y + height / 2;
                      const locked = !!buildLocks[b.id];
                      const ready = !!readyMap[b.id];
                      const isHighlighted = highlightedIds?.has?.(b.id);
                      const boostState = boostMode
                        ? getBoostInteractionState({
                            def,
                            locked,
                            ready,
                            shards: resources?.shards ?? 0,
                            config,
                            infiniteResources,
                          })
                        : null;
                      const labelColor = isHighlighted
                        ? themeColors.white
                        : boostMode
                          ? ready
                            ? "#ffeb3b"
                            : boostState?.impossible
                              ? "rgba(255, 255, 255, 0.45)"
                              : boostState?.overLimit
                                ? PRIMARY_COLORS.red
                                : themeColors.white
                          : locked
                            ? ready
                              ? "#ffeb3b"
                              : "#9aa3b5"
                            : ready
                              ? "#ffeb3b"
                              : themeColors.white;

                      return (
                        <g key={`building-${b.id}`} opacity={locked ? 0.5 : 1}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            rx={cornerRadiusPx}
                            ry={cornerRadiusPx}
                            fill={tinted.background}
                            stroke={tinted.border}
                            strokeWidth={buildingStrokeWidth}
                            vectorEffect="non-scaling-stroke"
                          >
                            <title>{getBuildingName(def, lang, "name")}</title>
                          </rect>
                          {Array.from({ length: Math.max(0, b.width - 1) }).map(
                            (_, idx) => {
                              const xx = x + safeCellSize * (idx + 1);
                              return (
                                <line
                                  key={`bgrid-v-${b.id}-${idx}`}
                                  x1={round2(xx)}
                                  y1={round2(y)}
                                  x2={round2(xx)}
                                  y2={round2(y + height)}
                                  stroke={themeColors.boardBorder}
                                  strokeWidth={buildingInnerStrokeWidth}
                                  strokeOpacity="0.3"
                                  vectorEffect="non-scaling-stroke"
                                />
                              );
                            },
                          )}
                          {Array.from({
                            length: Math.max(0, b.height - 1),
                          }).map((_, idx) => {
                            const yy = y + safeCellSize * (idx + 1);
                            return (
                              <line
                                key={`bgrid-h-${b.id}-${idx}`}
                                x1={round2(x)}
                                y1={round2(yy)}
                                x2={round2(x + width)}
                                y2={round2(yy)}
                                stroke={themeColors.boardBorder}
                                strokeWidth={buildingInnerStrokeWidth}
                                strokeOpacity="0.3"
                                vectorEffect="non-scaling-stroke"
                              />
                            );
                          })}
                          <text
                            x={cx}
                            y={cy}
                            fill={labelColor}
                            fontSize={buildingLabelFontSize}
                            fontFamily={SVG_TEXT_STACK}
                            fontWeight={buildingLabelFontWeight}
                            textAnchor="middle"
                            dominantBaseline="central"
                            transform={`rotate(${labelCounterRotation} ${cx} ${cy})`}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </g>

                  <g data-layer="building-highlight" pointerEvents="none">
                    {(layout || [])
                      .filter((b) => highlightedIds?.has?.(b.id))
                      .map((b) => {
                        const x = (b.x - viewColStart) * safeCellSize;
                        const y = (b.y - viewRowStart) * safeCellSize;
                        const width = b.width * safeCellSize;
                        const height = b.height * safeCellSize;
                        return (
                          <rect
                            key={`selected-${b.id}`}
                            x={x + buildingStrokeWidth * 0.5}
                            y={y + buildingStrokeWidth * 0.5}
                            width={Math.max(0, width - buildingStrokeWidth)}
                            height={Math.max(0, height - buildingStrokeWidth)}
                            rx={cornerRadiusPx}
                            ry={cornerRadiusPx}
                            fill="none"
                            stroke="rgba(255, 86, 86, 0.9)"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}
                  </g>

                  <g data-layer="drag-ghost" pointerEvents="none">
                    {previewRect ? (
                      <g>
                        <rect
                          x={previewRect.x}
                          y={previewRect.y}
                          width={previewRect.width}
                          height={previewRect.height}
                          rx={cornerRadiusPx}
                          ry={cornerRadiusPx}
                          fill="rgba(116, 176, 255, 0.15)"
                          stroke={themeColors.selectionBlue}
                          strokeWidth={1.8}
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={`${Math.max(4, safeCellSize * 0.3)} ${Math.max(
                            3,
                            safeCellSize * 0.2,
                          )}`}
                        />
                      </g>
                    ) : null}
                  </g>

                  <g data-layer="region-interactions">
                    {!regionInteractionsDisabled &&
                      visibleRegions
                        .filter((region) => region.clickable)
                        .map((region) => (
                          <rect
                            key={`region-hit-${region.idx}`}
                            x={region.x}
                            y={region.y}
                            width={region.width}
                            height={region.height}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onPointerEnter={() =>
                              setHoveredRegionIdx(region.idx)
                            }
                            onPointerLeave={() => setHoveredRegionIdx(null)}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRegionClick(region);
                            }}
                          >
                            <title>
                              {adminMode
                                ? region.isDebugUnlockable
                                  ? "Debug: Unlock for free"
                                  : region.isDebugLockable
                                    ? "Debug: Lock again"
                                    : region.isBase
                                      ? "Base region (cannot lock)"
                                      : region.unlocked
                                        ? "Unlocked"
                                        : "Locked"
                                : region.unlocked
                                  ? "Unlocked region"
                                  : region.isNeighbor
                                    ? "Click to unlock region"
                                    : "Locked region (not adjacent)"}
                            </title>
                          </rect>
                        ))}
                  </g>

                  {helpMode ? (
                    <g data-layer="help-interactions">
                      {helpTownhallRects.map((rect) => (
                        <rect
                          key={`help-townhall-${rect.id}`}
                          x={rect.x}
                          y={rect.y}
                          width={rect.width}
                          height={rect.height}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          data-help-id="board-townhall"
                        />
                      ))}
                      {helpUnlockableRegions.map((region) => (
                        <rect
                          key={`help-region-unlockable-${region.idx}`}
                          x={region.x}
                          y={region.y}
                          width={region.width}
                          height={region.height}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          data-help-id={`board-region-unlockable-${region.idx}`}
                        />
                      ))}
                      {helpLockedRegions.map((region) => (
                        <rect
                          key={`help-region-locked-${region.idx}`}
                          x={region.x}
                          y={region.y}
                          width={region.width}
                          height={region.height}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          data-help-id={`board-region-locked-${region.idx}`}
                        />
                      ))}
                    </g>
                  ) : null}

                  {previewRect && touchActionButtons && touchActionAnchor ? (
                    <g
                      data-layer="touch-actions"
                      transform={`rotate(${labelCounterRotation} ${touchActionAnchor.x} ${touchActionAnchor.y})`}
                    >
                      <g
                        className="touch-action-button touch-action-button--confirm"
                        transform={`translate(${touchActionButtons.confirm.x} ${touchActionButtons.confirm.y})`}
                        onPointerDown={stopTouchActionEvent}
                        onClick={handleTouchConfirm}
                        pointerEvents="auto"
                      >
                        <circle
                          className="touch-action-button__bg"
                          r={touchActionButtons.radius}
                          fill="#33a852"
                          stroke="#ffffff"
                          strokeWidth={touchActionButtons.strokeWidth}
                        />
                        <Check
                          className="touch-action-button__icon"
                          x={-touchActionButtons.iconSize / 2}
                          y={-touchActionButtons.iconSize / 2}
                          width={touchActionButtons.iconSize}
                          height={touchActionButtons.iconSize}
                          color="#ffffff"
                          strokeWidth={2.75}
                          pointerEvents="none"
                        />
                      </g>
                      <g
                        className="touch-action-button touch-action-button--cancel"
                        transform={`translate(${touchActionButtons.cancel.x} ${touchActionButtons.cancel.y})`}
                        onPointerDown={stopTouchActionEvent}
                        onClick={handleTouchCancel}
                        pointerEvents="auto"
                      >
                        <circle
                          className="touch-action-button__bg"
                          r={touchActionButtons.radius}
                          fill="#d64545"
                          stroke="#ffffff"
                          strokeWidth={touchActionButtons.strokeWidth}
                        />
                        <X
                          className="touch-action-button__icon"
                          x={-touchActionButtons.iconSize / 2}
                          y={-touchActionButtons.iconSize / 2}
                          width={touchActionButtons.iconSize}
                          height={touchActionButtons.iconSize}
                          color="#ffffff"
                          strokeWidth={2.75}
                          pointerEvents="none"
                        />
                      </g>
                    </g>
                  ) : null}
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default Board;
