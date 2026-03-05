import { REGION_GOODS_COSTS, REGION_SHARD_COSTS, GOODS_TYPES } from "../config/boardConfig";
import { DEFAULT_CONFIG, QA_BASE_PER_HOUR } from "../config/gameDefaults";
import { buildInitialGameState, buildLibrary } from "../config/initialState";
import {
  getBoostCostForTier,
  getUnlockCostForTier,
  isTierLocked,
} from "../config/buildingTiers";
import { computeSaleOrRefund } from "../domain/economy/resourceTransactions";
import {
  aggregateHarvest,
  computeBuildingHarvest,
  finishProductionsReadyMap,
} from "../domain/production/productionController";
import { computeStats } from "./stateUtils";
import { deserializeTree } from "./treeSerializer";
import { getShardLimit, normalizeConfigWithShardSettings } from "./shards";

export const DEFAULT_SAVE_CONFIG = {
  extraCoins: 0,
  extraSupplies: 0,
  goodsStartBonus: 0,
  troopsStartBonus: 0,
  shardsLimit: 500,
  coinBoost: 0,
  supplyBoost: 0,
};

export const SAVE_CONFIG_FIELDS = [
  "extraCoins",
  "extraSupplies",
  "goodsStartBonus",
  "troopsStartBonus",
  "shardsLimit",
  "coinBoost",
  "supplyBoost",
];

export const MIN_SAFE_SAVE_CONFIG_FIELDS = [
  "extraCoins",
  "extraSupplies",
  "goodsStartBonus",
];

export const SAVEFILE_SYNC_STATES = {
  impossible: "impossible",
  desynced: "desynced",
  synced: "synced",
};

const {
  libraryMap: BUILT_LIBRARY_MAP,
  shortIdMap: BUILT_SHORT_ID_MAP,
  townhallDef: BUILT_TOWNHALL_DEF,
} = buildLibrary();

const clampIndex = (value, max) =>
  Math.max(0, Math.min(max, Number(value) || 0));

const toNumber = (value) => (Number.isFinite(value) ? value : 0);

const isInfinityCost = (value) =>
  value === "Infinity" ||
  value === Infinity ||
  value === Number.POSITIVE_INFINITY;

const resolveCostIndex = (value, costList, fallbackIndex = 0) => {
  const maxIdx = (costList?.length ?? 1) - 1;
  if (!Array.isArray(costList) || maxIdx < 0) return clampIndex(fallbackIndex, 0);
  if (Number.isFinite(value)) {
    const idx = costList.findIndex((cost) => cost === value);
    if (idx >= 0) return clampIndex(idx, maxIdx);
  }
  if (isInfinityCost(value)) {
    const idx = costList.findIndex((cost) => isInfinityCost(cost));
    if (idx >= 0) return clampIndex(idx, maxIdx);
  }
  return clampIndex(fallbackIndex, maxIdx);
};

const normalizeMovePositions = (action) => {
  if (Array.isArray(action?.positions)) {
    return action.positions
      .filter(
        (p) =>
          Array.isArray(p) &&
          p.length >= 4 &&
          Number.isFinite(Number(p[0])) &&
          Number.isFinite(Number(p[1])) &&
          Number.isFinite(Number(p[2])) &&
          Number.isFinite(Number(p[3])),
      )
      .map((p) => [Number(p[0]), Number(p[1]), Number(p[2]), Number(p[3])]);
  }
  const xs = Array.isArray(action?.x) ? action.x : [];
  const ys = Array.isArray(action?.y) ? action.y : [];
  const xns = Array.isArray(action?.xn) ? action.xn : [];
  const yns = Array.isArray(action?.yn) ? action.yn : [];
  const positions = [];
  const count = Math.min(xs.length, ys.length, xns.length, yns.length);
  for (let i = 0; i < count; i += 1) {
    const fromX = Number(xs[i]);
    const fromY = Number(ys[i]);
    const toX = Number(xns[i]);
    const toY = Number(yns[i]);
    if (
      Number.isFinite(fromX) &&
      Number.isFinite(fromY) &&
      Number.isFinite(toX) &&
      Number.isFinite(toY)
    ) {
      positions.push([fromX, fromY, toX, toY]);
    }
  }
  return positions;
};

