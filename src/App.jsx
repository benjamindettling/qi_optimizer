// Top-level app composition: assembles board, sidebar, toolbars, and modals.

import { useEffect, useRef, useState } from "react";
import "./index.css";
import { Board } from "./components/Board";
import { TopBar } from "./components/TopBar";
import { ShopSidebar } from "./components/ShopSidebar";
import { ActionToolbar } from "./components/ActionToolbar";
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
import { useGameController } from "./hooks/useGameController";

// Entry component that wires controller state into all UI pieces.
function App() {
  const [holdTooltip, setHoldTooltip] = useState(null);
  const holdTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const holdTriggeredRef = useRef(false);
  const {
    resources,
    layout,
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
    toolbarOffsetPx,
    statusOffsetPx,
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
    debugRegions,
    handleCellClick,
    handleUnlockRegion,
    toggleDebugRegions,
    handleDebugUnlockRegion,
    handleDebugLockRegion,
    toggleMove,
    toggleSell,
    toggleRefund,
    undoWithCleanup,
    redoWithCleanup,
    finishProductions,
    toggleBoost,
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
    isCellUnlocked,
    undoStack,
    redoStack,
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
  } = useGameController();

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

  return (
    <div className="page layout-row">
      <ShopSidebar
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        setSelectedBuildingId={setSelectedBuildingId}
        resources={resources}
        stats={stats}
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
        onResetModes={resetModes}
        debugRegions={debugRegions}
        onToggleDebugRegions={toggleDebugRegions}
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
          infiniteResources={infiniteResources}
          onToggleInfinite={handleToggleInfinite}
          useShortNames={useShortNames}
          setUseShortNames={setUseShortNames}
          onOpenConfig={() => setConfigModal(true)}
          onOpenHelp={() => setHelpModal(true)}
          boardScale={boardScale}
          setBoardScale={setBoardScale}
          onEditResource={handleEditResource}
          onEditGood={handleEditGood}
        />
        <div className="workspace">
          <div className="board-area">
            <Board
              viewRotation={viewRotation}
              boardTransform={boardTransform}
              viewWidth={viewWidth}
              viewHeight={viewHeight}
              viewColStart={viewColStart}
              viewRowStart={viewRowStart}
              cellSizePx={cellSizePx}
              previewOrigin={previewOrigin}
              isCellUnlocked={isCellUnlocked}
              handleCellClick={handleCellClick}
              setHoverCell={setHoverCell}
              onDropComplete={() => setSelectedBuildingId(null)}
              layout={layout}
              libraryMap={libraryMap}
              categoryColors={categoryColors}
              boardTransformClass={boardTransformClass}
              buildLocks={buildLocks}
              readyMap={readyMap}
              useShortNames={useShortNames}
            />
            {status && (
              <div
                className="status"
                style={{ marginTop: `${statusOffsetPx || 0}px` }}
              >
                {status}
              </div>
            )}
            {carried && (
              <div
                className="carry-banner"
                style={{ marginTop: `${statusOffsetPx || 0}px` }}
              >
                Carrying {carried.def.name} - place, swap, or trash. Press Esc
                to cancel.
              </div>
            )}
          </div>
          <ActionToolbar
            moveMode={moveMode}
            onToggleMove={toggleMove}
            sellMode={sellMode}
            refundMode={refundMode}
            onToggleSell={toggleSell}
            onToggleRefund={toggleRefund}
            onToggleBoost={toggleBoost}
            onUndo={undoWithCleanup}
            onRedo={redoWithCleanup}
            finishProductions={finishProductions}
            harvestIsPartial={harvestIsPartial}
            boostMode={boostMode}
            harvestAll={harvestAll}
            canUndo={!!undoStack.length}
            canRedo={!!redoStack.length}
            onSave={handleSaveState}
            onLoad={handleLoadState}
            saves={saves}
            loadName={loadName}
            setLoadName={setLoadName}
            toolbarOffset={toolbarOffsetPx}
            notes={notes}
            onChangeNotes={handleChangeNotes}
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
      <EditGoodModal
        modal={editGoodModal}
        onSave={(val) => applyGoodEdit(val, false)}
        onSaveAll={(val) => applyGoodEdit(val, true)}
        onClose={cancelEditGood}
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
    </div>
  );
}

export default App;
