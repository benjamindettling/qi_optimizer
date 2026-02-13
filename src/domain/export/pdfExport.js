import { flushSync } from "react-dom";
import { buildInitialState } from "../../config/initialState";
import { buildSnapshot as buildSnapshotFromState } from "../../state/snapshot";
import { GOODS_TYPES, UNIT_TYPES } from "../../config/boardConfig";
import { buildBauplanLines, drawBauplanTextBlock } from "./pdfText";
import { createBoardCapturer, preloadTopBarAssets } from "./pdfCapture";

// Full PDF export flow for checkpoints.
export const exportBoardPdf = async ({
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
  setProgress,
}) => {
  const body = document.body;
  body.classList.add("print-mode");
  pauseCheckpointTracking();
  const prevSnapshot = buildSnapshot();
  const prevIndex = checkpointIndex;

  try {
    const PDF_BG_COLOR = "#132f4c";
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);

    const headerHeight = 40;
    const margin = 18;
    const columnGap = 18;
    const rightGap = 14;
    const leftColumnWidth = 320;
    const leftRowGap = 12;

    const timeLabel = (step) => {
      const found = checkpoints.find((c) => (c.timeStep ?? 1) === step);
      const base = `Schritt ${step}`;
      const title = found?.snapshot?.title;
      return title ? `${base} ${title}` : base;
    };

    const grouped = [];
    checkpoints.forEach((cp) => {
      const step = cp.timeStep ?? 1;
      let group = grouped.find((g) => g.timeStep === step);
      if (!group) {
        group = { timeStep: step, items: [] };
        grouped.push(group);
      }
      group.items.push(cp);
    });

    await preloadTopBarAssets({ goodsTypes: GOODS_TYPES, unitTypes: UNIT_TYPES });

    const { captureBoardImage, captureTopBarFiveCols } = createBoardCapturer({
      boardRef,
      topBarRef,
      html2canvas,
      applySnapshot,
      setCheckpointIndex,
      harvestFullForPdf,
      pdfBgColor: PDF_BG_COLOR,
    });

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const contentStartY = headerHeight + margin;
    const contentHeight = pageHeight - headerHeight - margin * 2;

    const leftX = margin;
    const leftW = leftColumnWidth;

    const rightX = margin + leftW + columnGap;
    const rightW = pageWidth - rightX - margin;

    let firstPage = true;

    const baseSnapshot = buildSnapshotFromState(buildInitialState());
    let prevForHarvestSnapshot = null;

    for (let g = 0; g < grouped.length; g += 1) {
      const group = grouped[g];
      const step = group.timeStep;
      const parts = group.items.length;
      const lastCp = group.items[parts - 1];

      const harvestSourceSnapshot = prevForHarvestSnapshot ?? baseSnapshot;

      const resAfterHarvestImg = await captureTopBarFiveCols(
        harvestSourceSnapshot,
        { withFullHarvest: !!prevForHarvestSnapshot },
      );

      const boardImgs = [];
      const bauplanLines = buildBauplanLines(group.items);

      for (let i = 0; i < group.items.length; i += 1) {
        const cp = group.items[i];
        const boardImg = await captureBoardImage(cp.snapshot);
        boardImgs.push(boardImg);
        setProgress((p) =>
          p ? { ...p, current: Math.min(p.total, p.current + 1) } : p,
        );
      }

      const resAfterBuildImg = await captureTopBarFiveCols(lastCp.snapshot, {
        withFullHarvest: false,
      });

      prevForHarvestSnapshot = lastCp.snapshot;

      if (!firstPage) {
        pdf.addPage("a4", "landscape");
      }
      firstPage = false;

      pdf.setFillColor(13, 27, 42);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      pdf.setFillColor(16, 37, 60);
      pdf.rect(0, 0, pageWidth, headerHeight, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text(timeLabel(step), margin, headerHeight - 12);

      let yLeft = contentStartY;

      const drawSectionTitle = (title) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.setTextColor(243, 246, 251);
        pdf.text(title, leftX, yLeft + 12);
        yLeft += 16;
      };

      const drawImageFitWidth = (img, maxHeight = null) => {
        if (!img) return 0;
        const scale = leftW / img.width;
        let h = img.height * scale;
        let w = leftW;
        if (maxHeight !== null && h > maxHeight) {
          const s2 = maxHeight / h;
          h = maxHeight;
          w = w * s2;
        }
        const x = leftX + (leftW - w) / 2;
        pdf.addImage(img.dataUrl, "PNG", x, yLeft, w, h);
        yLeft += h;
        return h;
      };

      const estTopH = (img) => (img ? img.height * (leftW / img.width) : 0);

      const labelsH = 16 * 3;
      const gapsH = leftRowGap * 2;
      const topbarsH = estTopH(resAfterHarvestImg) + estTopH(resAfterBuildImg);
      const notesAvailable = contentHeight - labelsH - gapsH - topbarsH;

      drawSectionTitle("Ressourcen nach der Ernte");
      drawImageFitWidth(resAfterHarvestImg);
      yLeft += leftRowGap;

      drawSectionTitle("Bauplan");
      const usedNotesH = drawBauplanTextBlock(pdf, bauplanLines, {
        x: leftX,
        y: yLeft,
        width: leftW,
        maxHeight: Math.max(40, notesAvailable),
      });
      yLeft += usedNotesH;
      yLeft += leftRowGap;

      drawSectionTitle("Ressourcen nach dem Bau");
      drawImageFitWidth(resAfterBuildImg);

      const nBoards = boardImgs.length;
      if (nBoards > 0) {
        const totalGaps = rightGap * (nBoards - 1);
        const slotH = (contentHeight - totalGaps) / nBoards;
        let yRight = contentStartY;

        for (let i = 0; i < nBoards; i += 1) {
          const img = boardImgs[i];
          if (!img) {
            yRight += slotH + rightGap;
            continue;
          }
          const scale = Math.min(rightW / img.width, slotH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = rightX + (rightW - w) / 2;
          const y = yRight + (slotH - h) / 2;
          pdf.addImage(img.dataUrl, "PNG", x, y, w, h);

          yRight += slotH + rightGap;
        }
      }
    }

    pdf.save(`QI_${loadName}_export.pdf`);
  } catch (e) {
    console.error("PDF Export fehlgeschlagen", e);
    alert("PDF Export fehlgeschlagen. Details in der Konsole.");
  } finally {
    try {
      flushSync(() => {
        applySnapshot(prevSnapshot);
        setCheckpointIndex(prevIndex);
      });
    } catch {
      // ignore
    }
    resumeCheckpointTracking();
    body.classList.remove("print-mode");
    setProgress(null);
  }
};
