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
    moveMode: state.moveMode,
    sellMode: state.sellMode,
    refundMode: state.refundMode,
    selectedCategory: state.selectedCategory,
    notes: state.notes,
  });

export const applySnapshot = (snapshot, setters) => {
  const {
    setResources,
    setLayout,
    setUnlockedRegions,
    setGoodsUnlocks,
    setShardUnlocks,
    setReadyMap,
    setMoveMode,
    setSellMode,
    setRefundMode,
    setSelectedCategory,
    setNotes,
    nextIdRef,
    townhallDef,
  } = setters;

  setResources(snapshot.resources);
  setLayout(snapshot.layout);
  setUnlockedRegions(snapshot.unlockedRegions);
  if (snapshot.goodsUnlocks !== undefined) setGoodsUnlocks(snapshot.goodsUnlocks);
  if (snapshot.shardUnlocks !== undefined) setShardUnlocks(snapshot.shardUnlocks);
  if (snapshot.nextId !== undefined && nextIdRef) nextIdRef.current = snapshot.nextId;
  if (snapshot.readyMap) setReadyMap(snapshot.readyMap);
  if (snapshot.moveMode !== undefined) setMoveMode(snapshot.moveMode);
  if (snapshot.sellMode !== undefined) setSellMode(snapshot.sellMode);
  if (snapshot.refundMode !== undefined) setRefundMode(snapshot.refundMode);
  if (snapshot.selectedCategory) setSelectedCategory(snapshot.selectedCategory);
  if (setNotes && snapshot.notes !== undefined) setNotes(snapshot.notes ?? "");
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
