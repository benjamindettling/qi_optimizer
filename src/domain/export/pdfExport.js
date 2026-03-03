import { flushSync } from "react-dom";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import { T } from "../../i18n/translations";
import { formatNumber } from "../../utils/formatNumber";
import { buildActionLogEntries } from "../../utils/actionLogEntries";
import {
  getSvgDimensions,
  serializeSvgNode,
  svgStringToPngDataUrl,
  waitForSvgReady,
} from "./svgExport";

const CHECKPOINT_TYPES = new Set([
  "finishProductions",
  "finishProductionsAdmin",
]);
const HARVEST_ALL_TYPES = new Set(["harvestAll", "harvestAllAdmin"]);
const SINGLE_HARVEST_TYPES = new Set(["harvest"]);
const imageCache = new Map();

const getTranslator = (lang) => (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

const isCheckpointAction = (action) => CHECKPOINT_TYPES.has(action?.type);
const isHarvestAction = (action) =>
  HARVEST_ALL_TYPES.has(action?.type) || SINGLE_HARVEST_TYPES.has(action?.type);

const getMainBranchNodeIds = (historyTree) => {
  const nodeIds = [];
  const nodes = historyTree?.nodes;
  let currentId = 0;
  const seen = new Set();

  while (currentId != null && nodes?.has?.(currentId) && !seen.has(currentId)) {
    seen.add(currentId);
    nodeIds.push(currentId);
    const node = nodes.get(currentId);
    currentId = node?.childrenIds?.[0] ?? null;
  }

  return nodeIds;
};

const buildExportSnapshot = (state, loadName) => ({
  resources: state?.resources ?? {},
  layout: state?.layout ?? [],
  unlockedRegions: state?.unlockedRegions ?? [],
  goodsUnlocks: state?.goodsUnlocks ?? 0,
  shardUnlocks: state?.shardUnlocks ?? 0,
  nextId: state?.nextId ?? 1,
  readyMap: state?.readyMap ?? {},
  buildLocks: state?.buildLocks ?? {},
  moveMode: false,
  sellMode: false,
  refundMode: false,
  boostMode: false,
  selectedCategory: null,
  notes: "",
  selectedIds: [],
  timeStep: state?.timeStep ?? 1,
  loadName: loadName ?? "",
  selectedBuildingId: null,
});

const buildSections = (historyTree) => {
  const nodes = historyTree?.nodes;
  const mainBranch = getMainBranchNodeIds(historyTree);
  const sections = [];
  let segmentNodeIds = [];

  const pushSection = () => {
    if (!segmentNodeIds.length) return;

    let postHarvestNodeId = segmentNodeIds[0];
    const firstHarvestIndex = segmentNodeIds.findIndex((nodeId) =>
      isHarvestAction(nodes.get(nodeId)?.action),
    );

    if (firstHarvestIndex >= 0) {
      for (let i = firstHarvestIndex; i < segmentNodeIds.length; i += 1) {
        const nodeId = segmentNodeIds[i];
        const nextNodeId = segmentNodeIds[i + 1] ?? null;
        const nextAction =
          nextNodeId != null ? nodes.get(nextNodeId)?.action : null;
        postHarvestNodeId = nodeId;
        if (!isHarvestAction(nextAction) && !isCheckpointAction(nextAction)) {
          break;
        }
      }
    } else {
      for (let i = 0; i < segmentNodeIds.length; i += 1) {
        const nodeId = segmentNodeIds[i];
        const nextNodeId = segmentNodeIds[i + 1] ?? null;
        const nextAction =
          nextNodeId != null ? nodes.get(nextNodeId)?.action : null;
        postHarvestNodeId = nodeId;
        if (!isHarvestAction(nextAction) && !isCheckpointAction(nextAction)) {
          break;
        }
      }
    }

    sections.push({
      postHarvestNodeId,
      endNodeId: segmentNodeIds[segmentNodeIds.length - 1],
    });
    segmentNodeIds = [];
  };

  for (let i = 1; i < mainBranch.length; i += 1) {
    const nodeId = mainBranch[i];
    const node = nodes.get(nodeId);
    if (!node?.action) continue;
    if (isCheckpointAction(node.action)) {
      pushSection();
      continue;
    }
    segmentNodeIds.push(nodeId);
  }

  pushSection();

  return sections;
};

const formatStepTitle = (timeStep, t) => {
  const stepVal = Math.max(1, Math.min(23, timeStep ?? 1));
  const dayNames = [
    t("stepDayThu"),
    t("stepDayFri"),
    t("stepDaySat"),
    t("stepDaySun"),
    t("stepDayMon"),
    t("stepDayTue"),
    t("stepDayWed"),
  ];
  const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
  const period = stepVal % 2 === 1 ? t("stepMorgen") : t("stepAbend");
  return `${t("stepLabel")} ${stepVal}, ${dayNames[dayIndex]} ${period}`;
};

const loadImageDataUrl = async (src) => {
  if (!src) return null;
  if (imageCache.has(src)) {
    return imageCache.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width || 1;
        canvas.height = image.naturalHeight || image.height || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not create image canvas."));
          return;
        }
        ctx.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`Failed to load image asset: ${src}`));
    image.src = src;
  });

  imageCache.set(src, promise);
  return promise;
};

