import { useCallback, useState } from "react";
import { exportBoardPdf } from "../../domain/export/pdfExport";
import { printBoardPng } from "../../domain/export/boardPrint";

// Orchestrates board PNG and PDF exports with progress state.
export function useBoardExport({
  boardRef,
  topBarRef,
  checkpoints,
  loadName,
  checkpointIndex,
  setCheckpointIndex,
  pauseCheckpointTracking,
  resumeCheckpointTracking,
  buildSnapshot,
  applySnapshot,
  harvestFullForPdf,
}) {
  const [pdfProgress, setPdfProgress] = useState(null);

  const handlePrint = useCallback(async () => {
    await printBoardPng({ boardRef, loadName });
  }, [boardRef, loadName]);

  const handleExportPdf = useCallback(async () => {
    if (!loadName) {
      alert("Bitte zuerst einen Spielstand waehlen.");
      return;
    }
    if (!checkpoints?.length) {
      alert("Keine Checkpoints vorhanden.");
      return;
    }

    setPdfProgress({ current: 0, total: checkpoints.length });
    await exportBoardPdf({
      checkpoints,
      loadName,
      boardRef,
      topBarRef,
      buildSnapshot,
      applySnapshot,
      checkpointIndex,
      setCheckpointIndex,
      pauseCheckpointTracking,
      resumeCheckpointTracking,
      harvestFullForPdf,
      setProgress: setPdfProgress,
    });
  }, [
    checkpoints,
    loadName,
    boardRef,
    topBarRef,
    buildSnapshot,
    applySnapshot,
    checkpointIndex,
    setCheckpointIndex,
    pauseCheckpointTracking,
    resumeCheckpointTracking,
    harvestFullForPdf,
  ]);

  return { handlePrint, handleExportPdf, pdfProgress };
}