const normalizeQuantityMap = (mapLike) => {
  const next = {};
  if (!mapLike || typeof mapLike !== "object" || Array.isArray(mapLike)) {
    return next;
  }
  Object.entries(mapLike).forEach(([amountRaw, countRaw]) => {
    const amount = Number(amountRaw);
    const count = Number(countRaw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!Number.isFinite(count) || count <= 0) return;
    const amountKey = String(amount);
    next[amountKey] = (next[amountKey] ?? 0) + Math.floor(count);
  });
  return next;
};

const extractQuantityMapFromAction = (action) => {
  const fromMap = normalizeQuantityMap(action?.q);
  if (Object.keys(fromMap).length > 0) return fromMap;
  const amount = Number(action?.quantity ?? action?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return {};
  const rawCount = action?.cost ? 1 : Number(action?.count ?? 1);
  if (!Number.isFinite(rawCount) || rawCount <= 0) return {};
  return { [String(amount)]: Math.floor(rawCount) };
};

const producerMap = (() => {
  const goods = {};
  const units = {};
  Object.values(BUILT_LIBRARY_MAP || {}).forEach((def) => {
    if (!def?.produces) return;
    if (def.category === "goods") goods[def.produces] = def;
    if (def.category === "military") units[def.produces] = def;
  });
  return { goods, units };
})();

const extractSaveField = (source, field) => {
  const sourceField =
    field === "shardsLimit" && source?.shardsLimit === undefined
      ? "shardsStart"
      : field;
  const value = source?.[sourceField];
  return Number.isFinite(Number(value))
    ? Number(value)
    : DEFAULT_SAVE_CONFIG[field];
};

export const extractSaveConfig = (source) =>
  SAVE_CONFIG_FIELDS.reduce(
    (acc, field) => ({ ...acc, [field]: extractSaveField(source, field) }),
    { ...DEFAULT_SAVE_CONFIG },
  );

export const buildEffectiveSaveConfig = (baseConfig, saveConfig) => ({
  ...normalizeConfigWithShardSettings({
    ...DEFAULT_CONFIG,
    ...(baseConfig || {}),
  }),
  ...extractSaveConfig(saveConfig),
});

export const computeStartResourcesFromConfig = (config, baseResources) => {
  const base = baseResources || buildInitialGameState({
    libraryMap: BUILT_LIBRARY_MAP,
    townhallDef: BUILT_TOWNHALL_DEF,
  }).resources;
  const goodsStart = Math.floor(Number(config?.goodsStartBonus ?? 0) / 5);
  const troopsStart = Math.floor(Number(config?.troopsStartBonus ?? 0) / 5);
  const shardsStart = getShardLimit(config, base?.shards ?? 0);
  return {
    ...base,
    coins: (base?.coins ?? 0) + Number(config?.extraCoins ?? 0),
    supplies: (base?.supplies ?? 0) + Number(config?.extraSupplies ?? 0),
    shards: shardsStart,
    goods: GOODS_TYPES.reduce(
      (acc, key) => ({ ...acc, [key]: (base?.goods?.[key] ?? 0) + goodsStart }),
      {},
    ),
    units: {
      ...(base?.units ?? {}),
      Katapult: ((base?.units?.Katapult) ?? 0) + troopsStart,
    },
  };
};

const getRefund = (defId) => computeSaleOrRefund({ defId }, BUILT_LIBRARY_MAP, false);

const goodsCostAt = (idx) => {
  const maxIdx = REGION_GOODS_COSTS.length - 1;
  const safeIdx = clampIndex(idx, maxIdx);
  return toNumber(REGION_GOODS_COSTS[safeIdx]);
};

const shardCostAt = (idx) => {
  const maxIdx = REGION_SHARD_COSTS.length - 1;
  const safeIdx = clampIndex(idx, maxIdx);
  return toNumber(REGION_SHARD_COSTS[safeIdx]);
};

const getPurchaseDelta = (action, kind) => {
  const isGoods = kind === "goods";
  const key = isGoods
    ? action?.goodsKey ?? action?.key
    : action?.unitKey ?? action?.key;
  if (!key) return null;
  const quantityMap = extractQuantityMapFromAction(action);
  const entries = Object.entries(quantityMap);
  if (!entries.length) return null;
  const table = isGoods
    ? producerMap.goods[key]?.goodsCost
    : producerMap.units[key]?.unitCosts;
  const singleEntry = entries.length === 1;
  let coins = 0;
  let supplies = 0;
  let totalAmount = 0;
  entries.forEach(([amountRaw, count]) => {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const mappedCost =
      action?.costByAmount?.[amountRaw] ?? action?.costByAmount?.[amount];
    const unitCost = mappedCost ?? (singleEntry ? action?.cost : null) ?? table?.[amount];
    if (!unitCost) return;
    coins += (unitCost.coins ?? 0) * count;
    supplies += (unitCost.supplies ?? 0) * count;
    totalAmount += amount * count;
  });
  if (totalAmount <= 0) return null;
  return { key, totalAmount, coins, supplies };
};

const getMainBranchNodeIds = (historyTree) => {
  const nodes = historyTree?.nodes;
  const nodeIds = [];
  let currentId = 0;
  const seen = new Set();

  while (currentId != null && nodes?.has?.(currentId) && !seen.has(currentId)) {
    seen.add(currentId);
    nodeIds.push(currentId);
    const node = nodes.get(currentId);
    currentId = node?.childrenIds?.[0] ?? null;
  }

  return nodeIds;
};

const computeStatsForLayout = (layoutSnapshot, locksSnapshot, config) => {
  const unlocked = (layoutSnapshot || []).filter((inst) => !locksSnapshot?.[inst.id]);
  const base = computeStats(unlocked, BUILT_LIBRARY_MAP);
  const lockedReq = (layoutSnapshot || []).reduce((acc, inst) => {
    if (!locksSnapshot?.[inst.id]) return acc;
    const def = BUILT_LIBRARY_MAP?.[inst.defId];
    if (!def || def.category === "housing") return acc;
    const req = def.requiresPeople ?? 0;
    return req > 0 ? acc + req : acc;
  }, 0);
  const withLocks = lockedReq
    ? { ...base, peopleReq: (base.peopleReq ?? 0) + lockedReq }
    : base;
  const coinBoostCfg = Number(config?.coinBoost ?? 0) / 100;
  const supplyBoostCfg = Number(config?.supplyBoost ?? 0) / 100;
  return {
    ...withLocks,
    coinBoost: (withLocks.coinBoost ?? 0) + coinBoostCfg,
    supplyBoost: (withLocks.supplyBoost ?? 0) + supplyBoostCfg,
    armyBoostRed: withLocks.armyBoostRed ?? 0,
    armyBoostBlue: withLocks.armyBoostBlue ?? 0,
  };
};

const trackMinima = (resources, minima) => {
  minima.coins = Math.min(minima.coins, Number(resources?.coins ?? 0));
  minima.supplies = Math.min(minima.supplies, Number(resources?.supplies ?? 0));
  const lowestGood = GOODS_TYPES.reduce(
    (min, key) => Math.min(min, Number(resources?.goods?.[key] ?? 0)),
    Infinity,
  );
  minima.goods = Math.min(
    minima.goods,
    Number.isFinite(lowestGood) ? lowestGood : 0,
  );
};

export const analyzeSmallestSaveConfig = ({
  treeData,
  draftConfig,
  fallbackConfig,
}) => {
  if (!treeData?.tree) return null;

  const { historyTree } = deserializeTree(treeData);
  const effectiveConfig = buildEffectiveSaveConfig(
    treeData?.config || fallbackConfig,
    draftConfig,
  );
  const normalizedDraft = extractSaveConfig(draftConfig);
  const base = buildInitialGameState({
    libraryMap: BUILT_LIBRARY_MAP,
    townhallDef: BUILT_TOWNHALL_DEF,
  });
  const seedResources = computeStartResourcesFromConfig(
    effectiveConfig,
    base.resources,
  );
  const resources = {
    coins: seedResources.coins ?? 0,
    supplies: seedResources.supplies ?? 0,
    chronos: seedResources.chronos ?? 0,
    shards: seedResources.shards ?? 0,
    quantumActions: seedResources.quantumActions ?? 0,
    goods: { ...(seedResources.goods ?? {}) },
    units: { ...(seedResources.units ?? {}) },
  };
  let layoutSim = [...(base.layout ?? [])];
  let readySim = { ...(base.readyMap ?? {}) };
  let buildLocksSim = { ...(base.buildLocks ?? {}) };
  if (!Object.keys(buildLocksSim).length) {
    layoutSim.forEach((inst) => {
      buildLocksSim[inst.id] = isTierLocked(BUILT_LIBRARY_MAP?.[inst.defId]?.tier);
    });
  }
  let unlockedRegionsSim = [...(base.unlockedRegions ?? [])];
  let goodsUnlocksSim = base.goodsUnlocks ?? 0;
  let shardUnlocksSim = base.shardUnlocks ?? 0;
  let timeStepSim = base.timeStep ?? 1;
  let nextIdSim = layoutSim.reduce((max, inst) => Math.max(max, inst.id), 0) + 1;

  const resolveDefIdSim = (action) =>
    action?.defId || (action?.shortId ? BUILT_SHORT_ID_MAP?.[action.shortId] : null);

  const applyResourceDeltaSim = (delta) => {
    if (!delta) return;
    resources.coins += delta.coins ?? 0;
    resources.supplies += delta.supplies ?? 0;
    resources.chronos += delta.chronos ?? 0;
    resources.shards += delta.shards ?? 0;
    resources.quantumActions += delta.quantumActions ?? 0;
    if (delta.goods) {
      Object.entries(delta.goods).forEach(([key, value]) => {
        resources.goods[key] = (resources.goods[key] ?? 0) + value;
      });
    }
    if (delta.units) {
      Object.entries(delta.units).forEach(([key, value]) => {
        resources.units[key] = (resources.units[key] ?? 0) + value;
      });
    }
  };

  const applySpendSim = (cost) => {
    if (!cost) return;
    applyResourceDeltaSim({
      coins: -(cost.coins ?? 0),
      supplies: -(cost.supplies ?? 0),
      chronos: -(cost.chronos ?? 0),
    });
  };

  const applyRefundSim = (refund) => {
    if (!refund) return;
    applyResourceDeltaSim({
      coins: refund.coins ?? 0,
      supplies: refund.supplies ?? 0,
      chronos: refund.chronos ?? 0,
    });
  };

  const findSimInstance = (action) => {
    if (action.instanceId !== null && action.instanceId !== undefined) {
      return layoutSim.find((inst) => inst.id === action.instanceId) || null;
    }
    const defId = resolveDefIdSim(action);
    return (
      layoutSim.find(
        (inst) => inst.defId === defId && inst.x === action.x && inst.y === action.y,
      ) || null
    );
  };

  const removeSimInstance = (id) => {
    layoutSim = layoutSim.filter((inst) => inst.id !== id);
    delete readySim[id];
    delete buildLocksSim[id];
  };

  const addSimInstance = (action, def, defId) => {
    const id =
      action.instanceId !== null && action.instanceId !== undefined
        ? action.instanceId
        : nextIdSim++;
    const instance = {
      id,
      defId,
      x: action.x,
      y: action.y,
      width: action.width ?? def.width,
      height: action.height ?? def.height,
    };
    layoutSim = [...layoutSim, instance];
    readySim[id] = false;
    buildLocksSim[id] = isTierLocked(def.tier);
  };

  const applyMoveSim = (action) => {
    const moves = normalizeMovePositions(action);
    if (!moves.length) return;
    const map = new Map();
    moves.forEach(([x, y, xn, yn]) => {
      map.set(`${x},${y}`, { x: xn, y: yn });
    });
    if (!map.size) return;
    layoutSim = layoutSim.map((inst) => {
      const key = `${inst.x},${inst.y}`;
      const dest = map.get(key);
      if (!dest) return inst;
      return { ...inst, x: dest.x, y: dest.y };
    });
  };

  const applyAdminAdjustSim = (action) => {
    if (!action) return;
    const delta = action.delta ?? 0;
    if (action.group === "goods") {
      const deltas = action.deltaByKey || { [action.key]: delta };
      applyResourceDeltaSim({ goods: deltas });
      return;
    }
    if (action.group === "units") {
      const deltas = action.deltaByKey || { [action.key]: delta };
      applyResourceDeltaSim({ units: deltas });
      return;
    }
    if (action.key) {
      applyResourceDeltaSim({ [action.key]: delta });
    }
  };

  const applyFinishProductionsSim = () => {
    readySim = finishProductionsReadyMap(
      layoutSim,
      BUILT_LIBRARY_MAP,
      readySim,
      buildLocksSim,
    );
    const baseQa =
      (QA_BASE_PER_HOUR + Number(effectiveConfig?.qaBaseBonus ?? 0)) *
      Number(effectiveConfig?.qaHarvestHours ?? 12);
    if (baseQa > 0) {
      applyResourceDeltaSim({ quantumActions: baseQa });
    }
    timeStepSim = Math.min(23, (timeStepSim ?? 1) + 1);
  };

  const applyHarvestAllSim = () => {
    const readyOnes = layoutSim.filter((b) => readySim[b.id] === true);
    const isFullHarvest = readyOnes.length === 0;
    const locksBefore = { ...buildLocksSim };
    Object.keys(buildLocksSim).forEach((key) => {
      if (buildLocksSim[key]) buildLocksSim[key] = false;
    });

    const effectiveStats = computeStatsForLayout(
      layoutSim,
      buildLocksSim,
      effectiveConfig,
    );
    const baseQa =
      (QA_BASE_PER_HOUR + Number(effectiveConfig?.qaBaseBonus ?? 0)) *
      Number(effectiveConfig?.qaHarvestHours ?? 12);
    const extraQa = isFullHarvest ? baseQa : 0;
    const targets = isFullHarvest ? layoutSim : readyOnes;

    const lockedIds = [];
    const harvestable = [];
    const lockedCulture = [];
    targets.forEach((inst) => {
      if (locksBefore[inst.id]) {
        const def = BUILT_LIBRARY_MAP[inst.defId];
        if (def?.category === "culture") {
          lockedCulture.push(inst);
        } else {
          lockedIds.push(inst.id);
        }
      } else {
        harvestable.push(inst);
      }
    });

    const total =
      harvestable.length > 0
        ? aggregateHarvest(harvestable, BUILT_LIBRARY_MAP, effectiveStats, {
            qaHoursPerHarvest: Number(effectiveConfig?.qaHarvestHours ?? 12),
          })
        : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };
    const qaFromLockedCulture = lockedCulture.reduce(
      (acc, inst) =>
        acc +
        (BUILT_LIBRARY_MAP[inst.defId]?.quantumActions ?? 0) *
          Number(effectiveConfig?.qaHarvestHours ?? 12),
      0,
    );
    total.qa = (total.qa ?? 0) + qaFromLockedCulture + extraQa;

    applyResourceDeltaSim({
      coins: total.coins ?? 0,
      supplies: total.supplies ?? 0,
      chronos: total.chronos ?? 0,
      quantumActions: total.qa ?? 0,
      goods: total.goods ?? {},
    });

    targets.forEach((inst) => {
      readySim[inst.id] = false;
    });
    [...lockedIds, ...lockedCulture.map((inst) => inst.id)].forEach((id) => {
      buildLocksSim[id] = false;
    });
    if (isFullHarvest) {
      timeStepSim = Math.min(23, (timeStepSim ?? 1) + 1);
    }
  };

  const minima = {
    coins: Number(resources.coins ?? 0),
    supplies: Number(resources.supplies ?? 0),
    goods: GOODS_TYPES.reduce(
      (min, key) => Math.min(min, Number(resources.goods?.[key] ?? 0)),
      Infinity,
    ),
  };

  const mainBranchNodeIds = getMainBranchNodeIds(historyTree);
  for (const nodeId of mainBranchNodeIds.slice(1)) {
    const action = historyTree?.nodes?.get(nodeId)?.action;
    if (!action) continue;
    const defId = resolveDefIdSim(action);
    const def = defId ? BUILT_LIBRARY_MAP?.[defId] : null;
    switch (action.type) {
      case "build":
      case "buildAdmin": {
        if (!def) break;
        if (action.type === "build") {
          applySpendSim(def.cost);
        }
        addSimInstance(action, def, defId);
        break;
      }
      case "sell":
      case "sellFull":
      case "sellAdmin": {
        if (!def) break;
        const refund = getRefund(defId);
        if (action.type === "sell") {
          applyRefundSim(refund);
        } else if (action.type === "sellFull") {
          applyRefundSim(def.cost);
        }
        const target = findSimInstance(action);
        if (target) removeSimInstance(target.id);
        break;
      }
      case "regionUnlockGoods": {
        const goodsCost = goodsCostAt(goodsUnlocksSim);
        if (action.goodKey) {
          applyResourceDeltaSim({
            goods: { [action.goodKey]: -goodsCost },
          });
        }
        goodsUnlocksSim += 1;
        if (action.regionIdx !== null && action.regionIdx !== undefined) {
          unlockedRegionsSim[action.regionIdx] = true;
        }
        break;
      }
      case "regionUnlockShards": {
        const shardCost = shardCostAt(shardUnlocksSim);
        applyResourceDeltaSim({ shards: -shardCost });
        shardUnlocksSim += 1;
        if (action.regionIdx !== null && action.regionIdx !== undefined) {
          unlockedRegionsSim[action.regionIdx] = true;
        }
        break;
      }
      case "regionUnlockAdmin": {
        if (action.regionIdx !== null && action.regionIdx !== undefined) {
          unlockedRegionsSim[action.regionIdx] = true;
        }
        break;
      }
      case "regionLockAdmin": {
        if (action.regionIdx !== null && action.regionIdx !== undefined) {
          unlockedRegionsSim[action.regionIdx] = false;
        }
        if (action.method === "goods") {
          goodsUnlocksSim = clampIndex(
            goodsUnlocksSim - 1,
            REGION_GOODS_COSTS.length - 1,
          );
        } else if (action.method === "shards") {
          shardUnlocksSim = clampIndex(
            shardUnlocksSim - 1,
            REGION_SHARD_COSTS.length - 1,
          );
        }
        break;
      }
      case "goodsCostAdmin": {
        const nextIdx = Number.isFinite(action.nextIndex)
          ? action.nextIndex
          : resolveCostIndex(action.nextValue, REGION_GOODS_COSTS, goodsUnlocksSim);
        goodsUnlocksSim = clampIndex(nextIdx, REGION_GOODS_COSTS.length - 1);
        break;
      }
      case "shardsCostAdmin": {
        const nextIdx = Number.isFinite(action.nextIndex)
          ? action.nextIndex
          : resolveCostIndex(
              action.nextValue,
              REGION_SHARD_COSTS,
              shardUnlocksSim,
            );
        shardUnlocksSim = clampIndex(nextIdx, REGION_SHARD_COSTS.length - 1);
        break;
      }
      case "boostUnlock":
      case "boostUnlockAdmin": {
        if (!def) break;
        const target = findSimInstance(action);
        if (!target) break;
        if (action.type === "boostUnlock") {
          applyResourceDeltaSim({ shards: -getUnlockCostForTier(def?.tier) });
        }
        buildLocksSim[target.id] = false;
        break;
      }
      case "boostReady":
      case "boostReadyAdmin": {
        if (!def) break;
        const target = findSimInstance(action);
        if (!target) break;
        if (action.type === "boostReady") {
          applyResourceDeltaSim({ shards: -getBoostCostForTier(def?.tier) });
        }
        readySim[target.id] = true;
        break;
      }
      case "harvest": {
        const target = findSimInstance(action);
        if (!target) break;
        const statsSnapshot = computeStatsForLayout(
          layoutSim,
          buildLocksSim,
          effectiveConfig,
        );
        const delta = computeBuildingHarvest(
          { defId: target.defId },
          BUILT_LIBRARY_MAP,
          statsSnapshot,
          { qaHoursPerHarvest: Number(effectiveConfig?.qaHarvestHours ?? 12) },
        );
        applyResourceDeltaSim({
          coins: delta.coins ?? 0,
          supplies: delta.supplies ?? 0,
          chronos: delta.chronos ?? 0,
          quantumActions: delta.qa ?? 0,
          goods: delta.goods ?? {},
        });
        readySim[target.id] = false;
        break;
      }
      case "finishProductions": {
        applyFinishProductionsSim();
        break;
      }
      case "harvestAll":
      case "harvestAllAdmin": {
        applyHarvestAllSim();
        break;
      }
      case "move": {
        applyMoveSim(action);
        break;
      }
      case "adminAdjust": {
        applyAdminAdjustSim(action);
        break;
      }
      case "goodsPurchase":
      case "goodsPurchaseAdmin": {
        if (action.type === "goodsPurchaseAdmin") break;
        const purchase = getPurchaseDelta(action, "goods");
        if (!purchase) break;
        applyResourceDeltaSim({
          coins: -purchase.coins,
          supplies: -purchase.supplies,
          goods: { [purchase.key]: purchase.totalAmount },
        });
        break;
      }
      case "unitPurchase":
      case "unitPurchaseAdmin": {
        if (action.type === "unitPurchaseAdmin") break;
        const purchase = getPurchaseDelta(action, "units");
        if (!purchase) break;
        applyResourceDeltaSim({
          coins: -purchase.coins,
          supplies: -purchase.supplies,
          units: { [purchase.key]: purchase.totalAmount },
        });
        break;
      }
      default:
        break;
    }
    trackMinima(resources, minima);
  }

  return {
    minima,
    adjustedConfig: {
      ...normalizedDraft,
      extraCoins: Math.max(0, normalizedDraft.extraCoins - minima.coins),
      extraSupplies: Math.max(0, normalizedDraft.extraSupplies - minima.supplies),
      goodsStartBonus: Math.max(0, normalizedDraft.goodsStartBonus - minima.goods * 5),
    },
  };
};

export const getSavefileSyncState = ({ saveEntry, userConfig }) => {
  if (!saveEntry) return SAVEFILE_SYNC_STATES.desynced;

  const analysis = analyzeSmallestSaveConfig({
    treeData: saveEntry?.tree,
    draftConfig: saveEntry?.saveConfig,
    fallbackConfig: userConfig,
  });

  if (analysis) {
    const normalizedUserConfig = extractSaveConfig(userConfig);
    const impossible = MIN_SAFE_SAVE_CONFIG_FIELDS.some(
      (field) =>
        (normalizedUserConfig?.[field] ?? 0) <
        (analysis.adjustedConfig?.[field] ?? 0),
    );
    if (impossible) {
      return SAVEFILE_SYNC_STATES.impossible;
    }
  }

  return saveEntry?.syncUser === true
    ? SAVEFILE_SYNC_STATES.synced
    : SAVEFILE_SYNC_STATES.desynced;
};
