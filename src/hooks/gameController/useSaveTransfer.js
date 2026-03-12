import { useCallback } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { fetchProfileUsername } from "../../firebase/usernameAuth";
import {
  findOwnSharedSaveByTitle,
  overwriteSharedSave,
  uploadSharedSave,
} from "../../firebase/sharedSaves";
import {
  serializeTree,
  deserializeTree,
  getMainBranchEndNodeId,
} from "../../utils/treeSerializer";
import {
  computeSavefileTreeStats,
  extractSaveConfig,
  SAVE_CONFIG_FIELDS,
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

// Export/import save files to JSON.
// Version 2: Only exports the history tree (no snapshots/checkpoints)
export const useSaveTransfer = ({
  saves,
  setAllSaves,
  setExportModal,
  setImportModal,
  historyTree,
  config,
  loadHistoryTree,
  loadName,
  setLoadName,
  setLoadSavesModal,
  setActiveSaveConfig,
}) => {
  const { user } = useAuth();

  const openExportSaves = useCallback(() => {
    setExportModal(true);
  }, [setExportModal]);

    const handleUploadSharedSave = useCallback(
    async (name) => {
      if (!name) return;
      if (!user?.uid) {
        alert("You must be logged in to upload a shared save.");
        return;
      }

      const saveEntry = saves?.[name];
      if (!saveEntry) {
        alert("Savefile not found.");
        return;
      }

      try {
        const ownerUsername = await fetchProfileUsername(user.uid);

        if (!ownerUsername) {
          alert("No username found for this account. Please set a username first.");
          return;
        }

        const existing = await findOwnSharedSaveByTitle({
          ownerUid: user.uid,
          title: name,
        });

        if (existing) {
          const shouldOverwrite = window.confirm(
            `You already uploaded a save called "${name}".\n\nPress OK to overwrite it, or Cancel to keep the existing online file.`,
          );

          if (!shouldOverwrite) return;

          await overwriteSharedSave({
            saveId: existing.id,
            saveEntry,
            ownerUid: user.uid,
            ownerUsername,
            title: name,
          });

          alert(`Shared save "${name}" was overwritten.`);
          return;
        }

        await uploadSharedSave({
          saveEntry,
          ownerUid: user.uid,
          ownerUsername,
          title: name,
        });

        alert(`Shared save "${name}" was uploaded.`);
      } catch (error) {
        console.error("Failed to upload shared save:", error);
        alert("Failed to upload shared save.");
      }
    },
    [saves, user],
  );

  const openImportSaves = useCallback(() => {
    setImportModal(true);
  }, [setImportModal]);

  const openLoadSavesModal = useCallback(() => {
    setLoadSavesModal?.(true);
  }, [setLoadSavesModal]);

  // Version 2 export: Only tree, no saves
  const handleExportSelected = useCallback(
    () => {
      // For v2, export only the current tree.

      // Serialize the history tree
      const serializedTree = historyTree && config
        ? serializeTree(historyTree)?.tree
        : null;

      if (!Array.isArray(serializedTree)) {
        console.error("No history tree to export");
        setExportModal(false);
        return;
      }
      const computedTreeStats = computeSavefileTreeStats({
        treeData: serializedTree,
        saveConfig: extractSaveConfig(config),
        fallbackConfig: config,
      });
      const sanitizedTreeStats = sanitizeSaveStats(computedTreeStats);

      // Version 2: Minimal payload with tree and name
      const payload = {
        version: 2,
        name: loadName || undefined,
        savedAt: new Date().toISOString(),
        tree: serializedTree,
        ...(sanitizedTreeStats ? { stats: sanitizedTreeStats } : {}),
      };
      
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const fileName = `QI_${pad(now.getMonth() + 1)}${pad(
        now.getDate(),
      )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(
        now.getSeconds(),
      )}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setExportModal(false);
    },
    [setExportModal, historyTree, config, loadName],
  );

  // Export individual savefile to JSON
  const handleExportSavefile = useCallback(
    (name) => {
      const save = saves?.[name];
      if (!save) return;

      const payload = {
        ...save,
      };
      // Keep export payload portable: omit local-only sync state and legacy checkpoints.
      delete payload.syncUser;
      delete payload.checkpoints;
      delete payload.saveConfig;
      if (Array.isArray(save?.tree)) {
        payload.tree = save.tree;
      } else if (save?.tree && typeof save.tree === "object") {
        payload.tree = Array.isArray(save.tree.tree) ? save.tree.tree : save.tree;
        if (
          !payload.stats &&
          save?.tree?.stats &&
          typeof save.tree.stats === "object" &&
          !Array.isArray(save.tree.stats)
        ) {
          payload.stats = save.tree.stats;
        }
      }
      const sanitizedPayloadStats = sanitizeSaveStats(payload.stats);
      if (sanitizedPayloadStats) {
        payload.stats = sanitizedPayloadStats;
      } else {
        delete payload.stats;
      }
      
      // Use the save name as filename
      const fileName = `${name}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    [saves],
  );

  // Rename a savefile
  const handleRenameSavefile = useCallback(
    (oldName, newName) => {
      if (!oldName || !newName || oldName === newName) return;

      setAllSaves((prev) => {
        if (!(oldName in prev)) return prev;

        const save = prev[oldName];
        const next = { ...prev };
        delete next[oldName];
        next[newName] = {
          ...save,
          // Update the name field in the save if it exists
          name: newName,
        };
        
        // Update loadName if we're renaming the currently loaded save
        if (loadName === oldName) {
          setLoadName?.(newName);
        }
        
        return next;
      });
    },
    [setAllSaves, loadName, setLoadName],
  );

  // Delete a savefile
  const handleDeleteSavefile = useCallback(
    (name) => {
      if (!name) return;

      setAllSaves((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });

      // Reset loadName if we deleted the currently loaded save
      if (loadName === name) {
        setLoadName?.("");
      }
    },
    [setAllSaves, loadName, setLoadName],
  );

  const handleImportSelected = useCallback(
    (entries, importData) => {
      // Check if this is a Version 2 import (tree-based)
      const isVersion2 = importData?.version === 2 || (importData?.tree && !importData?.saves?.length);
      
      if (isVersion2 && importData?.tree && loadHistoryTree) {
        // Version 2: Load tree and jump to end of main branch
        try {
          const { historyTree: deserializedTree } = deserializeTree(importData.tree);
          const endNodeId = getMainBranchEndNodeId(deserializedTree);
          loadHistoryTree(deserializedTree, endNodeId);
          console.log("Imported v2 tree with", deserializedTree.nodes.size, "nodes, jumping to node", endNodeId);
          
          // Create a save entry with the imported name and tree
          const saveName = importData.name || "Import";
          const importedSaveConfig =
            importData?.saveConfig ?? importData?.tree?.config;
          const importedTree = Array.isArray(importData?.tree)
            ? importData.tree
            : (Array.isArray(importData?.tree?.tree)
              ? importData.tree.tree
              : importData?.tree);
          const importedStats =
            (importData?.stats &&
              typeof importData.stats === "object" &&
              !Array.isArray(importData.stats))
              ? importData.stats
              : (importData?.tree?.stats &&
                  typeof importData.tree.stats === "object" &&
                  !Array.isArray(importData.tree.stats)
                ? importData.tree.stats
                : null);
          const sanitizedImportedStats = sanitizeSaveStats(importedStats);
          const importedLocalSaveConfig = extractSaveConfigFromStats(
            sanitizedImportedStats,
            importedSaveConfig,
          );
          setAllSaves((prev) => ({
            ...(prev || {}),
            [saveName]: {
              version: 2,
              name: saveName,
              tree: importedTree,
              ...(sanitizedImportedStats ? { stats: sanitizedImportedStats } : {}),
              saveConfig: importedLocalSaveConfig,
            },
          }));
          setActiveSaveConfig?.(importedLocalSaveConfig);
          setLoadName?.(saveName);
        } catch (e) {
          console.error("Failed to import v2 tree:", e);
        }
        setImportModal(false);
        return;
      }
      
      // Version 1: Legacy import with saves
      if (!entries?.length) {
        setImportModal(false);
        return;
      }
      
      // Also try to load tree if present in v1 import
      if (importData?.tree && loadHistoryTree) {
        try {
          const { historyTree: deserializedTree } = deserializeTree(importData.tree);
          loadHistoryTree(deserializedTree, 0);
          console.log("Imported v1 tree with", deserializedTree.nodes.size, "nodes");
        } catch (e) {
          console.error("Failed to import tree:", e);
        }
      }

      setAllSaves((prev) => {
        const next = { ...(prev || {}) };
        entries.forEach((entry) => {
          if (entry.name && entry.snapshot) {
            next[entry.name] = {
              snapshot: entry.snapshot,
              checkpoints: entry.checkpoints ?? [],
              meta: entry.meta ?? {},
            };
          }
        });
        return next;
      });
      setImportModal(false);
    },
    [setAllSaves, setImportModal, loadHistoryTree, setLoadName, setActiveSaveConfig],
  );

  // Update savefile config
  const handleUpdateSaveConfig = useCallback(
    (name, newConfig, options = {}) => {
      if (!name) return;
      const nextSyncUser = options?.syncUser === true;
      setAllSaves((prev) => {
        if (!(name in prev)) return prev;
        const save = prev[name];
        return {
          ...prev,
          [name]: {
            ...save,
            saveConfig: extractSaveConfig(newConfig),
            syncUser: nextSyncUser,
          },
        };
      });
      // If editing the currently loaded save, also update activeSaveConfig
      // so the board recalculates immediately
      if (name === loadName) {
        setActiveSaveConfig?.(extractSaveConfig(newConfig));
      }
    },
    [setAllSaves, loadName, setActiveSaveConfig],
  );

  // Create a synced copy with user config
  const handleSyncConfig = useCallback(
    (userConfig) => {
      if (!loadName || !saves[loadName]) return;
      
      const originalSave = saves[loadName];
      const newName = `${loadName}_SYNCED`;
      
      const syncedConfig = extractSaveConfig(userConfig);
      
      setAllSaves((prev) => ({
        ...prev,
        [newName]: {
          ...originalSave,
          name: newName,
          saveConfig: syncedConfig,
          syncUser: true,
        },
      }));
      
      setLoadName(newName);
      // Also update the active save config to reflect the synced config
      setActiveSaveConfig?.(syncedConfig);
      return newName;
    },
    [loadName, saves, setAllSaves, setLoadName, setActiveSaveConfig],
  );

    return {
    openExportSaves,
    openImportSaves,
    openLoadSavesModal,
    handleExportSelected,
    handleExportSavefile,
    handleUploadSharedSave,
    handleRenameSavefile,
    handleDeleteSavefile,
    handleImportSelected,
    handleUpdateSaveConfig,
    handleSyncConfig,
  };
};
