import { useCallback, useEffect } from "react";

// Notes updates + syncing when editing past checkpoints.
export const useNotesHandlers = ({
  notes,
  isPast,
  overwriteCheckpointAtIndex,
  buildSnapshot,
  setNotes,
  updateStatus,
}) => {
  useEffect(() => {
    if (!isPast) return;
    const timer = setTimeout(() => {
      overwriteCheckpointAtIndex(buildSnapshot());
    }, 0);
    return () => clearTimeout(timer);
  }, [notes, isPast, overwriteCheckpointAtIndex, buildSnapshot]);

  const handleChangeNotes = useCallback(
    (val) => {
      setNotes(val ?? "");
      updateStatus("Notizen geaendert");
    },
    [setNotes, updateStatus],
  );

  return { handleChangeNotes };
};
