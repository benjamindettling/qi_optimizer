import { useCallback, useEffect, useRef, useState } from "react";

/**
 * IndexedDB-backed persistence for savefiles.
 *
 * Motivation:
 * - localStorage is typically limited to ~5–10MB per origin and stores one giant string.
 * - savefiles with many checkpoints can exceed that quota, throwing:
 *   "Uncaught DOMException: The quota has been exceeded."
 * - IndexedDB is designed for larger payloads and incremental updates.
 */

// One-time migration source (legacy localStorage).
const LEGACY_STORAGE_KEY = "qi_saves";

// IndexedDB configuration.
const DB_NAME = "qi_optimizer";
const DB_VERSION = 1;
const STORE_NAME = "saves"; // key = save name, value = save entry

// Cache the open DB promise so we only open once per tab.
let dbPromise = null;

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDoneToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGetAll() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const keys = await reqToPromise(store.getAllKeys());
  const values = await reqToPromise(store.getAll());
  await txDoneToPromise(tx);

  const out = {};
  for (let i = 0; i < keys.length; i += 1) {
    out[String(keys[i])] = values[i];
  }
  return out;
}

async function idbBatchWrite({ puts = [], deletes = [] }) {
  if (puts.length === 0 && deletes.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  for (const name of deletes) store.delete(name);
  for (const [name, entry] of puts) store.put(entry, name);

  await txDoneToPromise(tx);
}

function isSnapshotEntry(entry) {
  return Boolean(entry?.meta?.isSnapshot);
}

function stripSignaturesInSaves(obj = {}) {
  const next = {};
  for (const [name, entry] of Object.entries(obj)) {
    const cps = entry?.checkpoints || [];
    next[name] = {
      ...entry,
      checkpoints: cps.map(({ signature, ...rest }) => rest),
    };
  }
  return next;
}

/**
 * What we actually persist:
 * - We intentionally do NOT persist snapshot entries (meta.isSnapshot === true).
 *   This matches your previous behavior: snapshots were removed on refresh.
 *   It also reduces storage pressure substantially.
 */
function toPersisted(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, entry]) => !isSnapshotEntry(entry))
  );
}

export function useSaves() {
  const [saves, setSaves] = useState({});
  const [loadName, setLoadName] = useState("");
  const [savesLoaded, setSavesLoaded] = useState(false);

  // Helps us compute a small diff for IDB writes.
  const lastPersistedRef = useRef({});

  // 1) Load from IndexedDB; if empty, migrate from legacy localStorage.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fromIdb = await idbGetAll();

        if (cancelled) return;

        const idbHasAny = Object.keys(fromIdb || {}).length > 0;
        if (idbHasAny) {
          const cleaned = stripSignaturesInSaves(fromIdb || {});
          lastPersistedRef.current = toPersisted(cleaned);
          setSaves(cleaned);
          setSavesLoaded(true);
          return;
        }

        // IndexedDB empty -> attempt one-time migration from localStorage.
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacyRaw) {
          lastPersistedRef.current = {};
          setSaves({});
          setSavesLoaded(true);
          return;
        }

        try {
          const parsed = JSON.parse(legacyRaw);
          const cleaned = stripSignaturesInSaves(parsed || {});
          const persisted = toPersisted(cleaned);

          // Write migrated (non-snapshot) saves to IDB.
          const puts = Object.entries(persisted);
          await idbBatchWrite({ puts, deletes: [] });

          // Keep in-memory state consistent with previous behavior:
          // - snapshots are NOT kept across refresh
          // - so we initialize state with only non-snapshot entries
          lastPersistedRef.current = persisted;
          setSaves(persisted);

          // Clear legacy storage to prevent re-migration and free space.
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (e) {
          console.error("Failed to parse legacy saves", e);
          lastPersistedRef.current = {};
          setSaves({});
        }

        setSavesLoaded(true);
      } catch (e) {
        console.error("Failed to load saves from IndexedDB", e);
        if (!cancelled) {
          lastPersistedRef.current = {};
          setSaves({});
          setSavesLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistToIdb = useCallback(async (nextInMemory) => {
    // Only persist non-snapshot entries.
    const nextPersisted = toPersisted(nextInMemory);
    const prevPersisted = lastPersistedRef.current || {};

    // Compute a minimal diff:
    // - deletes: keys that existed before but not anymore
    // - puts: keys that are new or whose JSON differs
    const deletes = [];
    const puts = [];

    for (const key of Object.keys(prevPersisted)) {
      if (!(key in nextPersisted)) deletes.push(key);
    }

    for (const [key, entry] of Object.entries(nextPersisted)) {
      const prevEntry = prevPersisted[key];
      if (!prevEntry) {
        puts.push([key, entry]);
        continue;
      }

      // Safe structural compare via JSON; fine for moderate object sizes.
      // If this becomes a hotspot, we can switch to hashing or shallow checks.
      const a = JSON.stringify(prevEntry);
      const b = JSON.stringify(entry);
      if (a !== b) puts.push([key, entry]);
    }

    try {
      await idbBatchWrite({ puts, deletes });
      lastPersistedRef.current = nextPersisted;
    } catch (e) {
      console.error("Failed to persist saves to IndexedDB", e);
    }
  }, []);

  /**
   * Set saves in-memory and persist (non-snapshot) saves to IndexedDB.
   */
  const setAllSaves = useCallback(
    (updater) => {
      setSaves((prev) => {
        const nextRaw = typeof updater === "function" ? updater(prev) : updater;
        const nextCleaned = stripSignaturesInSaves(nextRaw || {});

        // Persist asynchronously (do not block UI thread).
        // Note: snapshots remain in-memory only.
        persistToIdb(nextCleaned);

        return nextCleaned;
      });
    },
    [persistToIdb]
  );

  const saveSnapshot = useCallback(
    (name, payload) => {
      if (!name) return;
      const entry =
        payload && payload.snapshot ? payload : { snapshot: payload };
      setAllSaves((prev) => ({ ...prev, [name]: entry }));
    },
    [setAllSaves]
  );

  const loadSnapshot = useCallback((name) => saves[name] ?? null, [saves]);

  const deleteSave = useCallback(
    (name) => {
      if (!name) return;
      setAllSaves((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [setAllSaves]
  );

  return {
    saves,
    loadName,
    setLoadName,
    savesLoaded,
    setAllSaves,
    saveSnapshot,
    loadSnapshot,
    deleteSave,
  };
}
