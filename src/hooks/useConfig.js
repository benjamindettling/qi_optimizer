import { useState } from "react";

const STORAGE_KEY = "qi_config";

const defaultConfig = {
  goodsStartBonus: 0,
  extraCoins: 0,
  extraSupplies: 0,
  coinBoost: 0,
  supplyBoost: 0,
  armyBoostRed: 0,
  armyBoostBlue: 0,
  qaBaseBonus: 0,
  qaHarvestHours: 12,
  allowNegativeShards: false,
};

export function useConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultConfig;
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    } catch (e) {
      console.error("Failed to load config", e);
      return defaultConfig;
    }
  });

  const updateConfig = (partial) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { config, updateConfig };
}
