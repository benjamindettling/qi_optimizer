import { useCallback, useRef, useEffect } from "react";
import { useGameState } from "./useGameState";
import { useResourceControls } from "./useResourceControls";
import { useSnapshotManager } from "./useSnapshotManager";
import { useGameStats } from "./useGameStats";
import { useCellAccess } from "./useCellAccess";
import { useRegionHandlers } from "./useRegionHandlers";
import { useEconomyHandlers } from "./useEconomyHandlers";
import { useSelectionHandlers } from "./useSelectionHandlers";
import { useModeHandlers } from "./useModeHandlers";
import { useAdminSettings } from "./useAdminSettings";
import { useAdminEditors } from "./useAdminEditors";
import { useCheckpointTools } from "./useCheckpointTools";
import { useProductionHandlers } from "./useProductionHandlers";
import { useSmartHarvest } from "./useSmartHarvest";
import { useSmartInvest } from "./useSmartInvest";
import { usePlacementHandlers } from "./usePlacementHandlers";
import { useViewHandlers } from "./useViewHandlers";
import { useNotesHandlers } from "./useNotesHandlers";
import { useSaveTransfer } from "./useSaveTransfer";
import { useMoveEscape } from "./useMoveEscape";
import { useActionHistory } from "./useActionHistory";
import { buildControllerReturn } from "./controllerReturn";

