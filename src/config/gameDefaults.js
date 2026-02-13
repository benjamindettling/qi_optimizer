// Default configuration values and starting resources.
export const DEFAULT_CONFIG = {
  goodsStartBonus: 0,
  extraCoins: 0,
  extraSupplies: 0,
  troopsStartBonus: 0,
  shardsStart: 500,
  coinBoost: 0,
  supplyBoost: 0,
  // Fight boosts - separate attack/defense for each color
  redAttackBoost: 0,
  redDefenseBoost: 0,
  blueAttackBoost: 0,
  blueDefenseBoost: 0,
  fightColor: "rot", // "rot" or "blau"
  qaBaseBonus: 0,
  qaHarvestHours: 12,
  allowNegativeShards: false,
  // Preferences
  viewMode: "diagonal",
  skipToEnd: true,
  colorTheme: "dark",
  placementMode: "single",
  useShortNames: true,
};

export const DEFAULT_START_RESOURCES = {
  coins: 450000,
  supplies: 75000,
  chronos: 0,
  quantumActions: 0,
  shards: 500,
};

export const QA_BASE_PER_HOUR = 5000;

export const TOWNHALL_START_POSITION = { x: 17, y: 4 };

// Action colors are now imported from colors.js
// Re-export for backward compatibility
export { ACTION_COLORS } from "./colors";
