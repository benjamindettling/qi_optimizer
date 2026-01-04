import { useEffect, useState } from "react";

const STORAGE_KEY = "qi_saves";

export function useSaves() {
  const [saves, setSaves] = useState({});
  const [loadName, setLoadName] = useState("");

  useEffect(() => {
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    if (savedRaw) {
      try {
        setSaves(JSON.parse(savedRaw));
      } catch (e) {
        console.error("Failed to parse saves", e);
      }
    }
  }, []);

  const persist = (obj) => {
    setSaves(obj);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  };

  const setAllSaves = (updater) => {
    setSaves((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const finalObj = next || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalObj));
      return finalObj;
    });
  };

  const saveSnapshot = (name, payload) => {
    if (!name) return;
    const entry = payload && payload.snapshot ? payload : { snapshot: payload };
    setAllSaves((prev) => ({ ...prev, [name]: entry }));
  };

  const loadSnapshot = (name) => saves[name] ?? null;

  const deleteSave = (name) => {
    const next = { ...saves };
    delete next[name];
    persist(next);
  };

  return {
    saves,
    loadName,
    setLoadName,
    setAllSaves,
    saveSnapshot,
    loadSnapshot,
    deleteSave,
  };
}
