import { useCallback } from "react";

// Selection helpers for multi-select and auto-select.
export const useSelectionHandlers = ({
  editingLocked,
  updateStatus,
  requestAutoSnapshot,
  setSelectedIds,
  setAutoSelectNew,
}) => {
  const toggleSelectId = useCallback(
    (id) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!id) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      requestAutoSnapshot();
    },
    [editingLocked, updateStatus, requestAutoSnapshot, setSelectedIds],
  );

  const clearSelection = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    setSelectedIds(new Set());
  }, [editingLocked, updateStatus, setSelectedIds]);

  const toggleAutoSelectNew = useCallback(
    () => setAutoSelectNew((prev) => !prev),
    [setAutoSelectNew],
  );

  return { toggleSelectId, clearSelection, toggleAutoSelectNew };
};
