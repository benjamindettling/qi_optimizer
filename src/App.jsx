// Top-level app composition: assembles board, sidebar, toolbars, and modals.

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import "./index.css";
import { Board } from "./components/Board";
import { TopBar } from "./components/TopBar";
import { ShopSidebar } from "./components/ShopSidebar";
import { ActionToolbar } from "./components/ActionToolbar";
import {
  REGION_MASK,
  REGION_COLS,
  GOODS_TYPES,
  UNIT_TYPES,
} from "./config/boardConfig";
import { UnlockRegionModal } from "./components/modals/UnlockRegionModal";
import { ChooseGoodModal } from "./components/modals/ChooseGoodModal";
import { GoodsPurchaseModal } from "./components/modals/GoodsPurchaseModal";
import { UnitsPurchaseModal } from "./components/modals/UnitsPurchaseModal";
import { FastBuyModal } from "./components/modals/FastBuyModal";
import { HarvestModal } from "./components/modals/HarvestModal";
import { HelpModal } from "./components/modals/HelpModal";
import { ConfigModal } from "./components/modals/ConfigModal";
import { EditGoodModal } from "./components/modals/EditGoodModal";
import { EditUnitModal } from "./components/modals/EditUnitModal";
import { WorstRemovalModal } from "./components/modals/WorstRemovalModal";
import { ExportSavesModal } from "./components/modals/ExportSavesModal";
import { ImportSavesModal } from "./components/modals/ImportSavesModal";
import { PastEditWarningModal } from "./components/modals/PastEditWarningModal";
import { EditResourceModal } from "./components/modals/EditResourceModal";
import { useGameController } from "./hooks/useGameController";
import { buildInitialState } from "./state/initialState";
import { buildSnapshot as buildSnapshotFromState } from "./state/snapshot";

