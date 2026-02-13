import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SNAPSHOT_LIMIT = BigInt;

// Keeps snapshot history and auto-creates snapshots on load.
export const useSnapshotHistory = ({
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
}) => {
  const snapshots = useMemo(() => {
    const raw = Object.entries(saves || {})
      .filter(([, entry]) => entry?.meta?.isSnapshot)
      .map(([name, entry]) => ({ name, meta: entry.meta || {} }));
    const sorted = [...raw].sort((a, b) => {
      const ai = a.meta.snapshotIndex ?? 0;
      const bi = b.meta.snapshotIndex ?? 0;
      if (ai && bi && ai !== bi) return ai - bi;
      const ac = a.meta.createdAt || "";
      const bc = b.meta.createdAt || "";
      if (ac && bc && ac !== bc) return ac.localeCompare(bc);
      return a.name.localeCompare(b.name);
    });
    return sorted.map((entry, idx) => {
      const index = entry.meta.snapshotIndex ?? idx;
      const label = entry.meta.label || `Snapshot ${index}`;
      const log = entry.meta.log || "";
      return { name: entry.name, index, label, log };
    });
  }, [saves]);

  const initialSnapshotMadeRef = useRef(false);
  const [selectedSnapshotName, setSelectedSnapshotName] = useState(null);
  const [activeSnapshotName, setActiveSnapshotName] = useState(null);

  const handleTakeSnapshot = useCallback(() => {
    const orderedSnapshots = snapshots;
    const activeIdx =
      activeSnapshotName &&
      orderedSnapshots.some((snap) => snap.name === activeSnapshotName)
        ? orderedSnapshots.findIndex((snap) => snap.name === activeSnapshotName)
        : -1;
    const deleteNames = new Set(
      activeIdx >= 0 && activeIdx < orderedSnapshots.length - 1
        ? orderedSnapshots.slice(activeIdx + 1).map((snap) => snap.name)
        : [],
    );
    const remainingSnapshots = orderedSnapshots.filter(
      (snap) => !deleteNames.has(snap.name),
    );
    const maxIndex = remainingSnapshots.reduce(
      (max, entry) => Math.max(max, entry.index ?? -1),
      -1,
    );
    let index = maxIndex + 1;
    let snapshotName = `__snapshot_${index}`;

    const totalAfterAdd = remainingSnapshots.length + 1;
    if (totalAfterAdd > SNAPSHOT_LIMIT) {
      const removeCount = totalAfterAdd - SNAPSHOT_LIMIT;
      remainingSnapshots.slice(0, removeCount).forEach((snap) => {
        deleteNames.add(snap.name);
      });
    }

    while (saves[snapshotName] && !deleteNames.has(snapshotName)) {
      index += 1;
      snapshotName = `__snapshot_${index}`;
    }
    snapshots
      .filter((snap) => (snap.index ?? -1) > index)
      .forEach((snap) => {
        deleteNames.add(snap.name);
      });
    deleteNames.delete(snapshotName);

    const namesToDelete = Array.from(deleteNames);
    if (namesToDelete.length > 0) {
      setAllSaves((prev) => {
        const next = { ...prev };
        for (const name of namesToDelete) {
          delete next[name];
        }
        return next;
      });
    }

    const label = `Snapshot ${index}`;
    const snapshot = buildSnapshot();
    const latestCp = checkpoints[checkpoints.length - 1];
    const snapshotForSave = latestCp?.snapshot ?? snapshot;
    const stepForSave = latestCp?.timeStep ?? timeStep ?? 1;

    const rawCheckpointsForSave = makeCheckpointsForSave(
      snapshotForSave,
      stepForSave,
    );

    const patchedCheckpointsForSave =
      isPast && checkpointIndex !== null
        ? rawCheckpointsForSave.map((cp, idx) =>
            idx === checkpointIndex
              ? {
                  ...cp,
                  snapshot,
                  timeStep: cp.timeStep ?? stepForSave,
                }
              : cp,
          )
        : rawCheckpointsForSave;

    const checkpointsForSave = patchedCheckpointsForSave.map((cp) => ({
      ...cp,
      snapshot: { ...(cp.snapshot ?? {}), loadName: snapshotName },
    }));

    saveSnapshot(snapshotName, {
      snapshot: { ...snapshotForSave, loadName: snapshotName },
      checkpoints: checkpointsForSave,
      meta: {
        isSnapshot: true,
        snapshotIndex: index,
        createdAt: new Date().toISOString(),
        label,
        log: lastStatusRef.current || "",
      },
    });

    setSelectedSnapshotName(snapshotName);
    setActiveSnapshotName(snapshotName);
  }, [
    snapshots,
    activeSnapshotName,
    saves,
    buildSnapshot,
    checkpoints,
    timeStep,
    makeCheckpointsForSave,
    checkpointIndex,
    isPast,
    saveSnapshot,
    setAllSaves,
    lastStatusRef,
  ]);

  useEffect(() => {
    if (!savesLoaded) return;
    if (initialSnapshotMadeRef.current) return;
    initialSnapshotMadeRef.current = true;
    handleTakeSnapshot();
  }, [handleTakeSnapshot, savesLoaded]);

  useEffect(() => {
    if (!savesLoaded) return;
    if (!snapshots.length) {
      setSelectedSnapshotName(null);
      return;
    }
    const exists = snapshots.some((s) => s.name === selectedSnapshotName);
    if (!exists) {
      setSelectedSnapshotName(snapshots[0].name);
    }
  }, [snapshots, selectedSnapshotName, savesLoaded]);

  return {
    snapshots,
    selectedSnapshotName,
    setSelectedSnapshotName,
    setActiveSnapshotName,
    handleTakeSnapshot,
  };
};
