import { BOARD_WIDTH, BOARD_HEIGHT } from "../../config/boardConfig";
import {
  findInstanceAt,
  findOverlap,
  isAreaFree,
} from "../../utils/layoutUtils";
import { computeRefund } from "../../utils/gameMath";
import { hasPopulationForDef } from "../../utils/stateUtils";

export const clampPosition = (x, y, def) => ({
  x: Math.min(x, BOARD_WIDTH - def.width),
  y: Math.min(y, BOARD_HEIGHT - def.height),
});

export const dropCarried = ({
  carried,
  x,
  y,
  layout,
  libraryMap,
  isCellUnlocked,
  moveSnapshot,
  buildSnapshot,
  setLayout,
  setCarried,
  setReadyMap,
  pushHistory,
  setMoveSnapshot,
  setMoveMode,
  updateStatus,
}) => {
  if (!carried) return;
  const def = carried.def;
  const placeX = Math.min(x, BOARD_WIDTH - def.width);
  const placeY = Math.min(y, BOARD_HEIGHT - def.height);
  const overlap = findOverlap(
    layout,
    placeX,
    placeY,
    def.width,
    def.height,
    carried.instance.id
  );
  const areaOk = isAreaFree(
    layout,
    placeX,
    placeY,
    def.width,
    def.height,
    overlap?.id,
    isCellUnlocked
  );
  if (!areaOk) {
    updateStatus("Cannot place here.");
    return;
  }

  if (overlap) {
    setLayout((prev) => {
      const filtered = prev.filter((p) => p.id !== overlap.id);
      const placed = {
        ...carried.instance,
        x: placeX,
        y: placeY,
        width: def.width,
        height: def.height,
      };
      return [...filtered, placed];
    });
    setCarried({
      instance: { ...overlap },
      def: libraryMap[overlap.defId],
    });
    setReadyMap((prev) => ({
      ...prev,
      [carried.instance.id]:
        carried.instance.ready ?? prev[carried.instance.id] ?? false,
      [overlap.id]: prev[overlap.id] ?? false,
    }));
  } else {
    const snapshot = moveSnapshot ?? buildSnapshot();
    setLayout((prev) => [
      ...prev,
      {
        ...carried.instance,
        x: placeX,
        y: placeY,
        width: def.width,
        height: def.height,
      },
    ]);
    setReadyMap((prev) => ({
      ...prev,
      [carried.instance.id]:
        carried.instance.ready ?? prev[carried.instance.id] ?? false,
    }));
    pushHistory(snapshot);
    setCarried(null);
    setMoveSnapshot(null);
    // Stay in Move mode until user toggles it off or selects another mode.
  }
};

export const handleSaleOrRefund = ({
  target,
  refundMode,
  libraryMap,
  readyMap,
  buildSnapshot,
  pushHistory,
  harvestBuildings,
  refundResources,
  setLayout,
  setReadyMap,
  updateStatus,
}) => {
  const snapshot = buildSnapshot();
  pushHistory(snapshot);
  const delta =
    refundMode && target.cost
      ? target.cost
      : computeRefund(libraryMap[target.defId]);
  if (readyMap[target.id]) {
    harvestBuildings([target], "Harvest", true, true);
  }
  refundResources(delta);
  setLayout((prev) => prev.filter((p) => p.id !== target.id));
  setReadyMap((prev) => {
    const next = { ...prev };
    delete next[target.id];
    return next;
  });
  updateStatus(
    `${refundMode ? "Refunded" : "Sold"} ${libraryMap[target.defId].name}`
  );
};

export const canPlaceDef = ({
  selectedDef,
  layout,
  x,
  y,
  resources,
  stats,
  isCellUnlocked,
}) => {
  if (!selectedDef) return { ok: false, reason: "" };
  if (!hasPopulationForDef(stats, selectedDef)) {
    return { ok: false, reason: "Not enough free population." };
  }
  const adjustedX = Math.min(x, BOARD_WIDTH - selectedDef.width);
  const adjustedY = Math.min(y, BOARD_HEIGHT - selectedDef.height);
  if (
    !isAreaFree(
      layout,
      adjustedX,
      adjustedY,
      selectedDef.width,
      selectedDef.height,
      undefined,
      isCellUnlocked
    )
  ) {
    return { ok: false, reason: "Blocked or locked area." };
  }
  return { ok: true, x: adjustedX, y: adjustedY };
};

export const buildPreviewOrigin = (hoverCell, previewDef, categoryColors) => {
  if (!hoverCell || !previewDef) return null;
  return {
    x: Math.min(hoverCell.x, BOARD_WIDTH - previewDef.width),
    y: Math.min(hoverCell.y, BOARD_HEIGHT - previewDef.height),
    width: previewDef.width,
    height: previewDef.height,
    color: categoryColors[previewDef.category],
  };
};

export const findTargetInstance = (layout, x, y) =>
  findInstanceAt(layout, x, y);
