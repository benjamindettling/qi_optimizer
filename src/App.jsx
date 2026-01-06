// Top-level app composition: assembles board, sidebar, toolbars, and modals.

import { useEffect, useRef, useState } from "react";
import "./index.css";
import { Board } from "./components/Board";
import { TopBar } from "./components/TopBar";
import { ShopSidebar } from "./components/ShopSidebar";
import { ActionToolbar, formatNotesHtml } from "./components/ActionToolbar";
import { REGION_MASK, REGION_COLS } from "./config/boardConfig";
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

// Entry component that wires controller state into all UI pieces.
function App() {
  const [holdTooltip, setHoldTooltip] = useState(null);
  const holdTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const holdTriggeredRef = useRef(false);
  const boardRef = useRef(null);
  const [selectMode, setSelectMode] = useState(false);
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
    confirmHarvest,
    cancelHarvest,
    handleSaveState,
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

      // Using scale = 1 keeps the capture on the same pixel grid as your UI.
      const scale = 1;

      // Capture full page to avoid black screens from transforms, then crop.
      const fullCanvas = await html2canvas(document.body, {
        backgroundColor: null,
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
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

    const body = document.body;
    body.classList.add("print-mode");
    pauseCheckpointTracking();
    const prevSnapshot = buildSnapshot();
    const prevIndex = checkpointIndex;
    const prevTime = timeStep;

    const waitForFrame = () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

    const timeLabel = (step) => {
      const stepVal = Math.max(1, Math.min(23, step ?? 1));
      const dayNames = ["Do", "Fr", "Sa", "So", "Mo", "Di", "Mi"];
      const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
      const period = stepVal % 2 === 1 ? "Morgen" : "Abend";
      return `Schritt ${stepVal}, ${dayNames[dayIndex]} ${period}`;
    };

    try {
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import("jspdf"),
        import("html2canvas").then((m) => m.default),
      ]);

      const notesWidth = 320;
      const margin = 32;
      const columnGap = 16;
      const rowGap = 16;
      const headerHeight = 40;

      const scaleToFit = (w, h, maxW, maxH) => {
        const ratio = Math.min(maxW / Math.max(w, 1), maxH / Math.max(h, 1), 1);
        return { w: w * ratio, h: h * ratio };
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

      const renderNotesImage = async (html, part, total) => {
        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "-9999px";
        wrapper.style.top = "0";
        wrapper.style.width = `${notesWidth}px`;
        wrapper.style.padding = "0";
        wrapper.style.boxSizing = "border-box";
        wrapper.style.background = "transparent";
        wrapper.style.border = "none";
        wrapper.style.fontFamily = 'Consolas, "Courier New", monospace';
        wrapper.style.fontSize = "13px";
        wrapper.style.lineHeight = "1.4";

        const style = document.createElement("style");
        style.innerHTML = `
    .notes-green { color: #2ecc71; }
    .notes-red { color: #e74c3c; }
    .notes-turquoise { color: #1abc9c; }
    .notes-yellow { color: #f1c40f; }
    .notes-placeholder { color: #94a3b8; }
  `;
        wrapper.appendChild(style);

        // Dark themed notes card, matching app
        const content = document.createElement("div");
        content.style.padding = "10px 12px";
        content.style.borderRadius = "10px";
        content.style.background = "#0f1e30"; // dark blue card
        content.style.border = "1px solid #1f3e63"; // theme border
        content.style.color = "#f3f6fb"; // default text white
        content.innerHTML =
          html || '<span class="notes-placeholder">Fuege Notizen hinzu</span>';

        wrapper.appendChild(content);

        document.body.appendChild(wrapper);
        await waitForFrame();
        const canvas = await html2canvas(wrapper, {
          backgroundColor: null,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        wrapper.remove();
        return {
          url: canvas.toDataURL("image/png"),
          width: canvas.width,
          height: canvas.height,
        };
      };

      const captureBoardImage = async (snapshot) => {
        const target = boardRef.current;
        if (!target) return null;
        applySnapshot(snapshot);
        setCheckpointIndex(null);
        await waitForFrame();
        await waitForFrame();

        const fullCanvas = await html2canvas(document.body, {
          backgroundColor: null,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });

        const rect = target.getBoundingClientRect();
        const cropCanvas = document.createElement("canvas");
        const cropWidth = Math.max(1, Math.round(rect.width));
        const cropHeight = Math.max(1, Math.round(rect.height));
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;

        const ctx = cropCanvas.getContext("2d");
        const offsetX = rect.left + window.scrollX;
        const offsetY = rect.top + window.scrollY;

        ctx.drawImage(
          fullCanvas,
          offsetX,
          offsetY,
          rect.width,
          rect.height,
          0,
          0,
          cropWidth,
          cropHeight
        );

        return {
          url: cropCanvas.toDataURL("image/png"),
          width: cropCanvas.width,
          height: cropCanvas.height,
        };
      };

      const capturedGroups = [];
      for (const group of grouped) {
        const total = group.items.length;
        const capturedItems = [];
        for (let i = 0; i < group.items.length; i += 1) {
          const cp = group.items[i];
          const part = i + 1;
          const notesHtml = formatNotesHtml(cp?.snapshot?.notes || "");
          const [notesImg, boardImg] = await Promise.all([
            renderNotesImage(notesHtml, part, total),
            captureBoardImage(cp.snapshot),
          ]);
          capturedItems.push({
            part,
            total,
            notesImg,
            boardImg,
          });
        }
        capturedGroups.push({
          timeStep: group.timeStep,
          label: timeLabel(group.timeStep),
          items: capturedItems,
        });
      }

      //const headerHeight = 40;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let firstPage = true;

      capturedGroups.forEach((group) => {
        for (let i = 0; i < group.items.length; i += 2) {
          const slice = group.items.slice(i, i + 2);
          if (!firstPage) {
            pdf.addPage("a4", "landscape");
          }
          firstPage = false;

          // full page background: lighter theme blue (#132f4c)
          pdf.setFillColor(19, 47, 76); // rgb of #132f4c
          pdf.rect(0, 0, pageWidth, pageHeight, "F");

          // header bar: darker blue (#0f1e30)
          pdf.setFillColor(15, 30, 48); // rgb of #0f1e30
          pdf.rect(0, 0, pageWidth, headerHeight, "F");

          // title in header
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(18);
          pdf.setTextColor(243, 246, 251); // #f3f6fb
          // baseline a bit below top of bar
          pdf.text(group.label, margin, headerHeight - 12);

          // layout math: content area starts below header + margin
          const availableHeight =
            pageHeight -
            margin * 2 -
            headerHeight -
            (slice.length === 2 ? rowGap : 0);

          const slotHeight =
            slice.length === 2 ? availableHeight / 2 : availableHeight;

          const contentStartY = headerHeight + margin;

          const boardMaxWidth = pageWidth - margin * 2 - notesWidth - columnGap;

          slice.forEach((item, idx) => {
            const slotY =
              contentStartY +
              (slice.length === 2 ? idx * (slotHeight + rowGap) : 0);

            const noteScaled = scaleToFit(
              item.notesImg?.width || 1,
              item.notesImg?.height || 1,
              notesWidth,
              slotHeight
            );
            const boardScaled = scaleToFit(
              item.boardImg?.width || 1,
              item.boardImg?.height || 1,
              boardMaxWidth,
              slotHeight
            );
            const contentHeight = Math.max(noteScaled.h, boardScaled.h);
            const offsetY = slotY + (slotHeight - contentHeight) / 2;

            // NEW: clearer subtitle
            if (item.total > 1) {
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(12);
              pdf.setTextColor(243, 246, 251); // white
              const subtitleY = offsetY - 6; // a bit above the notes card
              pdf.text(
                `Teil ${item.part} von ${item.total}`,
                margin,
                subtitleY
              );
            }

            if (item.notesImg) {
              pdf.addImage(
                item.notesImg.url,
                "PNG",
                margin,
                offsetY,
                noteScaled.w,
                noteScaled.h
              );
            }
            if (item.boardImg) {
              pdf.addImage(
                item.boardImg.url,
                "PNG",
                margin + notesWidth + columnGap,
                offsetY,
                boardScaled.w,
                boardScaled.h
              );
            }
          });
        }
      });

      pdf.save(`${loadName}_checkpoints.pdf`);
    } catch (e) {
      console.error("PDF Export fehlgeschlagen", e);
    } finally {
      applySnapshot(prevSnapshot);
      setTimeStep(prevTime);
      setCheckpointIndex(prevIndex);
      resumeCheckpointTracking();
      body.classList.remove("print-mode");
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
              <div className="carry-banner">
                Carrying {carried.def.name} - place, swap, or trash. Press Esc
                to cancel.
              </div>
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
            onLoad={handleLoadState}
            saves={saves}
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
      />
      <ExportSavesModal
        open={!!exportModal}
        saves={saves}
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
    </div>
  );
}

export default App;
