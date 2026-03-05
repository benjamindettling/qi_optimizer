import { useCheckpointManager } from "./useCheckpointManager";
import { useSaveManager } from "./useSaveManager";

// Combines checkpoint tracking with save/load helpers.
export const useSnapshotManager = (args) => {
  const checkpoint = useCheckpointManager(args);
  const save = useSaveManager({
    ...args,
    ...checkpoint,
    setExternalLoadName: args.setLoadName,
    externalLoadName: args.loadName,
    // Pass refs for history tree - they get populated after historyApi is created
    loadHistoryTreeRef: args.loadHistoryTreeRef,
    historyTreeRef: args.historyTreeRef,
    config: args.config,
    userConfig: args.userConfig,
    activeSaveConfig: args.activeSaveConfig,
    setActiveSaveConfig: args.setActiveSaveConfig,
  });

  return { ...checkpoint, ...save };
};
