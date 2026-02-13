import { useCallback } from "react";

// Utilities that update checkpoints in bulk.
export const useCheckpointTools = ({
  editingLocked,
  updateStatus,
  updateCheckpoints,
  setResources,
  requestAutoSnapshot,
}) => {
  const applyStartBonusToCheckpoints = useCallback(
    (coinsDelta, suppliesDelta) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const coins = Number(coinsDelta ?? 0) || 0;
      const supplies = Number(suppliesDelta ?? 0) || 0;
      updateCheckpoints((prev) =>
        (prev || []).map((cp) => {
          const snapshot = cp.snapshot ?? {};
          const resourcesSnapshot = snapshot.resources ?? {};
          return {
            ...cp,
            snapshot: {
              ...snapshot,
              resources: {
                ...resourcesSnapshot,
                coins: (resourcesSnapshot.coins ?? 0) + coins,
                supplies: (resourcesSnapshot.supplies ?? 0) + supplies,
                goods: { ...(resourcesSnapshot.goods ?? {}) },
                units: { ...(resourcesSnapshot.units ?? {}) },
              },
            },
          };
        }),
      );
      setResources((prev) => ({
        ...prev,
        coins: (prev.coins ?? 0) + coins,
        supplies: (prev.supplies ?? 0) + supplies,
      }));
      updateStatus("Fuegte Startboni auf alle Checkpoints hinzu");
      requestAutoSnapshot({ waitForCheckpoint: false });
    },
    [
      editingLocked,
      requestAutoSnapshot,
      setResources,
      updateCheckpoints,
      updateStatus,
    ],
  );

  return { applyStartBonusToCheckpoints };
};
