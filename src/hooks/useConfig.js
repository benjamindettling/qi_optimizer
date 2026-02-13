import { useState } from "react";
import { DEFAULT_CONFIG } from "../config/gameDefaults";

const STORAGE_KEY = "qi_config";

export function useConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_CONFIG;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.error("Failed to load config", e);
      return DEFAULT_CONFIG;
    }
  });

  const updateConfig = (partial) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ✅ NEW: overwrite config fully (used when loading from Firestore)
  const replaceConfig = (nextConfig) => {
    const normalized = { ...DEFAULT_CONFIG, ...(nextConfig || {}) };
    setConfig(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  return { config, updateConfig, replaceConfig };
}