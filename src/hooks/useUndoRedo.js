// Provides a reusable undo/redo stack hook backed by external snapshot helpers.

import { useCallback, useState } from "react";

/**
 * Generic undo/redo manager based on external snapshot builders.
 * buildSnapshot: () => snapshot
 * applySnapshot: (snapshot) => void
 */
export function useUndoRedo(buildSnapshot, applySnapshot) {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Push a snapshot onto undo history and clear redo.
  const pushHistory = useCallback((snapshot) => {
    setUndoStack((prev) => [snapshot, ...prev].slice(0, 50));
    setRedoStack([]);
  }, []);

  // Restore the latest undo snapshot and stash current into redo.
  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (!prevUndo.length) return prevUndo;
      const current = buildSnapshot();
      const [latest, ...rest] = prevUndo;
      setRedoStack((prevRedo) => [current, ...prevRedo].slice(0, 50));
      applySnapshot(latest);
      return rest;
    });
  }, [applySnapshot, buildSnapshot]);

  // Restore the latest redo snapshot and stash current into undo.
  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (!prevRedo.length) return prevRedo;
      const current = buildSnapshot();
      const [latest, ...rest] = prevRedo;
      setUndoStack((prevUndo) => [current, ...prevUndo].slice(0, 50));
      applySnapshot(latest);
      return rest;
    });
  }, [applySnapshot, buildSnapshot]);

  return { undoStack, redoStack, pushHistory, handleUndo, handleRedo };
}
