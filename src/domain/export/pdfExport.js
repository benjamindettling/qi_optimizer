import { flushSync } from "react-dom";
import { buildInitialState } from "../../config/initialState";
import { buildSnapshot as buildSnapshotFromState } from "../../state/snapshot";
import { formatNumber } from "../../utils/formatNumber";
import { buildBauplanLines, drawBauplanTextBlock } from "./pdfText";
import {
  getSvgDimensions,
  serializeSvgNode,
  svgStringToElement,
  waitForSvgReady,
} from "./svgExport";

const groupByTimeStep = (checkpoints) => {
  const grouped = [];
  (checkpoints || []).forEach((cp) => {
    const step = cp.timeStep ?? 1;
    let group = grouped.find((entry) => entry.timeStep === step);
    if (!group) {
      group = { timeStep: step, items: [] };
      grouped.push(group);
    }
    group.items.push(cp);
  });
  return grouped;
};

const resourceLines = (resources = {}) => {
  const goods = resources.goods || {};
  const units = resources.units || {};

  const lines = [
    `Muenzen: ${formatNumber(resources.coins ?? 0)}`,
    `Vorraete: ${formatNumber(resources.supplies ?? 0)}`,
    `Chronos: ${formatNumber(resources.chronos ?? 0)}`,
    `Scherben: ${formatNumber(resources.shards ?? 0)}`,
    `QA: ${formatNumber(resources.quantumActions ?? 0)}`,
    "",
    "Gueter:",
  ];

  Object.entries(goods).forEach(([key, value]) => {
    lines.push(`${key}: ${formatNumber(value ?? 0)}`);
  });

  lines.push("", "Truppen:");
  Object.entries(units).forEach(([key, value]) => {
    lines.push(`${key}: ${formatNumber(value ?? 0)}`);
  });

  return lines;
};

const drawResourceBlock = (
  pdf,
  resources,
  { x, y, width, maxHeight, lineHeight = 12, padding = 8 },
) => {
  const lines = resourceLines(resources);
  const maxLines = Math.max(
    1,
    Math.floor((Math.max(24, maxHeight) - padding * 2) / lineHeight),
  );

  const clipped = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  const usedLines = truncated ? Math.max(1, clipped.length - 1) : clipped.length;
  const height = Math.min(maxHeight, usedLines * lineHeight + padding * 2);

  pdf.setFillColor(16, 37, 60);
  pdf.rect(x, y, width, height, "F");

  pdf.setDrawColor(31, 62, 99);
  pdf.setLineWidth(0.8);
  pdf.rect(x, y, width, height, "S");

  pdf.setFont("courier", "bold");
  pdf.setFontSize(10.5);
  pdf.setTextColor(240, 244, 255);

  let cursorY = y + padding + lineHeight - 2;
  clipped.forEach((line, idx) => {
    if (truncated && idx === clipped.length - 1) {
      pdf.text("...", x + padding, cursorY);
    } else {
      pdf.text(line, x + padding, cursorY);
    }
    cursorY += lineHeight;
  });

  return height;
};

