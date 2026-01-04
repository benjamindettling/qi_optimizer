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
  setLayout,
  setCarried,
  setReadyMap,
  setBuildLocks,
  buildLocks,
  setMoveMode,
  updateStatus,
}) => {
  if (!carried) return;
  const carriedSwapped = !!carried.swapped;
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
    // Mark that a swap occurred so the final placement can log accordingly.
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
      swapped: true,
    });
    setReadyMap((prev) => ({
      ...prev,
      [carried.instance.id]:
        carried.instance.ready ?? prev[carried.instance.id] ?? false,
      [overlap.id]: prev[overlap.id] ?? false,
    }));
    setBuildLocks((prev) => ({
      ...prev,
      [carried.instance.id]:
        carried.instance.locked ?? prev[carried.instance.id] ?? false,
      [overlap.id]: prev[overlap.id] ?? false,
    }));
  } else {
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
    setBuildLocks((prev) => ({
      ...prev,
      [carried.instance.id]:
        carried.instance.locked ?? prev[carried.instance.id] ?? false,
    }));
  const label = carriedSwapped
    ? "Swapped Buildings"
    : `Moved ${def?.name ?? "Gebaeude"}`;
  updateStatus(label);
  setCarried(null);
}
};

export const handleSaleOrRefund = ({
  target,
  refundMode,
  libraryMap,
  readyMap,
  harvestBuildings,
  refundResources,
  setLayout,
  setReadyMap,
  updateStatus,
}) => {
  const label = `${refundMode ? "Refunded" : "Sold"} ${
    libraryMap[target.defId]?.name ?? "Gebaeude"
  }`;
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
  updateStatus(label);
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