// Primary controller that exposes all state and actions for the app.
export const useGameController = () => {
  const state = useGameState();
  const moveChainRef = useRef([]);
  const clearMoveChain = useCallback(() => {
    moveChainRef.current = [];
  }, []);
  
  // Ref for loadHistoryTree - will be set after historyApi is created
  const loadHistoryTreeRef = useRef(null);
  const historyTreeRef = useRef(null);

  const resourceApi = useResourceControls({
    resources: state.resources,
    infiniteResources: state.infiniteResources,
    spendResources: state.spendResources,
    refundResources: state.refundResources,
    adjustGoods: state.adjustGoods,
    adjustUnits: state.adjustUnits,
  });

  const snapshotApi = useSnapshotManager({
    resources: state.resources,
    layout: state.layout,
    unlockedRegions: state.unlockedRegions,
    goodsUnlocks: state.goodsUnlocks,
    shardUnlocks: state.shardUnlocks,
    readyMap: state.readyMap,
    buildLocks: state.buildLocks,
    moveMode: state.moveMode,
    sellMode: state.sellMode,
    refundMode: state.refundMode,
    boostMode: state.boostMode,
    selectedCategory: state.selectedCategory,
    notes: state.notes,
    timeStep: state.timeStep,
    loadName: state.loadName,
    selectedBuildingId: state.selectedBuildingId,
    selectedIds: state.selectedIds,
    townhallDef: state.townhallDef,
    nextIdRef: state.nextIdRef,
    setResources: state.setResources,
    setLayout: state.setLayout,
    setUnlockedRegions: state.setUnlockedRegions,
    setGoodsUnlocks: state.setGoodsUnlocks,
    setShardUnlocks: state.setShardUnlocks,
    setReadyMap: state.setReadyMap,
    setBuildLocks: state.setBuildLocks,
    setMoveMode: state.setMoveMode,
    setSellMode: state.setSellMode,
    setRefundMode: state.setRefundMode,
    setBoostMode: state.setBoostMode,
    setSelectedCategory: state.setSelectedCategory,
    setTimeStep: state.setTimeStep,
    setLoadName: state.setLoadName,
    setNotes: state.setNotes,
    setSelectedIds: state.setSelectedIds,
    setSelectedBuildingId: state.setSelectedBuildingId,
    setCarried: state.setCarried,
    carried: state.carried,
    setMoveSnapshot: state.setMoveSnapshot,
    updateStatus: state.updateStatus,
    lastStatusRef: state.lastStatusRef,
    setPastEditModal: state.setPastEditModal,
    // Refs for history tree - will be populated after historyApi is created
    loadHistoryTreeRef,
    historyTreeRef,
    config: state.config,
    userConfig: state.userConfig,
    activeSaveConfig: state.activeSaveConfig,
    setActiveSaveConfig: state.setActiveSaveConfig,
  });

  const statsApi = useGameStats({
    layout: state.layout,
    buildLocks: state.buildLocks,
    libraryMap: state.libraryMap,
    config: state.config,
    setWorstModal: state.setWorstModal,
  });

  const historyApi = useActionHistory({
    layout: state.layout,
    readyMap: state.readyMap,
    buildLocks: state.buildLocks,
    goodsUnlocks: state.goodsUnlocks,
    shardUnlocks: state.shardUnlocks,
    libraryMap: state.libraryMap,
    shortIdMap: state.shortIdMap,
    stats: statsApi.stats,
    qaHoursPerHarvest: statsApi.qaHoursPerHarvest,
    infiniteResources: state.infiniteResources,
    config: state.config,
    applySpend: resourceApi.applySpend,
    applyRefund: resourceApi.applyRefund,
    setResources: state.setResources,
    setLayout: state.setLayout,
    setReadyMap: state.setReadyMap,
    setBuildLocks: state.setBuildLocks,
    setUnlockedRegions: state.setUnlockedRegions,
    setGoodsUnlocks: state.setGoodsUnlocks,
    setShardUnlocks: state.setShardUnlocks,
    nextIdRef: state.nextIdRef,
    configStartResources: state.configStartResources,
    configRevision: state.configRevision,
    townhallDef: state.townhallDef,
    setTimeStep: state.setTimeStep,
  });

  // Update refs so snapshotApi can access historyApi functions
  // Use effect to avoid updating refs during render
  useEffect(() => {
    loadHistoryTreeRef.current = historyApi.loadHistoryTree;
    historyTreeRef.current = historyApi.historyTree;
  }, [historyApi.loadHistoryTree, historyApi.historyTree]);

  const isCellUnlocked = useCellAccess({
    unlockedRegions: state.unlockedRegions,
  });

  const regionApi = useRegionHandlers({
    unlockedRegions: state.unlockedRegions,
    goodsUnlocks: state.goodsUnlocks,
    shardUnlocks: state.shardUnlocks,
    resources: state.resources,
    layout: state.layout,
    libraryMap: state.libraryMap,
    config: state.config,
    effectiveResources: resourceApi.effectiveResources,
    infiniteResources: state.infiniteResources,
    debugRegions: state.debugRegions,
    setUnlockedRegions: state.setUnlockedRegions,
    setGoodsUnlocks: state.setGoodsUnlocks,
    setShardUnlocks: state.setShardUnlocks,
    setResources: state.setResources,
    setUnlockChoice: state.setUnlockChoice,
    setUnlockGoodSelect: state.setUnlockGoodSelect,
    setFastBuyModal: state.setFastBuyModal,
    setFastBuyTarget: state.setFastBuyTarget,
    applyAdjustGoods: resourceApi.applyAdjustGoods,
    updateStatus: state.updateStatus,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    editingLocked: snapshotApi.editingLocked,
    recordHistoryAction: historyApi.recordHistoryAction,
  });

  const selectionApi = useSelectionHandlers({
    editingLocked: snapshotApi.editingLocked,
    updateStatus: state.updateStatus,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    setSelectedIds: state.setSelectedIds,
    setAutoSelectNew: state.setAutoSelectNew,
  });

  const modeApi = useModeHandlers({
    editingLocked: snapshotApi.editingLocked,
    updateStatus: state.updateStatus,
    moveMode: state.moveMode,
    carried: state.carried,
    moveSnapshot: state.moveSnapshot,
    applySnapshot: snapshotApi.applySnapshot,
    setMoveMode: state.setMoveMode,
    setSellMode: state.setSellMode,
    setRefundMode: state.setRefundMode,
    setBoostMode: state.setBoostMode,
    setSelectedBuildingId: state.setSelectedBuildingId,
    setCarried: state.setCarried,
    setMoveSnapshot: state.setMoveSnapshot,
    clearMoveChain,
  });

  useMoveEscape({
    moveSnapshot: state.moveSnapshot,
    applySnapshot: snapshotApi.applySnapshot,
    setCarried: state.setCarried,
    setMoveSnapshot: state.setMoveSnapshot,
    setMoveMode: state.setMoveMode,
    clearMoveChain,
  });

  const adminApi = useAdminSettings({
    editingLocked: snapshotApi.editingLocked,
    updateStatus: state.updateStatus,
    setInfiniteResources: state.setInfiniteResources,
  });

  const adminEditors = useAdminEditors({
    resources: state.resources,
    setResources: state.setResources,
    editResourceModal: state.editResourceModal,
    setEditResourceModal: state.setEditResourceModal,
    editGoodModal: state.editGoodModal,
    setEditGoodModal: state.setEditGoodModal,
    editUnitModal: state.editUnitModal,
    setEditUnitModal: state.setEditUnitModal,
    infiniteResources: state.infiniteResources,
    editingLocked: snapshotApi.editingLocked,
    updateStatus: state.updateStatus,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    branchFromPast: snapshotApi.branchFromPast,
    recordHistoryAction: historyApi.recordHistoryAction,
  });

  const checkpointTools = useCheckpointTools({
    editingLocked: snapshotApi.editingLocked,
    updateStatus: state.updateStatus,
    updateCheckpoints: snapshotApi.updateCheckpoints,
    setResources: state.setResources,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
  });

  const productionApi = useProductionHandlers({
    layout: state.layout,
    libraryMap: state.libraryMap,
    stats: statsApi.stats,
    resources: state.resources,
    buildLocks: state.buildLocks,
    readyMap: state.readyMap,
    setResources: state.setResources,
    setReadyMap: state.setReadyMap,
    setBuildLocks: state.setBuildLocks,
    setHarvestModal: state.setHarvestModal,
    setNotes: state.setNotes,
    setBoostMode: state.setBoostMode,
    setTimeStep: state.setTimeStep,
    setSelectedIds: state.setSelectedIds,
    setSelectedBuildingId: state.setSelectedBuildingId,
    infiniteResources: state.infiniteResources,
    applyConfigBoosts: statsApi.applyConfigBoosts,
    qaBasePerHour: statsApi.qaBasePerHour,
    qaHoursPerHarvest: statsApi.qaHoursPerHarvest,
    updateStatus: state.updateStatus,
    editingLocked: snapshotApi.editingLocked,
    branchFromPast: snapshotApi.branchFromPast,
    trimFutureCheckpoints: snapshotApi.trimFutureCheckpoints,
    setCheckpointIndex: snapshotApi.setCheckpointIndex,
    setEditUnlocked: snapshotApi.setEditUnlocked,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    recordHistoryAction: historyApi.recordHistoryAction,
  });

  const smartHarvestApi = useSmartHarvest({
    layout: state.layout,
    readyMap: state.readyMap,
    buildLocks: state.buildLocks,
    resources: state.resources,
    timeStep: state.timeStep,
    libraryMap: state.libraryMap,
    cloneResources: resourceApi.cloneResources,
    qaBasePerHour: statsApi.qaBasePerHour,
    qaHoursPerHarvest: statsApi.qaHoursPerHarvest,
    infiniteResources: state.infiniteResources,
    isCellUnlocked,
    applyConfigBoosts: statsApi.applyConfigBoosts,
    computeStatsWithLockedPeopleReq: statsApi.computeStatsWithLockedPeopleReq,
    setLayout: state.setLayout,
    setResources: state.setResources,
    setReadyMap: state.setReadyMap,
    setBuildLocks: state.setBuildLocks,
    setTimeStep: state.setTimeStep,
    setSmartHarvestModal: state.setSmartHarvestModal,
    setCheckpointIndex: snapshotApi.setCheckpointIndex,
    setEditUnlocked: snapshotApi.setEditUnlocked,
    branchFromPast: snapshotApi.branchFromPast,
    trimFutureCheckpoints: snapshotApi.trimFutureCheckpoints,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    updateStatus: state.updateStatus,
    editingLocked: snapshotApi.editingLocked,
    carried: state.carried,
    nextIdRef: state.nextIdRef,
  });

  const smartInvestApi = useSmartInvest({
    layout: state.layout,
    resources: state.resources,
    readyMap: state.readyMap,
    buildLocks: state.buildLocks,
    libraryMap: state.libraryMap,
    isCellUnlocked,
    timeStep: state.timeStep,
    nextIdRef: state.nextIdRef,
    cloneResources: resourceApi.cloneResources,
    infiniteResources: state.infiniteResources,
    runSmartHarvestSimulation: smartHarvestApi.runSmartHarvestSimulation,
    smartInvestRunningRef: state.smartInvestRunningRef,
    smartInvestStepResolveRef: state.smartInvestStepResolveRef,
    smartInvestResults: state.smartInvestResults,
    setSmartInvestRunning: state.setSmartInvestRunning,
    setSmartInvestResults: state.setSmartInvestResults,
    setSmartInvestModal: state.setSmartInvestModal,
    setLayout: state.setLayout,
    setResources: state.setResources,
    setReadyMap: state.setReadyMap,
    setBuildLocks: state.setBuildLocks,
    setTimeStep: state.setTimeStep,
    setSelectedIds: state.setSelectedIds,
    setSelectedBuildingId: state.setSelectedBuildingId,
    updateStatus: state.updateStatus,
    editingLocked: snapshotApi.editingLocked,
    carried: state.carried,
    trimFutureCheckpoints: snapshotApi.trimFutureCheckpoints,
    setCheckpointIndex: snapshotApi.setCheckpointIndex,
    setEditUnlocked: snapshotApi.setEditUnlocked,
    branchFromPast: snapshotApi.branchFromPast,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
  });

  const placementApi = usePlacementHandlers({
    layout: state.layout,
    carried: state.carried,
    libraryMap: state.libraryMap,
    isCellUnlocked,
    moveMode: state.moveMode,
    sellMode: state.sellMode,
    refundMode: state.refundMode,
    boostMode: state.boostMode,
    moveSnapshot: state.moveSnapshot,
    buildLocks: state.buildLocks,
    readyMap: state.readyMap,
    resources: state.resources,
    stats: statsApi.stats,
    selectedBuildingId: state.selectedBuildingId,
    autoSelectNew: state.autoSelectNew,
    infiniteResources: state.infiniteResources,
    config: state.config,
    effectiveResources: resourceApi.effectiveResources,
    applySpend: resourceApi.applySpend,
    applyRefund: resourceApi.applyRefund,
    setResources: state.setResources,
    setLayout: state.setLayout,
    setCarried: state.setCarried,
    setMoveMode: state.setMoveMode,
    setReadyMap: state.setReadyMap,
    setBuildLocks: state.setBuildLocks,
    setMoveSnapshot: state.setMoveSnapshot,
    setSelectedIds: state.setSelectedIds,
    setSelectedBuildingId: state.setSelectedBuildingId,
    setGoodsModal: state.setGoodsModal,
    setUnitModal: state.setUnitModal,
    updateStatus: state.updateStatus,
    harvestBuildings: productionApi.harvestBuildings,
    buildSnapshot: snapshotApi.buildSnapshot,
    overwriteCheckpointAtIndex: snapshotApi.overwriteCheckpointAtIndex,
    suppressNextCheckpoint: snapshotApi.suppressNextCheckpoint,
    branchFromPast: snapshotApi.branchFromPast,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    isPast: snapshotApi.isPast,
    nextIdRef: state.nextIdRef,
    recordHistoryAction: historyApi.recordHistoryAction,
    moveChainRef,
    applySnapshot: snapshotApi.applySnapshot,
    clearMoveChain,
  });

  const viewApi = useViewHandlers({
    hoverCell: state.hoverCell,
    carried: state.carried,
    selectedBuildingId: state.selectedBuildingId,
    libraryMap: state.libraryMap,
    categoryColors: state.categoryColors,
    unlockedRegions: state.unlockedRegions,
    viewMode: state.viewMode,
    boardScale: state.boardScale,
    containerHeight: state.containerHeight,
    containerWidth: state.containerWidth,
    isCellUnlocked,
  });

  const notesApi = useNotesHandlers({
    notes: state.notes,
    isPast: snapshotApi.isPast,
    overwriteCheckpointAtIndex: snapshotApi.overwriteCheckpointAtIndex,
    buildSnapshot: snapshotApi.buildSnapshot,
    setNotes: state.setNotes,
    updateStatus: state.updateStatus,
  });

  const economyApi = useEconomyHandlers({
    effectiveResources: resourceApi.effectiveResources,
    infiniteResources: state.infiniteResources,
    updateStatus: state.updateStatus,
    applySpend: resourceApi.applySpend,
    applyAdjustGoods: resourceApi.applyAdjustGoods,
    applyAdjustUnits: resourceApi.applyAdjustUnits,
    branchFromPast: snapshotApi.branchFromPast,
    requestAutoSnapshot: snapshotApi.requestAutoSnapshot,
    setUnlockedRegions: state.setUnlockedRegions,
    setGoodsUnlocks: state.setGoodsUnlocks,
    setFastBuyModal: state.setFastBuyModal,
    setFastBuyTarget: state.setFastBuyTarget,
    setUnlockChoice: state.setUnlockChoice,
    setUnlockGoodSelect: state.setUnlockGoodSelect,
    fastBuyModal: state.fastBuyModal,
    fastBuyTarget: state.fastBuyTarget,
    editingLocked: snapshotApi.editingLocked,
    recordHistoryAction: historyApi.recordHistoryAction,
  });

  const saveTransferApi = useSaveTransfer({
    saves: snapshotApi.saves,
    setAllSaves: snapshotApi.setAllSaves,
    setExportModal: state.setExportModal,
    setImportModal: state.setImportModal,
    setLoadSavesModal: state.setLoadSavesModal,
    // For tree serialization
    historyTree: historyApi.historyTree,
    config: state.config,
    loadHistoryTree: historyApi.loadHistoryTree,
    // For save name in export/import
    loadName: snapshotApi.loadName,
    setLoadName: snapshotApi.setLoadName,
    // For syncing config
    setActiveSaveConfig: state.setActiveSaveConfig,
  });

  return buildControllerReturn({
    state,
    statsApi,
    viewApi,
    regionApi,
    selectionApi,
    modeApi,
    productionApi,
    smartHarvestApi,
    smartInvestApi,
    notesApi,
    economyApi,
    adminEditors,
    adminApi,
    checkpointTools,
    snapshotApi,
    historyApi,
    isCellUnlocked,
    saveTransferApi,
    placementApi,
  });
};