// Entry component that wires controller state into all UI pieces.
function App() {
  const [holdTooltip, setHoldTooltip] = useState(null);
  const holdTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const holdTriggeredRef = useRef(false);
  const boardRef = useRef(null);
  const topBarRef = useRef(null);
  const [selectMode, setSelectMode] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null);
  const {
    resources,
    layout,
    selectedIds,
    libraryMap,
    categoryColors,
    selectedCategory,
    setSelectedCategory,
    setSelectedBuildingId,
    unlockedRegions,
    goodsUnlocks,
    shardUnlocks,
    goodsModal,
    setGoodsModal,
    unitModal,
    setUnitModal,
    fastBuyModal,
    setFastBuyModal,
    setFastBuyTarget,
    unlockChoice,
    setUnlockChoice,
    unlockGoodSelect,
    setUnlockGoodSelect,
    viewMode,
    setViewMode,
    boardScale,
    setBoardScale,
    status,
    carried,
    readyMap,
    buildLocks,
    setHoverCell,
    moveMode,
    sellMode,
    refundMode,
    boostMode,
    saves,
    visibleSaves,
    snapshots,
    loadName,
    setLoadName,
    harvestModal,
    stats,
    happyInfo,
    previewOrigin,
    viewRotation,
    boardTransform,
    regionTransform,
    rotatedWidthPx,
    rotatedHeightPx,
    boardTransformClass,
    cellSizePx,
    viewWidth,
    viewHeight,
    viewColStart,
    viewRowStart,
    currentGoodsCost,
    currentShardCost,
    neighborUnlocked,
    canAnyUnlock,
    setGoodsUnlocks,
    setShardUnlocks,
    infiniteResources,
    handleToggleInfinite,
    handleCellClick,
    handleUnlockRegion,
    handleDebugUnlockRegion,
    handleDebugLockRegion,
    toggleMove,
    toggleSell,
    toggleRefund,
    finishProductions,
    toggleBoost,
    toggleSelectId,
    clearSelection,
    harvestAll,
    harvestFullForPdf,
    confirmHarvest,
    cancelHarvest,
    handleSaveState,
    handleTakeSnapshot,
    handleLoadState,
    deleteSave,
    handleGoodsPurchase,
    handleUnitPurchase,
    handleFastBuy,
    resetModes,
    handleEditResource,
    handleEditGood,
    handleEditUnit,
    editUnitModal,
    applyUnitEdit,
    cancelEditUnit,
    isCellUnlocked,
    notes,
    handleChangeNotes,
    useShortNames,
    setUseShortNames,
    helpModal,
    setHelpModal,
    configModal,
    setConfigModal,
    config,
    updateConfig,
    applyStartBonusToCheckpoints,
    editGoodModal,
    applyGoodEdit,
    cancelEditGood,
    editResourceModal,
    applyResourceEdit,
    cancelEditResource,
    worstModal,
    openWorstModal,
    setWorstModal,
    checkpoints,
    timeStep,
    setTimeStep,
    checkpointIndex,
    setCheckpointIndex,
    addCheckpointPart,
    currentPart,
    currentPartTotal,
    editUnlocked,
    isPast,
    editingLocked,
    canTimeBack,
    canTimeForward,
    jumpBackTime,
    jumpForwardTime,
    enableEditFromPast,
    exportModal,
    importModal,
    setExportModal,
    setImportModal,
    openExportSaves,
    openImportSaves,
    handleExportSelected,
    handleImportSelected,
    pastEditModal,
    openPastEditModal,
    closePastEditModal,
    handleCopyAndEnableEdit,
    handleEnableEditFromPast,
    autoSelectNew,
    toggleAutoSelectNew,
    buildSnapshot,
    applySnapshot,
    pauseCheckpointTracking,
    resumeCheckpointTracking,
    selectedSnapshotName,
    setSelectedSnapshotName,
  } = useGameController();

  const adminMode = infiniteResources;

  useEffect(() => {
    const body = document.body;
    if (!body) return;
    if (adminMode) body.classList.add("admin-theme");
    else body.classList.remove("admin-theme");
  }, [adminMode]);

  useEffect(() => {
    const clearTimer = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const onPointerDown = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const title = btn.getAttribute("title");
      if (!title) return;
      clearTimer();
      holdTriggeredRef.current = false;
      const { clientX, clientY } = e;
      holdTimerRef.current = setTimeout(() => {
        holdTriggeredRef.current = true;
        suppressClickRef.current = true;
        setHoldTooltip({ text: title, x: clientX, y: clientY });
      }, 700);
    };

    const onPointerUp = () => {
      clearTimer();
    };

    const onClickCapture = (e) => {
      if (suppressClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickRef.current = false;
        return;
      }
      if (holdTriggeredRef.current) {
        holdTriggeredRef.current = false;
      }
      if (holdTooltip) {
        setHoldTooltip(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      clearTimer();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [holdTooltip]);

  const harvestIsPartial = Object.values(readyMap || {}).some(Boolean);

  const findTargetInstance = (x, y) =>
    layout.find(
      (b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height
    );

  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      const next = !prev;
      if (next) {
        resetModes();
        setSelectedBuildingId(null);
      }
      return next;
    });
  };

  const handleBoardClick = (x, y) => {
    if (selectMode) {
      const target = findTargetInstance(x, y);
      if (target) {
        toggleSelectId(target.id);
      }
      return;
    }
    handleCellClick(x, y);
  };

  const handlePrint = async () => {
    // We temporarily tweak styles for export to counteract html2canvas' rendering,
    // then restore them no matter what happens.
    const body = document.body;
    body.classList.add("print-mode");

    try {
      const html2canvas = (await import("html2canvas")).default;
      const target = boardRef.current; // board only
      if (!target) return;
      const shouldIgnore = (el) =>
        el?.classList?.contains("pdf-progress-modal");

      // Using scale = 1 keeps the capture on the same pixel grid as your UI.
      const scale = 1;

      // Capture full page to avoid black screens from transforms, then crop.
      const fullCanvas = await html2canvas(document.body, {
        backgroundColor: null,
        scale,
        useCORS: true,
        cacheBust: false,
        imageTimeout: 0,
        allowTaint: true,
        logging: false,
        ignoreElements: shouldIgnore,
      });

      const rect = target.getBoundingClientRect();
      const cropCanvas = document.createElement("canvas");
      const cropWidth = Math.max(1, Math.round(rect.width * scale));
      const cropHeight = Math.max(1, Math.round(rect.height * scale));
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;

      const ctx = cropCanvas.getContext("2d");
      const offsetX = (rect.left + window.scrollX) * scale;
      const offsetY = (rect.top + window.scrollY) * scale;

      ctx.drawImage(
        fullCanvas,
        offsetX,
        offsetY,
        rect.width * scale,
        rect.height * scale,
        0,
        0,
        cropWidth,
        cropHeight
      );

      const dataUrl = cropCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${loadName || "current_setup"}.png`;
      a.click();
    } catch (e) {
      console.error("Failed to print board", e);
    } finally {
      body.classList.remove("print-mode");
    }
  };

  const handleExportPdf = async () => {
    if (!loadName) {
      alert("Bitte zuerst einen Spielstand waehlen.");
      return;
    }
    if (!checkpoints?.length) {
      alert("Keine Checkpoints vorhanden.");
      return;
    }

    setPdfProgress({ current: 0, total: checkpoints.length });
    const body = document.body;
    body.classList.add("print-mode");
    pauseCheckpointTracking();
    const prevSnapshot = buildSnapshot();
    const prevIndex = checkpointIndex;

    const waitForFrame = () =>
      new Promise((resolve) => requestAnimationFrame(() => resolve()));

    const preloadImages = async (urls, { timeoutMs = 5000 } = {}) => {
      const unique = Array.from(new Set((urls || []).filter(Boolean)));
      if (!unique.length) return;

      const withTimeout = (p) =>
        Promise.race([
          p,
          new Promise((resolve) => setTimeout(resolve, timeoutMs)),
        ]);

      await Promise.all(
        unique.map((url) =>
          withTimeout(
            new Promise((resolve) => {
              const img = new Image();
              // Same-origin in your setup; still set to be safe.
              img.crossOrigin = "anonymous";
              img.onload = () => {
                // decode() avoids layout shifts during capture when supported
                if (img.decode) {
                  img
                    .decode()
                    .catch(() => {})
                    .finally(resolve);
                } else {
                  resolve();
                }
              };
              img.onerror = () => resolve();
              img.src = url;
            })
          )
        )
      );
    };

    const preloadTopBarAssets = async () => {
      // Root-level icons used in TopBar.
      const baseIcons = [
        "/money.webp",
        "/supplies.webp",
        "/chronos.webp",
        "/population.webp",
        "/shards.webp",
        "/quantum_actions.webp",
      ];

      // Goods/units icons shown in the first 5 TopBar columns.
      const goods = (GOODS_TYPES || []).map(
        (g) => `/goods/${g === "Stein" ? "Backstein" : g}.webp`
      );
      const units = (UNIT_TYPES || []).map((u) => `/units/${u}.webp`);

      await preloadImages([...baseIcons, ...goods, ...units]);
    };

    const waitForBoardReady = async (
      rootEl,
      { idleMs = 40, timeoutMs = 2000 } = {}
    ) => {
      if (!rootEl) {
        // Fallback: still yield a couple frames to allow React to paint.
        await waitForFrame();
        await waitForFrame();
        return;
      }

      // Fonts can affect layout; wait briefly if the API is available.
      try {
        if (document?.fonts?.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise((r) => setTimeout(r, 500)),
          ]);
        }
      } catch {
        // ignore
      }

      // Wait for DOM to stop mutating for a short idle window.
      await new Promise((resolve) => {
        let done = false;
        let idleTimer = null;
        const finish = () => {
          if (done) return;
          done = true;
          if (idleTimer) clearTimeout(idleTimer);
          observer.disconnect();
          resolve();
        };

        const observer = new MutationObserver(() => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(finish, idleMs);
        });

        try {
          observer.observe(rootEl, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
        } catch {
          // If observe fails for any reason, fall back to frames.
          finish();
          return;
        }

        // Kick off idle timer in case no mutations happen.
        idleTimer = setTimeout(finish, idleMs);

        // Hard timeout guard.
        setTimeout(finish, timeoutMs);
      });

      // Ensure at least one paint after the last mutation.
      await waitForFrame();
    };

    try {
      const PDF_BG_COLOR = "#132f4c";
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      // A4 landscape in points (jsPDF). Keep values local to allow easy tuning.
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

      // Group checkpoints by timeStep (= timestamp). Preserve insertion order.
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

      // --- Bauplan notes: render as PDF text (no screenshot) ---
      // Notes are stored as plain text, but older exports/edits may include spans; strip any HTML tags.
      const stripHtml = (s) =>
        (s || "")
          .replace(/<\/?span[^>]*>/gi, "")
          .replace(/<br\s*\/?\s*>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trimEnd();

      const buildBauplanLines = (items) => {
        const parts = items?.length || 0;
        const lines = [];
        for (let idx = 0; idx < parts; idx += 1) {
          const cp = items[idx];
          if (idx > 0) lines.push({ type: "sep" });
          if (parts > 1) {
            lines.push({
              type: "title",
              text: `Teil ${idx + 1} von ${parts}`,
            });
          }
          const raw = stripHtml(cp?.snapshot?.notes || "");
          const rawLines = raw.split(/\n/).map((l) => l.trimEnd());
          const hasAny = rawLines.some((l) => l.trim().length > 0);
          if (!hasAny) {
            lines.push({ type: "text", text: "(keine Notizen)" });
          } else {
            rawLines.forEach((l) => {
              if (!l.trim()) return;
              lines.push({ type: "text", text: l });
            });
          }
        }
        return lines;
      };

      const drawBauplanTextBlock = (
        pdf,
        lines,
        { x, y, width, maxHeight, lineHeight = 14, paddingX = 6, paddingY = 4 }
      ) => {
        const startY = y;
        const innerW = Math.max(10, width - paddingX * 2);
        let cursorY = y;

        const setMono = (weight = "bold", size = 11) => {
          // jsPDF has built-in "courier". Using monospaced makes inline highlight positioning reliable.
          pdf.setFont("courier", weight);
          pdf.setFontSize(size);
        };

        const bgForLine = (t) => {
          const s = (t || "").trimStart();
          if (s.startsWith("->")) return { r: 7, g: 95, b: 167 }; // turquoise
          if (s.startsWith("+")) return { r: 47, g: 138, b: 79 }; // green
          // Important: differentiate '-' vs '->' (handled above)
          if (s.startsWith("-")) return { r: 163, g: 41, b: 41 }; // red
          return { r: 7, g: 95, b: 167 };
        };

        const highlightTokens = ["(1h)", "(boost)"];

        const drawLineWithInlineHighlights = (text, { bg }) => {
          if (!text) return;

          // Full-line background (only when a rule applies). Default stays the page blue.
          if (bg) {
            pdf.setFillColor(bg.r, bg.g, bg.b);
            pdf.rect(x, cursorY, width, lineHeight + paddingY, "F");
          }

          // Base text
          setMono("bold", 14);
          pdf.setTextColor(255, 255, 255);
          const textY = cursorY + lineHeight; // baseline
          pdf.text(text, x + paddingX, textY);

          // Inline yellow backgrounds for tokens (apply even if line has colored bg)
          // We'll paint yellow rects on top of the line bg and then redraw the token text.
          setMono("bold", 14);
          const baseX = x + paddingX;
          const baseYTop = cursorY + 2;
          const rectH = lineHeight + 1;

          for (const token of highlightTokens) {
            let fromIndex = 0;
            while (true) {
              const pos = text.indexOf(token, fromIndex);
              if (pos === -1) break;
              const before = text.slice(0, pos);
              const tok = token;
              const wBefore = pdf.getTextWidth(before);
              const wTok = pdf.getTextWidth(tok);
              pdf.setFillColor(184, 134, 11); // yellow
              pdf.rect(baseX + wBefore - 1, baseYTop, wTok + 2, rectH, "F");
              // Redraw token text (keep white as requested)
              pdf.setTextColor(255, 255, 255);
              pdf.text(tok, baseX + wBefore, textY);
              fromIndex = pos + tok.length;
            }
          }

          cursorY += lineHeight + paddingY;
        };

        // Iterate structured lines
        for (const ln of lines || []) {
          if (cursorY - startY > maxHeight - lineHeight * 1.5) {
            // Overflow indicator
            pdf.setTextColor(255, 255, 255);
            setMono("normal", 11);
            pdf.text("…", x + paddingX, cursorY + lineHeight);
            cursorY += lineHeight;
            break;
          }

          if (ln.type === "sep") {
            pdf.setDrawColor(240, 244, 255);
            pdf.setLineWidth(0.5);
            pdf.line(x, cursorY + 6, x + width, cursorY + 6);
            cursorY += 10;
            continue;
          }

          if (ln.type === "title") {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.setTextColor(240, 244, 255);
            pdf.text(ln.text || "", x + paddingX, cursorY + lineHeight);
            cursorY += lineHeight + paddingY;
            continue;
          }

          // Text line: apply prefix-based backgrounds and wrap.
          const text = ln.text || "";
          const bg = bgForLine(text);

          setMono("normal", 11);
          const wrapped = pdf.splitTextToSize(text, innerW);
          wrapped.forEach((w) => drawLineWithInlineHighlights(w, { bg }));
        }

        return cursorY - startY;
      };

      const cropCanvasToDataUrl = async (fullCanvas, rect) => {
        const cropCanvas = document.createElement("canvas");
        const scale = fullCanvas.width / document.body.scrollWidth;
        const cropWidth = Math.max(1, Math.floor(rect.width * scale));
        const cropHeight = Math.max(1, Math.floor(rect.height * scale));
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        const ctx = cropCanvas.getContext("2d");

        const offsetX = (rect.left + window.scrollX) * scale;
        const offsetY = (rect.top + window.scrollY) * scale;

        ctx.drawImage(
          fullCanvas,
          offsetX,
          offsetY,
          rect.width * scale,
          rect.height * scale,
          0,
          0,
          cropWidth,
          cropHeight
        );

        return {
          dataUrl: cropCanvas.toDataURL("image/png"),
          width: cropWidth,
          height: cropHeight,
        };
      };

      const cropElementCanvasToDataUrl = (
        elementCanvas,
        rectWithinEl,
        elementRect
      ) => {
        const cropCanvas = document.createElement("canvas");
        const scale = elementCanvas.width / Math.max(1, elementRect.width);
        const cropWidth = Math.max(1, Math.floor(rectWithinEl.width * scale));
        const cropHeight = Math.max(1, Math.floor(rectWithinEl.height * scale));
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        const ctx = cropCanvas.getContext("2d");

        const offsetX = rectWithinEl.left * scale;
        const offsetY = rectWithinEl.top * scale;

        ctx.drawImage(
          elementCanvas,
          offsetX,
          offsetY,
          rectWithinEl.width * scale,
          rectWithinEl.height * scale,
          0,
          0,
          cropWidth,
          cropHeight
        );

        return {
          dataUrl: cropCanvas.toDataURL("image/png"),
          width: cropWidth,
          height: cropHeight,
        };
      };

      const captureBoardImage = async (snapshot) => {
        const target = boardRef.current;
        if (!target) return null;

        flushSync(() => {
          applySnapshot(snapshot);
          setCheckpointIndex(null);
        });

        await waitForBoardReady(target);

        // Ensure the PDF progress modal (and its backdrop) never gets captured.
        const shouldIgnore = (el) =>
          !!(
            el?.classList?.contains("pdf-progress-modal") ||
            el?.closest?.(".pdf-progress-modal")
          );

        const fullCanvas = await html2canvas(document.body, {
          backgroundColor: PDF_BG_COLOR,
          scale: 1,
          useCORS: true,
          cacheBust: false,
          imageTimeout: 0,
          allowTaint: true,
          logging: false,
          ignoreElements: shouldIgnore,
        });

        return cropCanvasToDataUrl(fullCanvas, target.getBoundingClientRect());
      };

      // Capture only the first 5 "columns" of the TopBar: Resources, Goods, Units, Boosts, Happiness.
      const captureTopBarFiveCols = async (
        snapshot,
        { withFullHarvest } = {}
      ) => {
        const root =
          topBarRef.current || document.querySelector("header.topbar");
        const header = root?.querySelector
          ? root.querySelector("header.topbar") || root
          : root;

        if (!header) return null;

        flushSync(() => {
          applySnapshot(snapshot);
          setCheckpointIndex(null);
        });
        await waitForBoardReady(header);

        if (withFullHarvest) {
          flushSync(() => {
            // Use explicit overrides so the harvest matches the just-applied snapshot
            // even if React has not re-rendered yet.
            harvestFullForPdf?.(snapshot?.layout, snapshot?.buildLocks);
          });
          await waitForBoardReady(header);
        }

        const children = Array.from(header.children || []);
        const targets = children.slice(0, 5).filter(Boolean);
        if (!targets.length) return null;

        const rects = targets.map((el) => el.getBoundingClientRect());
        const rect = {
          left: Math.min(...rects.map((r) => r.left)),
          top: Math.min(...rects.map((r) => r.top)),
          width:
            Math.max(...rects.map((r) => r.right)) -
            Math.min(...rects.map((r) => r.left)),
          height:
            Math.max(...rects.map((r) => r.bottom)) -
            Math.min(...rects.map((r) => r.top)),
        };

        const headerRect = header.getBoundingClientRect();

        const headerCanvas = await html2canvas(header, {
          backgroundColor: PDF_BG_COLOR,
          scale: 1,
          useCORS: true,
          cacheBust: false,
          imageTimeout: 0,
          allowTaint: true,
          logging: false,
        });

        const relRect = {
          left: rect.left - headerRect.left,
          top: rect.top - headerRect.top,
          width: rect.width,
          height: rect.height,
        };

        return cropElementCanvasToDataUrl(headerCanvas, relRect, headerRect);
      };

      await preloadTopBarAssets();

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

      // Base snapshot for Schritt 1 "nach der Ernte" (no prior checkpoint).
      const baseSnapshot = buildSnapshotFromState(buildInitialState());

      let prevForHarvestSnapshot = null;

      for (let g = 0; g < grouped.length; g++) {
        const group = grouped[g];
        const step = group.timeStep;
        const parts = group.items.length;
        const lastCp = group.items[parts - 1];

        const harvestSourceSnapshot = prevForHarvestSnapshot ?? baseSnapshot;

        // Capture Ressourcen nach der Ernte
        const resAfterHarvestImg = await captureTopBarFiveCols(
          harvestSourceSnapshot,
          { withFullHarvest: !!prevForHarvestSnapshot } // only harvest if there was a prior checkpoint
        );

        // Capture boards for partial checkpoints, and build combined Bauplan notes as PDF text.
        const boardImgs = [];
        const bauplanLines = buildBauplanLines(group.items);

        for (let i = 0; i < group.items.length; i += 1) {
          const cp = group.items[i];
          const boardImg = await captureBoardImage(cp.snapshot);
          boardImgs.push(boardImg);
          setPdfProgress((p) =>
            p ? { ...p, current: Math.min(p.total, p.current + 1) } : p
          );
        }

        // Capture Ressourcen nach dem Bau (TopBar of last partial checkpoint)
        const resAfterBuildImg = await captureTopBarFiveCols(lastCp.snapshot, {
          withFullHarvest: false,
        });

        // Prepare next iteration: the next step's harvest is based on the last partial of THIS step.
        prevForHarvestSnapshot = lastCp.snapshot;

        if (!firstPage) {
          pdf.addPage("a4", "landscape");
        }
        firstPage = false;

        // Background
        pdf.setFillColor(19, 47, 76);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        // Header bar
        pdf.setFillColor(15, 30, 48);
        pdf.rect(0, 0, pageWidth, headerHeight, "F");

        // Header text
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(243, 246, 251);
        pdf.text(timeLabel(step), margin, headerHeight - 12);

        // Left column layout
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

        // Compute how much space to allocate to notes (whatever remains between the two topbars)
        // First, estimate topbar heights after width-fit.
        const estTopH = (img) => (img ? img.height * (leftW / img.width) : 0);

        const labelsH = 16 * 3; // three section titles
        const gapsH = leftRowGap * 2;
        const topbarsH =
          estTopH(resAfterHarvestImg) + estTopH(resAfterBuildImg);
        const notesAvailable = contentHeight - labelsH - gapsH - topbarsH;

        drawSectionTitle("Ressourcen nach der Ernte");
        drawImageFitWidth(resAfterHarvestImg);
        yLeft += leftRowGap;

        drawSectionTitle("Bauplan");
        // Draw Bauplan as real PDF text with conditional backgrounds.
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

        // Right column: partial checkpoint boards stacked vertically
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
      setPdfProgress(null);
    }
  };

  const findSnapshotByName = (name) =>
    snapshots.find((s) => s.name === name) || null;

  const buildSnapshotStatus = (prefix, logText) => {
    if (prefix && logText) return `${prefix} '${logText}'`;
    if (prefix) return prefix;
    if (logText) return `Snapshot '${logText}'`;
    return undefined;
  };

  const handleLoadSnapshot = (name, statusOverride) => {
    if (!name) return;
    setSelectMode(false);
    setSelectedSnapshotName(name);
    handleLoadState(name, { statusOverride });
  };
  const selectedSnapshotIdx = snapshots.findIndex(
    (s) => s.name === selectedSnapshotName
  );
  const handleSnapshotBack = () => {
    if (selectedSnapshotIdx > 0) {
      const prev = snapshots[selectedSnapshotIdx - 1];
      const after = snapshots[selectedSnapshotIdx];
      const statusOverride = buildSnapshotStatus("Zurueck", after?.log);
      if (prev) handleLoadSnapshot(prev.name, statusOverride);
    }
  };
  const handleSnapshotForward = () => {
    if (
      selectedSnapshotIdx >= 0 &&
      selectedSnapshotIdx < snapshots.length - 1
    ) {
      const next = snapshots[selectedSnapshotIdx + 1];
      const statusOverride = buildSnapshotStatus("Vorwaerts", next?.log);
      if (next) handleLoadSnapshot(next.name, statusOverride);
    }
  };

  return (
    <div className="page layout-row">
      <ShopSidebar
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        setSelectedBuildingId={setSelectedBuildingId}
        resources={resources}
        stats={stats}
        editingLocked={editingLocked}
        infiniteResources={infiniteResources}
        viewMode={viewMode}
        regionTransform={regionTransform}
        unlockedRegions={unlockedRegions}
        regionMask={REGION_MASK}
        neighborUnlocked={neighborUnlocked}
        currentGoodsCost={currentGoodsCost}
        currentShardCost={currentShardCost}
        goodsUnlocks={goodsUnlocks}
        shardUnlocks={shardUnlocks}
        onSetGoodsUnlocks={setGoodsUnlocks}
        onSetShardUnlocks={setShardUnlocks}
        canAnyUnlock={canAnyUnlock}
        handleUnlockRegion={handleUnlockRegion}
        REGION_COLS={REGION_COLS}
        adminMode={adminMode}
        onResetModes={resetModes}
        onDebugUnlockRegion={handleDebugUnlockRegion}
        onDebugLockRegion={handleDebugLockRegion}
      />

      <div className="content-column">
        <div ref={topBarRef}>
          <TopBar
            resources={resources}
            stats={stats}
            happyInfo={happyInfo}
            viewMode={viewMode}
            setViewMode={setViewMode}
            adminMode={adminMode}
            onToggleAdmin={handleToggleInfinite}
            useShortNames={useShortNames}
            setUseShortNames={setUseShortNames}
            onOpenConfig={() => setConfigModal(true)}
            onOpenHelp={() => setHelpModal(true)}
            boardScale={boardScale}
            setBoardScale={setBoardScale}
            onEditResource={handleEditResource}
            onEditGood={handleEditGood}
            onEditUnit={handleEditUnit}
            editingLocked={editingLocked}
          />
        </div>{" "}
        <div className="workspace">
          <div className="board-area">
            <Board
              viewRotation={viewRotation}
              boardTransform={boardTransform}
              rotatedWidthPx={rotatedWidthPx}
              rotatedHeightPx={rotatedHeightPx}
              viewWidth={viewWidth}
              viewHeight={viewHeight}
              viewColStart={viewColStart}
              viewRowStart={viewRowStart}
              cellSizePx={cellSizePx}
              previewOrigin={previewOrigin}
              isCellUnlocked={isCellUnlocked}
              handleCellClick={handleBoardClick}
              setHoverCell={setHoverCell}
              onDropComplete={() => setSelectedBuildingId(null)}
              boardRef={boardRef}
              selectedIds={selectedIds}
              layout={layout}
              libraryMap={libraryMap}
              categoryColors={categoryColors}
              boardTransformClass={boardTransformClass}
              buildLocks={buildLocks}
              readyMap={readyMap}
              useShortNames={useShortNames}
            />
            {status && <div className="status">{status}</div>}
            {carried && (
              <div className="carry-banner">Carrying {carried.def.name}</div>
            )}
          </div>
          <ActionToolbar
            moveMode={moveMode}
            onToggleMove={() => {
              setSelectMode(false);
              toggleMove();
            }}
            sellMode={sellMode}
            refundMode={refundMode}
            onToggleSell={() => {
              setSelectMode(false);
              toggleSell();
            }}
            onToggleRefund={() => {
              setSelectMode(false);
              toggleRefund();
            }}
            onToggleBoost={() => {
              setSelectMode(false);
              toggleBoost();
            }}
            finishProductions={finishProductions}
            harvestIsPartial={harvestIsPartial}
            boostMode={boostMode}
            harvestAll={harvestAll}
            onSave={handleSaveState}
            onLoad={(name) => handleLoadState(name, { createSnapshot: true })}
            saves={visibleSaves}
            snapshots={snapshots}
            onCreateSnapshot={handleTakeSnapshot}
            onLoadSnapshot={handleLoadSnapshot}
            selectedSnapshotName={selectedSnapshotName}
            onSnapshotBack={handleSnapshotBack}
            onSnapshotForward={handleSnapshotForward}
            loadName={loadName}
            setLoadName={setLoadName}
            notes={notes}
            onChangeNotes={handleChangeNotes}
            selectMode={selectMode}
            onToggleSelectMode={toggleSelectMode}
            autoSelectNew={autoSelectNew}
            onToggleAutoSelectNew={toggleAutoSelectNew}
            onPrintBoard={handlePrint}
            onFindWorst={openWorstModal}
            timeStep={timeStep}
            canTimeBack={canTimeBack}
            canTimeForward={canTimeForward}
            onStepBack={jumpBackTime}
            onStepForward={jumpForwardTime}
            onAddCheckpoint={addCheckpointPart}
            isLatestCheckpoint={checkpointIndex === null}
            timePart={currentPart}
            timePartTotal={currentPartTotal}
            isPast={isPast}
            editUnlocked={editUnlocked}
            onOpenPastEditWarning={openPastEditModal}
            editingLocked={editingLocked}
            onOpenExport={openExportSaves}
            onOpenImport={openImportSaves}
            onExportPdf={handleExportPdf}
            onDeleteSave={(name) => {
              deleteSave(name);
              setLoadName((prev) => (prev === name ? "" : prev));
            }}
          />
        </div>
      </div>
      {holdTooltip && (
        <div
          className="hold-tooltip"
          style={{
            position: "fixed",
            left: holdTooltip.x + 12,
            top: holdTooltip.y + 12,
            zIndex: 9999,
            pointerEvents: "none",
            background: "#1f3e63",
            color: "#e9f1ff",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #4f7dbd",
            boxShadow: "0 6px 12px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          {holdTooltip.text}
        </div>
      )}
      <UnlockRegionModal
        unlockChoice={unlockChoice}
        onChooseGoods={(idx, goodsCost) => {
          setUnlockGoodSelect({ idx, goodsCost });
          setUnlockChoice(null);
        }}
        onUnlockWithShards={(idx) => handleUnlockRegion(idx, "shards")}
        onCancel={() => setUnlockChoice(null)}
      />

      <ChooseGoodModal
        unlockGoodSelect={unlockGoodSelect}
        goods={resources.goods}
        layout={layout}
        libraryMap={libraryMap}
        onUnlockWithGood={(idx, goodKey) =>
          handleUnlockRegion(idx, "goods", goodKey)
        }
        onCancel={() => setUnlockGoodSelect(null)}
      />

      <HarvestModal
        harvestModal={harvestModal}
        onConfirm={confirmHarvest}
        onCancel={cancelHarvest}
      />

      <GoodsPurchaseModal
        goodsModal={goodsModal}
        onPurchase={handleGoodsPurchase}
        onClose={() => setGoodsModal(null)}
      />
      <UnitsPurchaseModal
        unitModal={unitModal}
        onPurchase={handleUnitPurchase}
        onClose={() => setUnitModal(null)}
      />
      <EditUnitModal
        modal={editUnitModal}
        onSave={applyUnitEdit}
        onClose={cancelEditUnit}
      />
      <EditGoodModal
        modal={editGoodModal}
        onSave={(val) => applyGoodEdit(val, false)}
        onSaveAll={(val) => applyGoodEdit(val, true)}
        onClose={cancelEditGood}
      />
      <EditResourceModal
        modal={editResourceModal}
        onSave={applyResourceEdit}
        onClose={cancelEditResource}
      />

      <FastBuyModal
        fastBuyModal={fastBuyModal}
        onFastBuy={handleFastBuy}
        onCancel={() => {
          setFastBuyModal(null);
          setFastBuyTarget(null);
        }}
      />
      <HelpModal open={!!helpModal} onClose={() => setHelpModal(false)} />
      <ConfigModal
        open={!!configModal}
        onClose={() => setConfigModal(false)}
        config={config}
        onSave={updateConfig}
        onApplyStartBonus={applyStartBonusToCheckpoints}
      />
      <ExportSavesModal
        open={!!exportModal}
        saves={visibleSaves}
        onClose={() => setExportModal(false)}
        onExport={handleExportSelected}
      />
      <ImportSavesModal
        open={!!importModal}
        onClose={() => setImportModal(false)}
        onImport={handleImportSelected}
      />
      <WorstRemovalModal
        open={!!worstModal}
        data={worstModal}
        onClose={() => setWorstModal(null)}
      />
      <PastEditWarningModal
        open={pastEditModal}
        onCopyAndContinue={handleCopyAndEnableEdit}
        onContinue={handleEnableEditFromPast}
        onCancel={closePastEditModal}
        currentName={loadName}
      />
      {pdfProgress && (
        <div className="modal pdf-progress-modal">
          <div className="modal-card">
            <h3 className="modal-title">PDF wird erstellt...</h3>
            <div className="pdf-progress-bar">
              {Array.from({ length: pdfProgress.total }).map((_, idx) => {
                const filled = idx < pdfProgress.current;
                return (
                  <span
                    key={idx}
                    className={`pdf-progress-block ${filled ? "filled" : ""}`}
                  />
                );
              })}
            </div>
            <div className="pdf-progress-text">
              {pdfProgress.current} / {pdfProgress.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
