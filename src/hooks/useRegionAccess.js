import { useMemo } from "react";
import {
  REGION_GOODS_COSTS,
  REGION_SHARD_COSTS,
  REGION_COLS,
  REGION_ROWS,
  REGION_MASK,
  GOODS_TYPES,
} from "../config/boardConfig";
import { canAffordSingleGood } from "../utils/stateUtils";

/**
 * Derive region unlock helpers and costs.
 */
export function useRegionAccess({
  unlockedRegions,
  goodsUnlocks,
  shardUnlocks,
  resources,
  layout,
  libraryMap,
  allowNegativeShards = false,
}) {
  const isInfinityCost = (value) =>
    value === "Infinity" ||
    value === Infinity ||
    value === Number.POSITIVE_INFINITY;
  const currentGoodsCost = useMemo(
    () =>
      REGION_GOODS_COSTS[
        Math.min(goodsUnlocks, REGION_GOODS_COSTS.length - 1)
      ],
    [goodsUnlocks]
  );
  const currentShardCost = useMemo(
    () =>
      REGION_SHARD_COSTS[
        Math.min(shardUnlocks, REGION_SHARD_COSTS.length - 1)
      ],
    [shardUnlocks]
  );

  const neighborUnlocked = useMemo(
    () => (idx) => {
      const row = Math.floor(idx / REGION_COLS);
      const col = idx % REGION_COLS;
      if (REGION_MASK[row][col] === "N") return false;
      const neighbors = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];
      return neighbors.some(
        ([r, c]) =>
          r >= 0 &&
          c >= 0 &&
          r < REGION_ROWS &&
          c < REGION_COLS &&
          unlockedRegions[r * REGION_COLS + c]
      );
    },
    [unlockedRegions]
  );

  const hasAnyGoodsProducer = useMemo(
    () => layout.some((inst) => libraryMap[inst.defId]?.category === "goods"),
    [layout, libraryMap]
  );

  const hasAnyGoodsEnough = useMemo(
    () =>
      GOODS_TYPES.some((g) =>
        canAffordSingleGood(resources.goods, g, currentGoodsCost)
      ),
    [resources.goods, currentGoodsCost]
  );

  const canAnyUnlock = useMemo(
    () =>
      (!isInfinityCost(currentShardCost) &&
        (allowNegativeShards ||
          (resources.shards ?? 0) >= currentShardCost)) ||
      hasAnyGoodsProducer ||
      hasAnyGoodsEnough,
    [
      resources.shards,
      currentShardCost,
      hasAnyGoodsProducer,
      hasAnyGoodsEnough,
      allowNegativeShards,
    ]
  );

  return {
    currentGoodsCost,
    currentShardCost,
    neighborUnlocked,
    hasAnyGoodsProducer,
    hasAnyGoodsEnough,
    canAnyUnlock,
  };
}
