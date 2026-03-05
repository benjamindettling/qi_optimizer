import { useCallback } from "react";
import { serializeTree, deserializeTree, getMainBranchEndNodeId } from "../../utils/treeSerializer";
import { extractSaveConfig } from "../../utils/saveConfig";

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
  const openExportSaves = useCallback(() => {
    setExportModal(true);
  }, [setExportModal]);

  const openImportSaves = useCallback(() => {
    setImportModal(true);
  }, [setImportModal]);

  const openLoadSavesModal = useCallback(() => {
    setLoadSavesModal?.(true);
  }, [setLoadSavesModal]);

  // Version 2 export: Only tree, no saves
  const handleExportSelected = useCallback(
    (names) => {
      // For v2, we ignore the names and just export the tree
      // The names parameter is kept for backwards compatibility with the modal
      
      // Serialize the history tree with config
      const serializedTree = historyTree && config 
        ? serializeTree(historyTree, config)
        : null;

      if (!serializedTree) {
        console.error("No history tree to export");
        setExportModal(false);
        return;
      }

      // Version 2: Minimal payload with tree and name
      const payload = {
        version: 2,
        name: loadName || undefined,
        savedAt: new Date().toISOString(),
        tree: serializedTree,
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

      // Export the entire save entry
      const payload = save;
      
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
          setAllSaves((prev) => ({
            ...(prev || {}),
            [saveName]: {
              version: 2,
              name: saveName,
              tree: importData.tree,
            },
          }));
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
    [setAllSaves, setImportModal, loadHistoryTree, setLoadName],
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
            saveConfig: newConfig,
            syncUser: nextSyncUser,
          },
        };
      });
      // If editing the currently loaded save, also update activeSaveConfig
      // so the board recalculates immediately
      if (name === loadName) {
        setActiveSaveConfig?.(newConfig);
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
    handleRenameSavefile,
    handleDeleteSavefile,
    handleImportSelected,
    handleUpdateSaveConfig,
    handleSyncConfig,
  };
};
