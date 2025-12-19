import {
  REGION_SIZE,
  REGION_COLS,
  REGION_ROWS,
  REGION_MASK,
  GOODS_TYPES,
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
}) => {
  const hasAnyGoodEnough = GOODS_TYPES.some((g) =>
    canAffordSingleGood(resources.goods, g, currentGoodsCost)
  );
  const hasGoodsBuilding = layout.some(
    (inst) => libraryMap[inst.defId]?.category === "goods"
  );
  return {
    idx,
    goodsCost: currentGoodsCost,
    shardCost: currentShardCost,
    allowGoods: hasAnyGoodEnough || hasGoodsBuilding,
    allowShards: (resources.shards ?? 0) >= currentShardCost,
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
