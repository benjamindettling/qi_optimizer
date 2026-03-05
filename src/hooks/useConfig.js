import { useState } from "react";
import { DEFAULT_CONFIG } from "../config/gameDefaults";
import { normalizeConfigWithShardSettings } from "../utils/shards";

const STORAGE_KEY = "qi_config";

export function useConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_CONFIG;
      const parsed = JSON.parse(raw);
      return normalizeConfigWithShardSettings({ ...DEFAULT_CONFIG, ...parsed });
    } catch (e) {
      console.error("Failed to load config", e);
      return DEFAULT_CONFIG;
    }
  });

  const updateConfig = (partial) => {
    setConfig((prev) => {
      const next = normalizeConfigWithShardSettings({ ...prev, ...partial });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const replaceConfig = (nextConfig) => {
    const normalized = normalizeConfigWithShardSettings({
      ...DEFAULT_CONFIG,
      ...(nextConfig || {}),
    });
    setConfig(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  return { config, updateConfig, replaceConfig };
}
