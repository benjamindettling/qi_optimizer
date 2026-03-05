import { useCallback } from "react";
import {
  REGION_COLS,
  REGION_MASK,
  REGION_SIZE,
  REGION_GOODS_COSTS,
  REGION_SHARD_COSTS,
} from "../../config/boardConfig";
import { useRegionAccess } from "../useRegionAccess";
import { canAffordSingleGood } from "../../utils/stateUtils";
import { formatNumber } from "../../utils/formatNumber";
import {
  buildUnlockChoiceState,
  buildLockChoiceState,
  prepareFastBuyModal,
} from "../../domain/regions/regionController";
import {
  allowShardLimitOverflow,
  canPayShardCost,
  willShardCostExceedLimit,
} from "../../utils/shards";

// Region unlocks, debug tools, and related costs.
export const useRegionHandlers = ({
  unlockedRegions,
  goodsUnlocks,
  shardUnlocks,
  resources,
  layout,
  libraryMap,
  config,
  effectiveResources,
  infiniteResources,
  debugRegions,
  setUnlockedRegions,
  setGoodsUnlocks,
  setShardUnlocks,
  setResources,
  setUnlockChoice,
  setUnlockGoodSelect,
  setFastBuyModal,
  setFastBuyTarget,
  applyAdjustGoods,
  updateStatus,
  requestAutoSnapshot,
  editingLocked,
  recordHistoryAction,
}) => {
  const {
    currentGoodsCost,
    currentShardCost,
    neighborUnlocked,
    hasAnyGoodsProducer,
    hasAnyGoodsEnough,
    canAnyUnlock,
  } = useRegionAccess({
    unlockedRegions,
    goodsUnlocks,
    shardUnlocks,
    resources: effectiveResources,
    layout,
    libraryMap,
    config,
  });
  const allowOverflow = allowShardLimitOverflow(config);

  const handleSetGoodsUnlocks = useCallback(
    (nextIdx) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const idxRaw = Number(nextIdx);
      if (!Number.isFinite(idxRaw)) return;
      const maxIdx = REGION_GOODS_COSTS.length - 1;
      const prevIdx = Math.min(Math.max(goodsUnlocks ?? 0, 0), maxIdx);
      const clampedIdx = Math.min(Math.max(idxRaw, 0), maxIdx);
      if (clampedIdx === prevIdx) return;
      const prevCost = REGION_GOODS_COSTS[prevIdx];
      const nextCost = REGION_GOODS_COSTS[clampedIdx];
      setGoodsUnlocks(clampedIdx);
      if (infiniteResources) {
        recordHistoryAction?.({
          type: "goodsCostAdmin",
          prevIndex: prevIdx,
          nextIndex: clampedIdx,
          prevValue: prevCost,
          nextValue: nextCost,
        });
      }
      updateStatus(
        `naechste Region: ${formatNumber(prevCost)} -> ${formatNumber(
          nextCost,
        )} Güter`,
      );
      requestAutoSnapshot();
    },
    [
      editingLocked,
      goodsUnlocks,
      infiniteResources,
      recordHistoryAction,
      setGoodsUnlocks,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  const handleSetShardUnlocks = useCallback(
    (nextIdx) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const idxRaw = Number(nextIdx);
      if (!Number.isFinite(idxRaw)) return;
      const maxIdx = REGION_SHARD_COSTS.length - 1;
      const prevIdx = Math.min(Math.max(shardUnlocks ?? 0, 0), maxIdx);
      const clampedIdx = Math.min(Math.max(idxRaw, 0), maxIdx);
      if (clampedIdx === prevIdx) return;
      const prevCost = REGION_SHARD_COSTS[prevIdx];
      const nextCost = REGION_SHARD_COSTS[clampedIdx];
      setShardUnlocks(clampedIdx);
      if (infiniteResources) {
        recordHistoryAction?.({
          type: "shardsCostAdmin",
          prevIndex: prevIdx,
          nextIndex: clampedIdx,
          prevValue: prevCost,
          nextValue: nextCost,
        });
      }
      updateStatus(
        `naechste Region: ${formatNumber(prevCost)} -> ${formatNumber(
          nextCost,
        )} Scherben`,
      );
      requestAutoSnapshot();
    },
    [
      editingLocked,
      shardUnlocks,
      infiniteResources,
      recordHistoryAction,
      setShardUnlocks,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  const handleUnlockRegion = useCallback(
    (idx, method, goodKey) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const isInfinityCost = (value) =>
        value === "Infinity" ||
        value === Infinity ||
        value === Number.POSITIVE_INFINITY;
      const row = Math.floor(idx / REGION_COLS);
      const col = idx % REGION_COLS;
      if (REGION_MASK[row][col] === "N") return;
      if (!method) {
        const choice = buildUnlockChoiceState({
          idx,
          resources,
          layout,
          libraryMap,
          currentGoodsCost,
          currentShardCost,
          config,
          adminMode: !!infiniteResources,
        });
        setUnlockChoice(choice);
        setUnlockGoodSelect(null);
        return;
      }

      let didUnlock = false;

      if (method === "goods") {
        if (goodsUnlocks >= REGION_GOODS_COSTS.length) {
          updateStatus("Keine weiteren Güter-Erweiterungen verfügbar.");
          return;
        }
        if (!infiniteResources && !goodKey) {
          updateStatus("Bitte zuerst eine GÃ¼terart wÃ¤hlen.");
          return;
        }
        if (
          !infiniteResources &&
          !canAffordSingleGood(
            effectiveResources.goods,
            goodKey,
            currentGoodsCost,
          )
        ) {
          const fastBuy = prepareFastBuyModal({
            goodKey,
            resources: effectiveResources,
            layout,
            libraryMap,
            currentGoodsCost,
          });
          if (!fastBuy) {
            updateStatus("Need more goods of that type to unlock.");
            return;
          }
          setFastBuyModal({
            goodKey,
            goodsCost: currentGoodsCost,
            options: fastBuy.options,
            buildingDef: fastBuy.buildingDef,
          });
          setFastBuyTarget(idx);
          return;
        }
        const label = `Erweiterung gekauft für ${formatNumber(
          currentGoodsCost,
        )} Güter`;
        if (!infiniteResources) {
          applyAdjustGoods(goodKey, -currentGoodsCost);
        }
        setGoodsUnlocks((prev) =>
          Math.min(prev + 1, REGION_GOODS_COSTS.length - 1),
        );
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val)),
        );
        updateStatus(label);
        didUnlock = true;
      } else {
        if (isInfinityCost(currentShardCost)) {
          updateStatus("Keine weiteren Scherben-Erweiterungen verfügbar.");
          return;
        }
        if (
          !infiniteResources &&
          !canPayShardCost({
            shards: effectiveResources.shards ?? 0,
            cost: currentShardCost,
            config,
            infiniteResources,
          })
        ) {
          updateStatus("Need more shards to unlock.");
          return;
        }
        const label = `Erweiterung gekauft für ${formatNumber(
          currentShardCost,
        )} Scherben`;
        if (!infiniteResources) {
          setResources((prev) => ({
            ...prev,
            shards: prev.shards - currentShardCost,
          }));
        }
        setShardUnlocks((prev) => prev + 1);
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val)),
        );
        updateStatus(label);
        didUnlock = true;
      }
      setFastBuyTarget(null);
      setUnlockChoice(null);
      setUnlockGoodSelect(null);

      if (didUnlock) {
        recordHistoryAction?.({
          type: method === "goods" ? "regionUnlockGoods" : "regionUnlockShards",
          regionIdx: idx,
          goodKey: method === "goods" ? goodKey : undefined,
          admin: !!infiniteResources,
        });
        requestAutoSnapshot();
      }
    },
    [
      editingLocked,
      updateStatus,
      resources,
      layout,
      libraryMap,
      currentGoodsCost,
      currentShardCost,
      config,
      infiniteResources,
      effectiveResources,
      goodsUnlocks,
      setGoodsUnlocks,
      setUnlockedRegions,
      setUnlockChoice,
      setUnlockGoodSelect,
      setFastBuyModal,
      setFastBuyTarget,
      applyAdjustGoods,
      setResources,
      setShardUnlocks,
      requestAutoSnapshot,
      recordHistoryAction,
    ],
  );

  const regionRect = useCallback((idx) => {
    const row = Math.floor(idx / REGION_COLS);
    const col = idx % REGION_COLS;
    const x0 = col * REGION_SIZE;
    const y0 = row * REGION_SIZE;
    return {
      x0,
      y0,
      x1: x0 + REGION_SIZE - 1,
      y1: y0 + REGION_SIZE - 1,
    };
  }, []);

  const hasAnyBuildingInRegion = useCallback(
    (idx) => {
      const { x0, y0, x1, y1 } = regionRect(idx);
      return layout.some((inst) => {
        const ix0 = inst.x;
        const iy0 = inst.y;
        const ix1 = inst.x + inst.width - 1;
        const iy1 = inst.y + inst.height - 1;
        const overlaps = !(ix1 < x0 || ix0 > x1 || iy1 < y0 || iy0 > y1);
        return overlaps;
      });
    },
    [layout, regionRect],
  );

  const handleDebugUnlockRegion = useCallback(
    (idx) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!debugRegions) return;
      const row = Math.floor(idx / REGION_COLS);
      const col = idx % REGION_COLS;
      if (REGION_MASK[row][col] === "N") return;
      if (unlockedRegions[idx]) return;
      if (!neighborUnlocked(idx)) return;

      const choice = buildUnlockChoiceState({
        idx,
        resources,
        layout,
        libraryMap,
        currentGoodsCost,
        currentShardCost,
        config,
        adminMode: true,
      });
      setUnlockChoice(choice);
      setUnlockGoodSelect(null);
    },
    [
      currentGoodsCost,
      currentShardCost,
      config,
      debugRegions,
      layout,
      libraryMap,
      unlockedRegions,
      neighborUnlocked,
      editingLocked,
      resources,
      setUnlockChoice,
      setUnlockGoodSelect,
      updateStatus,
    ],
  );

  const handleDebugLockRegion = useCallback(
    (idx, isBase = false) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!debugRegions) return;
      if (isBase) return;
      if (!unlockedRegions[idx]) return;

      if (hasAnyBuildingInRegion(idx)) {
        updateStatus("Kann Region nicht entfernen, Gebäude stehen noch drauf.");
        return;
      }

      const choice = buildLockChoiceState({
        idx,
        goodsUnlocks,
        shardUnlocks,
      });
      setUnlockChoice(choice);
      setUnlockGoodSelect(null);
    },
    [
      debugRegions,
      goodsUnlocks,
      shardUnlocks,
      unlockedRegions,
      hasAnyBuildingInRegion,
      setUnlockChoice,
      setUnlockGoodSelect,
      updateStatus,
      editingLocked,
    ],
  );

  const handleAdminLockRegion = useCallback(
    (idx, method) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!debugRegions || !method) return;
      if (!unlockedRegions[idx]) return;

      const isGoods = method === "goods";
      const canReduce = isGoods ? goodsUnlocks > 0 : shardUnlocks > 0;
      if (!canReduce) {
        updateStatus("Kosten kÃ¶nnen nicht weiter gesenkt werden.");
        return;
      }

      setUnlockedRegions((prev) => {
        const next = [...prev];
        next[idx] = false;
        return next;
      });
      if (isGoods) {
        setGoodsUnlocks((prev) => Math.max(0, prev - 1));
      } else {
        setShardUnlocks((prev) => Math.max(0, prev - 1));
      }
      setUnlockChoice(null);
      setUnlockGoodSelect(null);
      updateStatus("Admin: -1 Region");
      recordHistoryAction?.({
        type: "regionLockAdmin",
        regionIdx: idx,
        method,
      });
      requestAutoSnapshot();
    },
    [
      debugRegions,
      editingLocked,
      goodsUnlocks,
      recordHistoryAction,
      requestAutoSnapshot,
      setGoodsUnlocks,
      setShardUnlocks,
      setUnlockChoice,
      setUnlockGoodSelect,
      setUnlockedRegions,
      shardUnlocks,
      unlockedRegions,
      updateStatus,
    ],
  );

  return {
    currentGoodsCost,
    currentShardCost,
    neighborUnlocked,
    hasAnyGoodsProducer,
    hasAnyGoodsEnough,
    canAnyUnlock,
    allowShardOverflow: allowOverflow,
    shardCostOverLimit: willShardCostExceedLimit({
      shards: effectiveResources.shards ?? 0,
      cost: currentShardCost,
    }),
    handleSetGoodsUnlocks,
    handleSetShardUnlocks,
    handleUnlockRegion,
    handleDebugUnlockRegion,
    handleDebugLockRegion,
    handleAdminLockRegion,
  };
};
