// Top-level app composition: assembles board, sidebar, toolbars, and modals.

import "./index.css";
import { Board } from "./components/Board";
import { TopBar } from "./components/TopBar";
import { ShopSidebar } from "./components/ShopSidebar";
import { ActionToolbar } from "./components/ActionToolbar";
import { REGION_MASK, REGION_COLS } from "./config/boardConfig";
import { UnlockRegionModal } from "./components/modals/UnlockRegionModal";
import { ChooseGoodModal } from "./components/modals/ChooseGoodModal";
import { GoodsPurchaseModal } from "./components/modals/GoodsPurchaseModal";
import { FastBuyModal } from "./components/modals/FastBuyModal";
import { HarvestModal } from "./components/modals/HarvestModal";
import { HelpModal } from "./components/modals/HelpModal";
import { ConfigModal } from "./components/modals/ConfigModal";
import { useGameController } from "./hooks/useGameController";

// Entry component that wires controller state into all UI pieces.
function App() {
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
    setHoverCell,
    moveMode,
    sellMode,
    refundMode,
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
    harvestAll,
    confirmHarvest,
    cancelHarvest,
    handleSaveState,
    handleLoadState,
    deleteSave,
    handleGoodsPurchase,
    handleFastBuy,
    resetModes,
    handleEditResource,
    handleEditGood,
    isCellUnlocked,
    undoStack,
    redoStack,
    notes,
    handleChangeNotes,
    helpModal,
    setHelpModal,
    configModal,
    setConfigModal,
    config,
    updateConfig,
  } = useGameController();

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
          previewOrigin={previewOrigin}
          isCellUnlocked={isCellUnlocked}
          handleCellClick={handleCellClick}
          setHoverCell={setHoverCell}
          onDropComplete={() => setSelectedBuildingId(null)}
          layout={layout}
          libraryMap={libraryMap}
          categoryColors={categoryColors}
          boardTransformClass={boardTransformClass}
              readyMap={readyMap}
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
            onUndo={undoWithCleanup}
            onRedo={redoWithCleanup}
            finishProductions={finishProductions}
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
