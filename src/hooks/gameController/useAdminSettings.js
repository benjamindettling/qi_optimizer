import { useCallback } from "react";

// Admin toggles (infinite resources, etc.).
export const useAdminSettings = ({ editingLocked, updateStatus, setInfiniteResources }) => {
  const handleToggleInfinite = useCallback(
    (checked) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      setInfiniteResources(!!checked);
    },
    [editingLocked, updateStatus, setInfiniteResources],
  );

  return { handleToggleInfinite };
};
