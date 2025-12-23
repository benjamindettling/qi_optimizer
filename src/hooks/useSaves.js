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

  const setAllSaves = (next) => {
    const value = typeof next === "function" ? next(saves) : next;
    persist(value || {});
  };

  const saveSnapshot = (name, snapshot) => {
    if (!name) return;
    setAllSaves((prev) => ({ ...prev, [name]: { snapshot } }));
  };

  const loadSnapshot = (name) => saves[name]?.snapshot ?? null;

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