// Full PDF export flow for checkpoints.
export const exportBoardPdf = async ({
  checkpoints,
  loadName,
  boardRef,
  buildSnapshot,
  applySnapshot,
  checkpointIndex,
  setCheckpointIndex,
  pauseCheckpointTracking,
  resumeCheckpointTracking,
  harvestFullForPdf,
  setProgress,
}) => {
  pauseCheckpointTracking();
  const prevSnapshot = buildSnapshot();
  const prevIndex = checkpointIndex;

  try {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([
      import("jspdf"),
      import("svg2pdf.js"),
    ]);

    const timeLabel = (step) => {
      const found = checkpoints.find((cp) => (cp.timeStep ?? 1) === step);
      const base = `Schritt ${step}`;
      const title = found?.snapshot?.title;
      return title ? `${base} ${title}` : base;
    };

    const captureBoardSvg = async (snapshot) => {
      const target = boardRef?.current;
      if (!target || !snapshot) return null;

      flushSync(() => {
        applySnapshot(snapshot);
        setCheckpointIndex(null);
      });

      await waitForSvgReady(target);

      return {
        svgString: serializeSvgNode(target),
        ...getSvgDimensions(target),
      };
    };

    const captureResources = async (snapshot, { withFullHarvest = false } = {}) => {
      if (!snapshot) return {};

      flushSync(() => {
        applySnapshot(snapshot);
        setCheckpointIndex(null);
      });

      await waitForSvgReady(boardRef?.current);

      if (withFullHarvest) {
        flushSync(() => {
          harvestFullForPdf?.(snapshot?.layout, snapshot?.buildLocks);
        });
        await waitForSvgReady(boardRef?.current);
      }

      return buildSnapshot()?.resources || {};
    };

    const grouped = groupByTimeStep(checkpoints);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const headerHeight = 40;
    const margin = 18;
    const columnGap = 18;
    const rightGap = 14;
    const leftColumnWidth = 320;
    const leftRowGap = 12;

    const contentStartY = headerHeight + margin;
    const contentHeight = pageHeight - headerHeight - margin * 2;

    const leftX = margin;
    const leftW = leftColumnWidth;

    const rightX = margin + leftW + columnGap;
    const rightW = pageWidth - rightX - margin;

    const baseSnapshot = buildSnapshotFromState(buildInitialState());
    let prevForHarvestSnapshot = null;
    let firstPage = true;

    for (let g = 0; g < grouped.length; g += 1) {
      const group = grouped[g];
      const step = group.timeStep;
      const items = group.items || [];
      const lastCheckpoint = items[items.length - 1];

      const harvestSource = prevForHarvestSnapshot ?? baseSnapshot;
      const resourcesAfterHarvest = await captureResources(harvestSource, {
        withFullHarvest: !!prevForHarvestSnapshot,
      });

      const boardSvgs = [];
      const bauplanLines = buildBauplanLines(items);

      for (let i = 0; i < items.length; i += 1) {
        const cp = items[i];
        const svgSnapshot = await captureBoardSvg(cp.snapshot);
        boardSvgs.push(svgSnapshot);
        setProgress((progress) =>
          progress
            ? {
                ...progress,
                current: Math.min(progress.total, progress.current + 1),
              }
            : progress,
        );
      }

      const resourcesAfterBuild = await captureResources(lastCheckpoint?.snapshot, {
        withFullHarvest: false,
      });

      prevForHarvestSnapshot = lastCheckpoint?.snapshot ?? prevForHarvestSnapshot;

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

      drawSectionTitle("Ressourcen nach der Ernte");
      const harvestH = drawResourceBlock(pdf, resourcesAfterHarvest, {
        x: leftX,
        y: yLeft,
        width: leftW,
        maxHeight: 150,
      });
      yLeft += harvestH + leftRowGap;

      drawSectionTitle("Bauplan");
      const notesMaxHeight = Math.max(
        50,
        contentHeight - (yLeft - contentStartY) - 150 - leftRowGap - 16,
      );
      const notesH = drawBauplanTextBlock(pdf, bauplanLines, {
        x: leftX,
        y: yLeft,
        width: leftW,
        maxHeight: notesMaxHeight,
      });
      yLeft += notesH + leftRowGap;

      drawSectionTitle("Ressourcen nach dem Bau");
      drawResourceBlock(pdf, resourcesAfterBuild, {
        x: leftX,
        y: yLeft,
        width: leftW,
        maxHeight: Math.max(50, contentStartY + contentHeight - yLeft),
      });

      const boardCount = boardSvgs.length;
      if (boardCount > 0) {
        const totalGaps = rightGap * (boardCount - 1);
        const slotH = (contentHeight - totalGaps) / boardCount;
        let yRight = contentStartY;

        for (let i = 0; i < boardCount; i += 1) {
          const boardSvg = boardSvgs[i];
          if (!boardSvg?.svgString) {
            yRight += slotH + rightGap;
            continue;
          }

          const scale = Math.min(
            rightW / Math.max(1, boardSvg.width),
            slotH / Math.max(1, boardSvg.height),
          );
          const drawW = boardSvg.width * scale;
          const drawH = boardSvg.height * scale;
          const drawX = rightX + (rightW - drawW) / 2;
          const drawY = yRight + (slotH - drawH) / 2;

          const svgElement = svgStringToElement(boardSvg.svgString);
          await svg2pdf(svgElement, pdf, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });

          yRight += slotH + rightGap;
        }
      }
    }

    pdf.save(`QI_${loadName}_export.pdf`);
  } catch (error) {
    console.error("PDF Export fehlgeschlagen", error);
    alert("PDF Export fehlgeschlagen. Details in der Konsole.");
  } finally {
    try {
      flushSync(() => {
        applySnapshot(prevSnapshot);
        setCheckpointIndex(prevIndex);
      });
    } catch {
      // ignore restore errors
    }

    resumeCheckpointTracking();
    setProgress(null);
  }
};
