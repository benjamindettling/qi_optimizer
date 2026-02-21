import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useGameController } from "../hooks/useGameController";
import { AppLayout } from "./layout/AppLayout";
import { AppModals } from "./layout/AppModals";
import { HoldTooltip } from "./ui/HoldTooltip";
import { PdfProgressModal } from "./ui/PdfProgressModal";
import { useHoldTooltip } from "./hooks/useHoldTooltip";
import { useHighlightMode } from "./hooks/useHighlightMode";
import { useSnapshotNavigation } from "./hooks/useSnapshotNavigation";
import { useBoardExport } from "./hooks/useBoardExport";
import { useAccountCloudSync } from "../hooks/useAccountCloudSync";
import { applyThemeToDocument, initializeCssColors } from "../config/colors";
import { StartingPage } from "../components/StartingPage/StartingPage";

// Entry component that wires controller state into all UI pieces.
export function AppRoot() {
  const boardRef = useRef(null);
  const topBarRef = useRef(null);
  const controller = useGameController();
  const adminMode = controller.infiniteResources;
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState("account");
  const navigate = useNavigate();
  const location = useLocation();
  const isSimulator = location.pathname === "/simulator";

  // Cloud sync for account settings (config + preferences)
  const {
    canCloudSave,
    saveNow: saveAccountToCloud,
    profile: cloudProfile,
  } = useAccountCloudSync({
    config: controller.config,
    replaceConfig: controller.replaceConfig,
    viewMode: controller.viewMode,
    setViewMode: controller.setViewMode,
    useShortNames: controller.useShortNames,
    setUseShortNames: controller.setUseShortNames,
    boardScale: controller.boardScale,
    setBoardScale: controller.setBoardScale,
  });

  const { tooltip } = useHoldTooltip();
  const { highlightMode, toggleHighlightMode, highlightedIds } =
    useHighlightMode({
      historyTree: controller.historyTree,
      selectedNodeId: controller.historyIndex,
      layout: controller.layout,
      libraryMap: controller.libraryMap,
    });

  const { handleSnapshotBack, handleSnapshotForward } = useSnapshotNavigation({
    snapshots: controller.snapshots,
    selectedSnapshotName: controller.selectedSnapshotName,
    setSelectedSnapshotName: controller.setSelectedSnapshotName,
    handleLoadState: controller.handleLoadState,
  });

  const { handlePrint, handleExportPdf, pdfProgress } = useBoardExport({
    boardRef,
    topBarRef,
    checkpoints: controller.checkpoints,
    loadName: controller.loadName,
    checkpointIndex: controller.checkpointIndex,
    setCheckpointIndex: controller.setCheckpointIndex,
    pauseCheckpointTracking: controller.pauseCheckpointTracking,
    resumeCheckpointTracking: controller.resumeCheckpointTracking,
    buildSnapshot: controller.buildSnapshot,
    applySnapshot: controller.applySnapshot,
    harvestFullForPdf: controller.harvestFullForPdf,
  });

  useEffect(() => {
    // Initialize CSS color variables from colors.js on mount
    initializeCssColors();
  }, []);

  useEffect(() => {
    // Apply theme colors when admin mode changes
    applyThemeToDocument(adminMode);
  }, [adminMode]);

  // Keep topbar height CSS variable updated
  useEffect(() => {
    const el = topBarRef.current;
    if (!el || typeof window === "undefined") return;
    const root = document.documentElement;

    const updateTopBarHeight = () => {
      const topBarHeight = el.getBoundingClientRect().height;
      root.style.setProperty("--topbar-height", `${topBarHeight}px`);
    };

    updateTopBarHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateTopBarHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSimulator]);

  // Observe the actual .board-content element and feed its real size
  // to the controller so the board scales fluidly — just like the tree.
  // Width: read from the element (stable — determined by flex layout, not content).
  // Height: capped to the element's width (board is square-ish) and also to
  //         the viewport-available height, whichever is smaller.  This prevents
  //         the board from extending vertically beyond its flex row.
  const boardContentRef = useRef(null);

  useEffect(() => {
    const el = boardContentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const EXPANSION_NOTICE_HEIGHT = 40;
    const WORKSPACE_PADDING = 32;

    const update = () => {
      const { width } = el.getBoundingClientRect();
      if (width < 1) return;

      // Viewport-based height ceiling
      const topBarH = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--topbar-height",
        ) || "60",
      );
      const viewportH = Math.max(
        240,
        window.innerHeight -
          topBarH -
          WORKSPACE_PADDING -
          EXPANSION_NOTICE_HEIGHT,
      );

      // Board height = min(element width, viewport available height).
      const availableH = Math.min(width, viewportH);

      controller.setContainerWidth(width);
      controller.setContainerHeight(availableH);

      // Publish the computed height as a CSS variable on :root so that
      // .board-content can use it as max-height without a resize loop.
      document.documentElement.style.setProperty(
        "--board-content-h",
        `${availableH + EXPANSION_NOTICE_HEIGHT + 8}px`,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [
    isSimulator,
    controller.setContainerHeight,
    controller.setContainerWidth,
  ]);

  const boardClusterRef = useRef(null);

  // Shop is now manually opened via button, no auto-open based on screen size

  // Wrapper to close shop when a building is selected
  const handleSetSelectedBuildingId = (defId) => {
    controller.setSelectedBuildingId(defId);
    if (defId !== null) {
      setIsShopOpen(false);
    }
  };

  // Cancel placement mode by clearing the selected building
  const handleCancelPlacement = () => {
    controller.setSelectedBuildingId(null);
  };

  // Check if we're in placement mode (a building is selected for placement)
  const isPlacementMode = controller.selectedBuildingId !== null;

  // Calculate if we should show the Sync Config button
  // Show when: savefile is loaded AND its config differs from user config
  const showSyncConfig = (() => {
    if (!controller.loadName || !controller.activeSaveConfig) return false;
    const fields = [
      "extraCoins",
      "extraSupplies",
      "goodsStartBonus",
      "troopsStartBonus",
      "coinBoost",
      "supplyBoost",
    ];
    return fields.some(
      (f) =>
        (controller.activeSaveConfig[f] ?? 0) !==
        (controller.userConfig?.[f] ?? 0),
    );
  })();

  // Handler to sync config - creates new savefile with user's config
  const handleSyncConfig = () => {
    controller.handleSyncConfig?.(controller.userConfig);
  };

  const openAccountModal = (tabKey = "account") => {
    setAccountInitialTab(tabKey);
    setAccountModalOpen(true);
  };

  const sidebarProps = {
    selectedCategory: controller.selectedCategory,
    setSelectedCategory: controller.setSelectedCategory,
    setSelectedBuildingId: handleSetSelectedBuildingId,
    resources: controller.resources,
    stats: controller.stats,
    editingLocked: controller.editingLocked,
    infiniteResources: controller.infiniteResources,
    viewMode: controller.viewMode,
    regionTransform: controller.regionTransform,
    unlockedRegions: controller.unlockedRegions,
    neighborUnlocked: controller.neighborUnlocked,
    currentGoodsCost: controller.currentGoodsCost,
    currentShardCost: controller.currentShardCost,
    goodsUnlocks: controller.goodsUnlocks,
    shardUnlocks: controller.shardUnlocks,
    onSetGoodsUnlocks: controller.setGoodsUnlocks,
    onSetShardUnlocks: controller.setShardUnlocks,
    canAnyUnlock: controller.canAnyUnlock,
    handleUnlockRegion: controller.handleUnlockRegion,
    adminMode,
    onResetModes: controller.resetModes,
    onDebugUnlockRegion: controller.handleDebugUnlockRegion,
    onDebugLockRegion: controller.handleDebugLockRegion,
  };

  const topBarProps = {
    resources: controller.resources,
    stats: controller.stats,
    happyInfo: controller.happyInfo,
    viewMode: controller.viewMode,
    setViewMode: controller.setViewMode,
    adminMode,
    onToggleAdmin: controller.handleToggleInfinite,
    useShortNames: controller.useShortNames,
    setUseShortNames: controller.setUseShortNames,
    onOpenHelp: () => controller.setHelpModal(true),
    onOpenAccount: () => openAccountModal("account"),
    onEditResource: controller.handleEditResource,
    onEditGood: controller.handleEditGood,
    onEditUnit: controller.handleEditUnit,
    editingLocked: controller.editingLocked,
    // Expansion costs
    currentGoodsCost: controller.currentGoodsCost,
    currentShardCost: controller.currentShardCost,
    goodsUnlocks: controller.goodsUnlocks,
    shardUnlocks: controller.shardUnlocks,
    onSetGoodsUnlocks: controller.setGoodsUnlocks,
    onSetShardUnlocks: controller.setShardUnlocks,
  };

  const boardProps = {
    viewRotation: controller.viewRotation,
    boardTransform: controller.boardTransform,
    rotatedWidthPx: controller.rotatedWidthPx,
    rotatedHeightPx: controller.rotatedHeightPx,
    viewWidth: controller.viewWidth,
    viewHeight: controller.viewHeight,
    viewColStart: controller.viewColStart,
    viewRowStart: controller.viewRowStart,
    cellSizePx: controller.cellSizePx,
    previewOrigin: controller.previewOrigin,
    isCellUnlocked: controller.isCellUnlocked,
    handleCellClick: controller.handleCellClick,
    setHoverCell: controller.setHoverCell,
    onDropComplete: () => controller.setSelectedBuildingId(null),
    boardRef,
    highlightedIds,
    layout: controller.layout,
    libraryMap: controller.libraryMap,
    categoryColors: controller.categoryColors,
    boardTransformClass: controller.boardTransformClass,
    buildLocks: controller.buildLocks,
    readyMap: controller.readyMap,
    useShortNames: controller.useShortNames,
    // Region props
    unlockedRegions: controller.unlockedRegions,
    neighborUnlocked: controller.neighborUnlocked,
    canAnyUnlock: controller.canAnyUnlock,
    onRegionClick: controller.handleUnlockRegion,
    adminMode,
    onDebugUnlockRegion: controller.handleDebugUnlockRegion,
    onDebugLockRegion: controller.handleDebugLockRegion,
    infiniteResources: controller.infiniteResources,
  };

  const toolbarProps = {
    moveMode: controller.moveMode,
    onToggleMove: controller.toggleMove,
    sellMode: controller.sellMode,
    refundMode: controller.refundMode,
    onToggleSell: controller.toggleSell,
    onToggleRefund: controller.toggleRefund,
    onToggleBoost: controller.toggleBoost,
    finishProductions: controller.finishProductions,
    harvestIsPartial: Object.values(controller.readyMap || {}).some(Boolean),
    harvestPartial: controller.harvestPartialOnly,
    boostMode: controller.boostMode,
    harvestAll: controller.harvestAll,
    onSave: controller.handleSaveState,
    onLoad: (name) =>
      controller.handleLoadState(name, { createSnapshot: true }),
    saves: controller.visibleSaves,
    snapshots: controller.snapshots,
    selectedSnapshotName: controller.selectedSnapshotName,
    onSnapshotBack: handleSnapshotBack,
    onSnapshotForward: handleSnapshotForward,
    loadName: controller.loadName,
    setLoadName: controller.setLoadName,
    notes: controller.notes,
    onChangeNotes: controller.handleChangeNotes,
    highlightMode,
    onToggleHighlightMode: toggleHighlightMode,
    onPrintBoard: handlePrint,
    onFindWorst: controller.openWorstModal,
    timeStep: controller.timeStep,
    canTimeBack: controller.canTimeBack,
    canTimeForward: controller.canTimeForward,
    onStepBack: controller.jumpBackTime,
    onStepForward: controller.jumpForwardTime,
    onAddCheckpoint: controller.addCheckpointPart,
    isLatestCheckpoint: controller.checkpointIndex === null,
    timePart: controller.currentPart,
    timePartTotal: controller.currentPartTotal,
    isPast: controller.isPast,
    editUnlocked: controller.editUnlocked,
    onOpenPastEditWarning: controller.openPastEditModal,
    editingLocked: controller.editingLocked,
    onOpenExport: controller.openExportSaves,
    onOpenImport: controller.openImportSaves,
    onOpenLoadSaves: controller.openLoadSavesModal,
    onExportPdf: handleExportPdf,
    isPlacementMode,
    onCancelPlacement: handleCancelPlacement,
    onDeleteSave: (name) => {
      controller.deleteSave(name);
      controller.setLoadName((prev) => (prev === name ? "" : prev));
    },
    hasUnsavedChanges: controller.hasUnsavedChanges,
  };

  const historyProps = {
    historyIndex: controller.historyIndex,
    historyTree: controller.historyTree,
    historyNodes: controller.historyNodes,
    historyInvalidSteps: controller.historyInvalidSteps,
    historyChecking: controller.historyChecking,
    onJumpHistory: controller.jumpToHistory,
    onMakeTop: controller.makeTopBranch,
    onCopyBranch: controller.copyBranchTo,
    onDeleteNode: controller.deleteNode,
    onApplyLayoutFix: controller.applyLayoutFix,
    libraryMap: controller.libraryMap,
    shortIdMap: controller.shortIdMap,
  };

  // NOTE: regionPanelProps removed - region functionality moved to Board overlays
  // and expansion costs moved under the Board.

  // ---- Route-based rendering ----
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <StartingPage
              config={controller.config}
              updateConfig={controller.updateConfig}
              onStartSimulator={() => navigate("/simulator")}
              onOpenSaves={() => controller.setLoadSavesModal(true)}
              onOpenAccount={openAccountModal}
            />
          }
        />
        <Route
          path="/simulator"
          element={
            <>
              <AppLayout
                sidebarProps={sidebarProps}
                topBarProps={topBarProps}
                boardProps={boardProps}
                toolbarProps={toolbarProps}
                historyProps={historyProps}
                status={controller.status}
                carried={controller.carried}
                topBarRef={topBarRef}
                boardClusterRef={boardClusterRef}
                boardContentRef={boardContentRef}
                isShopOpen={isShopOpen}
                onCloseShop={() => setIsShopOpen(false)}
                onOpenShop={() => setIsShopOpen(true)}
                config={controller.config}
                updateConfig={controller.updateConfig}
                toolbarPosition={controller.toolbarPosition}
                showSyncConfig={showSyncConfig}
                onSyncConfig={handleSyncConfig}
              />
              <HoldTooltip tooltip={tooltip} />
              <PdfProgressModal progress={pdfProgress} />
            </>
          }
        />
      </Routes>
      {/* Modals rendered on all routes so Account & LoadSaves work everywhere */}
      <AppModals
        controller={controller}
        accountModalOpen={accountModalOpen}
        accountInitialTab={accountInitialTab}
        setAccountModalOpen={setAccountModalOpen}
        viewMode={controller.viewMode}
        setViewMode={controller.setViewMode}
        useShortNames={controller.useShortNames}
        setUseShortNames={controller.setUseShortNames}
        toolbarPosition={controller.toolbarPosition}
        setToolbarPosition={controller.setToolbarPosition}
        boardScale={controller.boardScale}
        setBoardScale={controller.setBoardScale}
        saveAccountToCloud={saveAccountToCloud}
        canCloudSave={canCloudSave}
        cloudProfile={cloudProfile}
      />
    </>
  );
}
