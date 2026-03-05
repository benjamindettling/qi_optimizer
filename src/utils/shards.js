import { getBoostCostForTier, getUnlockCostForTier } from "../config/buildingTiers";

export const SHARD_DISPLAY_MODES = {
  spent: "spent",
  stock: "stock",
};

const NON_BOOSTABLE_UNLOCKED_CATEGORIES = new Set([
  "goods",
  "culture",
  "decoration",
  "military",
]);

const toFiniteNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const getShardLimit = (config, fallback = 500) =>
  Math.max(
    0,
    toFiniteNumber(config?.shardsLimit ?? config?.shardsStart, fallback),
  );

export const getShardDisplayMode = (
  config,
  fallback = SHARD_DISPLAY_MODES.spent,
) =>
  config?.shardDisplayMode === SHARD_DISPLAY_MODES.stock
    ? SHARD_DISPLAY_MODES.stock
    : fallback;

export const allowShardLimitOverflow = (config, fallback = true) => {
  if (typeof config?.allowShardLimitOverflow === "boolean") {
    return config.allowShardLimitOverflow;
  }
  if (typeof config?.allowNegativeShards === "boolean") {
    return config.allowNegativeShards;
  }
  return fallback;
};

export const getDisplayedShards = (shards, config) => {
  const remaining = toFiniteNumber(shards, 0);
  if (getShardDisplayMode(config) === SHARD_DISPLAY_MODES.stock) {
    return remaining;
  }
  return remaining - getShardLimit(config);
};

export const isShardLimitExceeded = (shards) => toFiniteNumber(shards, 0) < 0;

export const willShardCostExceedLimit = ({ shards, cost }) => {
  const nextCost = toFiniteNumber(cost, 0);
  if (nextCost <= 0) return false;
  return toFiniteNumber(shards, 0) - nextCost < 0;
};

export const canPayShardCost = ({
  shards,
  cost,
  config,
  infiniteResources = false,
}) => {
  const nextCost = toFiniteNumber(cost, 0);
  if (infiniteResources || nextCost <= 0) return true;
  if (allowShardLimitOverflow(config)) return true;
  return !willShardCostExceedLimit({ shards, cost: nextCost });
};

export const getBoostInteractionState = ({
  def,
  locked = false,
  ready = false,
  shards = 0,
  config,
  infiniteResources = false,
}) => {
  if (!def) {
    return {
      action: "none",
      cost: 0,
      impossible: true,
      overLimit: false,
      allowed: false,
    };
  }

  if (ready) {
    return {
      action: "harvest",
      cost: 0,
      impossible: false,
      overLimit: false,
      allowed: true,
    };
  }

  if (def.category === "townhall") {
    return {
      action: "none",
      cost: 0,
      impossible: true,
      overLimit: false,
      allowed: false,
    };
  }

  if (locked) {
    const cost = getUnlockCostForTier(def?.tier);
    const overLimit = willShardCostExceedLimit({ shards, cost });
    return {
      action: "unlock",
      cost,
      impossible: false,
      overLimit,
      allowed: canPayShardCost({ shards, cost, config, infiniteResources }),
    };
  }

  if (NON_BOOSTABLE_UNLOCKED_CATEGORIES.has(def.category)) {
    return {
      action: "none",
      cost: 0,
      impossible: true,
      overLimit: false,
      allowed: false,
    };
  }

  const cost = getBoostCostForTier(def?.tier);
  const overLimit = willShardCostExceedLimit({ shards, cost });
  return {
    action: "boost",
    cost,
    impossible: false,
    overLimit,
    allowed: canPayShardCost({ shards, cost, config, infiniteResources }),
  };
};

export const normalizeConfigWithShardSettings = (config = {}) => {
  const next = { ...(config || {}) };
  next.shardsLimit = getShardLimit(config);
  delete next.shardsStart;
  next.shardDisplayMode = getShardDisplayMode(config);
  delete next.useStockedShards;
  next.allowShardLimitOverflow = allowShardLimitOverflow(config);
  delete next.allowNegativeShards;
  return next;
};