const drawPageBackground = (pdf, pageWidth, pageHeight) => {
  pdf.setFillColor(13, 27, 42);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(16, 37, 60);
  pdf.rect(0, 0, pageWidth, 42, "F");
};

const drawPageTitle = (pdf, title, subtitle, pageWidth) => {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title, 18, 28);

  if (!subtitle) return;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(207, 219, 237);
  pdf.text(subtitle, pageWidth - 18, 28, { align: "right" });
};

const drawSectionHeading = (pdf, title, x, y) => {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(240, 244, 255);
  pdf.text(title, x, y);
};

const drawResourceRows = async (pdf, resources, t, { x, y, width }) => {
  const iconSize = 18;
  const rowHeight = 24;
  const iconGap = 10;
  const labelGap = 8;
  const rows = [
    { label: t("resourceCoins"), value: resources?.coins ?? 0, icon: moneyIcon },
    { label: t("resourceSupplies"), value: resources?.supplies ?? 0, icon: suppliesIcon },
    { label: t("resourceChronos"), value: resources?.chronos ?? 0, icon: chronosIcon },
  ];
  const iconDataUrls = await Promise.all(rows.map((row) => loadImageDataUrl(row.icon)));
  const blockHeight = rows.length * rowHeight + 12;

  pdf.setFillColor(16, 37, 60);
  pdf.roundedRect(x, y, width, blockHeight, 10, 10, "F");
  pdf.setDrawColor(31, 62, 99);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(x, y, width, blockHeight, 10, 10, "S");

  rows.forEach((row, index) => {
    const rowY = y + 10 + index * rowHeight;
    const iconDataUrl = iconDataUrls[index];
    if (iconDataUrl) {
      pdf.addImage(iconDataUrl, "PNG", x + 10, rowY, iconSize, iconSize);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(240, 244, 255);
    pdf.text(row.label, x + 10 + iconSize + iconGap, rowY + 12);

    pdf.setFont("courier", "bold");
    pdf.text(
      formatNumber(row.value),
      x + width - 10,
      rowY + 12,
      { align: "right" },
    );
  });

  return blockHeight;
};

const drawLogBlock = (pdf, entries, emptyText, { x, y, width, maxHeight }) => {
  const lineHeight = 14;
  const padding = 10;
  const lines = entries?.length ? entries.map((entry) => entry.text) : [emptyText];
  const maxLines = Math.max(1, Math.floor((maxHeight - padding * 2) / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const blockHeight = Math.min(maxHeight, visibleLines.length * lineHeight + padding * 2);

  pdf.setFillColor(16, 37, 60);
  pdf.roundedRect(x, y, width, blockHeight, 10, 10, "F");
  pdf.setDrawColor(31, 62, 99);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(x, y, width, blockHeight, 10, 10, "S");

  pdf.setFont("courier", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(240, 244, 255);

  visibleLines.forEach((line, index) => {
    pdf.text(line, x + padding, y + padding + 11 + index * lineHeight);
  });

  return blockHeight;
};

const drawSnapshotBlock = (pdf, snapshot, { x, y, width, height }) => {
  pdf.setFillColor(16, 37, 60);
  pdf.roundedRect(x, y, width, height, 10, 10, "F");
  pdf.setDrawColor(31, 62, 99);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(x, y, width, height, 10, 10, "S");

  if (!snapshot?.dataUrl || !snapshot?.width || !snapshot?.height) {
    return;
  }

  const innerPadding = 12;
  const availableWidth = width - innerPadding * 2;
  const availableHeight = height - innerPadding * 2;
  const scale = Math.min(
    availableWidth / Math.max(1, snapshot.width),
    availableHeight / Math.max(1, snapshot.height),
  );
  const drawWidth = snapshot.width * scale;
  const drawHeight = snapshot.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  pdf.addImage(snapshot.dataUrl, "PNG", drawX, drawY, drawWidth, drawHeight);
};

// Full PDF export flow for the main history branch.
export const exportBoardPdf = async ({
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
  setProgress,
}) => {
  const t = getTranslator(lang);
  void topBarRef;
  pauseCheckpointTracking();
  const prevSnapshot = buildSnapshot();
  const prevIndex = checkpointIndex;

  try {
    const { jsPDF } = await import("jspdf");
    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const margin = 18;
    const contentTop = 60;
    const leftColumnWidth = 300;
    const columnGap = 18;
    const rightColumnX = margin + leftColumnWidth + columnGap;
    const rightColumnWidth = pageWidth - rightColumnX - margin;

    const sections = buildSections(historyTree);
    const totalPages = Math.max(1, sections.length);

    setProgress?.({ current: 0, total: totalPages });

    const captureBoardSnapshot = async (state) => {
      const target = boardRef?.current;
      if (!target || !state) return null;

      flushSync(() => {
        applySnapshot(buildExportSnapshot(state, loadName));
        setCheckpointIndex(null);
      });

      await waitForSvgReady(target);
      const svgString = serializeSvgNode(target);
      const { width, height } = getSvgDimensions(target);
      const dataUrl = await svgStringToPngDataUrl(svgString, { width, height });
      return { dataUrl, width, height };
    };

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
      compress: true,
    });

    const renderSectionPage = async (section, sectionIndex) => {
      if (sectionIndex > 0) {
        pdf.addPage("a4", "landscape");
      }

      const postHarvestState = computeStateAtNode(section.postHarvestNodeId);
      const endState = computeStateAtNode(section.endNodeId);
      const logEntries = buildActionLogEntries({
        historyTree,
        selectedNodeId: section.postHarvestNodeId,
        libraryMap,
        shortIdMap,
        lang,
      });
      const screenshot = await captureBoardSnapshot(endState);

      drawPageBackground(pdf, pageWidth, pageHeight);
      drawPageTitle(
        pdf,
        formatStepTitle(endState.timeStep, t),
        loadName || "-",
        pageWidth,
      );

      drawSectionHeading(pdf, t("pdfExportPostHarvest"), margin, contentTop);
      const postHarvestHeight = await drawResourceRows(
        pdf,
        postHarvestState.resources,
        t,
        {
          x: margin,
          y: contentTop + 10,
          width: leftColumnWidth,
        },
      );

      drawSectionHeading(
        pdf,
        t("pdfExportActionLog"),
        margin,
        contentTop + 28 + postHarvestHeight,
      );
      const logTop = contentTop + 38 + postHarvestHeight;
      const endResourceTop = pageHeight - 110;
      drawLogBlock(pdf, logEntries, t("pdfExportNoActions"), {
        x: margin,
        y: logTop,
        width: leftColumnWidth,
        maxHeight: Math.max(80, endResourceTop - logTop - 26),
      });

      drawSectionHeading(pdf, t("pdfExportEndSection"), margin, endResourceTop - 12);
      await drawResourceRows(pdf, endState.resources, t, {
        x: margin,
        y: endResourceTop,
        width: leftColumnWidth,
      });

      drawSectionHeading(pdf, t("pdfExportBoardSnapshot"), rightColumnX, contentTop);
      drawSnapshotBlock(pdf, screenshot, {
        x: rightColumnX,
        y: contentTop + 10,
        width: rightColumnWidth,
        height: pageHeight - contentTop - margin,
      });
    };

    for (let i = 0; i < sections.length; i += 1) {
      await renderSectionPage(sections[i], i);
      setProgress?.({
        current: Math.min(totalPages, i + 1),
        total: totalPages,
      });
    }

    pdf.save(`QI_${loadName}_export.pdf`);
  } catch (error) {
    console.error("PDF export failed", error);
    alert(t("pdfExportFailed"));
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
