import {
  REGION_SIZE,
  REGION_COLS,
  REGION_ROWS,
  REGION_MASK,
  GOODS_TYPES,
  REGION_GOODS_COSTS,
  REGION_SHARD_COSTS,
} from "../../config/boardConfig";
import { computePurchasePlans } from "../../utils/gameMath";
import { canAffordSingleGood } from "../../utils/stateUtils";

export const regionIndexForCell = (x, y) =>
  Math.floor(x / REGION_SIZE) + REGION_COLS * Math.floor(y / REGION_SIZE);

export const isCellUnlocked = (x, y, unlockedRegions) => {
  const idx = regionIndexForCell(x, y);
  const col = idx % REGION_COLS;
  const row = Math.floor(idx / REGION_COLS);
  if (REGION_MASK[row][col] === "N") return false;
  return unlockedRegions[idx];
};

export const buildUnlockChoiceState = ({
  idx,
  resources,
  layout,
  libraryMap,
  currentGoodsCost,
  currentShardCost,
  allowNegativeShards = false,
  adminMode = false,
}) => {
  const isInfinityCost = (value) =>
    value === "Infinity" ||
    value === Infinity ||
    value === Number.POSITIVE_INFINITY;
  const hasAnyGoodEnough = GOODS_TYPES.some((g) =>
    canAffordSingleGood(resources.goods, g, currentGoodsCost)
  );
  const hasGoodsBuilding = layout.some(
    (inst) => libraryMap[inst.defId]?.category === "goods"
  );
  const shardsEnough = (resources.shards ?? 0) >= currentShardCost;
  const goodsAllowed = adminMode
    ? !isInfinityCost(currentGoodsCost)
    : hasAnyGoodEnough || hasGoodsBuilding;
  const shardsAllowed = adminMode
    ? !isInfinityCost(currentShardCost)
    : !isInfinityCost(currentShardCost) &&
      (allowNegativeShards || shardsEnough);
  return {
    idx,
    mode: "unlock",
    adminMode: !!adminMode,
    goodsCost: currentGoodsCost,
    shardCost: currentShardCost,
    allowGoods: goodsAllowed,
    allowShards: shardsAllowed,
  };
};

export const buildLockChoiceState = ({
  idx,
  goodsUnlocks = 0,
  shardUnlocks = 0,
}) => {
  const maxGoodsIdx = Math.max(0, REGION_GOODS_COSTS.length - 1);
  const maxShardIdx = Math.max(0, REGION_SHARD_COSTS.length - 1);
  const currentGoodsIdx = Math.min(Math.max(goodsUnlocks ?? 0, 0), maxGoodsIdx);
  const currentShardIdx = Math.min(Math.max(shardUnlocks ?? 0, 0), maxShardIdx);

  return {
    idx,
    mode: "lock",
    adminMode: true,
    goodsCost: REGION_GOODS_COSTS[currentGoodsIdx],
    shardCost: REGION_SHARD_COSTS[currentShardIdx],
    nextGoodsCost:
      currentGoodsIdx > 0 ? REGION_GOODS_COSTS[currentGoodsIdx - 1] : null,
    nextShardCost:
      currentShardIdx > 0 ? REGION_SHARD_COSTS[currentShardIdx - 1] : null,
    allowGoods: currentGoodsIdx > 0,
    allowShards: currentShardIdx > 0,
  };
};

export const prepareFastBuyModal = ({
  goodKey,
  resources,
  layout,
  libraryMap,
  currentGoodsCost,
}) => {
  const need = currentGoodsCost - (resources.goods[goodKey] ?? 0);
  const candidateInstance = layout.find(
    (inst) =>
      libraryMap[inst.defId]?.category === "goods" &&
      libraryMap[inst.defId]?.produces === goodKey
  );
  if (!candidateInstance) return null;
  const buildingDef = libraryMap[candidateInstance.defId];
  const options = computePurchasePlans(buildingDef, need);
  if (!options.length) return null;
  return { options, buildingDef, need };
};

export const regionCoords = (unlockedRegions) =>
  unlockedRegions
    .map((flag, idx) =>
      flag
        ? { row: Math.floor(idx / REGION_COLS), col: idx % REGION_COLS }
        : null
    )
    .filter(Boolean);
