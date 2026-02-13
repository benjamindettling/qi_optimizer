// Tier mappings for build times and boost shard costs.
export const TIER_TO_BUILD_TIME = {
  1: 0,
  2: 1,
  3: 10,
};

export const BUILD_TIME_TO_TIER = {
  0: 1,
  1: 2,
  10: 3,
};

export const TIER_TO_BOOST_SHARDS = {
  1: 50,
  2: 75,
  3: 95,
};

export const BOOST_UNLOCK_SHARDS = 50;

export const resolveTier = (tier) => {
  const num = Number(tier);
  return Number.isFinite(num) ? num : 1;
};

export const getBuildTimeForTier = (tier) =>
  TIER_TO_BUILD_TIME[resolveTier(tier)] ?? 0;

export const getBoostCostForTier = (tier) =>
  TIER_TO_BOOST_SHARDS[resolveTier(tier)] ?? 50;

export const isTierLocked = (tier) => resolveTier(tier) === 3;
