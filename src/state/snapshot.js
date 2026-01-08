import { serializeState } from "../utils/stateUtils";

export const buildSnapshot = (state) =>
  serializeState({
    resources: state.resources,
    layout: state.layout,
    unlockedRegions: state.unlockedRegions,
    goodsUnlocks: state.goodsUnlocks,
    shardUnlocks: state.shardUnlocks,
    nextId: state.nextId,
    readyMap: state.readyMap,
    buildLocks: state.buildLocks,
    moveMode: state.moveMode,
    sellMode: state.sellMode,
    refundMode: state.refundMode,
    boostMode: state.boostMode,
    selectedCategory: state.selectedCategory,
    notes: state.notes,
    selectedIds: Array.from(state.selectedIds ?? []),
    timeStep: state.timeStep,
    loadName: state.loadName,
    selectedBuildingId: state.selectedBuildingId,
  });

export const applySnapshot = (snapshot, setters) => {
  const {
    setResources,
    setLayout,
    setUnlockedRegions,
    setGoodsUnlocks,
    setShardUnlocks,
    setReadyMap,
    setBoostMode,
    setMoveMode,
    setSellMode,
    setRefundMode,
    setSelectedCategory,
    setTimeStep,
    setNotes,
    setBuildLocks,
    setSelectedIds,
    setSelectedBuildingId,
    setLoadName,
    nextIdRef,
    townhallDef,
  } = setters;

  setResources(snapshot.resources);
  setLayout(snapshot.layout);
  setUnlockedRegions(snapshot.unlockedRegions);
  if (snapshot.goodsUnlocks !== undefined)
    setGoodsUnlocks(snapshot.goodsUnlocks);
  if (snapshot.shardUnlocks !== undefined)
    setShardUnlocks(snapshot.shardUnlocks);
  if (snapshot.nextId !== undefined && nextIdRef)
    nextIdRef.current = snapshot.nextId;
  if (snapshot.readyMap) setReadyMap(snapshot.readyMap);
  if (setMoveMode) setMoveMode(!!snapshot.moveMode);
  if (setSellMode) setSellMode(!!snapshot.sellMode);
  if (setRefundMode) setRefundMode(!!snapshot.refundMode);
  if (setBoostMode) setBoostMode(!!snapshot.boostMode);
  if (snapshot.selectedCategory) setSelectedCategory(snapshot.selectedCategory);
  if (setNotes && snapshot.notes !== undefined) setNotes(snapshot.notes ?? "");
  if (setTimeStep && snapshot.timeStep !== undefined) {
    setTimeStep(snapshot.timeStep ?? 1);
  }
  if (setLoadName && snapshot.loadName !== undefined) {
    setLoadName(snapshot.loadName ?? "");
  }
  if (setBuildLocks) {
    setBuildLocks(snapshot.buildLocks ?? {});
  }
  if (setSelectedIds) {
    const incoming = snapshot.selectedIds ?? [];
    setSelectedIds(new Set(incoming));
  }
  if (setSelectedBuildingId !== undefined) {
    setSelectedBuildingId(snapshot.selectedBuildingId ?? null);
  }
  if (
    townhallDef &&
    !snapshot.layout?.some((l) => l.defId === townhallDef.defId)
  ) {
    setLayout((prev) => [
      ...prev,
      {
        id: nextIdRef?.current ? nextIdRef.current++ : 0,
        defId: townhallDef.defId,
        x: 8,
        y: 4,
        width: townhallDef.width,
        height: townhallDef.height,
      },
    ]);
  }
};
