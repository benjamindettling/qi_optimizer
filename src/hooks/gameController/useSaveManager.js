import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSaves } from "../useSaves";
import { useSnapshotHistory } from "./useSnapshotHistory";
import { serializeTree, deserializeTree, getMainBranchEndNodeId } from "../../utils/treeSerializer";
import {
  computeSavefileTreeStats,
  computeLocalLegality,
} from "../../utils/saveConfig";

const sanitizeSaveStats = (stats) => {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return null;
  if (
    !stats.final ||
    typeof stats.final !== "object" ||
    Array.isArray(stats.final) ||
    !Object.prototype.hasOwnProperty.call(stats.final, "finalStep")
  ) {
    return stats;
  }
  const nextFinal = { ...stats.final };
  delete nextFinal.finalStep;
  return {
    ...stats,
    final: nextFinal,
  };
};

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

  // One-pass sanitization: strip legacy saveConfig/syncUser/tree.config from existing saves.
  useEffect(() => {
    if (!savesLoaded) return;
    setAllSaves((prev) => {
      let changed = false;
      const next = { ...(prev || {}) };
      Object.entries(prev || {}).forEach(([name, entry]) => {
        if (!entry || typeof entry !== "object") return;
        let nextEntry = entry;

        // Strip legacy saveConfig and syncUser
        if (nextEntry.saveConfig !== undefined || nextEntry.syncUser !== undefined) {
          nextEntry = { ...nextEntry };
          delete nextEntry.saveConfig;
          delete nextEntry.syncUser;
        }

        // Normalize tree: unwrap { tree: [...], config: {...} } wrappers
        if (
          entry.tree &&
          typeof entry.tree === "object" &&
          !Array.isArray(entry.tree)
        ) {
          const treeObject = entry.tree;
          let normalizedTree = treeObject;
          if (Array.isArray(treeObject.tree)) {
            normalizedTree = treeObject.tree;
          } else if (Object.prototype.hasOwnProperty.call(treeObject, "config")) {
            const treeWithoutConfig = { ...treeObject };
            delete treeWithoutConfig.config;
            normalizedTree = treeWithoutConfig;
          }

          if (normalizedTree !== entry.tree) {
            nextEntry = {
              ...nextEntry,
              tree: normalizedTree,
            };
          }
        }

        // Migrate legacy tree.stats to top-level stats
        const legacyTreeStats = entry?.tree?.stats;
        if (
          !nextEntry?.stats &&
          legacyTreeStats &&
          typeof legacyTreeStats === "object" &&
          !Array.isArray(legacyTreeStats)
        ) {
          nextEntry = {
            ...nextEntry,
            stats: sanitizeSaveStats(legacyTreeStats),
          };
        }

        const currentStats = nextEntry?.stats;
        const sanitizedStats = sanitizeSaveStats(currentStats);
        if (currentStats !== undefined && !sanitizedStats) {
          nextEntry = { ...nextEntry };
          delete nextEntry.stats;
        } else if (
          sanitizedStats &&
          JSON.stringify(currentStats) !== JSON.stringify(sanitizedStats)
        ) {
          nextEntry = {
            ...nextEntry,
            stats: sanitizedStats,
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

  // Version 2 save: Only tree + name + stats (no saveConfig)
  const handleSaveState = useCallback(
    (nameArg) => {
      const targetName =
        nameArg || loadName || prompt("Save name?", loadName || "");
      if (!targetName) return;
      
      // Serialize the history tree (using ref)
      const historyTree = historyTreeRef?.current;
      const serializedTree = historyTree && config
        ? serializeTree(historyTree)?.tree
        : null;
      
      if (!Array.isArray(serializedTree)) {
        updateStatus("Error: No history tree to save");
        return;
      }

      // Compute stats with 0% boosts (hard minimum for all users)
      const computedTreeStats = sanitizeSaveStats(
        computeSavefileTreeStats({
          treeData: serializedTree,
          fallbackConfig: config,
        }),
      );
      
      // Version 2 format: tree + stats, no saveConfig
      saveSnapshot(targetName, {
        version: 2,
        name: targetName,
        tree: serializedTree,
        ...(computedTreeStats ? { stats: computedTreeStats } : {}),
        // No saveConfig, no syncUser - saves always use user's config on load
      });
      
      // Compute local legality flag using user's actual boosts and persist in localStorage
      const saveEntry = {
        tree: serializedTree,
        stats: computedTreeStats,
      };
      const isLegal = computeLocalLegality({ saveEntry, userConfig });
      try {
        const stored = JSON.parse(localStorage.getItem("qi_local_legality") || "{}");
        stored[targetName] = isLegal;
        localStorage.setItem("qi_local_legality", JSON.stringify(stored));
      } catch { /* ignore */ }

      setLoadName(targetName);
      // Update saved node count to mark current state as "saved"
      const tree = historyTreeRef?.current;
      setLastSavedNodeCount(tree?.nodes?.size ?? 0);
      updateStatus(`Saved "${targetName}" (v2)`);
    },
    [
      loadName,
      saveSnapshot,
      setLoadName,
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
      
      // Savefile configs are removed — always use the user's config.
      // No need to apply any per-save config.
      setActiveSaveConfig?.(null);
      
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
      setActiveSaveConfig,
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
