import { useCallback, useState } from "react";
import { exportBoardPdf } from "../../domain/export/pdfExport";
import { printBoardPng } from "../../domain/export/boardPrint";
import { T } from "../../i18n/translations";

// Orchestrates board PNG and PDF exports with progress state.
export function useBoardExport({
  boardRef,
  topBarRef,
  historyTree,
  computeStateAtNode,
  libraryMap,
  shortIdMap,
  lang,
  loadName,
  checkpointIndex,
  setCheckpointIndex,
  pauseCheckpointTracking,
  resumeCheckpointTracking,
  buildSnapshot,
  applySnapshot,
}) {
  const [pdfProgress, setPdfProgress] = useState(null);
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const handlePrint = useCallback(async () => {
    await printBoardPng({ boardRef, loadName });
  }, [boardRef, loadName]);

  const handleExportPdf = useCallback(async () => {
    if (!loadName) {
      alert(t("pdfExportNoSave"));
      return;
    }
    if (!historyTree?.nodes || historyTree.nodes.size <= 1 || !computeStateAtNode) {
      alert(t("pdfExportNoHistory"));
      return;
    }

    setPdfProgress({ current: 0, total: 1 });
    await exportBoardPdf({
      historyTree,
      computeStateAtNode,
      libraryMap,
      shortIdMap,
      lang,
      loadName,
      boardRef,
      topBarRef,
      buildSnapshot,
      applySnapshot,
      checkpointIndex,
      setCheckpointIndex,
      pauseCheckpointTracking,
      resumeCheckpointTracking,
      setProgress: setPdfProgress,
    });
  }, [
    applySnapshot,
    boardRef,
    buildSnapshot,
    checkpointIndex,
    computeStateAtNode,
    historyTree,
    lang,
    libraryMap,
    loadName,
    pauseCheckpointTracking,
    resumeCheckpointTracking,
    setCheckpointIndex,
    shortIdMap,
    t,
    topBarRef,
  ]);

  return { handlePrint, handleExportPdf, pdfProgress };
}
