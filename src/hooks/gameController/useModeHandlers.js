import { useCallback } from "react";

// Mode toggles for move/sell/refund/boost and selection.
export const useModeHandlers = ({
  editingLocked,
  updateStatus,
  moveMode,
  carried,
  moveSnapshot,
  applySnapshot,
  setMoveMode,
  setSellMode,
  setRefundMode,
  setBoostMode,
  setSelectedBuildingId,
  setCarried,
  setMoveSnapshot,
  clearMoveChain,
}) => {
  const resetModes = useCallback(() => {
    setMoveMode(false);
    setSellMode(false);
    setRefundMode(false);
    setBoostMode(false);
    setSelectedBuildingId(null);
  }, [
    setMoveMode,
    setSellMode,
    setRefundMode,
    setBoostMode,
    setSelectedBuildingId,
  ]);

  const toggleMove = useCallback(() => {
    setMoveMode((prev) => {
      const next = !prev;
      if (next) {
        setSellMode(false);
        setRefundMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
      }
      if (!next) {
        if (carried && moveSnapshot) {
          applySnapshot(moveSnapshot);
          clearMoveChain?.();
        }
        setCarried(null);
        setMoveSnapshot(null);
      }
      return next;
    });
  }, [
    setMoveMode,
    setSellMode,
    setRefundMode,
    setBoostMode,
    setSelectedBuildingId,
    carried,
    moveSnapshot,
    applySnapshot,
    setCarried,
    setMoveSnapshot,
    clearMoveChain,
  ]);

  const resetMoveIfActive = useCallback(() => {
    if (moveMode && carried && moveSnapshot) {
      applySnapshot(moveSnapshot);
      clearMoveChain?.();
    }
    setCarried(null);
    setMoveSnapshot(null);
  }, [
    moveMode,
    carried,
    moveSnapshot,
    applySnapshot,
    setCarried,
    setMoveSnapshot,
    clearMoveChain,
  ]);

  const toggleSell = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    resetMoveIfActive();
    setSellMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setRefundMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  }, [
    editingLocked,
    updateStatus,
    resetMoveIfActive,
    setSellMode,
    setMoveMode,
    setRefundMode,
    setBoostMode,
    setSelectedBuildingId,
  ]);

  const toggleRefund = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    resetMoveIfActive();
    setRefundMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setSellMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  }, [
    editingLocked,
    updateStatus,
    resetMoveIfActive,
    setRefundMode,
    setMoveMode,
    setSellMode,
    setBoostMode,
    setSelectedBuildingId,
  ]);

  const toggleBoost = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    resetMoveIfActive();
    setBoostMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setSellMode(false);
        setRefundMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  }, [
    editingLocked,
    updateStatus,
    resetMoveIfActive,
    setBoostMode,
    setMoveMode,
    setSellMode,
    setRefundMode,
    setSelectedBuildingId,
  ]);

  const handleSelectBuilding = useCallback(
    (defId) => {
      if (!defId) return;
      setMoveMode(false);
      setSellMode(false);
      setRefundMode(false);
      setBoostMode(false);
      setSelectedBuildingId(defId);
    },
    [setMoveMode, setSellMode, setRefundMode, setBoostMode, setSelectedBuildingId],
  );

  return {
    resetModes,
    toggleMove,
    toggleSell,
    toggleRefund,
    toggleBoost,
    handleSelectBuilding,
  };
};
