// Snapshot navigation helpers for the toolbar controls.
import { useCallback, useMemo } from "react";

export function useSnapshotNavigation({
  snapshots,
  selectedSnapshotName,
  setSelectedSnapshotName,
  handleLoadState,
}) {
  const buildSnapshotStatus = useCallback((prefix, logText) => {
    if (prefix && logText) return `${prefix} '${logText}'`;
    if (prefix) return prefix;
    if (logText) return `Snapshot '${logText}'`;
    return undefined;
  }, []);

  const handleLoadSnapshot = useCallback(
    (name, statusOverride) => {
      if (!name) return;
      setSelectedSnapshotName(name);
      handleLoadState(name, { statusOverride });
    },
    [setSelectedSnapshotName, handleLoadState],
  );

  const selectedSnapshotIdx = useMemo(
    () => snapshots.findIndex((s) => s.name === selectedSnapshotName),
    [snapshots, selectedSnapshotName],
  );

  const handleSnapshotBack = useCallback(() => {
    if (selectedSnapshotIdx > 0) {
      const prev = snapshots[selectedSnapshotIdx - 1];
      const after = snapshots[selectedSnapshotIdx];
      const statusOverride = buildSnapshotStatus("Zurueck", after?.log);
      if (prev) handleLoadSnapshot(prev.name, statusOverride);
    }
  }, [selectedSnapshotIdx, snapshots, buildSnapshotStatus, handleLoadSnapshot]);

  const handleSnapshotForward = useCallback(() => {
    if (
      selectedSnapshotIdx >= 0 &&
      selectedSnapshotIdx < snapshots.length - 1
    ) {
      const next = snapshots[selectedSnapshotIdx + 1];
      const statusOverride = buildSnapshotStatus("Vorwaerts", next?.log);
      if (next) handleLoadSnapshot(next.name, statusOverride);
    }
  }, [selectedSnapshotIdx, snapshots, buildSnapshotStatus, handleLoadSnapshot]);

  return {
    handleLoadSnapshot,
    handleSnapshotBack,
    handleSnapshotForward,
  };
}
