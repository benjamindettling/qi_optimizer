import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSaves } from "../useSaves";
import { useSnapshotHistory } from "./useSnapshotHistory";
import { serializeTree, deserializeTree, getMainBranchEndNodeId } from "../../utils/treeSerializer";
import {
  computeSavefileTreeStats,
  extractSaveConfig,
  SAVE_CONFIG_FIELDS,
} from "../../utils/saveConfig";

// Manages save/load flows and snapshot history.
export const useSaveManager = ({
  buildSnapshot,
  applySnapshot,
  checkpoints,
  checkpointIndex,
  isPast,
  makeCheckpointsForSave,
  applyLoadedCheckpoints,
  setMoveMode,
  setSellMode,
  setRefundMode,
  setBoostMode,
  setSelectedBuildingId,
  setCarried,
  setMoveSnapshot,
  setNotes,
  setSelectedIds,
  addCheckpointPart,
  suppressNextCheckpoint,
  enableEditFromPast,
  updateStatus,
  lastStatusRef,
  timeStep,
  carried,
  setPastEditModal,
  setExternalLoadName,
  externalLoadName,
  // Tree serialization (refs - populated after historyApi is created)
  loadHistoryTreeRef,
  historyTreeRef,
  config,
  userConfig,
  activeSaveConfig,
  setActiveSaveConfig,
}) => {
  const {
    saves,
    loadName,
    setLoadName,
    savesLoaded,
    setAllSaves,
    saveSnapshot,
    loadSnapshot,
    deleteSave,
  } = useSaves();

  const visibleSaves = useMemo(() => {
    const next = {};
    Object.entries(saves || {}).forEach(([name, entry]) => {
      if (entry?.meta?.isSnapshot) return;
      next[name] = entry;
    });
    return next;
  }, [saves]);

  // Sync external loadName to internal - only when external changes from outside
  const prevExternalRef = useRef(externalLoadName);
  useEffect(() => {
    // Only sync if external changed and differs from internal
    if (externalLoadName !== prevExternalRef.current && externalLoadName !== loadName) {
      setLoadName(externalLoadName);
    }
    prevExternalRef.current = externalLoadName;
  }, [externalLoadName, loadName, setLoadName]);

  // Sync internal loadName to external - notify parent of changes
  useEffect(() => {
    if (typeof setExternalLoadName === "function" && loadName !== externalLoadName) {
      setExternalLoadName(loadName);
    }
  }, [loadName, setExternalLoadName, externalLoadName]);

  const {
    snapshots,
    selectedSnapshotName,
    setSelectedSnapshotName,
    setActiveSnapshotName,
    handleTakeSnapshot,
  } = useSnapshotHistory({
    saves,
    savesLoaded,
    buildSnapshot,
    checkpoints,
    timeStep,
    makeCheckpointsForSave,
    checkpointIndex,
    isPast,
    saveSnapshot,
    setAllSaves,
    lastStatusRef,
  });

  const [pendingAutoSnapshot, setPendingAutoSnapshot] = useState(null);
  const prevUserConfigSignatureRef = useRef(null);
  const allowedSaveConfigKeys = useMemo(() => new Set(SAVE_CONFIG_FIELDS), []);
  
  // Track last saved node count for computing unsaved changes
  const [lastSavedNodeCount, setLastSavedNodeCount] = useState(null);

  const requestAutoSnapshot = useCallback(
    (options = {}) => {
      const { waitForCheckpoint = true } = options;
      const tailUid = checkpoints[checkpoints.length - 1]?.uid ?? null;
      setPendingAutoSnapshot({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        waitForCheckpoint,
        tailUid,
      });
    },
    [checkpoints],
  );

  const handleAddCheckpointPart = useCallback(() => {
    suppressNextCheckpoint(2);
    setNotes("");
    setSelectedIds(new Set());
    setSelectedBuildingId(null);
    setTimeout(() => {
      addCheckpointPart();
      requestAutoSnapshot();
    }, 0);
  }, [
    suppressNextCheckpoint,
    setNotes,
    setSelectedIds,
    setSelectedBuildingId,
    addCheckpointPart,
    requestAutoSnapshot,
  ]);

  useEffect(() => {
    if (!savesLoaded) return;

    const syncedConfig = extractSaveConfig(userConfig);
    const signature = JSON.stringify(syncedConfig);
    if (prevUserConfigSignatureRef.current === signature) {
      return;
    }
    prevUserConfigSignatureRef.current = signature;

    setAllSaves((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(prev || {}).forEach(([name, entry]) => {
        if (entry?.syncUser !== true) return;
        const sourceConfig = entry?.saveConfig ?? entry?.tree?.config;
        const currentConfig = extractSaveConfig(sourceConfig);
        const rawConfig = sourceConfig ?? {};
        const hasOnlyAllowedKeys =
          rawConfig &&
          typeof rawConfig === "object" &&
          !Array.isArray(rawConfig) &&
          Object.keys(rawConfig).every((key) => allowedSaveConfigKeys.has(key));
        if (JSON.stringify(currentConfig) === signature && hasOnlyAllowedKeys) return;
        next[name] = {
          ...entry,
          saveConfig: syncedConfig,
          syncUser: true,
        };
        changed = true;
      });
      return changed ? next : prev;
    });

    if (loadName && saves?.[loadName]?.syncUser === true) {
      setActiveSaveConfig?.(syncedConfig);
    }
  }, [
    userConfig,
    savesLoaded,
    setAllSaves,
    loadName,
    saves,
    setActiveSaveConfig,
    allowedSaveConfigKeys,
  ]);

  // One-pass sanitization: keep savefile config payload minimal for all existing saves.
  useEffect(() => {
    if (!savesLoaded) return;
    setAllSaves((prev) => {
      let changed = false;
      const next = { ...(prev || {}) };
      Object.entries(prev || {}).forEach(([name, entry]) => {
        if (!entry || typeof entry !== "object") return;
        let nextEntry = entry;
        const legacyTreeConfig = entry?.tree?.config;

        if (entry.saveConfig && typeof entry.saveConfig === "object") {
          const sanitizedSaveConfig = extractSaveConfig(entry.saveConfig);
          if (JSON.stringify(entry.saveConfig) !== JSON.stringify(sanitizedSaveConfig)) {
            nextEntry = { ...nextEntry, saveConfig: sanitizedSaveConfig };
          }
        } else if (legacyTreeConfig && typeof legacyTreeConfig === "object") {
          // Migrate legacy tree.config to top-level saveConfig once.
          nextEntry = {
            ...nextEntry,
            saveConfig: extractSaveConfig(legacyTreeConfig),
          };
        }

        if (
          entry.tree &&
          typeof entry.tree === "object" &&
          Object.prototype.hasOwnProperty.call(entry.tree, "config")
        ) {
          const treeWithoutConfig = { ...entry.tree };
          delete treeWithoutConfig.config;
          nextEntry = {
            ...nextEntry,
            tree: treeWithoutConfig,
          };
        }

        if (nextEntry !== entry) {
          next[name] = nextEntry;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [savesLoaded, setAllSaves]);

  // Version 2 save: Only tree + name, no snapshots/checkpoints
  const handleSaveState = useCallback(
    (nameArg) => {
      const targetName =
        nameArg || loadName || prompt("Save name?", loadName || "");
      if (!targetName) return;
      
      // Serialize the history tree (using ref)
      const historyTree = historyTreeRef?.current;
      const serializedTree = historyTree && config
        ? serializeTree(historyTree)
        : null;
      
      if (!serializedTree) {
        updateStatus("Error: No history tree to save");
        return;
      }
      
      // Determine saveConfig to use:
      // 1. If overwriting an existing save, keep its values but sanitize to the
      //    savefile-only config subset.
      // 2. If creating a new save, copy the current user config subset.
      let saveConfigToUse = null;
      let syncUserToUse = false;
      const existingSave = saves[targetName];
      if (Object.prototype.hasOwnProperty.call(saves, targetName)) {
        saveConfigToUse = extractSaveConfig(
          existingSave?.saveConfig ?? existingSave?.tree?.config,
        );
        syncUserToUse = existingSave?.syncUser === true;
      } else {
        saveConfigToUse = extractSaveConfig(userConfig);
        syncUserToUse = true;
      }

      const computedTreeStats = computeSavefileTreeStats({
        treeData: serializedTree,
        saveConfig: saveConfigToUse,
        fallbackConfig: config,
      });
      if (computedTreeStats) {
        serializedTree.stats = computedTreeStats;
      }
      
      // Version 2 format: only tree and name
      saveSnapshot(targetName, {
        version: 2,
        name: targetName,
        tree: serializedTree,
        saveConfig: saveConfigToUse,
        syncUser: syncUserToUse,
        // No snapshot, no checkpoints - state is reconstructed from tree
      });
      
      // New saves immediately become the active save context.
      if (targetName !== loadName) {
        setActiveSaveConfig?.(saveConfigToUse);
      }
      
      setLoadName(targetName);
      // Update saved node count to mark current state as "saved"
      const tree = historyTreeRef?.current;
      setLastSavedNodeCount(tree?.nodes?.size ?? 0);
      updateStatus(`Saved "${targetName}" (v2)`);
    },
    [
      loadName,
      saves,
      saveSnapshot,
      setLoadName,
      setActiveSaveConfig,
      updateStatus,
      historyTreeRef,
      config,
      userConfig,
    ],
  );

  const handleLoadState = useCallback(
    (name, options = {}) => {
      if (!name) return;
      const saved = loadSnapshot(name);
      if (!saved) return;
      
      const loadHistoryTree = loadHistoryTreeRef?.current;
      
      // Apply savefile config if present (only if at least one savefile key exists)
      const sourceSaveConfig = saved.saveConfig ?? saved?.tree?.config;
      const hasSavefileConfigKeys =
        sourceSaveConfig &&
        typeof sourceSaveConfig === "object" &&
        !Array.isArray(sourceSaveConfig) &&
        Object.keys(sourceSaveConfig).some((key) => allowedSaveConfigKeys.has(key));
      if (hasSavefileConfigKeys) {
        setActiveSaveConfig?.(extractSaveConfig(sourceSaveConfig));
      } else {
        setActiveSaveConfig?.(null);
      }
      
      // Check if this is a Version 2 save (tree-based, no snapshot)
      const isVersion2 = saved.version === 2 || (saved.tree && !saved.snapshot);
      
      if (isVersion2) {
        if (!saved.tree) {
          console.error("Version 2 save has no tree data");
          updateStatus("Error: Invalid v2 save file");
          return;
        }
        if (!loadHistoryTree) {
          console.error("loadHistoryTree not available yet");
          updateStatus("Error: History system not ready");
          return;
        }
        
        // Version 2: Load from tree, jump to end of main branch
        try {
          const { historyTree: deserializedTree } = deserializeTree(saved.tree);
          const endNodeId = getMainBranchEndNodeId(deserializedTree);
          loadHistoryTree(deserializedTree, endNodeId);
          console.log("Loaded v2 tree with", deserializedTree.nodes.size, "nodes, jumping to node", endNodeId);
          
          setCarried(null);
          setMoveSnapshot(null);
          setMoveMode(false);
          setSellMode(false);
          setRefundMode(false);
          setBoostMode(false);
          setSelectedBuildingId(null);
          setLoadName(name);
          setActiveSnapshotName(null);
          // Update saved node count after load
          setLastSavedNodeCount(deserializedTree.nodes.size);
          updateStatus(options.statusOverride ?? `Load ${name} (v2)`);
        } catch (e) {
          console.error("Failed to load v2 save:", e);
          updateStatus("Error loading save file");
        }
        return;
      }
      
      // Version 1: Legacy snapshot-based loading
      const snap = saved?.snapshot ?? saved;
      if (!snap) return;
      const isSnapshot = !!saved?.meta?.isSnapshot;
      const snapIdx = saved?.meta?.snapshotIndex;
      const logText = saved?.meta?.log;
      const label =
        options.statusOverride ??
        (isSnapshot
          ? logText
            ? `Snapshot '${logText}'`
            : snapIdx
              ? `Snapshot ${snapIdx} geladen`
              : "Snapshot geladen"
          : `Load ${name}`);
      const snapshotToApply = isSnapshot ? { ...snap } : snap;
      if (isSnapshot && snapshotToApply.loadName !== undefined) {
        delete snapshotToApply.loadName;
      }
      applySnapshot(snapshotToApply);
      applyLoadedCheckpoints(saved?.checkpoints ?? [], 1, snap?.timeStep ?? 1);
      
      // Also load tree if present in v1 save (hybrid)
      if (saved?.tree && loadHistoryTree) {
        try {
          const { historyTree: deserializedTree } = deserializeTree(saved.tree);
          loadHistoryTree(deserializedTree, 0);
        } catch (e) {
          console.error("Failed to load history tree:", e);
        }
      }
      
      setCarried(null);
      setMoveSnapshot(null);
      if (isSnapshot) {
        setMoveMode(false);
        setSellMode(false);
        setRefundMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
        setSelectedSnapshotName(name);
        setActiveSnapshotName(name);
      } else {
        setMoveMode(false);
        setLoadName(name);
        setActiveSnapshotName(null);
      }
      updateStatus(label);
      if (options.createSnapshot && !isSnapshot) {
        requestAutoSnapshot({ waitForCheckpoint: false });
      }
    },
    [
      applySnapshot,
      loadSnapshot,
      updateStatus,
      setLoadName,
      applyLoadedCheckpoints,
      setCarried,
      setMoveSnapshot,
      setSelectedBuildingId,
      setSellMode,
      setRefundMode,
      setBoostMode,
      setMoveMode,
      requestAutoSnapshot,
      setSelectedSnapshotName,
      loadHistoryTreeRef,
      setActiveSnapshotName,
      allowedSaveConfigKeys,
    ],
  );

  const openPastEditModal = useCallback(() => {
    setPastEditModal(true);
  }, [setPastEditModal]);

  const closePastEditModal = useCallback(() => {
    setPastEditModal(false);
  }, [setPastEditModal]);

  const handleEnableEditFromPast = useCallback(() => {
    enableEditFromPast();
    updateStatus("Bearbeitung aktiviert. Zukuenftige Checkpoints entfernt.");
    setPastEditModal(false);
    requestAutoSnapshot();
  }, [enableEditFromPast, updateStatus, requestAutoSnapshot, setPastEditModal]);

  const handleCopyAndEnableEdit = useCallback(() => {
    const base = (loadName || "").trim();
    let idx = 1;
    let candidate = `${base}_copy${idx}`;
    while (saves[candidate]) {
      idx += 1;
      candidate = `${base}_copy${idx}`;
    }
    const snapshot = buildSnapshot();
    const latestCp = checkpoints[checkpoints.length - 1];
    const snapshotForSave =
      isPast && checkpointIndex !== null
        ? snapshot
        : (latestCp?.snapshot ?? snapshot);
    const stepForSave = latestCp?.timeStep ?? timeStep ?? 1;
    const checkpointsForSave = makeCheckpointsForSave(
      snapshotForSave,
      stepForSave,
      checkpointIndex,
      isPast,
    ).map((cp) => ({
      ...cp,
      snapshot: { ...(cp.snapshot ?? {}), loadName: candidate },
    }));
    saveSnapshot(candidate, {
      snapshot: { ...snapshotForSave, loadName: candidate },
      checkpoints: checkpointsForSave,
    });
    setLoadName(candidate);
    updateStatus(`Kopie gespeichert als "${candidate}"`);
    handleEnableEditFromPast();
  }, [
    loadName,
    saves,
    buildSnapshot,
    makeCheckpointsForSave,
    saveSnapshot,
    setLoadName,
    updateStatus,
    timeStep,
    handleEnableEditFromPast,
    checkpointIndex,
    isPast,
    checkpoints,
  ]);

  useEffect(() => {
    if (!pendingAutoSnapshot) return;
    if (carried) return;

    if (pendingAutoSnapshot.waitForCheckpoint) {
      const currentTailUid = checkpoints[checkpoints.length - 1]?.uid ?? null;
      if (currentTailUid === pendingAutoSnapshot.tailUid) return;
    }

    setPendingAutoSnapshot(null);
    handleTakeSnapshot();
  }, [pendingAutoSnapshot, carried, checkpoints, handleTakeSnapshot]);

  return {
    saves,
    visibleSaves,
    snapshots,
    loadName,
    setLoadName,
    savesLoaded,
    setAllSaves,
    saveSnapshot,
    loadSnapshot,
    deleteSave,
    requestAutoSnapshot,
    handleSaveState,
    handleTakeSnapshot,
    handleLoadState,
    openPastEditModal,
    closePastEditModal,
    handleCopyAndEnableEdit,
    handleEnableEditFromPast,
    selectedSnapshotName,
    setSelectedSnapshotName,
    addCheckpointPart: handleAddCheckpointPart,
    lastSavedNodeCount,
  };
};
